/**
 * SPENDGUARDIAN — Orchestrator Interfaces
 */

import {
  Subscription,
  Transaction,
  EmailEvent,
  Guardrails,
  Decision,
  ActionResult,
  AuditEvent,
  SavingsSummary,
  WorkflowProgress,
} from '../models/index.ts';

export interface AuditRunOptions {
  userId: string;
  transactions?: Transaction[];
  emails?: EmailEvent[];
  guardrails?: Guardrails;
  onProgress?: (progress: WorkflowProgress) => void;
  stopAfterBlock1?: boolean; // When true, halts after Block 1 detection stage (Phase 2)
  stopAfterBlock2?: boolean; // When true, halts after Block 2 decision & guardrails stage without Block 3 execution (Phase 3)
}

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

export interface IOrchestrator {
  runSubscriptionAudit(options: AuditRunOptions): Promise<AuditRunResult>;
  executeUserApprovedAction(
    userId: string,
    subscriptionId: string,
    decisionOverride?: Partial<Decision>
  ): Promise<ActionResult>;
  getSystemStatus(): Promise<{
    status: 'ready' | 'degraded' | 'error';
    adapters: {
      block1: { name: string; url: string };
      block2: { name: string; url: string };
      block3: { name: string; url: string };
    };
  }>;
}
