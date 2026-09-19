/**
 * SPENDGUARDIAN — Block 3 Action Execution & Escalation Engine
 *
 * Core engine responsible for:
 * 1. Consuming structured Block 2 decisions without recalculating scores/guardrails
 * 2. Dispatching autonomous actions (AUTO_CANCEL, AUTO_DOWNGRADE) via action adapters
 * 3. Enforcing the strict savings invariant (confirmed_savings ONLY increases upon successful execution)
 * 4. Action idempotency (preventing duplicate execution & double-counting savings)
 * 5. Creating and tracking human-in-the-loop approval workflows (REQUIRE_APPROVAL)
 * 6. Managing escalation records (ESCALATE)
 * 7. Shielding protected items from autonomous actions (PROTECTED)
 * 8. Comprehensive audit logging for every lifecycle event
 */

import { IDatabase } from '../database/interfaces.ts';
import {
  Subscription,
  Decision,
  ActionResult,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  Block3DecisionState,
  Block3ExecutionResult,
  Block3ExecutionStatus,
  Block3ActionType,
  ApprovalRequest,
  EscalationRecord,
  ActionExecutionResponse,
} from './action-types.ts';
import { IActionExecutionAdapter } from './action-adapter.ts';
import { MockActionAdapter } from './mock-action-adapter.ts';
import { EscalationEngine } from './escalation-engine.ts';

export class ActionEngine {
  public readonly actionAdapter: IActionExecutionAdapter;
  public readonly escalationEngine: EscalationEngine;

  constructor(
    private readonly database: IDatabase,
    actionAdapter?: IActionExecutionAdapter
  ) {
    this.actionAdapter = actionAdapter || new MockActionAdapter();
    this.escalationEngine = new EscalationEngine(this.database);
  }

  /**
   * Processes a structured Block 2 decision according to its state.
   */
  public async processDecision(
    userId: string,
    subscription: Subscription,
    decision: Decision
  ): Promise<Block3ExecutionResult> {
    const timestamp = new Date().toISOString();

    // 1. Validation: Subscription check
    if (!subscription || !subscription.subscription_id) {
      const err = new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
        'Missing or invalid subscription object for Block 3 action execution'
      );
      return {
        action_id: `act_err_${Date.now()}`,
        status: 'FAILED',
        action: 'none',
        subscription_id: subscription?.subscription_id || '',
        merchant: subscription?.merchant || 'Unknown',
        monthly_savings: 0,
        simulated: true,
        message: err.message,
        error_code: SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
        timestamp,
      };
    }

    // 2. Validation: Decision check
    if (!decision || !decision.subscription_id) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_REQUIRED_FIELD,
        'Decision must contain a valid subscription_id',
        { decision }
      );
    }

    if (!decision.action) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_REQUIRED_FIELD,
        'Decision must contain an action property',
        { decision }
      );
    }

    // 3. Determine canonical Block 3 decision state
    const decisionState = this.resolveDecisionState(subscription, decision);

    // 4. Handle PROTECTED state
    if (decisionState === 'PROTECTED') {
      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: subscription.merchant,
        action: 'ACTION_BLOCKED',
        status: 'blocked',
        reason: decision.reason || `${subscription.merchant} is protected by user policy. Autonomous action blocked.`,
        savings: 0,
        subscription_id: subscription.subscription_id,
      });

      return {
        action_id: `act_prot_${subscription.subscription_id}`,
        status: 'PROTECTED',
        action: 'keep',
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: true,
        message: 'Subscription is protected by guardrail policy. No action taken.',
        reason: decision.reason,
        timestamp,
      };
    }

    // 5. Handle ESCALATE state
    if (decisionState === 'ESCALATE') {
      const escalation = await this.escalationEngine.createEscalation(userId, subscription, decision);
      return {
        action_id: escalation.escalation_id,
        escalation_id: escalation.escalation_id,
        status: 'ESCALATED',
        action: (decision.action as Block3ActionType) || 'none',
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: true,
        message: `Escalation record created: ${escalation.reason}`,
        reason: escalation.reason,
        timestamp,
      };
    }

    // 6. Handle REQUIRE_APPROVAL state
    if (decisionState === 'REQUIRE_APPROVAL') {
      const approvalId = `appr_${subscription.subscription_id}_${Date.now()}`;
      const approvalReq: ApprovalRequest = {
        approval_id: approvalId,
        user_id: userId,
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        requested_action: decision.action === 'ask_user' ? 'review' : decision.action,
        monthly_savings: Number(subscription.amount.toFixed(2)),
        reason: decision.reason || 'Requires explicit human confirmation before execution',
        created_at: timestamp,
        status: 'PENDING',
        decision,
      };

      await this.database.saveApprovalRequest(userId, approvalReq);

      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: subscription.merchant,
        action: 'APPROVAL_REQUESTED',
        status: 'pending',
        reason: approvalReq.reason,
        savings: 0,
        subscription_id: subscription.subscription_id,
      });

      return {
        action_id: approvalId,
        approval_id: approvalId,
        status: 'PENDING_APPROVAL',
        action: (decision.action as Block3ActionType) || 'keep',
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: true,
        message: 'Approval request generated. Pending explicit user direction.',
        reason: decision.reason,
        timestamp,
      };
    }

    // 7. Handle NO_ACTION state
    if (decisionState === 'NO_ACTION') {
      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: subscription.merchant,
        action: 'NO_ACTION',
        status: 'completed',
        reason: decision.reason || 'Subscription usage active. Retained per policy.',
        savings: 0,
        subscription_id: subscription.subscription_id,
      });

      return {
        action_id: `act_none_${subscription.subscription_id}`,
        status: 'NO_ACTION',
        action: 'keep',
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: true,
        message: 'No action required. Subscription retained.',
        reason: decision.reason,
        timestamp,
      };
    }

    // 8. IDEMPOTENCY CHECK for AUTO_CANCEL / AUTO_DOWNGRADE
    const existingResult = await this.database.getActionResultBySubscriptionId(
      userId,
      subscription.subscription_id
    );

    if (existingResult && existingResult.status === 'success') {
      // Already successfully executed. Invariant: DO NOT execute again, DO NOT add savings again!
      return {
        action_id: existingResult.action_id,
        status: 'SUCCESS',
        action: existingResult.action as Block3ActionType,
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0, // Idempotent: 0 new savings added on duplicate call!
        simulated: existingResult.simulated,
        message: 'Action already successfully executed previously (idempotent replay)',
        reason: existingResult.reason,
        timestamp: existingResult.timestamp,
        idempotent_replayed: true,
      };
    }

    // 9. EXECUTE ACTION via Adapter (AUTO_CANCEL or AUTO_DOWNGRADE)
    const targetAction = decisionState === 'AUTO_DOWNGRADE' ? 'downgrade' : 'cancel';
    const downgradeTargetAmount =
      decision.downgrade_target_amount !== undefined
        ? decision.downgrade_target_amount
        : decision.estimated_monthly_savings !== undefined
        ? Math.max(0, Number((subscription.amount - decision.estimated_monthly_savings).toFixed(2)))
        : undefined;

    let execResponse: ActionExecutionResponse;
    try {
      execResponse = await this.actionAdapter.execute({
        userId,
        subscriptionId: subscription.subscription_id,
        merchant: subscription.merchant,
        action: targetAction,
        amount: subscription.amount,
        reason: decision.reason,
        downgradeTargetAmount,
      });
    } catch (err: any) {
      execResponse = {
        action_id: `act_err_${Date.now()}`,
        status: 'FAILED',
        action: targetAction,
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: false,
        message: err.message || 'Action adapter error',
        error_code: 'ACTION_EXECUTION_FAILED',
      };
    }

    const isSuccess = execResponse.status === 'SUCCESS';

    const actionResult: ActionResult = {
      action_id: execResponse.action_id,
      subscription_id: subscription.subscription_id,
      status: isSuccess ? 'success' : 'failed',
      action: targetAction === 'downgrade' ? 'negotiate' : 'cancel',
      reason: decision.reason,
      monthly_savings: isSuccess ? execResponse.monthly_savings : 0,
      simulated: execResponse.simulated,
      timestamp,
    };

    // Persist action result in SQLite
    await this.database.saveActionResult(userId, actionResult);

    if (isSuccess && execResponse.monthly_savings > 0) {
      // STRICT SAVINGS INVARIANT: confirmed savings updates ONLY on success!
      await this.database.recordConfirmedSavings(userId, execResponse.monthly_savings);

      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: subscription.merchant,
        action: targetAction === 'downgrade' ? 'auto_downgrade' : 'auto_cancel',
        status: 'success',
        reason: decision.reason,
        savings: execResponse.monthly_savings,
        subscription_id: subscription.subscription_id,
      });

      return {
        action_id: execResponse.action_id,
        status: 'SUCCESS',
        action: targetAction,
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: execResponse.monthly_savings,
        simulated: execResponse.simulated,
        message: execResponse.message,
        reason: decision.reason,
        timestamp,
      };
    } else {
      // Action failed
      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: subscription.merchant,
        action: targetAction === 'downgrade' ? 'auto_downgrade' : 'auto_cancel',
        status: 'failed',
        reason: `Action execution failed: ${execResponse.message}`,
        savings: 0,
        subscription_id: subscription.subscription_id,
      });

      return {
        action_id: execResponse.action_id,
        status: 'FAILED',
        action: targetAction,
        subscription_id: subscription.subscription_id,
        merchant: subscription.merchant,
        monthly_savings: 0,
        simulated: execResponse.simulated,
        message: execResponse.message,
        reason: decision.reason,
        error_code: execResponse.error_code || 'ACTION_EXECUTION_FAILED',
        timestamp,
      };
    }
  }

  /**
   * Approves a pending approval request and executes the merchant action.
   */
  public async approveApprovalRequest(
    userId: string,
    approvalId: string,
    options?: { actionOverride?: 'cancel' | 'downgrade' }
  ): Promise<Block3ExecutionResult> {
    const timestamp = new Date().toISOString();
    const req = await this.database.getApprovalRequestById(userId, approvalId);

    if (!req) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.APPROVAL_NOT_FOUND,
        `Approval request "${approvalId}" not found`,
        { approvalId, userId }
      );
    }

    if (req.status !== 'PENDING') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_APPROVAL_STATUS,
        `Approval request "${approvalId}" cannot be approved because it is already "${req.status}"`,
        { approvalId, currentStatus: req.status }
      );
    }

    // Mark approval request as APPROVED
    req.status = 'APPROVED';
    req.resolved_at = timestamp;
    await this.database.updateApprovalRequest(userId, req);

    await this.database.addAuditEvent(userId, {
      timestamp,
      merchant: req.merchant,
      action: 'APPROVAL_APPROVED',
      status: 'completed',
      reason: `User explicitly approved action for ${req.merchant}`,
      savings: 0,
      subscription_id: req.subscription_id,
    });

    const targetAction = options?.actionOverride || (req.requested_action === 'downgrade' ? 'downgrade' : 'cancel');

    // Execute merchant action
    let execResponse: ActionExecutionResponse;
    try {
      execResponse = await this.actionAdapter.execute({
        userId,
        subscriptionId: req.subscription_id,
        merchant: req.merchant,
        action: targetAction,
        amount: req.monthly_savings,
        reason: req.reason,
      });
    } catch (err: any) {
      execResponse = {
        action_id: `act_err_${Date.now()}`,
        status: 'FAILED',
        action: targetAction,
        subscription_id: req.subscription_id,
        merchant: req.merchant,
        monthly_savings: 0,
        simulated: false,
        message: err.message || 'Action adapter error',
        error_code: 'ACTION_EXECUTION_FAILED',
      };
    }

    const isSuccess = execResponse.status === 'SUCCESS';

    const actionResult: ActionResult = {
      action_id: execResponse.action_id,
      subscription_id: req.subscription_id,
      status: isSuccess ? 'success' : 'failed',
      action: targetAction === 'downgrade' ? 'negotiate' : 'cancel',
      reason: `User approved: ${req.reason}`,
      monthly_savings: isSuccess ? execResponse.monthly_savings : 0,
      simulated: execResponse.simulated,
      timestamp,
    };

    await this.database.saveActionResult(userId, actionResult);

    if (isSuccess && execResponse.monthly_savings > 0) {
      await this.database.recordConfirmedSavings(userId, execResponse.monthly_savings);

      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: req.merchant,
        action: 'ACTION_SUCCESS',
        status: 'success',
        reason: `User approved ${targetAction}: ${req.reason}`,
        savings: execResponse.monthly_savings,
        subscription_id: req.subscription_id,
      });

      return {
        action_id: execResponse.action_id,
        status: 'SUCCESS',
        action: targetAction,
        subscription_id: req.subscription_id,
        merchant: req.merchant,
        monthly_savings: execResponse.monthly_savings,
        simulated: execResponse.simulated,
        message: execResponse.message,
        timestamp,
      };
    } else {
      await this.database.addAuditEvent(userId, {
        timestamp,
        merchant: req.merchant,
        action: 'ACTION_FAILED',
        status: 'failed',
        reason: `User approved action failed during execution: ${execResponse.message}`,
        savings: 0,
        subscription_id: req.subscription_id,
      });

      return {
        action_id: execResponse.action_id,
        status: 'FAILED',
        action: targetAction,
        subscription_id: req.subscription_id,
        merchant: req.merchant,
        monthly_savings: 0,
        simulated: execResponse.simulated,
        message: execResponse.message,
        error_code: execResponse.error_code || 'ACTION_EXECUTION_FAILED',
        timestamp,
      };
    }
  }

  /**
   * Rejects a pending approval request. No merchant action is executed;
   * confirmed savings remains completely unchanged.
   */
  public async rejectApprovalRequest(
    userId: string,
    approvalId: string,
    reason = 'User explicitly rejected action'
  ): Promise<ApprovalRequest> {
    const timestamp = new Date().toISOString();
    const req = await this.database.getApprovalRequestById(userId, approvalId);

    if (!req) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.APPROVAL_NOT_FOUND,
        `Approval request "${approvalId}" not found`,
        { approvalId, userId }
      );
    }

    if (req.status !== 'PENDING') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_APPROVAL_STATUS,
        `Approval request "${approvalId}" cannot be rejected because it is already "${req.status}"`,
        { approvalId, currentStatus: req.status }
      );
    }

    req.status = 'REJECTED';
    req.resolved_at = timestamp;
    req.reason = `${req.reason} (Rejected: ${reason})`;
    await this.database.updateApprovalRequest(userId, req);

    await this.database.addAuditEvent(userId, {
      timestamp,
      merchant: req.merchant,
      action: 'APPROVAL_REJECTED',
      status: 'completed',
      reason,
      savings: 0,
      subscription_id: req.subscription_id,
    });

    return req;
  }

  /**
   * Resolves the decision state from the decision object and subscription.
   */
  private resolveDecisionState(subscription: Subscription, decision: Decision): Block3DecisionState {
    // 1. Explicit decision field check
    if (decision.decision) {
      return decision.decision as Block3DecisionState;
    }

    // 2. Protected category
    if (
      decision.guardrail_status === 'blocked' ||
      subscription.category === 'insurance' ||
      subscription.category === 'loan_payment'
    ) {
      return 'PROTECTED';
    }

    // 3. Escalation check
    if (decision.action === ('escalate' as any) || (decision.risk === 'high' && decision.waste_score >= 80 && decision.confidence < 70)) {
      return 'ESCALATE';
    }

    // 4. Require approval check
    if (
      decision.requires_approval ||
      decision.action === 'ask_user' ||
      decision.guardrail_status === 'requires_approval'
    ) {
      return 'REQUIRE_APPROVAL';
    }

    // 5. Auto downgrade
    if (decision.action === 'downgrade' && decision.guardrail_status === 'passed') {
      return 'AUTO_DOWNGRADE';
    }

    // 6. Auto cancel
    if (decision.action === 'cancel' && decision.guardrail_status === 'passed') {
      return 'AUTO_CANCEL';
    }

    // 7. No action
    return 'NO_ACTION';
  }
}
