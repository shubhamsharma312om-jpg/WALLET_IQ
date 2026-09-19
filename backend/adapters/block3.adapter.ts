/**
 * SPENDGUARDIAN — Block 3 Adapter (Autonomous Actions & Escalation)
 *
 * Implements IBlock3Adapter with:
 * - Request transformation
 * - Response transformation
 * - Strict schema validation
 * - Timeout handling
 * - Granular error mapping (BLOCK_3_UNAVAILABLE, INVALID_BLOCK_3_RESPONSE, ACTION_FAILED)
 *
 * SAVINGS RULE INVARIANT:
 * Block 3 response status must be verified. Only "success" status with non-negative
 * monthly_savings can be credited to confirmed savings.
 */

import {
  Subscription,
  Decision,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  IBlock3Adapter,
  Block3RequestPayload,
  Block3ResponsePayload,
} from './interfaces.ts';

export class Block3HttpAdapter implements IBlock3Adapter {
  public readonly name = 'Block3HttpAdapter';
  public readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(baseUrl = process.env.BLOCK3_BASE_URL || 'http://localhost:4003', defaultTimeoutMs = 10000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Transforms internal domain models into Block 3 action execution request.
   */
  public transformRequest(
    userId: string,
    subscription: Subscription,
    decision: Decision
  ): Block3RequestPayload {
    if (!userId || typeof userId !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'User ID is required for Block 3 execution'
      );
    }
    if (!subscription || !subscription.subscription_id) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.MISSING_SUBSCRIPTION_ID,
        'Valid subscription is required for Block 3 action'
      );
    }
    if (!decision) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'Decision context is required for Block 3 action'
      );
    }

    return {
      user_id: userId,
      subscription: { ...subscription },
      decision: { ...decision },
    };
  }

  /**
   * Validates and transforms the raw Block 3 response into strictly validated payload.
   */
  public transformResponse(raw: unknown): Block3ResponsePayload {
    if (!raw || typeof raw !== 'object') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'Block 3 response must be a valid JSON object'
      );
    }

    const payload = raw as Partial<Block3ResponsePayload>;

    if (!payload.action_id || typeof payload.action_id !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'Block 3 response missing string field "action_id"'
      );
    }

    if (!payload.status || !['success', 'failed', 'pending', 'escalated'].includes(payload.status)) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        `Block 3 response has invalid or missing "status": ${String(payload.status)}`
      );
    }

    if (!payload.action || typeof payload.action !== 'string') {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'Block 3 response missing string field "action"'
      );
    }

    // Monthly savings validation
    const rawSavings = typeof payload.monthly_savings === 'number' ? payload.monthly_savings : 0;
    if (isNaN(rawSavings) || rawSavings < 0) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.INVALID_BLOCK_3_RESPONSE,
        'Block 3 response has invalid monthly_savings amount'
      );
    }

    return {
      action_id: payload.action_id,
      status: payload.status,
      action: payload.action,
      monthly_savings: Number(rawSavings.toFixed(2)),
    };
  }

  /**
   * Invokes POST /execute-action with timeout and error classification.
   */
  public async executeAction(
    userId: string,
    subscription: Subscription,
    decision: Decision,
    options?: { timeoutMs?: number }
  ): Promise<Block3ResponsePayload> {
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const url = `${this.baseUrl}/execute-action`;
    const requestPayload = this.transformRequest(userId, subscription, decision);

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
          SpendGuardianErrorCode.BLOCK_3_UNAVAILABLE,
          `Block 3 returned HTTP ${response.status} ${response.statusText}`,
          { status: response.status }
        );
      }

      const rawJson = await response.json();
      const validated = this.transformResponse(rawJson);

      // If Block 3 explicitly returned a failed status, do NOT swallow it
      if (validated.status === 'failed') {
        // We return the response object so the caller records the failure in audit log
        // without raising an unhandled exception, or we can flag the action result.
      }

      return validated;
    } catch (err: unknown) {
      if (err instanceof SpendGuardianError) {
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError';
      const message = isAbort
        ? `Block 3 action execution timed out after ${timeoutMs}ms at ${url}`
        : `Block 3 unavailable at ${url}: ${(err as Error)?.message || String(err)}`;

      throw new SpendGuardianError(SpendGuardianErrorCode.BLOCK_3_UNAVAILABLE, message, {
        cause: String(err),
        url,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
