/**
 * SPENDGUARDIAN — Deterministic Mock Action Execution Adapter
 *
 * Simulates merchant cancellation and downgrade operations without live credentials.
 * Supports deterministic failure modes for test verification.
 */

import { IActionExecutionAdapter } from './action-adapter.ts';
import { ActionExecutionParams, ActionExecutionResponse } from './action-types.ts';

export class MockActionAdapter implements IActionExecutionAdapter {
  public readonly name = 'MockActionAdapter';
  public shouldSimulateFailure = false;
  public failForSubscriptionIds: Set<string> = new Set();
  public executionCount = 0;
  public executedParams: ActionExecutionParams[] = [];
  public failNextCount = 0;
  public simulateError = false;
  public errorMessage = 'Simulated merchant action failure';

  public setSimulateFailure(fail: boolean): void {
    this.shouldSimulateFailure = fail;
  }

  public setSimulateError(simulate: boolean, message = 'Simulated merchant action failure'): void {
    this.simulateError = simulate;
    this.errorMessage = message;
  }

  public failNext(count = 1): void {
    this.failNextCount = count;
  }

  public addFailingSubscriptionId(subscriptionId: string): void {
    this.failForSubscriptionIds.add(subscriptionId);
  }

  public clearFailingSubscriptionIds(): void {
    this.failForSubscriptionIds.clear();
  }

  public async execute(params: ActionExecutionParams): Promise<ActionExecutionResponse> {
    this.executionCount++;
    this.executedParams.push(params);

    if (this.simulateError) {
      throw new Error(this.errorMessage);
    }

    const timestamp = Date.now();
    const actionId = `action_${params.subscriptionId}_${timestamp}`;

    // Deterministic failure simulation
    if (
      this.shouldSimulateFailure ||
      this.failForSubscriptionIds.has(params.subscriptionId) ||
      this.failNextCount > 0
    ) {
      if (this.failNextCount > 0) this.failNextCount--;
      return {
        action_id: actionId,
        status: 'FAILED',
        action: params.action,
        subscription_id: params.subscriptionId,
        merchant: params.merchant,
        monthly_savings: 0,
        simulated: true,
        message: 'Simulated merchant action failure',
        error_code: 'ACTION_EXECUTION_FAILED',
      };
    }

    if (params.action === 'cancel') {
      return {
        action_id: actionId,
        status: 'SUCCESS',
        action: 'cancel',
        subscription_id: params.subscriptionId,
        merchant: params.merchant,
        monthly_savings: Number(params.amount.toFixed(2)),
        simulated: true,
        message: 'Simulated cancellation completed successfully',
      };
    }

    if (params.action === 'downgrade') {
      const targetAmount =
        params.downgradeTargetAmount !== undefined
          ? params.downgradeTargetAmount
          : Math.max(0, Number((params.amount * 0.5).toFixed(2)));
      const savings = Math.max(0, Number((params.amount - targetAmount).toFixed(2)));

      return {
        action_id: actionId,
        status: 'SUCCESS',
        action: 'downgrade',
        subscription_id: params.subscriptionId,
        merchant: params.merchant,
        monthly_savings: savings,
        simulated: true,
        message: `Simulated downgrade from $${params.amount.toFixed(2)} to $${targetAmount.toFixed(2)} completed successfully`,
      };
    }

    // Default: pause or unsupported action
    return {
      action_id: actionId,
      status: 'FAILED',
      action: params.action,
      subscription_id: params.subscriptionId,
      merchant: params.merchant,
      monthly_savings: 0,
      simulated: true,
      message: `Unsupported action type: ${params.action}`,
      error_code: 'UNSUPPORTED_ACTION',
    };
  }
}

export const MockActionExecutionAdapter = MockActionAdapter;
export type MockActionExecutionAdapter = MockActionAdapter;

