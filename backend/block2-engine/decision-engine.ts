/**
 * SPENDGUARDIAN — Block 2 Canonical Decision Engine
 *
 * Evaluates subscriptions deterministically to produce:
 * - Deterministic Waste Score (0-100) with explainable factor breakdown
 * - Decision Confidence (0-100) kept distinct from Block 1 Detection Confidence
 * - Risk Assessment ('low' | 'medium' | 'high') without personal/health profiling
 * - Guardrail Policy Enforcement in strict priority order:
 *     1. Protected Categories (insurance, loan_payment -> PROTECTED)
 *     2. Duplicate / Overlap Groups (require_approval -> REQUIRE_APPROVAL, no auto-picking)
 *     3. Inactivity Thresholds (unused_after_days)
 *     4. Auto-Action Dollar Limit (sub.amount <= auto_action_limit)
 *     5. Minimum Confidence Threshold (decision_confidence >= minimum_confidence)
 *
 * CRITICAL INVARIANT:
 * Block 2 is a pure decision engine. It NEVER executes merchant actions,
 * never modifies confirmed savings, and never calls Block 3.
 */

import {
  Subscription,
  EmailEvent,
  Guardrails,
  Decision,
  DecisionState,
  DecisionAction,
  GuardrailStatus,
  SubscriptionRisk,
  WasteFactor,
  GuardrailCheck,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';

export interface EvaluationResult {
  user_id: string;
  decisions: Decision[];
  evaluated_at: string;
}

export class Block2DecisionEngine {
  /**
   * Calculates a bounded (0-100), deterministic, explainable waste score.
   * Inactivity is the strongest signal, supplemented by recurring cost,
   * price hikes, trial conversion, and overlap redundancy.
   */
  public calculateWasteScore(
    sub: Subscription,
    guardrails: Guardrails,
    overlapGroupSubs: Subscription[] = []
  ): { waste_score: number; waste_factors: WasteFactor[] } {
    const factors: WasteFactor[] = [];
    const inactiveDays = sub.last_used_days_ago ?? 0;
    const thresholdDays = guardrails.unused_after_days ?? 90;

    // 1. Inactivity Factor (Primary Signal: up to 65 points)
    if (inactiveDays >= 180) {
      factors.push({
        factor: 'inactivity',
        contribution: 65,
        reason: `Unused for ${inactiveDays} days (>6 months prolonged inactivity)`,
      });
    } else if (inactiveDays >= thresholdDays) {
      // Scales from 50 to 65 between threshold and 180 days
      const extra = Math.min(15, Math.round(((inactiveDays - thresholdDays) / Math.max(1, 180 - thresholdDays)) * 15));
      const contrib = 50 + extra;
      factors.push({
        factor: 'inactivity',
        contribution: contrib,
        reason: `Unused for ${inactiveDays} days (exceeds ${thresholdDays}-day policy threshold)`,
      });
    } else if (inactiveDays >= 30) {
      // Moderate inactivity: 20-40 points
      const contrib = Math.round(20 + ((inactiveDays - 30) / 60) * 20);
      factors.push({
        factor: 'inactivity',
        contribution: contrib,
        reason: `Inactive for ${inactiveDays} days (moderate inactivity)`,
      });
    } else if (inactiveDays >= 14) {
      factors.push({
        factor: 'inactivity',
        contribution: 10,
        reason: `Unused for ${inactiveDays} days`,
      });
    } else {
      factors.push({
        factor: 'inactivity',
        contribution: 0,
        reason: `Active recent usage (last used ${inactiveDays === 0 ? 'today' : `${inactiveDays} days ago`})`,
      });
    }

    // 2. Recurring Cost Drain Factor (Leverage Signal: up to 15 points)
    const amount = Number(sub.amount) || 0;
    if (amount >= 50) {
      factors.push({
        factor: 'recurring_cost',
        contribution: 15,
        reason: `$${amount.toFixed(2)} high recurring cost`,
      });
    } else if (amount >= 20) {
      factors.push({
        factor: 'recurring_cost',
        contribution: 14,
        reason: `$${amount.toFixed(2)} monthly recurring cost`,
      });
    } else if (amount >= 10) {
      factors.push({
        factor: 'recurring_cost',
        contribution: 14,
        reason: `$${amount.toFixed(2)} monthly recurring cost`,
      });
    } else if (amount > 0) {
      factors.push({
        factor: 'recurring_cost',
        contribution: 10,
        reason: `$${amount.toFixed(2)} monthly recurring cost`,
      });
    }

    // 3. Inactivity Leverage (Compound drain for long-term inactivity)
    if (inactiveDays >= 180 && amount >= 10) {
      factors.push({
        factor: 'prolonged_drain',
        contribution: 15,
        reason: `Compounding financial drain without utilization for over half a year`,
      });
    }

    // 4. Overlap / Redundancy Factor (up to 20 points)
    const isOverlapping = sub.overlap_detected || Boolean(sub.duplicate_group);
    if (isOverlapping) {
      // If there are other items in the same group that have more recent use
      const moreActivePeer = overlapGroupSubs.find(
        (other) => other.subscription_id !== sub.subscription_id && (other.last_used_days_ago ?? 999) < inactiveDays
      );

      if (moreActivePeer) {
        factors.push({
          factor: 'redundancy',
          contribution: 20,
          reason: `Redundant overlapping service in group "${sub.duplicate_group || 'media'}"; peer service "${moreActivePeer.merchant}" was used more recently (${moreActivePeer.last_used_days_ago}d ago vs ${inactiveDays}d ago)`,
        });
      } else {
        factors.push({
          factor: 'redundancy',
          contribution: 15,
          reason: `Potential redundant subscription in overlap group "${sub.duplicate_group || 'media'}"`,
        });
      }
    }

    // 5. Price Hike Factor (up to 15 points)
    if (sub.price_hike_detected) {
      const prev = sub.previous_amount ?? sub.price_hike_details?.previous_amount;
      const hikePct = sub.price_hike_details?.hike_percentage || (prev && prev > 0 ? Math.round(((amount - prev) / prev) * 100) : 15);
      factors.push({
        factor: 'price_hike',
        contribution: 15,
        reason: `Unbudgeted price increase (+${hikePct}%${prev ? ` from $${prev.toFixed(2)} to $${amount.toFixed(2)}` : ''}) detected`,
      });
    }

    // 6. Trial Conversion Factor (up to 15 points)
    if (sub.is_trial_conversion) {
      if (inactiveDays >= 14) {
        factors.push({
          factor: 'trial_conversion',
          contribution: 15,
          reason: `Converted from free trial to paid recurring billing with low post-conversion activity`,
        });
      } else {
        factors.push({
          factor: 'trial_conversion',
          contribution: 5,
          reason: `Converted from free trial to paid subscription`,
        });
      }
    }

    // Sum and clamp to [0, 100]
    const rawSum = factors.reduce((acc, f) => acc + f.contribution, 0);
    const waste_score = Math.min(100, Math.max(0, rawSum));

    return { waste_score, waste_factors: factors };
  }

  /**
   * Calculates Block 2 Decision Confidence (0-100).
   * Kept strictly separate from Block 1 Detection Confidence.
   */
  public calculateDecisionConfidence(
    sub: Subscription,
    guardrails: Guardrails,
    wasteScore: number,
    isProtected: boolean,
    isOverlap: boolean
  ): number {
    const detectionConf = sub.detection_confidence ?? sub.confidence ?? 90;

    // A. Protected category has absolute policy clarity
    if (isProtected) {
      return 98;
    }

    // B. Overlapping subscriptions have inherent user preference ambiguity
    if (isOverlap && guardrails.duplicate_subscriptions === 'require_approval') {
      // High confidence that user approval is required, but low confidence for autonomous action
      return 88;
    }

    // C. Very high waste and high detection confidence
    if (wasteScore >= 80 && detectionConf >= 90) {
      return Math.min(99, Math.max(92, detectionConf));
    }

    // D. Low waste / clear active usage
    if (wasteScore < 30 && (sub.last_used_days_ago ?? 0) <= 7) {
      return Math.min(98, Math.max(90, detectionConf));
    }

    // E. Moderate waste with trial conversion or price hike
    if (sub.is_trial_conversion || sub.price_hike_detected) {
      return Math.min(90, Math.max(82, detectionConf - 5));
    }

    return Math.min(95, Math.max(75, detectionConf));
  }

  /**
   * Evaluates Risk ('low' | 'medium' | 'high').
   * Focuses purely on financial impact, category sensitivity, and ambiguity.
   */
  public assessRisk(
    sub: Subscription,
    isProtected: boolean,
    isOverlap: boolean,
    amountExceedsLimit: boolean,
    decisionState: DecisionState
  ): SubscriptionRisk {
    // Protected categories are always treated with highest sensitivity
    if (isProtected) {
      return 'high';
    }

    // Overlap ambiguity or exceeding auto limits introduces financial/preference risk
    if (isOverlap || amountExceedsLimit || Number(sub.amount) >= 50) {
      return 'medium';
    }

    // High confidence autonomous cancellations or routine retentions are low risk
    if (decisionState === 'AUTO_CANCEL' || decisionState === 'NO_ACTION') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Evaluates a single subscription against all criteria and guardrails.
   */
  public evaluateSubscription(
    sub: Subscription,
    guardrails: Guardrails,
    allSubscriptions: Subscription[] = [],
    _events: EmailEvent[] = []
  ): Decision {
    if (!sub || !sub.subscription_id) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
        'Cannot evaluate subscription without subscription_id'
      );
    }

    const amount = Number(sub.amount) || 0;
    const category = (sub.category || '').toLowerCase();
    const inactiveDays = sub.last_used_days_ago ?? 0;
    const detection_confidence = sub.detection_confidence ?? sub.confidence ?? 95;

    // Collect peer subscriptions in the same duplicate/overlap group
    const overlapGroupSubs = allSubscriptions.filter(
      (s) =>
        s.subscription_id !== sub.subscription_id &&
        ((sub.duplicate_group && s.duplicate_group === sub.duplicate_group) ||
          (sub.overlap_detected && s.category.toLowerCase() === category) ||
          (category === 'streaming_music' && s.category.toLowerCase() === 'streaming_music'))
    );

    const isOverlap =
      Boolean(sub.duplicate_group || sub.overlap_detected) ||
      (category === 'streaming_music' && overlapGroupSubs.length > 0);

    // 1. Calculate Waste Score and Factors
    const { waste_score, waste_factors } = this.calculateWasteScore(sub, guardrails, overlapGroupSubs);

    // 2. Check Guardrails in Strict Order
    const guardrailChecks: GuardrailCheck[] = [];
    const evidence: string[] = [];

    // Evidence gathering from Block 1 signals
    evidence.push(`Last activity detected ${inactiveDays === 0 ? 'today' : `${inactiveDays} days ago`}`);
    evidence.push(`Monthly recurring amount: $${amount.toFixed(2)} ${sub.currency || 'USD'}`);
    if (sub.is_trial_conversion) {
      evidence.push('Converted from free trial to paid recurring subscription');
    }
    if (sub.price_hike_detected) {
      evidence.push(
        `Price hike detected: previous amount $${sub.previous_amount ?? sub.price_hike_details?.previous_amount ?? '?'}, current $${amount.toFixed(2)}`
      );
    }
    if (isOverlap) {
      const peerNames = overlapGroupSubs.map((p) => p.merchant).join(', ');
      evidence.push(
        `Overlapping service detected in group "${sub.duplicate_group || 'media'}"; related merchants: ${peerNames || 'peer service'}`
      );
    }

    // GUARDRAIL 1: Protected Category
    const isProtected = (guardrails.protected_categories || []).some(
      (p) => p.toLowerCase() === category
    );

    guardrailChecks.push({
      check: 'protected_category',
      passed: !isProtected,
      reason: isProtected
        ? `Category "${sub.category}" is in the protected list: [${guardrails.protected_categories.join(', ')}]`
        : `Category "${sub.category}" is not protected`,
    });

    // GUARDRAIL 2: Duplicate / Overlap Handling
    const isDuplicateConflict = isOverlap && guardrails.duplicate_subscriptions === 'require_approval';
    guardrailChecks.push({
      check: 'duplicate_overlap',
      passed: !isDuplicateConflict,
      reason: isDuplicateConflict
        ? `Overlapping subscriptions in group "${sub.duplicate_group || 'overlap'}" require user choice under policy "${guardrails.duplicate_subscriptions}"`
        : 'No unhandled duplicate overlap conflict',
    });

    // GUARDRAIL 3: Amount Limit
    const exceedsAmountLimit = amount > guardrails.auto_action_limit;
    guardrailChecks.push({
      check: 'auto_action_limit',
      passed: !exceedsAmountLimit,
      reason: exceedsAmountLimit
        ? `Amount $${amount.toFixed(2)} exceeds autonomous action limit ($${guardrails.auto_action_limit.toFixed(2)})`
        : `Amount $${amount.toFixed(2)} is within autonomous limit ($${guardrails.auto_action_limit.toFixed(2)})`,
    });

    // Calculate Decision Confidence
    const decision_confidence = this.calculateDecisionConfidence(
      sub,
      guardrails,
      waste_score,
      isProtected,
      isOverlap
    );

    // GUARDRAIL 4: Minimum Confidence
    const meetsConfidence = decision_confidence >= guardrails.minimum_confidence;
    guardrailChecks.push({
      check: 'minimum_confidence',
      passed: meetsConfidence,
      reason: meetsConfidence
        ? `Decision confidence (${decision_confidence}%) meets threshold (${guardrails.minimum_confidence}%)`
        : `Decision confidence (${decision_confidence}%) is below minimum threshold (${guardrails.minimum_confidence}%)`,
    });

    // GUARDRAIL 5: Inactivity Policy
    const exceedsInactivityThreshold = inactiveDays >= guardrails.unused_after_days;
    guardrailChecks.push({
      check: 'inactivity_threshold',
      passed: exceedsInactivityThreshold,
      reason: exceedsInactivityThreshold
        ? `Inactivity (${inactiveDays} days) exceeds threshold (${guardrails.unused_after_days} days)`
        : `Inactivity (${inactiveDays} days) is below threshold (${guardrails.unused_after_days} days)`,
    });

    // =========================================================================
    // SYNTHESIZE DECISION
    // =========================================================================

    let decisionState: DecisionState;
    let action: DecisionAction;
    let recommended_action: 'cancel' | 'downgrade' | 'keep' | 'pause' | 'review' | 'none';
    let guardrail_status: GuardrailStatus;
    let guardrail_result: 'allowed' | 'blocked' | 'requires_approval';
    let autonomous_action_allowed: boolean;
    let requires_approval: boolean;
    let reason: string;

    // PATH A: Protected Category (CANONICAL CASE 3)
    if (isProtected) {
      decisionState = 'PROTECTED';
      action = 'keep';
      recommended_action = 'none';
      guardrail_status = 'blocked';
      guardrail_result = 'blocked';
      autonomous_action_allowed = false;
      requires_approval = false;
      reason = `${sub.merchant} (${sub.category}) is protected by the user's autonomous-action rules. No cancellation was attempted.`;
    }
    // PATH B: Duplicate / Overlap (CANONICAL CASE 2)
    else if (isDuplicateConflict) {
      decisionState = 'REQUIRE_APPROVAL';
      action = 'ask_user';
      recommended_action = 'review';
      guardrail_status = 'requires_approval';
      guardrail_result = 'requires_approval';
      autonomous_action_allowed = false;
      requires_approval = true;

      const peerList = overlapGroupSubs
        .map((p) => `${p.merchant} ($${Number(p.amount).toFixed(2)}, used ${p.last_used_days_ago ?? 0}d ago)`)
        .join(' vs ');
      reason = `Detected overlapping subscription in category "${sub.category}". Compare: ${sub.merchant} ($${amount.toFixed(2)}, used ${inactiveDays}d ago)${peerList ? ` with ${peerList}` : ''}. User approval required to choose preference.`;
    }
    // PATH C: Inactivity Threshold Met -> Candidate for Action
    else if (exceedsInactivityThreshold) {
      // Check if blocked by amount limit
      if (exceedsAmountLimit) {
        decisionState = 'REQUIRE_APPROVAL';
        action = 'cancel';
        recommended_action = 'cancel';
        guardrail_status = 'requires_approval';
        guardrail_result = 'requires_approval';
        autonomous_action_allowed = false;
        requires_approval = true;
        reason = `Subscription has been unused for ${inactiveDays} days and has high waste evidence, but recurring amount ($${amount.toFixed(2)}) exceeds the autonomous action limit ($${guardrails.auto_action_limit.toFixed(2)}). User approval required.`;
      }
      // Check if blocked by confidence threshold
      else if (!meetsConfidence) {
        decisionState = 'REQUIRE_APPROVAL';
        action = 'cancel';
        recommended_action = 'cancel';
        guardrail_status = 'requires_approval';
        guardrail_result = 'requires_approval';
        autonomous_action_allowed = false;
        requires_approval = true;
        reason = `Subscription has been unused for ${inactiveDays} days, but decision confidence (${decision_confidence}%) is below the configured minimum threshold (${guardrails.minimum_confidence}%). User approval required.`;
      }
      // Passed all guardrails -> CANONICAL CASE 1 (StreamFlix)
      else {
        decisionState = 'AUTO_CANCEL';
        action = 'cancel';
        recommended_action = 'cancel';
        guardrail_status = 'passed';
        guardrail_result = 'allowed';
        autonomous_action_allowed = true;
        requires_approval = false;
        reason = `Subscription has been unused for ${inactiveDays} days, has high waste evidence (${waste_score}/100), confidence (${decision_confidence}%) is above the configured threshold (${guardrails.minimum_confidence}%), amount ($${amount.toFixed(2)}) is within the autonomous action limit ($${guardrails.auto_action_limit.toFixed(2)}), and category is not protected.`;
      }
    }
    // PATH D: High Waste (>=60) or Prior Recommended Cancel -> Review/Cancel with Approval
    else if (waste_score >= 60 || sub.recommended_action === 'cancel') {
      decisionState = 'REQUIRE_APPROVAL';
      action = 'cancel';
      recommended_action = 'cancel';
      guardrail_status = 'requires_approval';
      guardrail_result = 'requires_approval';
      autonomous_action_allowed = false;
      requires_approval = true;
      reason = `Elevated waste score (${waste_score}/100) and inactivity (${inactiveDays} days). User approval required to execute cancellation because ${exceedsAmountLimit ? `amount ($${amount.toFixed(2)}) exceeds auto limit ($${guardrails.auto_action_limit.toFixed(2)})` : `inactivity does not exceed autonomous threshold (${guardrails.unused_after_days} days)`}.`;
    }
    // PATH D: Low Inactivity but Trial Conversion with Moderate/High Waste
    else if (sub.is_trial_conversion && waste_score >= 50) {
      decisionState = 'REQUIRE_APPROVAL';
      action = 'ask_user';
      recommended_action = 'review';
      guardrail_status = 'requires_approval';
      guardrail_result = 'requires_approval';
      autonomous_action_allowed = false;
      requires_approval = true;
      reason = `Converted from free trial to paid recurring billing with elevated waste score (${waste_score}/100). User approval recommended to confirm ongoing intent.`;
    }
    // PATH E: Price Hike with High Waste
    else if (sub.price_hike_detected && waste_score >= 50) {
      decisionState = 'REQUIRE_APPROVAL';
      action = 'ask_user';
      recommended_action = 'review';
      guardrail_status = 'requires_approval';
      guardrail_result = 'requires_approval';
      autonomous_action_allowed = false;
      requires_approval = true;
      reason = `Unbudgeted price increase detected with elevated waste score (${waste_score}/100). User approval recommended before proceeding.`;
    }
    // PATH F: Active Service / Routine Retention
    else {
      decisionState = 'NO_ACTION';
      action = 'keep';
      recommended_action = 'keep';
      guardrail_status = 'passed';
      guardrail_result = 'allowed';
      autonomous_action_allowed = false;
      requires_approval = false;
      reason = `Active usage detected (last used ${inactiveDays === 0 ? 'today' : `${inactiveDays} days ago`}) with low waste evidence (${waste_score}/100). Matches ongoing retention policy.`;
    }

    const risk = this.assessRisk(sub, isProtected, isOverlap, exceedsAmountLimit, decisionState);

    const overlappingIds = overlapGroupSubs.map((o) => o.subscription_id);

    return {
      subscription_id: sub.subscription_id,
      action,
      decision: decisionState,
      recommended_action,
      reason,
      waste_score,
      confidence: decision_confidence, // backwards-compatible alias
      detection_confidence,
      decision_confidence,
      risk,
      requires_approval,
      guardrail_status,
      guardrail_result,
      autonomous_action_allowed,
      overlapping_subscription_ids: overlappingIds.length > 0 ? overlappingIds : undefined,
      waste_factors,
      guardrail_checks: guardrailChecks,
      evidence,
      evaluated_at: new Date().toISOString(),
    };
  }

  /**
   * Evaluates an entire collection of subscriptions against guardrails.
   */
  public evaluateAll(
    userId: string,
    subscriptions: Subscription[],
    guardrails: Guardrails,
    events: EmailEvent[] = []
  ): EvaluationResult {
    if (!subscriptions || !Array.isArray(subscriptions)) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
        'Subscriptions must be provided as an array for Block 2 evaluation'
      );
    }

    const decisions = subscriptions.map((sub) =>
      this.evaluateSubscription(sub, guardrails, subscriptions, events)
    );

    return {
      user_id: userId,
      decisions,
      evaluated_at: new Date().toISOString(),
    };
  }
}
