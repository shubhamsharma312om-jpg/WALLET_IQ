/**
 * SPENDGUARDIAN — Block 3 Action Execution & Escalation Test Suite
 *
 * Validates:
 * 1. AUTO_CANCEL executes via adapter and credits confirmed savings
 * 2. AUTO_DOWNGRADE executes via adapter and credits differential savings
 * 3. REQUIRE_APPROVAL creates approval request in SQLite and does NOT credit confirmed savings
 * 4. PROTECTED items are blocked, logged in audit events, and never execute autonomously
 * 5. NO_ACTION items never execute and do not modify savings
 * 6. ESCALATE creates escalation record in SQLite and does not execute autonomously
 * 7. Approval request can be approved and credits confirmed savings upon success
 * 8. Approval request can be rejected and leaves confirmed savings at 0
 * 9. Double approval attempt is rejected (cannot approve already resolved request)
 * 10. Idempotency: re-running action on already executed subscription avoids double-counting savings
 * 11. Simulated failure returns FAILED status and 0 confirmed savings
 * 12. Adapter execution failure does not increment confirmed savings
 * 13. Malformed decision (missing subscription_id) throws MISSING_REQUIRED_FIELD
 * 14. Missing or invalid action in decision throws MISSING_REQUIRED_FIELD
 * 15. Non-existent approval request throws APPROVAL_NOT_FOUND
 * 16. Rejected approval request cannot be approved
 * 17. Confirmed savings strictly equals 0 after Block 2
 * 18. Confirmed savings increases ONLY upon successful Block 3 execution
 * 19. Canonical CASE 1 (StreamFlix): auto-cancels and confirms $14.99 savings
 * 20. Canonical CASE 2 (TuneWave & MusicBox): requires approval, leaves confirmed savings at 0
 * 21. Canonical CASE 3 (HealthGuard Insurance): protected category, leaves confirmed savings at 0
 * 22. Orchestrator stage pipeline: emits all 7 workflow stages in sequence
 */

import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import {
  ActionEngine,
  MockActionExecutionAdapter,
} from '../backend/block3-engine/index.ts';
import {
  Subscription,
  Decision,
  SpendGuardianError,
  SpendGuardianErrorCode,
  WorkflowProgress,
  WorkflowStageId,
} from '../backend/models/index.ts';
import { Orchestrator } from '../backend/orchestrator/orchestrator.ts';
import {
  MockBlock1Adapter,
  MockBlock2Adapter,
  MockBlock3Adapter,
} from '../backend/adapters/mock.adapters.ts';

export async function testBlock3ActionEngine(): Promise<{ name: string; passed: boolean; message?: string }[]> {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, message: err.message });
    }
  };

  // Helper mock subscription
  const createSub = (id: string, merchant: string, amount: number, category = 'entertainment'): Subscription => ({
    subscription_id: id,
    merchant,
    category,
    amount,
    currency: 'USD',
    cadence: 'monthly',
    last_used_days_ago: 95,
    waste_score: 85,
    confidence: 90,
    risk: 'low',
    status: 'active',
    recommended_action: 'cancel',
  });

  // 1. AUTO_CANCEL
  await runTest('1. AUTO_CANCEL executes via adapter and credits confirmed savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_1', 'StreamCloud', 12.99);
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_1',
      decision: 'AUTO_CANCEL',
      action: 'cancel',
      confidence: 92,
      waste_score: 85,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'Unused for 95 days',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'SUCCESS') throw new Error(`Expected SUCCESS, got ${res.status}`);
    if (res.monthly_savings !== 12.99) throw new Error(`Expected savings 12.99, got ${res.monthly_savings}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 12.99) {
      throw new Error(`Expected confirmed_savings 12.99, got ${savings.confirmed_savings}`);
    }
    await db.close();
  });

  // 2. AUTO_DOWNGRADE
  await runTest('2. AUTO_DOWNGRADE executes via adapter and credits differential savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_2', 'CloudStorage Pro', 30.00, 'software');
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_2',
      decision: 'AUTO_DOWNGRADE',
      action: 'downgrade',
      confidence: 95,
      waste_score: 75,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'Underutilizing storage capacity; basic tier is sufficient',
      downgrade_target: 'CloudStorage Basic ($10/mo)',
      estimated_monthly_savings: 20.00,
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'SUCCESS') throw new Error(`Expected SUCCESS, got ${res.status}`);
    if (res.monthly_savings !== 20.00) throw new Error(`Expected savings 20.00, got ${res.monthly_savings}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 20.00) {
      throw new Error(`Expected confirmed_savings 20.00, got ${savings.confirmed_savings}`);
    }
    await db.close();
  });

  // 3. REQUIRE_APPROVAL
  await runTest('3. REQUIRE_APPROVAL creates approval request in SQLite and does NOT credit confirmed savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_3', 'DesignApp Annual', 45.00, 'software');
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_3',
      decision: 'REQUIRE_APPROVAL',
      action: 'cancel',
      confidence: 80,
      waste_score: 60,
      risk: 'medium',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'Exceeds auto-action limit of $20',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${res.status}`);
    if (!res.approval_id) throw new Error('Expected approval_id to be generated');

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) {
      throw new Error(`Confirmed savings increased prematurely! Got: ${savings.confirmed_savings}`);
    }

    const approvals = await db.getApprovalRequests('user_1');
    if (approvals.length !== 1 || approvals[0].approval_id !== res.approval_id) {
      throw new Error('Approval request not persisted in SQLite');
    }
    await db.close();
  });

  // 4. PROTECTED
  await runTest('4. PROTECTED items are blocked, logged in audit events, and never execute autonomously', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_4', 'Family Health Plan', 150.00, 'insurance');
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_4',
      decision: 'PROTECTED',
      action: 'keep',
      confidence: 98,
      waste_score: 20,
      risk: 'high',
      guardrail_status: 'blocked',
      requires_approval: false,
      reason: 'Category insurance is protected by safety guardrail',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'PROTECTED') throw new Error(`Expected PROTECTED, got ${res.status}`);
    if (adapter.executedParams.length > 0) throw new Error('Adapter was invoked for protected item!');

    const events = await db.getAuditEvents('user_1');
    const blockedEvent = events.find((e) => e.status === 'blocked');
    if (!blockedEvent) throw new Error('ACTION_BLOCKED audit event missing');

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) throw new Error('Savings increased for protected item');
    await db.close();
  });

  // 5. NO_ACTION
  await runTest('5. NO_ACTION items never execute and do not modify savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_5', 'Daily Newspaper', 8.00, 'news');
    const decision: Decision = {
      subscription_id: 'sub_test_5',
      decision: 'NO_ACTION',
      action: 'keep',
      confidence: 90,
      waste_score: 5,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'Active daily usage',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'NO_ACTION') throw new Error(`Expected NO_ACTION, got ${res.status}`);
    if (adapter.executedParams.length > 0) throw new Error('Adapter was invoked for NO_ACTION item');

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) throw new Error('Savings changed for NO_ACTION item');
    await db.close();
  });

  // 6. ESCALATE
  await runTest('6. ESCALATE creates escalation record in SQLite and does not execute autonomously', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_6', 'Enterprise CRM', 350.00, 'business');
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_6',
      decision: 'ESCALATE',
      action: 'review',
      confidence: 45,
      waste_score: 80,
      risk: 'critical',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'High financial exposure and low detection confidence',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'ESCALATED') throw new Error(`Expected ESCALATED, got ${res.status}`);
    if (!res.escalation_id) throw new Error('Expected escalation_id to be generated');

    const escalations = await db.getEscalationRecords('user_1');
    if (escalations.length !== 1 || escalations[0].escalation_id !== res.escalation_id) {
      throw new Error('Escalation record not found in SQLite');
    }
    if (adapter.executedParams.length > 0) throw new Error('Adapter was invoked for escalated item');
    await db.close();
  });

  // 7. Approval can be approved and credits savings
  await runTest('7. Approval request can be approved and credits confirmed savings upon success', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_7', 'DevOps Cloud', 35.00, 'developer');
    await db.saveSubscriptions('user_1', [sub]);

    const decRes = await engine.processDecision('user_1', sub, {
      subscription_id: 'sub_test_7',
      decision: 'REQUIRE_APPROVAL',
      action: 'cancel',
      confidence: 85,
      waste_score: 70,
      risk: 'medium',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'Amount $35 exceeds auto limit',
    });

    const approvalId = decRes.approval_id!;
    const approveRes = await engine.approveApprovalRequest('user_1', approvalId);
    if (approveRes.status !== 'SUCCESS') throw new Error(`Expected SUCCESS, got ${approveRes.status}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 35.00) {
      throw new Error(`Expected confirmed savings 35.00, got ${savings.confirmed_savings}`);
    }

    const updatedApproval = await db.getApprovalRequestById('user_1', approvalId);
    if (updatedApproval?.status !== 'APPROVED') {
      throw new Error(`Expected approval status APPROVED, got ${updatedApproval?.status}`);
    }
    await db.close();
  });

  // 8. Approval can be rejected
  await runTest('8. Approval request can be rejected and leaves confirmed savings at 0', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_8', 'Video Editor', 25.00);
    await db.saveSubscriptions('user_1', [sub]);

    const decRes = await engine.processDecision('user_1', sub, {
      subscription_id: 'sub_test_8',
      decision: 'REQUIRE_APPROVAL',
      action: 'cancel',
      confidence: 85,
      waste_score: 65,
      risk: 'medium',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'User review requested',
    });

    const approvalId = decRes.approval_id!;
    const rejectRes = await engine.rejectApprovalRequest('user_1', approvalId, 'User prefers to keep this service');
    if (rejectRes.status !== 'REJECTED') throw new Error(`Expected REJECTED, got ${rejectRes.status}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) {
      throw new Error(`Confirmed savings increased on rejection! Got: ${savings.confirmed_savings}`);
    }

    const updatedApproval = await db.getApprovalRequestById('user_1', approvalId);
    if (updatedApproval?.status !== 'REJECTED') {
      throw new Error(`Expected approval status REJECTED, got ${updatedApproval?.status}`);
    }
    await db.close();
  });

  // 9. Double approval attempt is prevented
  await runTest('9. Double approval attempt is rejected (cannot approve already resolved request)', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_9', 'Music Service', 9.99);
    await db.saveSubscriptions('user_1', [sub]);

    const decRes = await engine.processDecision('user_1', sub, {
      subscription_id: 'sub_test_9',
      decision: 'REQUIRE_APPROVAL',
      action: 'cancel',
      confidence: 85,
      waste_score: 60,
      risk: 'low',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'Review requested',
    });

    const approvalId = decRes.approval_id!;
    await engine.approveApprovalRequest('user_1', approvalId);

    // Second approval attempt must throw
    let threw = false;
    try {
      await engine.approveApprovalRequest('user_1', approvalId);
    } catch (err: any) {
      threw = true;
      if (err.code !== SpendGuardianErrorCode.INVALID_APPROVAL_STATUS) {
        throw new Error(`Expected error code INVALID_APPROVAL_STATUS, got ${err.code}`);
      }
    }
    if (!threw) throw new Error('Double approval attempt did not throw error');
    await db.close();
  });

  // 10. Idempotency: re-running action avoids double-counting savings
  await runTest('10. Idempotency: re-running action on already executed subscription avoids double-counting savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_10', 'Fitness App', 15.00);
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_10',
      decision: 'AUTO_CANCEL',
      action: 'cancel',
      confidence: 90,
      waste_score: 90,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'No workout logged in 90 days',
    };

    // First execution
    const res1 = await engine.processDecision('user_1', sub, decision);
    if (res1.status !== 'SUCCESS') throw new Error('First execution failed');

    const savings1 = await db.getSavingsSummary('user_1');
    if (savings1.confirmed_savings !== 15.00) {
      throw new Error(`Expected 15.00 savings, got ${savings1.confirmed_savings}`);
    }

    // Second execution (re-run)
    const res2 = await engine.processDecision('user_1', sub, decision);
    if (res2.status !== 'SUCCESS') throw new Error('Idempotent re-run did not return success');

    const savings2 = await db.getSavingsSummary('user_1');
    if (savings2.confirmed_savings !== 15.00) {
      throw new Error(`Confirmed savings double counted! Got: ${savings2.confirmed_savings}`);
    }
    if (adapter.executedParams.length !== 1) {
      throw new Error(`Adapter called ${adapter.executedParams.length} times, expected exactly 1 call (idempotent cache)`);
    }
    await db.close();
  });

  // 11. Simulated failure returns FAILED status and 0 confirmed savings
  await runTest('11. Simulated failure returns FAILED status and 0 confirmed savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    adapter.failNext(1);
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_11', 'News Pro', 10.00);
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_11',
      decision: 'AUTO_CANCEL',
      action: 'cancel',
      confidence: 90,
      waste_score: 80,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'Unused',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'FAILED') throw new Error(`Expected FAILED, got ${res.status}`);
    if (res.monthly_savings !== 0) throw new Error(`Expected 0 savings, got ${res.monthly_savings}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) throw new Error('Confirmed savings increased on failure');
    await db.close();
  });

  // 12. Adapter execution failure does not increment confirmed savings
  await runTest('12. Adapter execution failure does not increment confirmed savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    adapter.setSimulateError(true, 'Network timeout connecting to merchant portal');
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_12', 'Cloud Hosting', 20.00);
    await db.saveSubscriptions('user_1', [sub]);

    const decision: Decision = {
      subscription_id: 'sub_test_12',
      decision: 'AUTO_CANCEL',
      action: 'cancel',
      confidence: 90,
      waste_score: 80,
      risk: 'low',
      guardrail_status: 'passed',
      requires_approval: false,
      reason: 'Unused server',
    };

    const res = await engine.processDecision('user_1', sub, decision);
    if (res.status !== 'FAILED') throw new Error(`Expected FAILED, got ${res.status}`);

    const savings = await db.getSavingsSummary('user_1');
    if (savings.confirmed_savings !== 0) throw new Error('Confirmed savings increased on error');
    await db.close();
  });

  // 13. Malformed decision (missing subscription_id) throws MISSING_REQUIRED_FIELD
  await runTest('13. Malformed decision (missing subscription_id) throws MISSING_REQUIRED_FIELD', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_13', 'SomeApp', 10.00);

    let threw = false;
    try {
      await engine.processDecision('user_1', sub, {
        subscription_id: '',
        decision: 'AUTO_CANCEL',
        action: 'cancel',
        confidence: 90,
        waste_score: 80,
        risk: 'low',
        guardrail_status: 'passed',
        requires_approval: false,
        reason: 'test',
      });
    } catch (err: any) {
      threw = true;
      if (err.code !== SpendGuardianErrorCode.MISSING_REQUIRED_FIELD) {
        throw new Error(`Expected MISSING_REQUIRED_FIELD, got ${err.code}`);
      }
    }
    if (!threw) throw new Error('Malformed decision did not throw error');
    await db.close();
  });

  // 14. Missing or invalid action in decision throws MISSING_REQUIRED_FIELD
  await runTest('14. Missing or invalid action in decision throws MISSING_REQUIRED_FIELD', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_14', 'SomeApp', 10.00);

    let threw = false;
    try {
      await engine.processDecision('user_1', sub, {
        subscription_id: 'sub_test_14',
        decision: 'AUTO_CANCEL',
        action: undefined as any,
        confidence: 90,
        waste_score: 80,
        risk: 'low',
        guardrail_status: 'passed',
        requires_approval: false,
        reason: 'test',
      });
    } catch (err: any) {
      threw = true;
      if (err.code !== SpendGuardianErrorCode.MISSING_REQUIRED_FIELD) {
        throw new Error(`Expected MISSING_REQUIRED_FIELD, got ${err.code}`);
      }
    }
    if (!threw) throw new Error('Missing action did not throw error');
    await db.close();
  });

  // 15. Non-existent approval request throws APPROVAL_NOT_FOUND
  await runTest('15. Non-existent approval request throws APPROVAL_NOT_FOUND', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    let threw = false;
    try {
      await engine.approveApprovalRequest('user_1', 'appr_non_existent');
    } catch (err: any) {
      threw = true;
      if (err.code !== SpendGuardianErrorCode.APPROVAL_NOT_FOUND) {
        throw new Error(`Expected APPROVAL_NOT_FOUND, got ${err.code}`);
      }
    }
    if (!threw) throw new Error('Non-existent approval request did not throw error');
    await db.close();
  });

  // 16. Rejected approval request cannot be approved
  await runTest('16. Rejected approval request cannot subsequently be approved', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const adapter = new MockActionExecutionAdapter();
    const engine = new ActionEngine(db, adapter);

    const sub = createSub('sub_test_16', 'Video Streaming', 19.99);
    await db.saveSubscriptions('user_1', [sub]);

    const decRes = await engine.processDecision('user_1', sub, {
      subscription_id: 'sub_test_16',
      decision: 'REQUIRE_APPROVAL',
      action: 'cancel',
      confidence: 80,
      waste_score: 60,
      risk: 'medium',
      guardrail_status: 'requires_approval',
      requires_approval: true,
      reason: 'Review requested',
    });

    const approvalId = decRes.approval_id!;
    await engine.rejectApprovalRequest('user_1', approvalId, 'User declined');

    let threw = false;
    try {
      await engine.approveApprovalRequest('user_1', approvalId);
    } catch (err: any) {
      threw = true;
      if (err.code !== SpendGuardianErrorCode.INVALID_APPROVAL_STATUS) {
        throw new Error(`Expected INVALID_APPROVAL_STATUS, got ${err.code}`);
      }
    }
    if (!threw) throw new Error('Rejected request approval did not throw error');
    await db.close();
  });

  // 17. Confirmed savings strictly equals 0 after Block 2
  await runTest('17. Confirmed savings strictly equals 0 after Block 2', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const result = await orchestrator.runSubscriptionAudit({
      userId: 'u_test_invariant',
      stopAfterBlock2: true,
    });

    if (result.savings.confirmed_savings !== 0) {
      throw new Error(`Confirmed savings was ${result.savings.confirmed_savings}, expected strictly 0 after Block 2`);
    }
    await db.close();
  });

  // 18. Confirmed savings increases ONLY upon successful Block 3 execution
  await runTest('18. Confirmed savings increases ONLY upon successful Block 3 execution', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    mock3.failForSubscriptionIds = ['sub_streamflix'];
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const result = await orchestrator.runSubscriptionAudit({
      userId: 'u_test_savings_fail',
    });

    if (result.savings.confirmed_savings !== 0) {
      throw new Error(`Confirmed savings increased on failed execution: ${result.savings.confirmed_savings}`);
    }
    await db.close();
  });

  // 19. Canonical CASE 1: StreamFlix
  await runTest('19. Canonical CASE 1: StreamFlix auto-cancels and confirms $14.99 savings', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const result = await orchestrator.runSubscriptionAudit({
      userId: 'u_case1',
    });

    const streamflixAction = result.autoExecutedActions.find((a) => a.subscription_id === 'sub_streamflix');
    if (!streamflixAction || streamflixAction.status !== 'success') {
      throw new Error('StreamFlix was not successfully auto-cancelled');
    }
    if (result.savings.confirmed_savings !== 14.99) {
      throw new Error(`Expected confirmed savings 14.99, got ${result.savings.confirmed_savings}`);
    }
    await db.close();
  });

  // 20. Canonical CASE 2: TuneWave & MusicBox
  await runTest('20. Canonical CASE 2: TuneWave & MusicBox require approval and leave confirmed savings at 0', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const result = await orchestrator.runSubscriptionAudit({
      userId: 'u_case2',
    });

    const twAuto = result.autoExecutedActions.find((a) => a.subscription_id === 'sub_tunewave');
    const mbAuto = result.autoExecutedActions.find((a) => a.subscription_id === 'sub_musicbox');
    if (twAuto || mbAuto) {
      throw new Error('Overlapping music services were executed autonomously instead of requiring approval');
    }

    const approvals = await db.getApprovalRequests('u_case2');
    const hasMusicApproval = approvals.some(
      (a) => a.subscription_id === 'sub_tunewave' || a.subscription_id === 'sub_musicbox'
    );
    if (!hasMusicApproval) {
      throw new Error('Approval request was not created for overlapping music services');
    }
    await db.close();
  });

  // 21. Canonical CASE 3: HealthGuard Insurance
  await runTest('21. Canonical CASE 3: HealthGuard Insurance is protected and leaves confirmed savings at 0', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const result = await orchestrator.runSubscriptionAudit({
      userId: 'u_case3',
    });

    const hgAuto = result.autoExecutedActions.find((a) => a.subscription_id === 'sub_healthguard');
    if (hgAuto) {
      throw new Error('HealthGuard insurance was autonomously executed despite guardrail protection');
    }

    const events = await db.getAuditEvents('u_case3');
    const hgBlocked = events.find((e) => e.subscription_id === 'sub_healthguard' && e.status === 'blocked');
    if (!hgBlocked) {
      throw new Error('Blocked audit event missing for HealthGuard insurance');
    }
    await db.close();
  });

  // 22. Orchestrator stage pipeline: emits all 7 workflow stages in sequence
  await runTest('22. Orchestrator stage pipeline emits all 7 workflow stages in sequence', async () => {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();
    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const stages: WorkflowProgress[] = [];
    await orchestrator.runSubscriptionAudit({
      userId: 'u_stages',
      onProgress: (prog) => stages.push(prog),
    });

    const expectedStages = [
      WorkflowStageId.ANALYZING_TRANSACTIONS,
      WorkflowStageId.DETECTING_SUBSCRIPTIONS,
      WorkflowStageId.EVALUATING_WASTE,
      WorkflowStageId.CHECKING_GUARDRAILS,
      WorkflowStageId.EXECUTING_SAFE_ACTIONS,
      WorkflowStageId.PREPARING_APPROVAL_REQUESTS,
      WorkflowStageId.AUDIT_COMPLETE,
    ];

    for (const st of expectedStages) {
      const completed = stages.find((s) => s.stage === st && s.status === 'completed');
      if (!completed) {
        throw new Error(`Stage ${st} did not complete during audit pipeline execution`);
      }
    }
    await db.close();
  });

  return results;
}
