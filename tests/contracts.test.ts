/**
 * SPENDGUARDIAN — Contract Validation Tests
 *
 * Verifies that the JSON schemas and domain models strictly satisfy
 * the required Block 1, Block 2, and Block 3 contracts.
 */

import { Block1HttpAdapter } from '../backend/adapters/block1.adapter.ts';
import { Block2HttpAdapter } from '../backend/adapters/block2.adapter.ts';
import { Block3HttpAdapter } from '../backend/adapters/block3.adapter.ts';
import {
  MOCK_TRANSACTIONS,
  MOCK_EMAILS,
  MOCK_SUBSCRIPTIONS,
  MOCK_GUARDRAILS,
} from '../mock-data/index.ts';
import { SpendGuardianErrorCode } from '../backend/models/index.ts';

export async function testContracts(): Promise<{ name: string; passed: boolean; message?: string }[]> {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // 1. Block 1 Request Contract
  try {
    const adapter1 = new Block1HttpAdapter();
    const req1 = adapter1.transformRequest('u_301', MOCK_TRANSACTIONS, MOCK_EMAILS);

    if (req1.user_id !== 'u_301' || !Array.isArray(req1.transactions) || !Array.isArray(req1.emails)) {
      throw new Error('Block 1 request transformation does not match { user_id, transactions, emails }');
    }
    results.push({ name: 'Block 1 Request Transformation Contract', passed: true });
  } catch (err) {
    results.push({ name: 'Block 1 Request Transformation Contract', passed: false, message: (err as Error).message });
  }

  // 2. Block 1 Response Contract
  try {
    const adapter1 = new Block1HttpAdapter();
    const rawResponse = {
      user_id: 'u_301',
      subscriptions: [
        {
          subscription_id: 'sub_streamflix',
          merchant: 'StreamFlix',
          category: 'streaming_video',
          amount: 14.99,
          currency: 'USD',
          cadence: 'monthly',
          last_used_days_ago: 187,
          waste_score: 95,
          confidence: 96,
          risk: 'low',
          status: 'active',
          recommended_action: 'cancel',
        },
      ],
      events: [],
    };
    const res1 = adapter1.transformResponse(rawResponse);
    if (!res1.subscriptions || res1.subscriptions[0].subscription_id !== 'sub_streamflix') {
      throw new Error('Block 1 response transformation failed to parse subscriptions');
    }
    results.push({ name: 'Block 1 Response Validation Contract', passed: true });
  } catch (err) {
    results.push({ name: 'Block 1 Response Validation Contract', passed: false, message: (err as Error).message });
  }

  // 3. Block 2 Request & Response Contract
  try {
    const adapter2 = new Block2HttpAdapter();
    const req2 = adapter2.transformRequest('u_301', MOCK_SUBSCRIPTIONS, MOCK_EMAILS, MOCK_GUARDRAILS);
    if (req2.user_id !== 'u_301' || !Array.isArray(req2.subscriptions) || !req2.guardrails) {
      throw new Error('Block 2 request transformation failed schema check');
    }

    const rawResponse = {
      user_id: 'u_301',
      decisions: [
        {
          subscription_id: 'sub_streamflix',
          action: 'cancel',
          reason: 'Unused 187 days',
          waste_score: 95,
          confidence: 96,
          risk: 'low',
          requires_approval: false,
          guardrail_status: 'passed',
        },
      ],
    };
    const res2 = adapter2.transformResponse(rawResponse);
    if (!res2.decisions || res2.decisions[0].action !== 'cancel') {
      throw new Error('Block 2 response transformation failed to parse decisions');
    }
    results.push({ name: 'Block 2 Contract (Request & Response)', passed: true });
  } catch (err) {
    results.push({ name: 'Block 2 Contract (Request & Response)', passed: false, message: (err as Error).message });
  }

  // 4. Block 3 Request & Response Contract
  try {
    const adapter3 = new Block3HttpAdapter();
    const sub = MOCK_SUBSCRIPTIONS[0];
    const decision = {
      subscription_id: sub.subscription_id,
      action: 'cancel' as const,
      reason: 'Inactivity',
      waste_score: 90,
      confidence: 95,
      risk: 'low' as const,
      requires_approval: false,
      guardrail_status: 'passed' as const,
    };

    const req3 = adapter3.transformRequest('u_301', sub, decision);
    if (!req3.subscription || !req3.decision) {
      throw new Error('Block 3 request missing required subscription/decision object');
    }

    const rawResponse = {
      action_id: 'act_001',
      status: 'success',
      action: 'cancel',
      monthly_savings: 14.99,
    };
    const res3 = adapter3.transformResponse(rawResponse);
    if (res3.status !== 'success' || res3.monthly_savings !== 14.99) {
      throw new Error('Block 3 response failed to map status and monthly_savings');
    }
    results.push({ name: 'Block 3 Contract (Request & Response)', passed: true });
  } catch (err) {
    results.push({ name: 'Block 3 Contract (Request & Response)', passed: false, message: (err as Error).message });
  }

  // 5. Malformed payload detection (Missing subscription_id)
  try {
    const adapter1 = new Block1HttpAdapter();
    adapter1.transformResponse({
      user_id: 'u_301',
      subscriptions: [{ merchant: 'Mystery Service', amount: 10.0 }],
      events: [],
    });
    results.push({ name: 'Block 1 Rejects Missing subscription_id', passed: false, message: 'Expected error but none thrown' });
  } catch (err: any) {
    const passed = err.code === SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID;
    results.push({
      name: 'Block 1 Rejects Missing subscription_id',
      passed,
      message: passed ? undefined : `Expected MISSING_SUBSCRIPTION_ID but got ${err.code}`,
    });
  }

  return results;
}
