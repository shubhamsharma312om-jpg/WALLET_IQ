/**
 * SPENDGUARDIAN — Block 3 Action Execution & Escalation Types
 *
 * Types for autonomous execution, approval workflows, escalations,
 * and deterministic action simulation.
 */

import { Decision, Subscription, SubscriptionRisk, ActionResultStatus } from '../models/index.ts';

export type Block3DecisionState =
  | 'AUTO_CANCEL'
  | 'AUTO_DOWNGRADE'
  | 'REQUIRE_APPROVAL'
  | 'PROTECTED'
  | 'NO_ACTION'
  | 'ESCALATE';

export type Block3ExecutionStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PENDING_APPROVAL'
  | 'PROTECTED'
  | 'NO_ACTION'
  | 'ESCALATED';

export type Block3ActionType = 'cancel' | 'downgrade' | 'keep' | 'pause' | 'none';

export interface Block3ExecutionResult {
  action_id: string;
  status: Block3ExecutionStatus;
  action: Block3ActionType;
  subscription_id: string;
  merchant: string;
  monthly_savings: number;
  simulated: boolean;
  message: string;
  reason?: string;
  timestamp: string;
  error_code?: string;
  idempotent_replayed?: boolean;
  approval_id?: string;
  escalation_id?: string;
}

export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalRequest {
  approval_id: string;
  user_id: string;
  subscription_id: string;
  merchant: string;
  requested_action: string;
  monthly_savings: number;
  reason: string;
  created_at: string;
  resolved_at?: string;
  status: ApprovalRequestStatus;
  decision?: Decision;
}

export type EscalationStatus = 'OPEN' | 'RESOLVED';

export interface EscalationRecord {
  escalation_id: string;
  user_id: string;
  subscription_id: string;
  merchant: string;
  action: string;
  reason: string;
  risk: SubscriptionRisk;
  created_at: string;
  status: EscalationStatus;
  decision?: Decision;
}

export interface ActionExecutionParams {
  userId: string;
  subscriptionId: string;
  merchant: string;
  action: 'cancel' | 'downgrade' | 'pause';
  amount: number;
  downgradeTargetAmount?: number;
  reason: string;
}

export interface ActionExecutionResponse {
  action_id: string;
  status: 'SUCCESS' | 'FAILED';
  action: 'cancel' | 'downgrade' | 'pause';
  subscription_id: string;
  merchant: string;
  monthly_savings: number;
  simulated: boolean;
  message: string;
  error_code?: string;
}
