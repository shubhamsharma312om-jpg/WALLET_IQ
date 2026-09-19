/**
 * SPENDGUARDIAN — Adapter Interfaces
 *
 * The orchestrator MUST depend strictly on these abstract interfaces.
 * When teammate implementations arrive or differ, custom adapters are written
 * that map the teammate's service to these interfaces without altering the
 * orchestrator or dashboard logic.
 */

import {
  Subscription,
  Transaction,
  EmailEvent,
  Guardrails,
  Decision,
  ActionResult,
} from '../models/index.ts';

// ============================================================================
// Block 1 — Detection & Intelligence Adapter Interface
// ============================================================================
export interface Block1RequestPayload {
  user_id: string;
  transactions: Transaction[];
  emails: EmailEvent[];
}

export interface Block1ResponsePayload {
  user_id: string;
  subscriptions: Subscription[];
  events: EmailEvent[];
}

export interface IBlock1Adapter {
  readonly name: string;
  readonly baseUrl: string;
  analyzeSubscriptions(
    userId: string,
    transactions: Transaction[],
    emails: EmailEvent[],
    options?: { timeoutMs?: number }
  ): Promise<Block1ResponsePayload>;
}

// ============================================================================
// Block 2 — Decision, Scoring & Guardrails Adapter Interface
// ============================================================================
export interface Block2RequestPayload {
  user_id: string;
  subscriptions: Subscription[];
  events: EmailEvent[];
  guardrails: Guardrails;
}

export interface Block2ResponsePayload {
  user_id: string;
  decisions: Decision[];
}

export interface IBlock2Adapter {
  readonly name: string;
  readonly baseUrl: string;
  evaluateSubscriptions(
    userId: string,
    subscriptions: Subscription[],
    events: EmailEvent[],
    guardrails: Guardrails,
    options?: { timeoutMs?: number }
  ): Promise<Block2ResponsePayload>;
}

// ============================================================================
// Block 3 — Autonomous Actions & Escalation Adapter Interface
// ============================================================================
export interface Block3RequestPayload {
  user_id: string;
  subscription: Subscription;
  decision: Decision;
}

export interface Block3ResponsePayload {
  action_id: string;
  status: 'success' | 'failed' | 'pending' | 'escalated';
  action: string;
  monthly_savings: number;
}

export interface IBlock3Adapter {
  readonly name: string;
  readonly baseUrl: string;
  executeAction(
    userId: string,
    subscription: Subscription,
    decision: Decision,
    options?: { timeoutMs?: number }
  ): Promise<Block3ResponsePayload>;
}
