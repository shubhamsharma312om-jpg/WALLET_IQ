/**
 * SPENDGUARDIAN — Block 2 Adapter (Decision, Scoring & Guardrails)
 *
 * Implements IBlock2Adapter with:
 * - Request transformation
 * - Response transformation
 * - Strict schema validation
 * - Timeout handling
 * - Granular error mapping (BLOCK_2_UNAVAILABLE, INVALID_BLOCK_2_RESPONSE)
 */

import {
  Subscription,
  EmailEvent,
  Guardrails,
  Decision,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  IBlock2Adapter,
  Block2RequestPayload,
  Block2ResponsePayload,
} from './interfaces.ts';

export class Block2HttpAdapter implements IBlock2Adapter {
  public readonly name = 'Block2HttpAdapter';
  public readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(baseUrl = process.env.BLOCK2_BASE_URL || 'http://localhost:4002', defaultTimeoutMs = 8000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Transforms domain entities into Block 2 request contract.
   */
  public transformRequest(
    userId: string,
    subscriptions: Subscription[],
    events: EmailEvent[],
    guardrails: Guardrails
  ): Block2RequestPayload {
    if (!userId || typeof userId !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
        'User ID is required for Block 2 evaluation'
      );
    }

    return {
      user_id: userId,
      subscriptions: subscriptions.map((s) => ({
        subscription_id: s.subscription_id,
        merchant: s.merchant,
        category: s.category,
        amount: Number(s.amount),
        currency: s.currency,
        cadence: s.cadence,
        last_used_days_ago: s.last_used_days_ago,
        waste_score: s.waste_score,
        confidence: s.confidence,
        risk: s.risk,
        status: s.status,
        recommended_action: s.recommended_action,
      })),
      events: events.map((e) => ({
        event_id: e.event_id,
        user_id: e.user_id || userId,
        subject: e.subject,
        sender: e.sender,
        date: e.date,
        snippet: e.snippet,
        event_type: e.event_type,
        metadata: e.metadata,
      })),
      guardrails: {
        auto_action_limit: Number(guardrails.auto_action_limit),
        protected_categories: Array.isArray(guardrails.protected_categories)
          ? guardrails.protected_categories
          : [],
        minimum_confidence: Number(guardrails.minimum_confidence),
        duplicate_subscriptions: guardrails.duplicate_subscriptions || 'require_approval',
        unused_after_days: Number(guardrails.unused_after_days),
      },
    };
  }

  /**
   * Validates and transforms the raw Block 2 response into strictly typed Decision models.
   */
  public transformResponse(raw: unknown): Block2ResponsePayload {
    if (!raw || typeof raw !== 'object') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
        'Block 2 response must be a valid JSON object'
      );
    }

    const payload = raw as Partial<Block2ResponsePayload>;

    if (!payload.user_id || typeof payload.user_id !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
        'Block 2 response missing string field "user_id"'
      );
    }

    if (!Array.isArray(payload.decisions)) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
        'Block 2 response missing array field "decisions"'
      );
    }

    const validatedDecisions: Decision[] = payload.decisions.map((d: unknown, index: number) => {
      if (!d || typeof d !== 'object') {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
          `Block 2 decision at index ${index} is not an object`
        );
      }

      const decision = d as Partial<Decision>;

      if (!decision.subscription_id || typeof decision.subscription_id !== 'string') {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
          `Block 2 decision at index ${index} is missing "subscription_id"`
        );
      }

      if (!decision.action || typeof decision.action !== 'string') {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.INVALID_BLOCK_2_RESPONSE,
          `Decision for subscription ${decision.subscription_id} missing "action"`
        );
      }

      return {
        subscription_id: decision.subscription_id,
        action: decision.action,
        decision: decision.decision,
        recommended_action: decision.recommended_action,
        reason: decision.reason || 'Evaluated by Block 2 decision engine',
        waste_score: typeof decision.waste_score === 'number' ? decision.waste_score : 0,
        confidence: typeof decision.confidence === 'number' ? decision.confidence : 0,
        detection_confidence:
          typeof decision.detection_confidence === 'number' ? decision.detection_confidence : undefined,
        decision_confidence:
          typeof decision.decision_confidence === 'number' ? decision.decision_confidence : undefined,
        risk: decision.risk || 'low',
        requires_approval: Boolean(decision.requires_approval),
        guardrail_status: decision.guardrail_status || 'passed',
        guardrail_result: decision.guardrail_result,
        autonomous_action_allowed:
          typeof decision.autonomous_action_allowed === 'boolean'
            ? decision.autonomous_action_allowed
            : undefined,
        overlapping_subscription_ids: Array.isArray(decision.overlapping_subscription_ids)
          ? decision.overlapping_subscription_ids
          : undefined,
        waste_factors: Array.isArray(decision.waste_factors) ? decision.waste_factors : undefined,
        guardrail_checks: Array.isArray(decision.guardrail_checks) ? decision.guardrail_checks : undefined,
        evidence: Array.isArray(decision.evidence) ? decision.evidence : undefined,
        evaluated_at: decision.evaluated_at,
      };
    });

    return {
      user_id: payload.user_id,
      decisions: validatedDecisions,
    };
  }

  /**
   * Invokes POST /evaluate-subscriptions with timeout and error classification.
   */
  public async evaluateSubscriptions(
    userId: string,
    subscriptions: Subscription[],
    events: EmailEvent[],
    guardrails: Guardrails,
    options?: { timeoutMs?: number }
  ): Promise<Block2ResponsePayload> {
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const url = `${this.baseUrl}/evaluate-subscriptions`;
    const requestPayload = this.transformRequest(userId, subscriptions, events, guardrails);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.BLOCK_2_UNAVAILABLE,
          `Block 2 returned HTTP ${response.status} ${response.statusText}`,
          { status: response.status }
        );
      }

      const rawJson = await response.json();
      return this.transformResponse(rawJson);
    } catch (err: unknown) {
      if (err instanceof SpendGuardianError) {
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError';
      const message = isAbort
        ? `Block 2 request timed out after ${timeoutMs}ms at ${url}`
        : `Block 2 unavailable at ${url}: ${(err as Error)?.message || String(err)}`;

      throw new SpendGuardianError(SpendGuardianErrorCode.BLOCK_2_UNAVAILABLE, message, {
        cause: String(err),
        url,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
