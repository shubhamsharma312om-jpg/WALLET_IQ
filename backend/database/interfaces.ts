/**
 * SPENDGUARDIAN — Database & Persistence Interface
 *
 * Defines the contract for persisting subscriptions, transactions,
 * decisions, guardrails, action results, audit events, and savings summaries.
 */

import {
  Subscription,
  Transaction,
  Decision,
  Guardrails,
  ActionResult,
  AuditEvent,
  SavingsSummary,
  AutoCancelSettings,
  AutoCancelState,
  AutomationNotification,
} from '../models/index.ts';
import { ApprovalRequest, EscalationRecord } from '../block3-engine/action-types.ts';

export interface IDatabase {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Subscriptions
  saveSubscriptions(userId: string, subs: Subscription[]): Promise<void>;
  getSubscriptions(userId: string): Promise<Subscription[]>;
  getSubscriptionById(userId: string, subscriptionId: string): Promise<Subscription | null>;

  // Transactions
  saveTransactions(userId: string, txs: Transaction[]): Promise<void>;
  getTransactions(userId: string): Promise<Transaction[]>;

  // Decisions
  saveDecisions(userId: string, decisions: Decision[]): Promise<void>;
  getDecisions(userId: string): Promise<Decision[]>;
  getDecisionBySubscriptionId(userId: string, subscriptionId: string): Promise<Decision | null>;

  // Guardrails
  saveGuardrails(userId: string, guardrails: Guardrails): Promise<void>;
  getGuardrails(userId: string): Promise<Guardrails>;

  // Action Results
  saveActionResult(userId: string, result: ActionResult): Promise<void>;
  getActionResults(userId: string): Promise<ActionResult[]>;
  getActionResultBySubscriptionId(userId: string, subscriptionId: string): Promise<ActionResult | null>;

  // Approval Requests
  saveApprovalRequest(userId: string, req: ApprovalRequest): Promise<void>;
  getApprovalRequests(userId: string): Promise<ApprovalRequest[]>;
  getApprovalRequestById(userId: string, approvalId: string): Promise<ApprovalRequest | null>;
  updateApprovalRequest(userId: string, req: ApprovalRequest): Promise<void>;

  // Escalation Records
  saveEscalationRecord(userId: string, record: EscalationRecord): Promise<void>;
  getEscalationRecords(userId: string): Promise<EscalationRecord[]>;

  // Audit Events
  addAuditEvent(userId: string, event: AuditEvent): Promise<void>;
  getAuditEvents(userId: string): Promise<AuditEvent[]>;


  // Auto-cancel automation
  getAutoCancelSettings(userId: string): Promise<AutoCancelSettings>;
  saveAutoCancelSettings(userId: string, settings: AutoCancelSettings): Promise<void>;
  getAutoCancelStates(userId: string): Promise<AutoCancelState[]>;
  getAutoCancelState(userId: string, subscriptionId: string): Promise<AutoCancelState | null>;
  saveAutoCancelState(userId: string, state: AutoCancelState): Promise<void>;
  addAutomationNotification(userId: string, notification: AutomationNotification): Promise<boolean>;
  getAutomationNotifications(userId: string, unreadOnly?: boolean): Promise<AutomationNotification[]>;
  markAutomationNotification(userId: string, id: number, updates: { read?: boolean; delivered?: boolean }): Promise<void>;

  // Savings
  getSavingsSummary(userId: string): Promise<SavingsSummary>;
  updateSavingsSummary(userId: string, summary: SavingsSummary): Promise<void>;
  saveSavingsSummary(userId: string, summary: SavingsSummary): Promise<void>;
  recordConfirmedSavings(userId: string, monthlySavingsDelta: number): Promise<SavingsSummary>;
}
