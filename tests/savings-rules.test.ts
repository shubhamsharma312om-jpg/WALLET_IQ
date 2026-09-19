/**
 * SPENDGUARDIAN — Savings Rules & Invariant Tests
 *
 * Enforces:
 * - Confirmed savings ONLY increases after Block 3 explicitly returns status === 'success'
 * - Failed or pending actions NEVER increase confirmed savings
 * - Potential savings reflects recommended actions without falsely crediting confirmed savings
 */

import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import {
  MockBlock1Adapter,
  MockBlock2Adapter,
  MockBlock3Adapter,
} from '../backend/adapters/mock.adapters.ts';
import { Orchestrator } from '../backend/orchestrator/orchestrator.ts';
import { MOCK_SUBSCRIPTIONS } from '../mock-data/index.ts';

export async function testSavingsRules(): Promise<{ name: string; passed: boolean; message?: string }[]> {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Successful action increases confirmed savings
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();

    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const auditResult = await orchestrator.runSubscriptionAudit({
      userId: 'u_savings_test_1',
    });

    // StreamFlix ($14.99) is the only auto-action candidate under default guardrails ($20 limit, >=90 conf, >90d inactive)
    if (auditResult.savings.confirmed_savings !== 14.99) {
      throw new Error(`Expected confirmed_savings to be 14.99, got ${auditResult.savings.confirmed_savings}`);
    }

    if (auditResult.savings.potential_savings <= auditResult.savings.confirmed_savings) {
      throw new Error('Expected potential_savings to exceed confirmed_savings due to review/approval items');
    }

    results.push({ name: 'Successful Block 3 Action Increases Confirmed Savings', passed: true });
    await db.close();
  } catch (err) {
    results.push({
      name: 'Successful Block 3 Action Increases Confirmed Savings',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 2: Failed action does NOT increase confirmed savings
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();

    // Instruct MockBlock3 to return failure for StreamFlix
    mock3.failForSubscriptionIds = ['sub_streamflix'];

    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const auditResult = await orchestrator.runSubscriptionAudit({
      userId: 'u_savings_test_2',
    });

    if (auditResult.savings.confirmed_savings !== 0) {
      throw new Error(
        `Confirmed savings increased despite failed Block 3 execution! Got: ${auditResult.savings.confirmed_savings}`
      );
    }

    // Check that audit log recorded failure
    const streamflixEvent = auditResult.auditEvents.find((e) => e.subscription_id === 'sub_streamflix');
    if (!streamflixEvent || streamflixEvent.status !== 'failed') {
      throw new Error('Audit log did not record failure for failed Block 3 action');
    }

    results.push({ name: 'Failed Block 3 Action Does NOT Increase Confirmed Savings', passed: true });
    await db.close();
  } catch (err) {
    results.push({
      name: 'Failed Block 3 Action Does NOT Increase Confirmed Savings',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 3: Blocked action (guardrail) does NOT execute and does NOT increase confirmed savings
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();

    // Custom single subscription: HealthGuard Insurance ($89/mo)
    mock1.customSubscriptions = [
      {
        subscription_id: 'sub_insurance_only',
        merchant: 'HealthGuard Insurance',
        category: 'insurance',
        amount: 89.0,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 300,
        waste_score: 99,
        confidence: 99,
        risk: 'high',
        status: 'active',
        recommended_action: 'cancel',
      },
    ];

    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);
    const auditResult = await orchestrator.runSubscriptionAudit({
      userId: 'u_savings_test_3',
    });

    if (auditResult.savings.confirmed_savings !== 0) {
      throw new Error(`Guardrail blocked item falsely credited confirmed savings: ${auditResult.savings.confirmed_savings}`);
    }

    if (auditResult.autoExecutedActions.length !== 0) {
      throw new Error('Blocked item was executed autonomously by orchestrator!');
    }

    results.push({ name: 'Guardrail Blocked Item Never Increases Confirmed Savings', passed: true });
    await db.close();
  } catch (err) {
    results.push({
      name: 'Guardrail Blocked Item Never Increases Confirmed Savings',
      passed: false,
      message: (err as Error).message,
    });
  }

  return results;
}
