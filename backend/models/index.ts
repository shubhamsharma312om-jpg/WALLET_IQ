/**
 * SPENDGUARDIAN — Shared Data Models & Architectural Contracts
 *
 * These models are the authoritative domain types shared across the
 * orchestrator, adapters, database, and API layers.
 */

// ============================================================================
// 1. Transaction Model
// ============================================================================
export interface Transaction {
  transaction_id: string;
  user_id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string; // ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
  category: string;
  payment_method?: string;
  description?: string;
}

// ============================================================================
// 2. Email Event Model
// ============================================================================
export type EmailEventType =
  | 'price_increase'
  | 'trial_ending'
  | 'renewal_notice'
  | 'receipt'
  | 'cancellation_confirmation'
  | 'other';

export interface EmailEvent {
  event_id: string;
  user_id: string;
  subject: string;
  sender: string;
  date: string; // ISO 8601
  snippet: string;
  event_type: EmailEventType;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 3. Subscription Model (Block 1 Detection Output)
// ============================================================================
export type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionRisk = 'low' | 'medium' | 'high' | 'critical';
export type SubscriptionStatus = 'active' | 'cancelling' | 'cancelled' | 'paused' | 'flagged';
export type RecommendedAction = 'keep' | 'cancel' | 'review' | 'pause' | 'downgrade';

export interface Subscription {
  subscription_id: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  cadence: SubscriptionCadence;
  last_used_days_ago: number;
  waste_score: number; // 0 to 100
  confidence: number; // 0 to 100
  risk: SubscriptionRisk;
  status: SubscriptionStatus;
  recommended_action: RecommendedAction;

  // Block 1 Detection & Intelligence Metadata
  detection_confidence?: number;
  normalized_merchant?: string;
  is_trial_conversion?: boolean;
  trial_conversion_details?: {
    trial_start_date?: string;
    converted_date?: string;
    trial_amount?: number;
    converted_amount?: number;
    notes?: string;
  };
  price_hike_detected?: boolean;
  previous_amount?: number;
  price_hike_details?: {
    previous_amount: number;
    current_amount: number;
    hike_percentage: number;
    detected_from?: string;
    notice_date?: string;
  };
  duplicate_group?: string;
  overlap_detected?: boolean;
  overlap_confidence?: number;
  evidence?: string[];
  source_transaction_ids?: string[];
  source_email_ids?: string[];
  awaiting_decision?: boolean;

  // Renewal / inactivity automation metadata
  next_renewal_date?: string; // ISO 8601 date/time when the next charge is expected
  renewal_date_source?: 'email' | 'cadence_estimate' | 'manual' | 'demo';
  usage_signal_available?: boolean; // Gmail alone cannot prove product usage
  usage_source?: 'external' | 'manual' | 'unknown' | 'demo';
  last_used_at?: string; // ISO 8601 when a reliable usage signal is available
}

// ============================================================================
// 4. Guardrails Model (User-Configurable State)
// ============================================================================
export type DuplicateHandling = 'require_approval' | 'auto_cancel_lower_usage' | 'ignore';

export interface Guardrails {
  user_id?: string;
  auto_action_limit: number; // Maximum dollar amount allowed for autonomous cancellation (e.g. 20)
  protected_categories: string[]; // Categories forbidden from autonomous cancellation (e.g. ["insurance", "loan_payment"])
  minimum_confidence: number; // Minimum confidence score (0-100) required to act autonomously (e.g. 90)
  duplicate_subscriptions: DuplicateHandling; // Rule for handling overlapping subscriptions (e.g. 'require_approval')
  unused_after_days: number; // Days of inactivity before subscription is flagged as candidate for action (e.g. 90)
}

// ============================================================================
// 5. Decision Model (Block 2 Scoring Output)
// ============================================================================
export type DecisionAction = 'cancel' | 'keep' | 'ask_user' | 'pause' | 'downgrade' | 'review';
export type GuardrailStatus = 'passed' | 'blocked' | 'requires_approval';
export type DecisionState =
  | 'AUTO_CANCEL'
  | 'AUTO_DOWNGRADE'
  | 'REQUIRE_APPROVAL'
  | 'PROTECTED'
  | 'NO_ACTION'
  | 'ESCALATE';

export interface WasteFactor {
  factor: string;
  contribution: number;
  reason: string;
}

export interface GuardrailCheck {
  check: string;
  passed: boolean;
  reason: string;
}

export interface Decision {
  subscription_id: string;
  action: DecisionAction;
  decision?: DecisionState;
  recommended_action?: 'cancel' | 'downgrade' | 'keep' | 'pause' | 'review' | 'none';
  reason: string;
  waste_score: number; // 0 to 100
  confidence: number; // 0 to 100 (backwards compatible alias to decision_confidence)
  detection_confidence?: number; // 0 to 100 (Block 1 intelligence)
  decision_confidence?: number; // 0 to 100 (Block 2 intelligence)
  risk: SubscriptionRisk; // 'low' | 'medium' | 'high'
  requires_approval: boolean;
  guardrail_status: GuardrailStatus; // 'passed' | 'blocked' | 'requires_approval'
  guardrail_result?: 'allowed' | 'blocked' | 'requires_approval';
  autonomous_action_allowed?: boolean;
  overlapping_subscription_ids?: string[];
  downgrade_target_amount?: number;
  downgrade_target?: string;
  estimated_monthly_savings?: number;
  waste_factors?: WasteFactor[];
  guardrail_checks?: GuardrailCheck[];
  evidence?: string[];
  evaluated_at?: string;
}

// ============================================================================
// 6. Action Result Model (Block 3 Execution Output)
// ============================================================================
export type ActionResultStatus = 'success' | 'failed' | 'pending' | 'escalated';
export type ExecutedActionType = 'cancel' | 'pause' | 'negotiate' | 'approval_requested';

export interface ActionResult {
  action_id: string;
  subscription_id: string;
  status: ActionResultStatus;
  action: ExecutedActionType;
  reason: string;
  monthly_savings: number;
  simulated: boolean;
  timestamp: string; // ISO 8601
}

// ============================================================================
// 7. Audit Event Model
// ============================================================================
export type AuditStatus = 'success' | 'failed' | 'blocked' | 'pending' | 'escalated' | 'completed';

export interface AuditEvent {
  id?: string;
  timestamp: string; // ISO 8601
  merchant: string;
  action: string;
  status: AuditStatus;
  reason: string;
  savings: number;
  subscription_id?: string;
}

// ============================================================================
// 8. Savings Summary Model
// ============================================================================
/**
 * SAVINGS RULE:
 * - potential_savings: calculated from recommended actions / decisions.
 * - confirmed_savings: ONLY increases after Block 3 explicitly returns
 *   status === 'success' and monthly_savings > 0.
 * Never count failed, pending, or blocked actions as confirmed savings.
 */
export interface SavingsSummary {
  potential_savings: number;
  confirmed_savings: number;
  currency: string;
  last_updated: string;
  subscriptions_scanned?: number;
}

// ============================================================================
// 9. Error Codes & Error Classification
// ============================================================================
export enum SpendGuardianErrorCode {
  BLOCK_1_UNAVAILABLE = 'BLOCK_1_UNAVAILABLE',
  BLOCK_2_UNAVAILABLE = 'BLOCK_2_UNAVAILABLE',
  BLOCK_3_UNAVAILABLE = 'BLOCK_3_UNAVAILABLE',
  INVALID_BLOCK_1_RESPONSE = 'INVALID_BLOCK_1_RESPONSE',
  INVALID_BLOCK_2_RESPONSE = 'INVALID_BLOCK_2_RESPONSE',
  INVALID_BLOCK_3_RESPONSE = 'INVALID_BLOCK_3_RESPONSE',
  MISSING_SUBSCRIPTION_ID = 'MISSING_SUBSCRIPTION_ID',
  ACTION_FAILED = 'ACTION_FAILED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  GUARDRAIL_BLOCKED = 'GUARDRAIL_BLOCKED',
  ACTION_EXECUTION_FAILED = 'ACTION_EXECUTION_FAILED',
  MALFORMED_DECISION = 'MALFORMED_DECISION',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND',
  INVALID_APPROVAL_STATE = 'INVALID_APPROVAL_STATE',
  INVALID_APPROVAL_STATUS = 'INVALID_APPROVAL_STATUS',
}

export class SpendGuardianError extends Error {
  public readonly code: SpendGuardianErrorCode;
  public readonly details?: unknown;
  public readonly httpStatus: number;

  constructor(code: SpendGuardianErrorCode, message: string, details?: unknown, httpStatus = 500) {
    super(message);
    this.name = 'SpendGuardianError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, SpendGuardianError.prototype);
  }
}

// ============================================================================
// 10. Demo Workflow Stages
// ============================================================================
export enum WorkflowStageId {
  ANALYZING_TRANSACTIONS = 'analyzing_transactions',
  DETECTING_SUBSCRIPTIONS = 'detecting_subscriptions',
  EVALUATING_WASTE = 'evaluating_waste',
  CHECKING_GUARDRAILS = 'checking_guardrails',
  EXECUTING_SAFE_ACTIONS = 'executing_safe_actions',
  PREPARING_APPROVAL_REQUESTS = 'preparing_approval_requests',
  AUDIT_COMPLETE = 'audit_complete',
}

export interface WorkflowProgress {
  stage: WorkflowStageId;
  stageNumber: number; // 1 to 7
  totalStages: number; // 7
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export const WORKFLOW_STAGES_CONFIG: Array<{ stage: WorkflowStageId; label: string; number: number }> = [
  { stage: WorkflowStageId.ANALYZING_TRANSACTIONS, label: '1. Analyzing transactions...', number: 1 },
  { stage: WorkflowStageId.DETECTING_SUBSCRIPTIONS, label: '2. Detecting subscriptions...', number: 2 },
  { stage: WorkflowStageId.EVALUATING_WASTE, label: '3. Evaluating waste...', number: 3 },
  { stage: WorkflowStageId.CHECKING_GUARDRAILS, label: '4. Checking guardrails...', number: 4 },
  { stage: WorkflowStageId.EXECUTING_SAFE_ACTIONS, label: '5. Executing safe actions...', number: 5 },
  { stage: WorkflowStageId.PREPARING_APPROVAL_REQUESTS, label: '6. Preparing approval requests...', number: 6 },
  { stage: WorkflowStageId.AUDIT_COMPLETE, label: '7. Audit complete.', number: 7 },
];

export interface AuditRunResult {
  userId: string;
  subscriptions: Subscription[];
  decisions: Decision[];
  autoExecutedActions: ActionResult[];
  pendingApprovals: Decision[];
  savings: SavingsSummary;
  auditEvents: AuditEvent[];
  completedAt: string;
}

export * from '../block3-engine/action-types.ts';



// ============================================================================
// 8. Auto-Cancel Automation Models
// ============================================================================
export interface AutoCancelSettings {
  user_id?: string;
  enabled: boolean;
  inactivity_days: number;
  first_reminder_days_before: number;
  second_reminder_days_before: number;
  final_window_hours: 24 | 48;
  auto_cancel_when_ignored: boolean;
  desktop_notifications: boolean;
}

export type AutoCancelStatus =
  | 'monitoring'
  | 'needs_renewal_date'
  | 'usage_unknown'
  | 'reminding'
  | 'scheduled'
  | 'kept_for_cycle'
  | 'snoozed'
  | 'cancelled'
  | 'blocked'
  | 'failed';

export interface AutoCancelState {
  user_id?: string;
  subscription_id: string;
  enabled: boolean;
  next_renewal_date?: string;
  renewal_date_source?: Subscription['renewal_date_source'];
  last_used_at?: string;
  manual_last_used_days_ago?: number;
  usage_source: 'subscription_signal' | 'manual' | 'unknown';
  status: AutoCancelStatus;
  responded: boolean;
  response?: 'keep' | 'snooze' | 'cancel_now' | 'mark_used';
  snoozed_until?: string;
  cycle_key?: string;
  last_reminder_stage?: string;
  last_checked_at?: string;
  last_action_simulated?: boolean;
  note?: string;
  updated_at: string;
}

export type AutomationNotificationType =
  | 'reminder'
  | 'final_warning'
  | 'auto_cancelled'
  | 'auto_cancel_failed'
  | 'blocked'
  | 'info';

export interface AutomationNotification {
  id?: number;
  user_id?: string;
  subscription_id?: string;
  type: AutomationNotificationType;
  title: string;
  body: string;
  dedupe_key: string;
  created_at: string;
  read: boolean;
  delivered: boolean;
}

export interface AutoCancelSubscriptionView {
  subscription: Subscription;
  state: AutoCancelState;
  inactive_days: number | null;
  days_until_renewal: number | null;
  hours_until_renewal: number | null;
  eligible_for_auto_cancel: boolean;
  guardrail_reason?: string;
}

export interface AutoCancelCheckResult {
  checked_at: string;
  user_id: string;
  evaluated: number;
  reminders_created: number;
  actions_triggered: number;
  blocked: number;
  subscriptions: AutoCancelSubscriptionView[];
}
