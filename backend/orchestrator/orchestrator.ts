/**
 * SPENDGUARDIAN — Core Orchestrator Engine
 *
 * Coordinates the 3 blocks via abstract adapters:
 *   orchestrator -> IBlock1Adapter -> Block 1
 *   orchestrator -> IBlock2Adapter -> Block 2
 *   orchestrator -> IBlock3Adapter -> Block 3
 *
 * Implements strict savings tracking (confirmed savings only on Block 3 success)
 * and emits structured workflow stages for UI consumption.
 */

import {
  Subscription,
  Transaction,
  EmailEvent,
  Guardrails,
  Decision,
  ActionResult,
  AuditEvent,
  SavingsSummary,
  WorkflowStageId,
  WorkflowProgress,
  WORKFLOW_STAGES_CONFIG,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  IBlock1Adapter,
  IBlock2Adapter,
  IBlock3Adapter,
} from '../adapters/interfaces.ts';
import { IDatabase } from '../database/interfaces.ts';
import {
  IOrchestrator,
  AuditRunOptions,
  AuditRunResult,
} from './interfaces.ts';
import {
  ActionEngine,
  IActionExecutionAdapter,
  ActionExecutionParams,
  ActionExecutionResponse,
} from '../block3-engine/index.ts';

/**
 * Adapter bridge allowing ActionEngine to execute through an IBlock3Adapter instance.
 */
class Block3AdapterBridge implements IActionExecutionAdapter {
  public readonly name: string;

  constructor(private readonly adapter: IBlock3Adapter) {
    this.name = adapter.name;
  }

  public async execute(params: ActionExecutionParams): Promise<ActionExecutionResponse> {
    const sub: Subscription = {
      subscription_id: params.subscriptionId,
      merchant: params.merchant,
      category: 'general',
      amount: params.amount,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 0,
      waste_score: 50,
      confidence: 90,
      risk: 'low',
      status: 'active',
      recommended_action: params.action === 'cancel' ? 'cancel' : 'review',
    };

    const decision: Decision = {
      subscription_id: params.subscriptionId,
      action: params.action === 'downgrade' ? 'downgrade' : 'cancel',
      confidence: 90,
      waste_score: 50,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: params.reason,
    };

    try {
      const resp = await this.adapter.executeAction(params.userId, sub, decision);
      const isSuccess = resp.status === 'success';
      return {
        action_id: resp.action_id,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        action: params.action,
        subscription_id: params.subscriptionId,
        merchant: params.merchant,
        monthly_savings: resp.monthly_savings,
        simulated: false,
        message: isSuccess ? 'Action executed successfully' : 'Action execution failed',
      };
    } catch (err: any) {
      return {
        action_id: `act_err_${Date.now()}`,
        status: 'FAILED',
        action: params.action,
        subscription_id: params.subscriptionId,
        merchant: params.merchant,
        monthly_savings: 0,
        simulated: false,
        message: err.message || 'Action adapter error',
        error_code: err.code || 'ACTION_FAILED',
      };
    }
  }
}

export class Orchestrator implements IOrchestrator {
  private readonly block1Adapter: IBlock1Adapter;
  private readonly block2Adapter: IBlock2Adapter;
  private readonly block3Adapter: IBlock3Adapter;
  private readonly database: IDatabase;
  public readonly block3Engine: ActionEngine;

  constructor(
    block1Adapter: IBlock1Adapter,
    block2Adapter: IBlock2Adapter,
    block3Adapter: IBlock3Adapter,
    database: IDatabase,
    block3Engine?: ActionEngine
  ) {
    this.block1Adapter = block1Adapter;
    this.block2Adapter = block2Adapter;
    this.block3Adapter = block3Adapter;
    this.database = database;
    this.block3Engine =
      block3Engine || new ActionEngine(database, new Block3AdapterBridge(block3Adapter));
  }

  private emitStage(
    stageId: WorkflowStageId,
    status: WorkflowProgress['status'],
    onProgress?: (progress: WorkflowProgress) => void,
    metadata?: Record<string, unknown>
  ): void {
    const config = WORKFLOW_STAGES_CONFIG.find((s) => s.stage === stageId);
    if (!config) return;

    const progress: WorkflowProgress = {
      stage: stageId,
      stageNumber: config.number,
      totalStages: 7,
      label: config.label,
      status,
      timestamp: new Date().toISOString(),
      metadata,
    };

    if (onProgress) {
      onProgress(progress);
    }
  }

  public async runSubscriptionAudit(options: AuditRunOptions): Promise<AuditRunResult> {
    const { userId, onProgress } = options;

    // Ensure database is initialized
    await this.database.initialize();

    // Retrieve or merge guardrails
    const activeGuardrails: Guardrails =
      options.guardrails || (await this.database.getGuardrails(userId));

    // STAGE 1: Analyzing transactions...
    this.emitStage(WorkflowStageId.ANALYZING_TRANSACTIONS, 'in_progress', onProgress);

    let transactions = options.transactions || [];
    if (transactions.length === 0) {
      transactions = await this.database.getTransactions(userId);
    }
    const emails: EmailEvent[] = options.emails || [];

    this.emitStage(
      WorkflowStageId.ANALYZING_TRANSACTIONS,
      'completed',
      onProgress,
      { transactionsCount: transactions.length, emailsCount: emails.length }
    );

    // STAGE 2: Detecting subscriptions... (BLOCK 1)
    this.emitStage(WorkflowStageId.DETECTING_SUBSCRIPTIONS, 'in_progress', onProgress);

    let subscriptions: Subscription[] = [];
    let detectedEvents: EmailEvent[] = [];

    try {
      const block1Result = await this.block1Adapter.analyzeSubscriptions(
        userId,
        transactions,
        emails
      );
      subscriptions = block1Result.subscriptions;
      detectedEvents = block1Result.events || emails;
      await this.database.saveSubscriptions(userId, subscriptions);
    } catch (err: unknown) {
      this.emitStage(WorkflowStageId.DETECTING_SUBSCRIPTIONS, 'failed', onProgress, {
        error: String(err),
      });
      throw err;
    }

    this.emitStage(
      WorkflowStageId.DETECTING_SUBSCRIPTIONS,
      'completed',
      onProgress,
      { subscriptionsDetected: subscriptions.length }
    );

    // If configured to stop after Block 1 (Phase 2 integration milestone), persist and return
    if (options.stopAfterBlock1) {
      const currentSavings = await this.database.getSavingsSummary(userId);
      const updatedSavings: SavingsSummary = {
        ...currentSavings,
        subscriptions_scanned: subscriptions.length,
        last_updated: new Date().toISOString(),
      };
      await this.database.saveSavingsSummary(userId, updatedSavings);

      await this.database.addAuditEvent(userId, {
        timestamp: new Date().toISOString(),
        merchant: 'Block 1 Detection Engine',
        action: 'audit_completed',
        status: 'completed',
        reason: `Detection completed. Identified ${subscriptions.length} recurring subscriptions. Awaiting Block 2 decision engine.`,
        savings: 0,
      });

      return {
        userId,
        subscriptions,
        decisions: [],
        autoExecutedActions: [],
        pendingApprovals: [],
        savings: updatedSavings,
        auditEvents: await this.database.getAuditEvents(userId),
        completedAt: new Date().toISOString(),
      };
    }

    // STAGE 3: Evaluating waste... (BLOCK 2)
    this.emitStage(WorkflowStageId.EVALUATING_WASTE, 'in_progress', onProgress);

    let decisions: Decision[] = [];
    try {
      const block2Result = await this.block2Adapter.evaluateSubscriptions(
        userId,
        subscriptions,
        detectedEvents,
        activeGuardrails
      );
      decisions = block2Result.decisions;
      await this.database.saveDecisions(userId, decisions);
    } catch (err: unknown) {
      this.emitStage(WorkflowStageId.EVALUATING_WASTE, 'failed', onProgress, {
        error: String(err),
      });
      throw err;
    }

    this.emitStage(
      WorkflowStageId.EVALUATING_WASTE,
      'completed',
      onProgress,
      { decisionsCount: decisions.length }
    );

    // STAGE 4: Checking guardrails...
    this.emitStage(WorkflowStageId.CHECKING_GUARDRAILS, 'in_progress', onProgress);

    // Calculate potential savings: sum of all recommendations suggesting cancel/downgrade
    let potentialSavingsTotal = 0;
    for (const d of decisions) {
      const sub = subscriptions.find((s) => s.subscription_id === d.subscription_id);
      if (sub && (d.action === 'cancel' || d.action === 'downgrade')) {
        potentialSavingsTotal += sub.amount;
      }
    }

    const currentSavings = await this.database.getSavingsSummary(userId);
    const updatedSavings: SavingsSummary = {
      ...currentSavings,
      potential_savings: Number(potentialSavingsTotal.toFixed(2)),
      last_updated: new Date().toISOString(),
    };
    await this.database.updateSavingsSummary(userId, updatedSavings);

    this.emitStage(
      WorkflowStageId.CHECKING_GUARDRAILS,
      'completed',
      onProgress,
      {
        potentialSavings: updatedSavings.potential_savings,
        guardrailsApplied: activeGuardrails,
      }
    );

    // Phase 3 Boundary: Stop after Block 2 decisions without invoking Block 3 execution
    if (options.stopAfterBlock2) {
      const pendingApprovals = decisions.filter(
        (d) => d.requires_approval || d.action === 'ask_user' || d.guardrail_status === 'requires_approval'
      );

      this.emitStage(WorkflowStageId.AUDIT_COMPLETE, 'completed', onProgress, {
        totalSubscriptions: subscriptions.length,
        totalDecisions: decisions.length,
        autoActions: 0,
        pendingApprovals: pendingApprovals.length,
        phase: 'block_2_decision_engine_complete',
      });

      const finalAuditEvents = await this.database.getAuditEvents(userId);

      return {
        userId,
        subscriptions,
        decisions,
        autoExecutedActions: [],
        pendingApprovals,
        savings: updatedSavings,
        auditEvents: finalAuditEvents,
        completedAt: new Date().toISOString(),
      };
    }

    // STAGE 5: Executing safe actions... (BLOCK 3)
    this.emitStage(WorkflowStageId.EXECUTING_SAFE_ACTIONS, 'in_progress', onProgress);

    const autoExecutedActions: ActionResult[] = [];
    const pendingApprovals: Decision[] = [];

    for (const decision of decisions) {
      const sub = subscriptions.find((s) => s.subscription_id === decision.subscription_id);
      if (!sub) continue;

      // Check if this decision is eligible for autonomous execution
      const isAutoActionCandidate =
        decision.action === 'cancel' &&
        decision.guardrail_status === 'passed' &&
        !decision.requires_approval &&
        sub.amount <= activeGuardrails.auto_action_limit &&
        decision.confidence >= activeGuardrails.minimum_confidence &&
        !activeGuardrails.protected_categories.includes(sub.category.toLowerCase());

      if (isAutoActionCandidate) {
        try {
          const execRes = await this.block3Engine.processDecision(userId, sub, {
            ...decision,
            decision: 'AUTO_CANCEL',
          });

          const actionResult: ActionResult = {
            action_id: execRes.action_id,
            subscription_id: sub.subscription_id,
            status: execRes.status === 'SUCCESS' ? 'success' : 'failed',
            action: 'cancel',
            reason: decision.reason,
            monthly_savings: execRes.monthly_savings,
            simulated: execRes.simulated,
            timestamp: execRes.timestamp,
          };

          autoExecutedActions.push(actionResult);
        } catch (execErr: unknown) {
          // Log execution error
          await this.database.addAuditEvent(userId, {
            timestamp: new Date().toISOString(),
            merchant: sub.merchant,
            action: 'auto_cancel',
            status: 'failed',
            reason: `Action execution error: ${(execErr as Error)?.message || String(execErr)}`,
            savings: 0,
            subscription_id: sub.subscription_id,
          });
        }
      } else {
        // Did not meet autonomous criteria: requires approval, escalate, or is blocked
        if (
          decision.guardrail_status === 'blocked' ||
          activeGuardrails.protected_categories.includes(sub.category.toLowerCase())
        ) {
          await this.block3Engine.processDecision(userId, sub, {
            ...decision,
            decision: 'PROTECTED',
          });
        } else if (decision.decision === 'ESCALATE') {
          await this.block3Engine.processDecision(userId, sub, decision);
        } else if (decision.requires_approval || decision.guardrail_status === 'requires_approval') {
          await this.block3Engine.processDecision(userId, sub, {
            ...decision,
            decision: 'REQUIRE_APPROVAL',
          });
          pendingApprovals.push(decision);
        }
      }
    }

    this.emitStage(
      WorkflowStageId.EXECUTING_SAFE_ACTIONS,
      'completed',
      onProgress,
      { autoExecutedCount: autoExecutedActions.length }
    );

    // STAGE 6: Preparing approval requests...
    this.emitStage(WorkflowStageId.PREPARING_APPROVAL_REQUESTS, 'in_progress', onProgress);

    this.emitStage(
      WorkflowStageId.PREPARING_APPROVAL_REQUESTS,
      'completed',
      onProgress,
      { pendingApprovalsCount: pendingApprovals.length }
    );

    // STAGE 7: Audit complete.
    this.emitStage(WorkflowStageId.AUDIT_COMPLETE, 'completed', onProgress, {
      totalSubscriptions: subscriptions.length,
      autoActions: autoExecutedActions.length,
      pendingApprovals: pendingApprovals.length,
    });

    const finalSavings = await this.database.getSavingsSummary(userId);
    const finalAuditEvents = await this.database.getAuditEvents(userId);

    return {
      userId,
      subscriptions,
      decisions,
      autoExecutedActions,
      pendingApprovals,
      savings: finalSavings,
      auditEvents: finalAuditEvents,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * User approved an action from the Action Center (e.g. CASE 2 music overlap choice).
   * Executes Block 3 on demand and credits confirmed savings ONLY on success.
   */
  public async executeUserApprovedAction(
    userId: string,
    subscriptionId: string,
    decisionOverride?: Partial<Decision>
  ): Promise<ActionResult> {
    await this.database.initialize();

    const sub = await this.database.getSubscriptionById(userId, subscriptionId);
    if (!sub) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
        `Subscription "${subscriptionId}" not found in database for user "${userId}"`,
        { subscriptionId, userId }
      );
    }

    // Resolve any corresponding pending approval request in SQLite
    const approvalRequests = await this.database.getApprovalRequests(userId);
    const pendingReq = approvalRequests.find(
      (r) => r.subscription_id === subscriptionId && r.status === 'PENDING'
    );
    if (pendingReq) {
      pendingReq.status = 'APPROVED';
      pendingReq.resolved_at = new Date().toISOString();
      await this.database.updateApprovalRequest(userId, pendingReq);
    }

    const storedDecision =
      (await this.database.getDecisionBySubscriptionId(userId, subscriptionId)) || {
        subscription_id: subscriptionId,
        action: 'cancel' as const,
        reason: 'User explicitly confirmed cancellation in Action Center',
        waste_score: sub.waste_score,
        confidence: 100,
        risk: sub.risk,
        requires_approval: false,
        guardrail_status: 'passed' as const,
      };

    const effectiveDecision: Decision = {
      ...storedDecision,
      ...decisionOverride,
    };

    const block3Response = await this.block3Adapter.executeAction(
      userId,
      sub,
      effectiveDecision
    );

    const actionResult: ActionResult = {
      action_id: block3Response.action_id,
      subscription_id: sub.subscription_id,
      status: block3Response.status,
      action: 'cancel',
      reason: effectiveDecision.reason,
      monthly_savings: block3Response.monthly_savings,
      simulated: false,
      timestamp: new Date().toISOString(),
    };

    await this.database.saveActionResult(userId, actionResult);

    if (block3Response.status === 'success' && block3Response.monthly_savings > 0) {
      await this.database.recordConfirmedSavings(userId, block3Response.monthly_savings);

      await this.database.addAuditEvent(userId, {
        timestamp: new Date().toISOString(),
        merchant: sub.merchant,
        action: 'user_approved_cancel',
        status: 'success',
        reason: `User approved: ${effectiveDecision.reason}`,
        savings: block3Response.monthly_savings,
        subscription_id: sub.subscription_id,
      });
    } else {
      await this.database.addAuditEvent(userId, {
        timestamp: new Date().toISOString(),
        merchant: sub.merchant,
        action: 'user_approved_cancel',
        status: 'failed',
        reason: `Execution failed. Block 3 status: ${block3Response.status}`,
        savings: 0,
        subscription_id: sub.subscription_id,
      });
    }

    return actionResult;
  }

  public async getSystemStatus(): Promise<{
    status: 'ready' | 'degraded' | 'error';
    adapters: {
      block1: { name: string; url: string };
      block2: { name: string; url: string };
      block3: { name: string; url: string };
    };
  }> {
    return {
      status: 'ready',
      adapters: {
        block1: { name: this.block1Adapter.name, url: this.block1Adapter.baseUrl },
        block2: { name: this.block2Adapter.name, url: this.block2Adapter.baseUrl },
        block3: { name: this.block3Adapter.name, url: this.block3Adapter.baseUrl },
      },
    };
  }
}
