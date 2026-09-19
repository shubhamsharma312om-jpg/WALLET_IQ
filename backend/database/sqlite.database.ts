/**
 * SPENDGUARDIAN — SQLite Database Implementation
 *
 * Uses Node 22 native `node:sqlite` (DatabaseSync) for high performance,
 * zero external native C-bindings, zero-configuration persistence.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  Subscription,
  Transaction,
  Decision,
  Guardrails,
  ActionResult,
  AuditEvent,
  SavingsSummary,
} from '../models/index.ts';
import { ApprovalRequest, EscalationRecord } from '../block3-engine/action-types.ts';
import { IDatabase } from './interfaces.ts';

export class SQLiteDatabase implements IDatabase {
  private db: DatabaseSync | null = null;
  private readonly dbLocation: string;

  public static readonly DEFAULT_GUARDRAILS: Guardrails = {
    auto_action_limit: 20,
    protected_categories: ['insurance', 'loan_payment'],
    minimum_confidence: 90,
    duplicate_subscriptions: 'require_approval',
    unused_after_days: 90,
  };

  constructor(dbLocation?: string) {
    const configuredUrl = process.env.DATABASE_URL || 'spendguardian.sqlite';
    this.dbLocation = dbLocation || configuredUrl.replace(/^file:/, '');
  }

  public async initialize(): Promise<void> {
    if (this.db) return;

    this.db = new DatabaseSync(this.dbLocation);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guardrails (
        user_id TEXT PRIMARY KEY,
        auto_action_limit REAL NOT NULL,
        protected_categories TEXT NOT NULL,
        minimum_confidence REAL NOT NULL,
        duplicate_subscriptions TEXT NOT NULL,
        unused_after_days INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        merchant TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        cadence TEXT NOT NULL,
        last_used_days_ago INTEGER NOT NULL,
        waste_score REAL NOT NULL,
        confidence REAL NOT NULL,
        risk TEXT NOT NULL,
        status TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (user_id, subscription_id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        user_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        merchant TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (user_id, transaction_id)
      );

      CREATE TABLE IF NOT EXISTS decisions (
        user_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        waste_score REAL NOT NULL,
        confidence REAL NOT NULL,
        risk TEXT NOT NULL,
        requires_approval INTEGER NOT NULL,
        guardrail_status TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (user_id, subscription_id)
      );

      CREATE TABLE IF NOT EXISTS action_results (
        action_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        status TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        monthly_savings REAL NOT NULL,
        simulated INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        merchant TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        savings REAL NOT NULL,
        subscription_id TEXT
      );

      CREATE TABLE IF NOT EXISTS savings_summary (
        user_id TEXT PRIMARY KEY,
        potential_savings REAL NOT NULL,
        confirmed_savings REAL NOT NULL,
        currency TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approval_requests (
        approval_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        merchant TEXT NOT NULL,
        requested_action TEXT NOT NULL,
        monthly_savings REAL NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        status TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS escalation_records (
        escalation_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        merchant TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        risk TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );
    `);
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureDb(): DatabaseSync {
    if (!this.db) {
      throw new Error('Database is not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // ============================================================================
  // Guardrails
  // ============================================================================
  public async getGuardrails(userId: string): Promise<Guardrails> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM guardrails WHERE user_id = ?');
    const row = query.get(userId) as
      | {
          user_id: string;
          auto_action_limit: number;
          protected_categories: string;
          minimum_confidence: number;
          duplicate_subscriptions: string;
          unused_after_days: number;
        }
      | undefined;

    if (!row) {
      // Seed default guardrails for user
      await this.saveGuardrails(userId, SQLiteDatabase.DEFAULT_GUARDRAILS);
      return { ...SQLiteDatabase.DEFAULT_GUARDRAILS };
    }

    let categories: string[] = [];
    try {
      categories = JSON.parse(row.protected_categories);
    } catch {
      categories = ['insurance', 'loan_payment'];
    }

    return {
      auto_action_limit: row.auto_action_limit,
      protected_categories: categories,
      minimum_confidence: row.minimum_confidence,
      duplicate_subscriptions: row.duplicate_subscriptions as Guardrails['duplicate_subscriptions'],
      unused_after_days: row.unused_after_days,
    };
  }

  public async saveGuardrails(userId: string, guardrails: Guardrails): Promise<void> {
    const db = this.ensureDb();
    const statement = db.prepare(`
      INSERT OR REPLACE INTO guardrails (
        user_id, auto_action_limit, protected_categories, minimum_confidence, duplicate_subscriptions, unused_after_days
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      userId,
      guardrails.auto_action_limit,
      JSON.stringify(guardrails.protected_categories || []),
      guardrails.minimum_confidence,
      guardrails.duplicate_subscriptions,
      guardrails.unused_after_days
    );
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================
  public async saveSubscriptions(userId: string, subs: Subscription[]): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO subscriptions (
        user_id, subscription_id, merchant, category, amount, currency, cadence,
        last_used_days_ago, waste_score, confidence, risk, status, recommended_action, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of subs) {
      stmt.run(
        userId,
        s.subscription_id,
        s.merchant || '',
        s.category || 'other',
        s.amount ?? 0,
        s.currency || 'USD',
        s.cadence || 'monthly',
        s.last_used_days_ago ?? 0,
        s.waste_score ?? 0,
        s.confidence ?? 0,
        s.risk || 'low',
        s.status || 'active',
        s.recommended_action || 'review',
        JSON.stringify(s)
      );
    }
  }

  public async getSubscriptions(userId: string): Promise<Subscription[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT raw_json FROM subscriptions WHERE user_id = ?');
    const rows = query.all(userId) as Array<{ raw_json: string }>;
    return rows.map((r) => JSON.parse(r.raw_json) as Subscription);
  }

  public async getSubscriptionById(userId: string, subscriptionId: string): Promise<Subscription | null> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT raw_json FROM subscriptions WHERE user_id = ? AND subscription_id = ?');
    const row = query.get(userId, subscriptionId) as { raw_json: string } | undefined;
    return row ? (JSON.parse(row.raw_json) as Subscription) : null;
  }

  // ============================================================================
  // Transactions
  // ============================================================================
  public async saveTransactions(userId: string, txs: Transaction[]): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        user_id, transaction_id, merchant, amount, currency, date, category, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of txs) {
      stmt.run(
        userId,
        t.transaction_id,
        t.merchant,
        t.amount,
        t.currency,
        t.date,
        t.category,
        JSON.stringify(t)
      );
    }
  }

  public async getTransactions(userId: string): Promise<Transaction[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT raw_json FROM transactions WHERE user_id = ? ORDER BY date DESC');
    const rows = query.all(userId) as Array<{ raw_json: string }>;
    return rows.map((r) => JSON.parse(r.raw_json) as Transaction);
  }

  // ============================================================================
  // Decisions
  // ============================================================================
  public async saveDecisions(userId: string, decisions: Decision[]): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO decisions (
        user_id, subscription_id, action, reason, waste_score, confidence,
        risk, requires_approval, guardrail_status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of decisions) {
      stmt.run(
        userId,
        d.subscription_id,
        d.action,
        d.reason,
        d.waste_score,
        d.confidence,
        d.risk,
        d.requires_approval ? 1 : 0,
        d.guardrail_status,
        JSON.stringify(d)
      );
    }
  }

  public async getDecisions(userId: string): Promise<Decision[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT raw_json FROM decisions WHERE user_id = ?');
    const rows = query.all(userId) as Array<{ raw_json: string }>;
    return rows.map((r) => JSON.parse(r.raw_json) as Decision);
  }

  public async getDecisionBySubscriptionId(userId: string, subscriptionId: string): Promise<Decision | null> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT raw_json FROM decisions WHERE user_id = ? AND subscription_id = ?');
    const row = query.get(userId, subscriptionId) as { raw_json: string } | undefined;
    return row ? (JSON.parse(row.raw_json) as Decision) : null;
  }

  // ============================================================================
  // Action Results
  // ============================================================================
  public async saveActionResult(userId: string, result: ActionResult): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO action_results (
        action_id, user_id, subscription_id, status, action, reason, monthly_savings, simulated, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.action_id,
      userId,
      result.subscription_id,
      result.status,
      result.action,
      result.reason,
      result.monthly_savings,
      result.simulated ? 1 : 0,
      result.timestamp
    );
  }

  public async getActionResults(userId: string): Promise<ActionResult[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM action_results WHERE user_id = ? ORDER BY timestamp DESC');
    const rows = query.all(userId) as Array<{
      action_id: string;
      subscription_id: string;
      status: ActionResult['status'];
      action: ActionResult['action'];
      reason: string;
      monthly_savings: number;
      simulated: number;
      timestamp: string;
    }>;

    return rows.map((r) => ({
      action_id: r.action_id,
      subscription_id: r.subscription_id,
      status: r.status,
      action: r.action,
      reason: r.reason,
      monthly_savings: r.monthly_savings,
      simulated: r.simulated === 1,
      timestamp: r.timestamp,
    }));
  }

  public async getActionResultBySubscriptionId(userId: string, subscriptionId: string): Promise<ActionResult | null> {
    const db = this.ensureDb();
    const query = db.prepare(`
      SELECT * FROM action_results 
      WHERE user_id = ? AND subscription_id = ? 
      ORDER BY timestamp DESC LIMIT 1
    `);
    const row = query.get(userId, subscriptionId) as
      | {
          action_id: string;
          subscription_id: string;
          status: ActionResult['status'];
          action: ActionResult['action'];
          reason: string;
          monthly_savings: number;
          simulated: number;
          timestamp: string;
        }
      | undefined;

    if (!row) return null;

    return {
      action_id: row.action_id,
      subscription_id: row.subscription_id,
      status: row.status,
      action: row.action,
      reason: row.reason,
      monthly_savings: row.monthly_savings,
      simulated: row.simulated === 1,
      timestamp: row.timestamp,
    };
  }

  // ============================================================================
  // Approval Requests
  // ============================================================================
  public async saveApprovalRequest(userId: string, req: ApprovalRequest): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO approval_requests (
        approval_id, user_id, subscription_id, merchant, requested_action,
        monthly_savings, reason, created_at, resolved_at, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      req.approval_id,
      userId,
      req.subscription_id,
      req.merchant,
      req.requested_action,
      req.monthly_savings,
      req.reason,
      req.created_at,
      req.resolved_at || null,
      req.status,
      JSON.stringify(req)
    );
  }

  public async getApprovalRequests(userId: string): Promise<ApprovalRequest[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM approval_requests WHERE user_id = ? ORDER BY created_at DESC');
    const rows = query.all(userId) as Array<{
      approval_id: string;
      user_id: string;
      subscription_id: string;
      merchant: string;
      requested_action: string;
      monthly_savings: number;
      reason: string;
      created_at: string;
      resolved_at: string | null;
      status: ApprovalRequest['status'];
      raw_json: string;
    }>;

    return rows.map((r) => {
      try {
        const parsed = JSON.parse(r.raw_json);
        return {
          ...parsed,
          approval_id: r.approval_id,
          user_id: r.user_id,
          subscription_id: r.subscription_id,
          merchant: r.merchant,
          requested_action: r.requested_action,
          monthly_savings: r.monthly_savings,
          reason: r.reason,
          created_at: r.created_at,
          resolved_at: r.resolved_at || undefined,
          status: r.status,
        };
      } catch {
        return {
          approval_id: r.approval_id,
          user_id: r.user_id,
          subscription_id: r.subscription_id,
          merchant: r.merchant,
          requested_action: r.requested_action,
          monthly_savings: r.monthly_savings,
          reason: r.reason,
          created_at: r.created_at,
          resolved_at: r.resolved_at || undefined,
          status: r.status,
        };
      }
    });
  }

  public async getApprovalRequestById(userId: string, approvalId: string): Promise<ApprovalRequest | null> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM approval_requests WHERE user_id = ? AND approval_id = ?');
    const row = query.get(userId, approvalId) as
      | {
          approval_id: string;
          user_id: string;
          subscription_id: string;
          merchant: string;
          requested_action: string;
          monthly_savings: number;
          reason: string;
          created_at: string;
          resolved_at: string | null;
          status: ApprovalRequest['status'];
          raw_json: string;
        }
      | undefined;

    if (!row) return null;

    try {
      const parsed = JSON.parse(row.raw_json);
      return {
        ...parsed,
        approval_id: row.approval_id,
        user_id: row.user_id,
        subscription_id: row.subscription_id,
        merchant: row.merchant,
        requested_action: row.requested_action,
        monthly_savings: row.monthly_savings,
        reason: row.reason,
        created_at: row.created_at,
        resolved_at: row.resolved_at || undefined,
        status: row.status,
      };
    } catch {
      return {
        approval_id: row.approval_id,
        user_id: row.user_id,
        subscription_id: row.subscription_id,
        merchant: row.merchant,
        requested_action: row.requested_action,
        monthly_savings: row.monthly_savings,
        reason: row.reason,
        created_at: row.created_at,
        resolved_at: row.resolved_at || undefined,
        status: row.status,
      };
    }
  }

  public async updateApprovalRequest(userId: string, req: ApprovalRequest): Promise<void> {
    return this.saveApprovalRequest(userId, req);
  }

  // ============================================================================
  // Escalation Records
  // ============================================================================
  public async saveEscalationRecord(userId: string, record: EscalationRecord): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO escalation_records (
        escalation_id, user_id, subscription_id, merchant, action,
        reason, risk, created_at, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.escalation_id,
      userId,
      record.subscription_id,
      record.merchant,
      record.action,
      record.reason,
      record.risk,
      record.created_at,
      record.status,
      JSON.stringify(record)
    );
  }

  public async getEscalationRecords(userId: string): Promise<EscalationRecord[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM escalation_records WHERE user_id = ? ORDER BY created_at DESC');
    const rows = query.all(userId) as Array<{
      escalation_id: string;
      user_id: string;
      subscription_id: string;
      merchant: string;
      action: string;
      reason: string;
      risk: EscalationRecord['risk'];
      created_at: string;
      status: EscalationRecord['status'];
      raw_json: string;
    }>;

    return rows.map((r) => {
      try {
        const parsed = JSON.parse(r.raw_json);
        return {
          ...parsed,
          escalation_id: r.escalation_id,
          user_id: r.user_id,
          subscription_id: r.subscription_id,
          merchant: r.merchant,
          action: r.action,
          reason: r.reason,
          risk: r.risk,
          created_at: r.created_at,
          status: r.status,
        };
      } catch {
        return {
          escalation_id: r.escalation_id,
          user_id: r.user_id,
          subscription_id: r.subscription_id,
          merchant: r.merchant,
          action: r.action,
          reason: r.reason,
          risk: r.risk,
          created_at: r.created_at,
          status: r.status,
        };
      }
    });
  }

  // ============================================================================
  // Audit Events
  // ============================================================================
  public async addAuditEvent(userId: string, event: AuditEvent): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT INTO audit_events (
        user_id, timestamp, merchant, action, status, reason, savings, subscription_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      event.timestamp || new Date().toISOString(),
      event.merchant || 'System',
      event.action || 'info',
      event.status || 'completed',
      event.reason || '',
      event.savings ?? 0,
      event.subscription_id || ''
    );
  }

  public async getAuditEvents(userId: string): Promise<AuditEvent[]> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM audit_events WHERE user_id = ? ORDER BY id DESC');
    const rows = query.all(userId) as Array<{
      id: number;
      timestamp: string;
      merchant: string;
      action: string;
      status: AuditEvent['status'];
      reason: string;
      savings: number;
      subscription_id: string;
    }>;

    return rows.map((r) => ({
      id: String(r.id),
      timestamp: r.timestamp,
      merchant: r.merchant,
      action: r.action,
      status: r.status,
      reason: r.reason,
      savings: r.savings,
      subscription_id: r.subscription_id,
    }));
  }

  // ============================================================================
  // Savings Summary & Savings Rule Enforcer
  // ============================================================================
  public async getSavingsSummary(userId: string): Promise<SavingsSummary> {
    const db = this.ensureDb();
    const query = db.prepare('SELECT * FROM savings_summary WHERE user_id = ?');
    const row = query.get(userId) as
      | {
          potential_savings: number;
          confirmed_savings: number;
          currency: string;
          last_updated: string;
        }
      | undefined;

    if (!row) {
      const initial: SavingsSummary = {
        potential_savings: 0,
        confirmed_savings: 0,
        currency: 'USD',
        last_updated: new Date().toISOString(),
      };
      await this.updateSavingsSummary(userId, initial);
      return initial;
    }

    return {
      potential_savings: row.potential_savings,
      confirmed_savings: row.confirmed_savings,
      currency: row.currency,
      last_updated: row.last_updated,
    };
  }

  public async updateSavingsSummary(userId: string, summary: SavingsSummary): Promise<void> {
    const db = this.ensureDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO savings_summary (
        user_id, potential_savings, confirmed_savings, currency, last_updated
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      summary.potential_savings,
      summary.confirmed_savings,
      summary.currency || 'USD',
      summary.last_updated || new Date().toISOString()
    );
  }

  public async saveSavingsSummary(userId: string, summary: SavingsSummary): Promise<void> {
    return this.updateSavingsSummary(userId, summary);
  }

  /**
   * CRITICAL SAVINGS RULE ENFORCER:
   * Confirmed savings ONLY increases when Block 3 explicitly confirms a successful action.
   * Never count failed or pending actions as confirmed savings.
   */
  public async recordConfirmedSavings(userId: string, monthlySavingsDelta: number): Promise<SavingsSummary> {
    if (monthlySavingsDelta <= 0) {
      return this.getSavingsSummary(userId);
    }

    const current = await this.getSavingsSummary(userId);
    const updated: SavingsSummary = {
      ...current,
      confirmed_savings: Number((current.confirmed_savings + monthlySavingsDelta).toFixed(2)),
      last_updated: new Date().toISOString(),
    };

    await this.updateSavingsSummary(userId, updated);
    return updated;
  }
}
