/**
 * SPENDGUARDIAN — Block 2 Decision, Scoring & Guardrail Engine Tests
 *
 * Verifies all 17 canonical requirements for Phase 3:
 * 1. StreamFlix -> AUTO_CANCEL under canonical inputs
 * 2. TuneWave + MusicBox -> REQUIRE_APPROVAL and preserve overlap evidence
 * 3. HealthGuard -> PROTECTED and never autonomous
 * 4. Amount above limit -> REQUIRE_APPROVAL
 * 5. Confidence below threshold -> REQUIRE_APPROVAL
 * 6. Protected category cannot become autonomous
 * 7. Duplicate handling requires approval
 * 8. Trial-to-paid evidence preserved
 * 9. Price hike evidence preserved
 * 10. Detection confidence remains separate
 * 11. Decision confidence is produced
 * 12. Waste score stays 0–100
 * 13. Savings invariant remains intact
 * 14. Block 2 never executes actions
 * 15. Orchestrator stopAfterBlock2 persists decisions without Block 3 execution
 */

import { Block2DecisionEngine } from '../backend/block2-engine/decision-engine.ts';
import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import { Orchestrator } from '../backend/orchestrator/orchestrator.ts';
import {
  MockBlock1Adapter,
  MockBlock2Adapter,
  MockBlock3Adapter,
} from '../backend/adapters/mock.adapters.ts';
import {
  Subscription,
  Guardrails,
} from '../backend/models/index.ts';

const DEFAULT_GUARDRAILS: Guardrails = {
  user_id: 'u_test_guardrails',
  auto_action_limit: 20,
  protected_categories: ['insurance', 'loan_payment'],
  minimum_confidence: 90,
  duplicate_subscriptions: 'require_approval',
  unused_after_days: 90,
};

export async function testBlock2Engine(): Promise<
  { name: string; passed: boolean; message?: string }[]
> {
  const results: { name: string; passed: boolean; message?: string }[] = [];
  const engine = new Block2DecisionEngine();

  // Test 1: StreamFlix -> AUTO_CANCEL under canonical inputs
  try {
    const streamflix: Subscription = {
      subscription_id: 'sub_streamflix',
      merchant: 'StreamFlix',
      category: 'streaming_video',
      amount: 14.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 187,
      waste_score: 95,
      confidence: 96,
      detection_confidence: 96,
      risk: 'low',
      status: 'active',
      recommended_action: 'cancel',
    };

    const decision = engine.evaluateSubscription(streamflix, DEFAULT_GUARDRAILS);

    if (decision.decision !== 'AUTO_CANCEL') {
      throw new Error(`Expected decision 'AUTO_CANCEL', got '${decision.decision}'`);
    }
    if (decision.action !== 'cancel') {
      throw new Error(`Expected action 'cancel', got '${decision.action}'`);
    }
    if (decision.autonomous_action_allowed !== true) {
      throw new Error('Expected autonomous_action_allowed to be true');
    }
    if (decision.requires_approval !== false) {
      throw new Error('Expected requires_approval to be false');
    }
    if (decision.guardrail_status !== 'passed') {
      throw new Error(`Expected guardrail_status 'passed', got '${decision.guardrail_status}'`);
    }
    if (decision.waste_score < 80) {
      throw new Error(`Expected waste_score >= 80, got ${decision.waste_score}`);
    }

    results.push({ name: '1. StreamFlix -> AUTO_CANCEL under canonical inputs', passed: true });
  } catch (err) {
    results.push({
      name: '1. StreamFlix -> AUTO_CANCEL under canonical inputs',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 2: TuneWave + MusicBox -> REQUIRE_APPROVAL and preserve overlap evidence
  try {
    const tunewave: Subscription = {
      subscription_id: 'sub_tunewave',
      merchant: 'TuneWave',
      category: 'streaming_music',
      amount: 9.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 4,
      waste_score: 15,
      confidence: 92,
      detection_confidence: 92,
      risk: 'low',
      status: 'active',
      recommended_action: 'keep',
      duplicate_group: 'overlap_streaming_music',
      overlap_detected: true,
    };

    const musicbox: Subscription = {
      subscription_id: 'sub_musicbox',
      merchant: 'MusicBox Premium',
      category: 'streaming_music',
      amount: 11.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 40,
      waste_score: 70,
      confidence: 91,
      detection_confidence: 91,
      risk: 'medium',
      status: 'active',
      recommended_action: 'review',
      duplicate_group: 'overlap_streaming_music',
      overlap_detected: true,
    };

    const res = engine.evaluateAll('u_test', [tunewave, musicbox], DEFAULT_GUARDRAILS);
    const dTune = res.decisions.find((d) => d.subscription_id === 'sub_tunewave')!;
    const dMusic = res.decisions.find((d) => d.subscription_id === 'sub_musicbox')!;

    if (dTune.decision !== 'REQUIRE_APPROVAL' || dMusic.decision !== 'REQUIRE_APPROVAL') {
      throw new Error('Expected both overlapping services to receive REQUIRE_APPROVAL');
    }
    if (dTune.autonomous_action_allowed !== false || dMusic.autonomous_action_allowed !== false) {
      throw new Error('Autonomous action must NOT be allowed for unresolved duplicates');
    }
    if (!dTune.overlapping_subscription_ids?.includes('sub_musicbox')) {
      throw new Error('TuneWave decision must reference MusicBox in overlapping_subscription_ids');
    }
    if (!dMusic.overlapping_subscription_ids?.includes('sub_tunewave')) {
      throw new Error('MusicBox decision must reference TuneWave in overlapping_subscription_ids');
    }

    results.push({
      name: '2. TuneWave + MusicBox -> REQUIRE_APPROVAL and preserve overlap evidence',
      passed: true,
    });
  } catch (err) {
    results.push({
      name: '2. TuneWave + MusicBox -> REQUIRE_APPROVAL and preserve overlap evidence',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 3: HealthGuard -> PROTECTED and never autonomous
  try {
    const insurance: Subscription = {
      subscription_id: 'sub_healthguard',
      merchant: 'HealthGuard Insurance',
      category: 'insurance',
      amount: 89.0,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 120, // Even if inactive!
      waste_score: 85,
      confidence: 98,
      detection_confidence: 98,
      risk: 'high',
      status: 'active',
      recommended_action: 'cancel',
    };

    const decision = engine.evaluateSubscription(insurance, DEFAULT_GUARDRAILS);

    if (decision.decision !== 'PROTECTED') {
      throw new Error(`Expected decision 'PROTECTED', got '${decision.decision}'`);
    }
    if (decision.action !== 'keep') {
      throw new Error(`Expected action 'keep', got '${decision.action}'`);
    }
    if (decision.guardrail_status !== 'blocked') {
      throw new Error(`Expected guardrail_status 'blocked', got '${decision.guardrail_status}'`);
    }
    if (decision.autonomous_action_allowed === true) {
      throw new Error('Protected items must NEVER be autonomous');
    }
    if (decision.risk !== 'high') {
      throw new Error(`Expected risk 'high', got '${decision.risk}'`);
    }

    results.push({ name: '3. HealthGuard -> PROTECTED and never autonomous', passed: true });
  } catch (err) {
    results.push({
      name: '3. HealthGuard -> PROTECTED and never autonomous',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 4: Amount above limit -> REQUIRE_APPROVAL
  try {
    const expensiveSub: Subscription = {
      subscription_id: 'sub_expensive',
      merchant: 'Executive Suite',
      category: 'software',
      amount: 49.99, // Exceeds $20 limit
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 140, // High inactivity
      waste_score: 90,
      confidence: 95,
      detection_confidence: 95,
      risk: 'low',
      status: 'active',
      recommended_action: 'cancel',
    };

    const decision = engine.evaluateSubscription(expensiveSub, DEFAULT_GUARDRAILS);

    if (decision.decision !== 'REQUIRE_APPROVAL') {
      throw new Error(`Expected REQUIRE_APPROVAL for amount > $20, got '${decision.decision}'`);
    }
    if (decision.autonomous_action_allowed !== false) {
      throw new Error('Autonomous action must be false when amount exceeds limit');
    }
    if (!decision.reason.includes('exceeds')) {
      throw new Error('Reason must state that amount exceeds the limit');
    }

    results.push({ name: '4. Amount above limit -> REQUIRE_APPROVAL', passed: true });
  } catch (err) {
    results.push({
      name: '4. Amount above limit -> REQUIRE_APPROVAL',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 5: Confidence below threshold -> REQUIRE_APPROVAL
  try {
    const lowConfSub: Subscription = {
      subscription_id: 'sub_low_conf',
      merchant: 'Uncertain Cloud',
      category: 'cloud_storage',
      amount: 9.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 120,
      waste_score: 80,
      confidence: 75,
      detection_confidence: 75, // Below 90% threshold
      risk: 'low',
      status: 'active',
      recommended_action: 'cancel',
    };

    const decision = engine.evaluateSubscription(lowConfSub, DEFAULT_GUARDRAILS);

    if (decision.decision !== 'REQUIRE_APPROVAL') {
      throw new Error(`Expected REQUIRE_APPROVAL for confidence < 90%, got '${decision.decision}'`);
    }
    if (decision.autonomous_action_allowed !== false) {
      throw new Error('Autonomous action must be false when confidence is below threshold');
    }

    results.push({ name: '5. Confidence below threshold -> REQUIRE_APPROVAL', passed: true });
  } catch (err) {
    results.push({
      name: '5. Confidence below threshold -> REQUIRE_APPROVAL',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 6: Protected category cannot become autonomous under any circumstances
  try {
    const loanSub: Subscription = {
      subscription_id: 'sub_loan',
      merchant: 'Mortgage AutoPay',
      category: 'loan_payment',
      amount: 5.0, // Low amount
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 365, // Massive inactivity
      waste_score: 100,
      confidence: 99,
      detection_confidence: 99,
      risk: 'high',
      status: 'active',
      recommended_action: 'cancel',
    };

    const decision = engine.evaluateSubscription(loanSub, DEFAULT_GUARDRAILS);

    if (decision.autonomous_action_allowed !== false || decision.guardrail_status !== 'blocked') {
      throw new Error('Protected category must ALWAYS be blocked from autonomous action');
    }

    results.push({ name: '6. Protected category cannot become autonomous', passed: true });
  } catch (err) {
    results.push({
      name: '6. Protected category cannot become autonomous',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 7: Duplicate handling requires approval
  try {
    const subA: Subscription = {
      subscription_id: 'sub_stream_a',
      merchant: 'Flix A',
      category: 'streaming_video',
      amount: 9.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 10,
      waste_score: 30,
      confidence: 92,
      detection_confidence: 92,
      risk: 'low',
      status: 'active',
      recommended_action: 'review',
      duplicate_group: 'video_group',
    };
    const subB: Subscription = {
      subscription_id: 'sub_stream_b',
      merchant: 'Flix B',
      category: 'streaming_video',
      amount: 9.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 100,
      waste_score: 80,
      confidence: 92,
      detection_confidence: 92,
      risk: 'low',
      status: 'active',
      recommended_action: 'review',
      duplicate_group: 'video_group',
    };

    const res = engine.evaluateAll('u_test', [subA, subB], DEFAULT_GUARDRAILS);
    for (const d of res.decisions) {
      if (d.decision !== 'REQUIRE_APPROVAL' || d.autonomous_action_allowed !== false) {
        throw new Error('Both items in duplicate group must require approval');
      }
    }

    results.push({ name: '7. Duplicate handling requires approval', passed: true });
  } catch (err) {
    results.push({
      name: '7. Duplicate handling requires approval',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 8: Trial-to-paid evidence preserved
  try {
    const trialSub: Subscription = {
      subscription_id: 'sub_trial',
      merchant: 'SaaS App',
      category: 'productivity',
      amount: 12.0,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 20,
      waste_score: 60,
      confidence: 92,
      detection_confidence: 92,
      risk: 'medium',
      status: 'active',
      recommended_action: 'review',
      is_trial_conversion: true,
    };

    const decision = engine.evaluateSubscription(trialSub, DEFAULT_GUARDRAILS);
    const hasTrialFactor = decision.waste_factors?.some((f) => f.factor === 'trial_conversion');
    const hasTrialEvidence = decision.evidence?.some((e) => e.toLowerCase().includes('trial'));

    if (!hasTrialFactor || !hasTrialEvidence) {
      throw new Error('Trial conversion factor and evidence must be preserved');
    }

    results.push({ name: '8. Trial-to-paid evidence preserved', passed: true });
  } catch (err) {
    results.push({
      name: '8. Trial-to-paid evidence preserved',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 9: Price hike evidence preserved
  try {
    const hikeSub: Subscription = {
      subscription_id: 'sub_hike',
      merchant: 'News Daily',
      category: 'news',
      amount: 15.0,
      previous_amount: 10.0,
      price_hike_detected: true,
      price_hike_details: {
        previous_amount: 10.0,
        current_amount: 15.0,
        hike_percentage: 50,
      },
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 15,
      waste_score: 40,
      confidence: 93,
      detection_confidence: 93,
      risk: 'medium',
      status: 'active',
      recommended_action: 'review',
    };

    const decision = engine.evaluateSubscription(hikeSub, DEFAULT_GUARDRAILS);
    const hasHikeFactor = decision.waste_factors?.some((f) => f.factor === 'price_hike');
    const hasHikeEvidence = decision.evidence?.some((e) => e.toLowerCase().includes('price hike'));

    if (!hasHikeFactor || !hasHikeEvidence) {
      throw new Error('Price hike factor and evidence must be preserved');
    }

    results.push({ name: '9. Price hike evidence preserved', passed: true });
  } catch (err) {
    results.push({
      name: '9. Price hike evidence preserved',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 10: Detection confidence remains separate from decision confidence
  try {
    const sub: Subscription = {
      subscription_id: 'sub_test_dual_conf',
      merchant: 'MusicBox',
      category: 'streaming_music',
      amount: 9.99,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 10,
      waste_score: 20,
      confidence: 94,
      detection_confidence: 94,
      risk: 'low',
      status: 'active',
      recommended_action: 'keep',
    };

    const decision = engine.evaluateSubscription(sub, DEFAULT_GUARDRAILS);

    if (decision.detection_confidence !== 94) {
      throw new Error(`Expected detection_confidence 94, got ${decision.detection_confidence}`);
    }
    if (typeof decision.decision_confidence !== 'number') {
      throw new Error('Expected decision_confidence to be a distinct number');
    }

    results.push({ name: '10. Detection confidence remains separate', passed: true });
  } catch (err) {
    results.push({
      name: '10. Detection confidence remains separate',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 11: Decision confidence is produced
  try {
    const sub: Subscription = {
      subscription_id: 'sub_test_conf_range',
      merchant: 'AnyService',
      category: 'cloud',
      amount: 15.0,
      currency: 'USD',
      cadence: 'monthly',
      last_used_days_ago: 20,
      waste_score: 30,
      confidence: 88,
      detection_confidence: 88,
      risk: 'low',
      status: 'active',
      recommended_action: 'keep',
    };

    const decision = engine.evaluateSubscription(sub, DEFAULT_GUARDRAILS);

    if (
      decision.decision_confidence === undefined ||
      decision.decision_confidence < 0 ||
      decision.decision_confidence > 100
    ) {
      throw new Error(`decision_confidence must be between 0 and 100, got ${decision.decision_confidence}`);
    }

    results.push({ name: '11. Decision confidence is produced', passed: true });
  } catch (err) {
    results.push({
      name: '11. Decision confidence is produced',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 12: Waste score stays 0–100 under all conditions
  try {
    const extremeSubs: Subscription[] = [
      {
        subscription_id: 'sub_min',
        merchant: 'Zero Waste',
        category: 'work',
        amount: 0,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 0,
        waste_score: 0,
        confidence: 99,
        risk: 'low',
        status: 'active',
        recommended_action: 'keep',
      },
      {
        subscription_id: 'sub_max',
        merchant: 'Max Drain',
        category: 'entertainment',
        amount: 9999,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 1000,
        is_trial_conversion: true,
        price_hike_detected: true,
        overlap_detected: true,
        waste_score: 100,
        confidence: 99,
        risk: 'high',
        status: 'active',
        recommended_action: 'cancel',
      },
    ];

    for (const s of extremeSubs) {
      const d = engine.evaluateSubscription(s, DEFAULT_GUARDRAILS);
      if (d.waste_score < 0 || d.waste_score > 100) {
        throw new Error(`Waste score out of bounds [0, 100]: ${d.waste_score}`);
      }
    }

    results.push({ name: '12. Waste score stays 0–100', passed: true });
  } catch (err) {
    results.push({
      name: '12. Waste score stays 0–100',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 13: Savings invariant remains intact
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    // Run audit stopping after Block 2
    const auditRes = await orchestrator.runSubscriptionAudit({
      userId: 'u_savings_invariant',
      stopAfterBlock2: true,
    });

    // Confirmed savings MUST be 0!
    if (auditRes.savings.confirmed_savings !== 0) {
      throw new Error(`Expected confirmed_savings 0 after Block 2, got ${auditRes.savings.confirmed_savings}`);
    }
    // Potential savings should be > 0 (reflecting recommendations)
    if (auditRes.savings.potential_savings <= 0) {
      throw new Error('Expected potential_savings to be calculated and > 0');
    }

    await db.close();
    results.push({ name: '13. Savings invariant remains intact', passed: true });
  } catch (err) {
    results.push({
      name: '13. Savings invariant remains intact',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 14: Block 2 never executes actions
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const auditRes = await orchestrator.runSubscriptionAudit({
      userId: 'u_no_exec',
      stopAfterBlock2: true,
    });

    if (auditRes.autoExecutedActions.length > 0) {
      throw new Error('Block 2 flow must NEVER execute merchant actions');
    }

    // Check all subscriptions in DB are still active
    const savedSubs = await db.getSubscriptions('u_no_exec');
    for (const s of savedSubs) {
      if (s.status === 'cancelled') {
        throw new Error(`Subscription ${s.merchant} was prematurely cancelled!`);
      }
    }

    await db.close();
    results.push({ name: '14. Block 2 never executes actions', passed: true });
  } catch (err) {
    results.push({
      name: '14. Block 2 never executes actions',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test 15: Orchestrator stopAfterBlock2 persists decisions in SQLite
  try {
    const db = new SQLiteDatabase(':memory:');
    await db.initialize();

    const mock1 = new MockBlock1Adapter();
    const mock2 = new MockBlock2Adapter();
    const mock3 = new MockBlock3Adapter();
    const orchestrator = new Orchestrator(mock1, mock2, mock3, db);

    const auditRes = await orchestrator.runSubscriptionAudit({
      userId: 'u_persist_test',
      stopAfterBlock2: true,
    });

    const savedDecisions = await db.getDecisions('u_persist_test');
    if (savedDecisions.length === 0) {
      throw new Error('Decisions were not persisted to SQLite');
    }
    if (savedDecisions.length !== auditRes.decisions.length) {
      throw new Error(`Persisted decisions count (${savedDecisions.length}) != returned count (${auditRes.decisions.length})`);
    }

    await db.close();
    results.push({
      name: '15. Orchestrator stopAfterBlock2 persists decisions without Block 3 execution',
      passed: true,
    });
  } catch (err) {
    results.push({
      name: '15. Orchestrator stopAfterBlock2 persists decisions without Block 3 execution',
      passed: false,
      message: (err as Error).message,
    });
  }

  return results;
}
