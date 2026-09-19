/**
 * SPENDGUARDIAN — Block 3 Escalation Engine
 *
 * Handles ESCALATE decision states where high-risk or ambiguous subscription
 * conditions prevent autonomous execution and require escalation review.
 */

import { IDatabase } from '../database/interfaces.ts';
import { Subscription, Decision } from '../models/index.ts';
import { EscalationRecord } from './action-types.ts';

export class EscalationEngine {
  constructor(private readonly database: IDatabase) {}

  public async createEscalation(
    userId: string,
    subscription: Subscription,
    decision: Decision
  ): Promise<EscalationRecord> {
    const escalationId = `esc_${subscription.subscription_id}_${Date.now()}`;
    const record: EscalationRecord = {
      escalation_id: escalationId,
      user_id: userId,
      subscription_id: subscription.subscription_id,
      merchant: subscription.merchant,
      action: decision.action || 'escalate',
      reason: decision.reason || 'Escalated due to high-risk policy trigger',
      risk: decision.risk || 'high',
      created_at: new Date().toISOString(),
      status: 'OPEN',
      decision,
    };

    await this.database.saveEscalationRecord(userId, record);

    await this.database.addAuditEvent(userId, {
      timestamp: record.created_at,
      merchant: subscription.merchant,
      action: 'ACTION_ESCALATED',
      status: 'escalated',
      reason: `Escalated: ${record.reason}`,
      savings: 0,
      subscription_id: subscription.subscription_id,
    });

    return record;
  }

  public async getEscalations(userId: string): Promise<EscalationRecord[]> {
    return this.database.getEscalationRecords(userId);
  }
}
