/**
 * SPENDGUARDIAN — Adapter Error Handling Tests
 *
 * Verifies explicit error states:
 * - BLOCK_1_UNAVAILABLE
 * - BLOCK_2_UNAVAILABLE
 * - BLOCK_3_UNAVAILABLE
 * - INVALID_BLOCK_1_RESPONSE
 * - INVALID_BLOCK_2_RESPONSE
 * - INVALID_BLOCK_3_RESPONSE
 */

import { Block1HttpAdapter } from '../backend/adapters/block1.adapter.ts';
import { Block2HttpAdapter } from '../backend/adapters/block2.adapter.ts';
import { Block3HttpAdapter } from '../backend/adapters/block3.adapter.ts';
import { SpendGuardianErrorCode } from '../backend/models/index.ts';

export async function testAdapters(): Promise<{ name: string; passed: boolean; message?: string }[]> {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // 1. Block 1 Offline Error Mapping
  try {
    const unreachableAdapter = new Block1HttpAdapter('http://127.0.0.1:49999', 500);
    await unreachableAdapter.analyzeSubscriptions('u_301', [], []);
    results.push({ name: 'Block 1 Offline -> BLOCK_1_UNAVAILABLE', passed: false, message: 'Expected failure but passed' });
  } catch (err: any) {
    const passed = err.code === SpendGuardianErrorCode.BLOCK_1_UNAVAILABLE;
    results.push({
      name: 'Block 1 Offline -> BLOCK_1_UNAVAILABLE',
      passed,
      message: passed ? undefined : `Expected BLOCK_1_UNAVAILABLE but got ${err.code}: ${err.message}`,
    });
  }

  // 2. Block 2 Malformed Response Mapping
  try {
    const adapter2 = new Block2HttpAdapter();
    adapter2.transformResponse({ not_even_user_id: 123 });
    results.push({ name: 'Block 2 Bad Schema -> INVALID_BLOCK_2_RESPONSE', passed: false, message: 'Expected error but none thrown' });
  } catch (err: any) {
    const passed = err.code === SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE;
    results.push({
      name: 'Block 2 Bad Schema -> INVALID_BLOCK_2_RESPONSE',
      passed,
      message: passed ? undefined : `Expected INVALID_BLOCK_2_RESPONSE but got ${err.code}`,
    });
  }

  // 3. Block 3 Offline Error Mapping
  try {
    const unreachableAdapter3 = new Block3HttpAdapter('http://127.0.0.1:49998', 500);
    await unreachableAdapter3.executeAction('u_301', {
      subscription_id: 'sub_dummy',
      merchant: 'Dummy',
      category: 'misc',
      amount: 10,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 100,
      waste_score: 80,
      confidence: 90,
      risk: 'low',
      status: 'active',
      recommended_action: 'cancel',
    }, {
      subscription_id: 'sub_dummy',
      action: 'cancel',
      reason: 'test',
      waste_score: 80,
      confidence: 90,
      risk: 'low',
      requires_approval: false,
      guardrail_status: 'passed',
    });
    results.push({ name: 'Block 3 Offline -> BLOCK_3_UNAVAILABLE', passed: false, message: 'Expected failure but passed' });
  } catch (err: any) {
    const passed = err.code === SpendGuardianErrorCode.BLOCK_3_UNAVAILABLE;
    results.push({
      name: 'Block 3 Offline -> BLOCK_3_UNAVAILABLE',
      passed,
      message: passed ? undefined : `Expected BLOCK_3_UNAVAILABLE but got ${err.code}`,
    });
  }

  // 4. Block 3 Invalid Status Response
  try {
    const adapter3 = new Block3HttpAdapter();
    adapter3.transformResponse({
      action_id: 'act_001',
      status: 'unknown_garbage_status',
      action: 'cancel',
      monthly_savings: 10,
    });
    results.push({ name: 'Block 3 Invalid Status -> INVALID_BLOCK_3_RESPONSE', passed: false, message: 'Expected error but none thrown' });
  } catch (err: any) {
    const passed = err.code === SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE;
    results.push({
      name: 'Block 3 Invalid Status -> INVALID_BLOCK_3_RESPONSE',
      passed,
      message: passed ? undefined : `Expected INVALID_BLOCK_3_RESPONSE but got ${err.code}`,
    });
  }

  return results;
}
