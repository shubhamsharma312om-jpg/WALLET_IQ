/**
 * SPENDGUARDIAN — Mock / Contract Stub Adapters
 *
 * Used for contract testing, unit tests, and local dry-runs when teammate
 * services are not yet deployed. Demonstrates the three canonical demo cases
 * without coupling to teammate code.
 */

import {
  Subscription,
  Transaction,
  EmailEvent,
  Guardrails,
  Decision,
  SpendGuardianError,
  SpendGuardianErrorCode,
} from '../models/index.ts';
import {
  IBlock1Adapter,
  IBlock2Adapter,
  IBlock3Adapter,
  Block1ResponsePayload,
  Block2ResponsePayload,
  Block3ResponsePayload,
} from './interfaces.ts';

export class MockBlock1Adapter implements IBlock1Adapter {
  public readonly name = 'MockBlock1Adapter';
  public readonly baseUrl = 'mock://block1';
  public shouldSimulateFailure = false;
  public customSubscriptions: Subscription[] | null = null;

  public async analyzeSubscriptions(
    userId: string,
    transactions: Transaction[],
    emails: EmailEvent[]
  ): Promise<Block1ResponsePayload> {
    if (this.shouldSimulateFailure) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.BLOCK_1_UNAVAILABLE,
        'Mock Block 1 simulation error: Service unavailable'
      );
    }

    if (this.customSubscriptions) {
      return {
        user_id: userId,
        subscriptions: this.customSubscriptions,
        events: emails,
      };
    }

    // PRACTICAL DATA ISOLATION FIX:
    // If we are in practical mode or only have emails (no transactions), 
    // dynamically generate the subscriptions from the actual EmailEvent metadata!
    if (userId === 'u_practical' || (transactions.length === 0 && emails.length > 0)) {
      const parsedSubscriptions: Subscription[] = emails.map((e, index) => {
        const meta = e.metadata as any || {};
        const amount = typeof meta.amount === 'number' ? meta.amount : 0;
        const merchant = typeof meta.merchant === 'string' ? meta.merchant : e.sender;
        return {
          subscription_id: `sub_gmail_${index}_${Date.now()}`,
          merchant: merchant || 'Unknown Merchant',
          category: 'general',
          amount,
          currency: (meta.currency as string) || 'USD',
          cadence: ((meta.cadence as string) || 'monthly') as Subscription['cadence'],
          last_used_days_ago: 0,
          waste_score: 50, // Block 2 will overwrite this
          confidence: (meta.confidence as number) || 80,
          risk: 'low',
          status: 'active',
          recommended_action: 'review',
        };
      });

      return {
        user_id: userId,
        subscriptions: parsedSubscriptions,
        events: emails,
      };
    }

    // Default mock detection incorporating the required demo cases
    const subscriptions: Subscription[] = [
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
      {
        subscription_id: 'sub_tunewave',
        merchant: 'TuneWave',
        category: 'streaming_music',
        amount: 9.99,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 4,
        waste_score: 15,
        confidence: 92,
        risk: 'low',
        status: 'active',
        recommended_action: 'keep',
      },
      {
        subscription_id: 'sub_musicbox',
        merchant: 'MusicBox Premium',
        category: 'streaming_music',
        amount: 11.99,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 40,
        waste_score: 70,
        confidence: 91,
        risk: 'medium',
        status: 'active',
        recommended_action: 'review',
      },
      {
        subscription_id: 'sub_healthguard',
        merchant: 'HealthGuard Insurance',
        category: 'insurance',
        amount: 89.0,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 12,
        waste_score: 10,
        confidence: 98,
        risk: 'high',
        status: 'active',
        recommended_action: 'keep',
      },
      {
        subscription_id: 'sub_cloudpro',
        merchant: 'CloudPro',
        category: 'cloud_storage',
        amount: 19.99,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 8,
        waste_score: 45,
        confidence: 90,
        risk: 'low',
        status: 'active',
        recommended_action: 'review',
      },
      {
        subscription_id: 'sub_fitpulse',
        merchant: 'FitPulse Pro',
        category: 'fitness',
        amount: 29.99,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 65,
        waste_score: 85,
        confidence: 94,
        risk: 'low',
        status: 'active',
        recommended_action: 'cancel',
      },
    ];

    return {
      user_id: userId,
      subscriptions,
      events: emails,
    };
  }
}

import { Block2DecisionEngine } from '../block2-engine/decision-engine.ts';

export class MockBlock2Adapter implements IBlock2Adapter {
  public readonly name = 'MockBlock2Adapter';
  public readonly baseUrl = 'mock://block2';
  public shouldSimulateFailure = false;
  private readonly engine = new Block2DecisionEngine();

  public async evaluateSubscriptions(
    userId: string,
    subscriptions: Subscription[],
    events: EmailEvent[],
    guardrails: Guardrails
  ): Promise<Block2ResponsePayload> {
    if (this.shouldSimulateFailure) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.BLOCK_2_UNAVAILABLE,
        'Mock Block 2 simulation error: Service unavailable'
      );
    }

    const evaluation = this.engine.evaluateAll(userId, subscriptions, guardrails, events);

    return {
      user_id: evaluation.user_id,
      decisions: evaluation.decisions,
    };
  }
}

export class MockBlock3Adapter implements IBlock3Adapter {
  public readonly name = 'MockBlock3Adapter';
  public readonly baseUrl = 'mock://block3';
  public shouldSimulateFailure = false;
  public failForSubscriptionIds: string[] = [];

  public async executeAction(
    userId: string,
    subscription: Subscription,
    decision: Decision
  ): Promise<Block3ResponsePayload> {
    if (this.shouldSimulateFailure) {
      throw new SpendGuardianError(
        SpendGuardianErrorCode.BLOCK_3_UNAVAILABLE,
        'Mock Block 3 simulation error: Action service offline'
      );
    }

    if (this.failForSubscriptionIds.includes(subscription.subscription_id)) {
      return {
        action_id: `act_fail_${Date.now()}`,
        status: 'failed',
        action: decision.action,
        monthly_savings: 0,
      };
    }

    // Successful action execution returns the exact confirmed monthly savings
    return {
      action_id: `act_${subscription.subscription_id}_${Date.now()}`,
      status: 'success',
      action: decision.action,
      monthly_savings: Number(subscription.amount.toFixed(2)),
    };
  }
}
