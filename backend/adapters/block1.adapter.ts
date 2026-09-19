/**
 * SPENDGUARDIAN — Block 1 Adapter (Detection & Subscription Intelligence)
 *
 * Implements IBlock1Adapter with:
 * - Request transformation
 * - Response transformation
 * - Strict schema validation
 * - Timeout handling
 * - Granular error mapping (BLOCK_1_UNAVAILABLE, INVALID_BLOCK_1_RESPONSE)
 */

import {
  Transaction,
  EmailEvent,
  Subscription,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  IBlock1Adapter,
  Block1RequestPayload,
  Block1ResponsePayload,
} from './interfaces.ts';

export class Block1HttpAdapter implements IBlock1Adapter {
  public readonly name = 'Block1HttpAdapter';
  public readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(baseUrl = process.env.BLOCK1_BASE_URL || 'http://localhost:8001', defaultTimeoutMs = 8000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Transforms internal domain models into Block 1 conceptual request format.
   */
  public transformRequest(userId: string, transactions: Transaction[], emails: EmailEvent[]): Block1RequestPayload {
    if (!userId || typeof userId !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
        'User ID is required for Block 1 analysis'
      );
    }

    return {
      user_id: userId,
      transactions: transactions.map((t) => ({
        transaction_id: t.transaction_id,
        user_id: t.user_id || userId,
        merchant: t.merchant,
        amount: Number(t.amount),
        currency: t.currency || 'USD',
        date: t.date,
        category: t.category,
        payment_method: t.payment_method,
        description: t.description,
      })),
      emails: emails.map((e) => ({
        event_id: e.event_id,
        user_id: e.user_id || userId,
        subject: e.subject,
        sender: e.sender,
        date: e.date,
        snippet: e.snippet,
        event_type: e.event_type,
        metadata: e.metadata,
      })),
      ...( { usage_events: [] } as any ),
    };
  }

  /**
   * Validates and transforms the raw Block 1 response into strictly typed canonical internal models.
   */
  public transformResponse(raw: unknown): Block1ResponsePayload {
    if (!raw || typeof raw !== 'object') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
        'Block 1 response must be a valid JSON object'
      );
    }

    const payload = raw as Partial<Block1ResponsePayload>;

    if (!payload.user_id || typeof payload.user_id !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
        'Block 1 response missing string field "user_id"'
      );
    }

    if (!Array.isArray(payload.subscriptions)) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
        'Block 1 response missing array field "subscriptions"'
      );
    }

    // Validate each subscription contract and map Friend 1 schema to canonical SpendGuardian model
    const validatedSubscriptions: Subscription[] = payload.subscriptions.map((s: unknown, index: number) => {
      if (!s || typeof s !== 'object') {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
          `Block 1 subscription at index ${index} is not an object`
        );
      }

      const rawSub = s as Record<string, any>;

      if (!rawSub.subscription_id || typeof rawSub.subscription_id !== 'string' || !rawSub.subscription_id.trim()) {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
          `Block 1 subscription at index ${index} is missing "subscription_id"`
        );
      }
      if (!rawSub.merchant || typeof rawSub.merchant !== 'string') {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
          `Subscription ${rawSub.subscription_id} missing "merchant"`
        );
      }
      if (typeof rawSub.amount !== 'number' || isNaN(rawSub.amount)) {
        throw new SpendGuardianError(
          SpendGuardianErrorCode.INVALID_BLOCK_1_RESPONSE,
          `Subscription ${rawSub.subscription_id} has invalid "amount"`
        );
      }

      // Cadence mapping: billing_cadence -> cadence
      const rawCadence = rawSub.billing_cadence || rawSub.cadence || 'monthly';
      const cadence = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(rawCadence)
        ? rawCadence
        : 'monthly';

      // Usage mapping: days_since_use -> last_used_days_ago
      const lastUsedDaysAgo = typeof rawSub.days_since_use === 'number'
        ? rawSub.days_since_use
        : typeof rawSub.last_used_days_ago === 'number'
        ? rawSub.last_used_days_ago
        : 0;

      // Detection confidence mapping: overall_detection_confidence -> detection_confidence & confidence
      const detectionConfidence = typeof rawSub.overall_detection_confidence === 'number'
        ? rawSub.overall_detection_confidence
        : typeof rawSub.confidence === 'number'
        ? rawSub.confidence
        : 90;

      // Trial conversion mapping: trial_conversion -> is_trial_conversion
      const isTrialConversion = Boolean(rawSub.trial_conversion || rawSub.is_trial_conversion);

      // Price hike mapping
      const priceHikeDetected = Boolean(rawSub.price_hike_detected);
      const priceHikeDetails = rawSub.price_hike_details || undefined;
      const previousAmount = priceHikeDetails?.previous_amount ?? rawSub.previous_amount;

      // Duplicate/overlap mapping: overlap_group_id -> duplicate_group
      const duplicateGroup = rawSub.overlap_group_id || rawSub.duplicate_group || undefined;
      const overlapDetected = Boolean(rawSub.overlap_detected || rawSub.overlap_group_id);

      // Responsibility Boundary: Block 1 is detection only (no waste scoring or decisions)
      const awaitingDecision = rawSub.waste_score === undefined;
      const wasteScore = typeof rawSub.waste_score === 'number' ? rawSub.waste_score : 0;
      const risk = (rawSub.risk || 'low') as Subscription['risk'];
      const status = (rawSub.status || 'active') as Subscription['status'];
      const recommendedAction = (rawSub.recommended_action || 'review') as Subscription['recommended_action'];

      return {
        subscription_id: rawSub.subscription_id,
        merchant: rawSub.merchant,
        category: rawSub.category || 'general',
        amount: Number(rawSub.amount),
        currency: rawSub.currency || 'USD',
        cadence,
        last_used_days_ago: lastUsedDaysAgo,
        waste_score: wasteScore,
        confidence: detectionConfidence,
        detection_confidence: detectionConfidence,
        risk,
        status,
        recommended_action: recommendedAction,
        awaiting_decision: awaitingDecision,
        normalized_merchant: rawSub.normalized_merchant || rawSub.merchant,
        is_trial_conversion: isTrialConversion,
        trial_conversion_details: rawSub.trial_conversion_details,
        price_hike_detected: priceHikeDetected,
        previous_amount: previousAmount,
        price_hike_details: priceHikeDetails,
        duplicate_group: duplicateGroup,
        overlap_detected: overlapDetected,
        overlap_confidence: rawSub.overlap_confidence,
        evidence: Array.isArray(rawSub.evidence) ? rawSub.evidence : [],
        source_transaction_ids: Array.isArray(rawSub.source_transaction_ids) ? rawSub.source_transaction_ids : [],
        source_email_ids: Array.isArray(rawSub.source_email_ids) ? rawSub.source_email_ids : [],
      };
    });

    const validatedEvents: EmailEvent[] = Array.isArray(payload.events) ? (payload.events as EmailEvent[]) : [];

    return {
      user_id: payload.user_id,
      subscriptions: validatedSubscriptions,
      events: validatedEvents,
    };
  }

  /**
   * Invokes POST /analyze-subscriptions with timeout and error classification.
   */
  public async analyzeSubscriptions(
    userId: string,
    transactions: Transaction[],
    emails: EmailEvent[],
    options?: { timeoutMs?: number }
  ): Promise<Block1ResponsePayload> {
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const url = `${this.baseUrl}/analyze-subscriptions`;
    const requestPayload = this.transformRequest(userId, transactions, emails);

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
          SpendGuardianErrorCode.BLOCK_1_UNAVAILABLE,
          `Block 1 returned HTTP ${response.status} ${response.statusText}`,
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
        ? `Block 1 request timed out after ${timeoutMs}ms at ${url}`
        : `Block 1 unavailable at ${url}: ${(err as Error)?.message || String(err)}`;

      throw new SpendGuardianError(SpendGuardianErrorCode.BLOCK_1_UNAVAILABLE, message, {
        cause: String(err),
        url,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
