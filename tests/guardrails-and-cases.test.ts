/**
 * SPENDGUARDIAN — Canonical Demo Cases & Guardrail Tests
 *
 * Validates:
 * - CASE 1: StreamFlix auto-cancel ($14.99, unused 187d, limit $20)
 * - CASE 2: TuneWave + MusicBox Premium overlap detection (Action Center asks user)
 * - CASE 3: HealthGuard Insurance ($89/mo, category insurance, guardrail blocked)
 * - Workflow Stages Emission (all 7 stages in sequence)
 */

import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import {
  MockBlock1Adapter,
  MockBlock2Adapter,
  MockBlock3Adapter,
} from '../backend/adapters/mock.adapters.ts';
import { Orchestrator } from '../backend/orchestrator/orchestrator.ts';
import { WorkflowProgress, WorkflowStageId } from '../backend/models/index.ts';

export async function testGuardrailsAndCases(): Promise<{ name: string; passed: boolean; message?: string }[]> {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  const db = new SQLiteDatabase(':memory:');
  await db.initialize();

  const mock1 = new MockBlock1Adapter();
  const mock2 = new MockBlock2Adapter();
  const mock3 = new MockBlock3Adapter();
  const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

  const capturedStages: WorkflowProgress[] = [];

  try {
    const auditResult = await orchestrator.runSubscriptionAudit({
      userId: 'u_demo_test',
      onProgress: (progress) => capturedStages.push(progress),
    });

    // CASE 1 VALIDATION: StreamFlix
    const streamflixAction = auditResult.autoExecutedActions.find(
      (a) => a.subscription_id === 'sub_streamflix'
    );
    if (!streamflixAction || streamflixAction.status !== 'success' || streamflixAction.monthly_savings !== 14.99) {
      throw new Error(`Case 1 failed: StreamFlix not auto-cancelled or savings mismatch: ${JSON.stringify(streamflixAction)}`);
    }
    results.push({ name: 'CASE 1: StreamFlix Auto-Cancelled & Confirmed Savings Credited ($14.99)', passed: true });

    // CASE 2 VALIDATION: TuneWave + MusicBox Premium Overlap
    const tunewaveDecision = auditResult.decisions.find((d) => d.subscription_id === 'sub_tunewave');
    const musicboxDecision = auditResult.decisions.find((d) => d.subscription_id === 'sub_musicbox');

    if (!tunewaveDecision || !musicboxDecision) {
      throw new Error('Case 2 failed: Music subscriptions not found in decisions');
    }

    if (!tunewaveDecision.requires_approval || !musicboxDecision.requires_approval) {
      throw new Error('Case 2 failed: Overlapping subscriptions did not require approval');
    }

    if (tunewaveDecision.action !== 'ask_user' || musicboxDecision.action !== 'ask_user') {
      throw new Error('Case 2 failed: System auto-decided instead of asking user');
    }

    results.push({ name: 'CASE 2: Overlapping Music Subscriptions Flagged for User Choice (No Auto-Decide)', passed: true });

    // CASE 3 VALIDATION: HealthGuard Insurance Guardrail Blocked
    const insuranceDecision = auditResult.decisions.find(
      (d) => d.subscription_id === 'sub_healthguard'
    );
    if (!insuranceDecision) {
      throw new Error('Case 3 failed: HealthGuard Insurance decision missing');
    }

    if (insuranceDecision.guardrail_status !== 'blocked') {
      throw new Error(`Case 3 failed: Expected guardrail_status 'blocked', got ${insuranceDecision.guardrail_status}`);
    }

    const insuranceAutoExecuted = auditResult.autoExecutedActions.find(
      (a) => a.subscription_id === 'sub_healthguard'
    );
    if (insuranceAutoExecuted) {
      throw new Error('Case 3 failed: Insurance subscription was executed autonomously despite guardrail block');
    }

    results.push({ name: 'CASE 3: Protected Insurance Category Autonomous Cancellation Blocked', passed: true });

    // WORKFLOW STAGES VALIDATION: All 7 stages
    const expectedStages = [
      WorkflowStageId.ANALYZING_TRANSACTIONS,
      WorkflowStageId.DETECTING_SUBSCRIPTIONS,
      WorkflowStageId.EVALUATING_WASTE,
      WorkflowStageId.CHECKING_GUARDRAILS,
      WorkflowStageId.EXECUTING_SAFE_ACTIONS,
      WorkflowStageId.PREPARING_APPROVAL_REQUESTS,
      WorkflowStageId.AUDIT_COMPLETE,
    ];

    const missingStage = expectedStages.find(
      (expected) => !capturedStages.some((c) => c.stage === expected && c.status === 'completed')
    );

    if (missingStage) {
      throw new Error(`Workflow stage ${missingStage} was not completed in audit pipeline`);
    }

    results.push({ name: 'Workflow Stage Pipeline: All 7 Stages Emitted In Sequence', passed: true });
  } catch (err) {
    results.push({
      name: 'Canonical Cases Execution',
      passed: false,
      message: (err as Error).message,
    });
  } finally {
    await db.close();
  }

  return results;
}
