/**
 * SPENDGUARDIAN — Phase 2 Block 1 Integration & Transformation Tests
 *
 * Verifies:
 * 1. Friend 1 schema transformation into canonical SpendGuardian Subscription model
 * 2. Preservation of recurring subscriptions, cadence, usage, and detection confidence
 * 3. Preservation of trial-to-paid conversion evidence
 * 4. Preservation of price hike evidence and previous amounts
 * 5. Preservation of duplicate / category overlap groupings
 * 6. Error handling for missing IDs, malformed schemas, and downstream outages
 * 7. Orchestrator detection stage execution and SQLite persistence without premature Block 2/3 execution
 */

import { Block1HttpAdapter } from '../backend/adapters/block1.adapter.ts';
import { Orchestrator } from '../backend/orchestrator/orchestrator.ts';
import { MockBlock1Adapter, MockBlock2Adapter, MockBlock3Adapter } from '../backend/adapters/mock.adapters.ts';
import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import {
  Subscription,
  WorkflowStageId,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../backend/models/index.ts';

export async function testBlock1Integration(): Promise<Array<{ name: string; passed: boolean; message?: string }>> {
  const results: Array<{ name: string; passed: boolean; message?: string }> = [];

  // Helper assert
  const assert = (condition: boolean, name: string, message?: string) => {
    results.push({
      name,
      passed: Boolean(condition),
      message: condition ? undefined : (message || 'Assertion failed'),
    });
  };

  const adapter = new Block1HttpAdapter('http://localhost:8001');

  // Sample Friend 1 raw response payload
  const sampleFriend1Response = {
    user_id: 'u_test_phase2',
    subscriptions: [
      {
        subscription_id: 'sub_cloudpro',
        merchant: 'CloudPro Workspace',
        normalized_merchant: 'CloudPro Workspace',
        category: 'cloud_storage',
        amount: 29.99,
        currency: 'USD',
        billing_cadence: 'monthly',
        monthly_equivalent: 29.99,
        first_detected_at: '2026-06-15T10:00:00Z',
        last_charged_at: '2026-09-15T10:00:00Z',
        occurrence_count: 3,
        recurring: true,
        recurring_confidence: 95,
        trial_conversion: true,
        trial_conversion_details: {
          trial_start_date: '2026-05-15',
          converted_date: '2026-06-15',
          trial_amount: 0.0,
          converted_amount: 29.99,
          notes: 'Converted from 30-day trial',
        },
        price_hike_detected: true,
        price_hike_details: {
          previous_amount: 19.99,
          current_amount: 29.99,
          hike_percentage: 50.0,
          detected_from: 'email_and_transactions',
          notice_date: '2026-08-10',
        },
        last_used_at: '2026-09-10T12:00:00Z',
        days_since_use: 8,
        usage_status: 'active',
        usage_confidence: 88,
        category_confidence: 96,
        overlap_group_id: null,
        overlap_detected: false,
        overlap_confidence: 0,
        overall_detection_confidence: 94,
        evidence: [
          'Detected 3 consecutive monthly charges of $29.99',
          'Trial-to-paid conversion verified from signup notice',
          'Price increased by $10.00/mo (50%) in August',
        ],
        source_transaction_ids: ['tx_c1', 'tx_c2', 'tx_c3'],
        source_email_ids: ['em_trial_cloud', 'em_hike_cloud'],
      },
      {
        subscription_id: 'sub_tunewave',
        merchant: 'TuneWave Premium',
        normalized_merchant: 'TuneWave',
        category: 'streaming_music',
        amount: 10.99,
        currency: 'USD',
        billing_cadence: 'monthly',
        days_since_use: 2,
        usage_status: 'active',
        overlap_group_id: 'overlap_streaming_music',
        overlap_detected: true,
        overlap_confidence: 92,
        overall_detection_confidence: 91,
        evidence: ['Overlaps with MusicBox in streaming_music category'],
        source_transaction_ids: ['tx_m1'],
        source_email_ids: [],
      },
    ],
    events: [],
    analysis_summary: {
      total_subscriptions_detected: 2,
      recurring_subscriptions: 2,
      price_hikes_detected: 1,
      trial_conversions_detected: 1,
      overlaps_detected: 1,
    },
    warnings: [],
  };

  // Test 1: Transformation from Friend 1 schema to canonical SpendGuardian model
  try {
    const transformed = adapter.transformResponse(sampleFriend1Response);
    assert(
      transformed.user_id === 'u_test_phase2' && transformed.subscriptions.length === 2,
      'Friend 1 Schema -> SpendGuardian Canonical Model Transformation',
      'Failed to transform Friend 1 response to canonical format'
    );

    const cloudPro = transformed.subscriptions[0];

    // Test 2: Field mappings (cadence, usage, confidence)
    assert(
      cloudPro.cadence === 'monthly' &&
        cloudPro.last_used_days_ago === 8 &&
        cloudPro.detection_confidence === 94 &&
        cloudPro.confidence === 94 &&
        cloudPro.awaiting_decision === true,
      'Field Mappings (billing_cadence -> cadence, days_since_use -> last_used_days_ago, overall_confidence -> detection_confidence)',
      `Field mappings incorrect: cadence=${cloudPro.cadence}, usage=${cloudPro.last_used_days_ago}, conf=${cloudPro.confidence}`
    );

    // Test 3: Trial-to-paid conversion preserved
    assert(
      cloudPro.is_trial_conversion === true &&
        cloudPro.trial_conversion_details?.converted_amount === 29.99 &&
        cloudPro.trial_conversion_details?.trial_amount === 0,
      'Trial-to-Paid Conversion Evidence Preserved',
      'Trial conversion metadata was lost in transformation'
    );

    // Test 4: Price hike evidence preserved
    assert(
      cloudPro.price_hike_detected === true &&
        cloudPro.previous_amount === 19.99 &&
        cloudPro.price_hike_details?.hike_percentage === 50.0,
      'Price Hike Evidence & Previous Amount Preserved',
      'Price hike metadata was lost in transformation'
    );

    // Test 5: Overlap / Duplicate evidence preserved
    const tuneWave = transformed.subscriptions[1];
    assert(
      tuneWave.duplicate_group === 'overlap_streaming_music' &&
        tuneWave.overlap_detected === true &&
        tuneWave.overlap_confidence === 92,
      'Overlap / Duplicate Group Evidence Preserved',
      'Overlap group metadata was lost in transformation'
    );
  } catch (err: any) {
    assert(false, 'Friend 1 Schema Transformation Execution', err.message);
  }

  // Test 6: Error handling when Friend 1 returns missing subscription_id
  try {
    const invalidPayload = {
      user_id: 'u_err',
      subscriptions: [
        {
          merchant: 'Unnamed Merchant',
          amount: 19.99,
        },
      ],
    };
    adapter.transformResponse(invalidPayload);
    assert(false, 'Error Handling: Rejects Missing subscription_id', 'Should have thrown error for missing subscription_id');
  } catch (err: any) {
    assert(
      err instanceof SpendGuardianError && err.code === SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
      'Error Handling: Rejects Missing subscription_id',
      `Wrong error code thrown: ${err.code}`
    );
  }

  // Test 7: Error handling when Friend 1 returns invalid response or non-array
  try {
    const invalidPayload = {
      user_id: 'u_err',
      subscriptions: 'not-an-array',
    };
    adapter.transformResponse(invalidPayload);
    assert(false, 'Error Handling: Rejects Non-Array Subscriptions', 'Should have thrown error for invalid response');
  } catch (err: any) {
    assert(
      err instanceof SpendGuardianError && err.code === SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
      'Error Handling: Rejects Malformed Friend 1 Schema',
      `Wrong error code thrown: ${err.code}`
    );
  }

  // Test 8: Orchestrator detection stage integration with persistence (stopAfterBlock1)
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    // Mock Block 1 that returns Friend 1 transformed subscriptions
    const mockBlock1 = new MockBlock1Adapter();
    const mockBlock2 = new MockBlock2Adapter();
    const mockBlock3 = new MockBlock3Adapter();

    const orchestrator = new Orchestrator(mockBlock1, mockBlock2, mockBlock3, db);

    const emittedStages: WorkflowStageId[] = [];
    const auditResult = await orchestrator.runSubscriptionAudit({
      userId: 'u_orch_test',
      transactions: [],
      emails: [],
      stopAfterBlock1: true,
      onProgress: (prog) => {
        if (prog.status === 'completed') {
          emittedStages.push(prog.stage);
        }
      },
    });

    // Subscriptions should be persisted in database
    const savedSubs = await db.getSubscriptions('u_orch_test');

    assert(
      auditResult.subscriptions.length > 0 &&
        savedSubs.length === auditResult.subscriptions.length &&
        auditResult.decisions.length === 0 &&
        auditResult.autoExecutedActions.length === 0,
      'Orchestrator Phase 2 Flow: Detection & Persistence Without Premature Block 2/3 Decisions',
      `Saved subs: ${savedSubs.length}, Decisions: ${auditResult.decisions.length}`
    );

    assert(
      emittedStages.includes(WorkflowStageId.ANALYZING_TRANSACTIONS) &&
        emittedStages.includes(WorkflowStageId.DETECTING_SUBSCRIPTIONS) &&
        !emittedStages.includes(WorkflowStageId.EVALUATING_WASTE) &&
        !emittedStages.includes(WorkflowStageId.EXECUTING_SAFE_ACTIONS),
      'Workflow Boundary: Halts Gracefully After Block 1 Detection Stage',
      `Unexpected stages emitted: ${emittedStages.join(', ')}`
    );

    await db.close();
  } catch (err: any) {
    assert(false, 'Orchestrator Detection Stage Integration', err.message);
  }

  return results;
}
