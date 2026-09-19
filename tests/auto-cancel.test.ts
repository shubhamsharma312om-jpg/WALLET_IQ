import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteDatabase } from '../backend/database/sqlite.database.ts';
import { ActionEngine } from '../backend/block3-engine/action-engine.ts';
import { AutoCancelEngine } from '../backend/services/auto-cancel-engine.ts';

export async function runAutoCancelTests() {
  await describe('Auto-Cancel & Reminder Feature', async () => {
    let db: SQLiteDatabase;
    let actionEngine: ActionEngine;
    let autoCancelEngine: AutoCancelEngine;
    const userId = 'u_test_auto_cancel';

    await it('Setup DB & Engine', async () => {
      db = new SQLiteDatabase();
      await db.initialize();
      actionEngine = new ActionEngine(db);
      autoCancelEngine = new AutoCancelEngine(db, actionEngine);

      const dbSync = (db as any).ensureDb();
      dbSync.exec(`
        DELETE FROM subscriptions WHERE user_id = '${userId}';
        DELETE FROM guardrails WHERE user_id = '${userId}';
        DELETE FROM auto_cancel_settings WHERE user_id = '${userId}';
        DELETE FROM auto_cancel_states WHERE user_id = '${userId}';
      `);

      await db.saveGuardrails(userId, {
        user_id: userId,
        auto_action_limit: 100, 
        protected_categories: [], 
        minimum_confidence: 50,
        duplicate_subscriptions: 'require_approval',
        unused_after_days: 90
      });

      await db.saveAutoCancelSettings(userId, {
        user_id: userId,
        enabled: true,
        inactivity_days: 60,
        first_reminder_days_before: 14,
        second_reminder_days_before: 3,
        final_window_hours: 48,
        auto_cancel_when_ignored: true,
        desktop_notifications: false
      });
    });

    await it('Should automatically cancel eligible unused subscription', async () => {
      const renewalDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await db.saveSubscription(userId, {
        subscription_id: 'sub_unused_123',
        merchant: 'UnusedApp',
        category: 'software',
        amount: 20,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 90,
        waste_score: 90,
        confidence: 90,
        risk: 'high',
        status: 'active',
        recommended_action: 'cancel',
        next_renewal_date: renewalDate,
        usage_signal_available: true,
      });

      await db.saveAutoCancelState(userId, {
        subscription_id: 'sub_unused_123',
        enabled: true,
        next_renewal_date: renewalDate,
        usage_source: 'subscription_signal',
        status: 'reminding',
        responded: false,
        last_reminder_stage: 'final_warning',
        updated_at: new Date().toISOString()
      });

      const result = await autoCancelEngine.runCheck(userId);
      
      const updatedState = await db.getAutoCancelState(userId, 'sub_unused_123');
      assert.strictEqual(updatedState?.status, 'cancelled', 'Should be marked cancelled');
    });

    await it('Should respect guardrails during auto-cancel', async () => {
      await db.saveGuardrails(userId, {
        user_id: userId,
        auto_action_limit: 10, 
        protected_categories: [],
        minimum_confidence: 50,
        duplicate_subscriptions: 'require_approval',
        unused_after_days: 90
      });

      const renewalDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await db.saveSubscription(userId, {
        subscription_id: 'sub_expensive_123',
        merchant: 'ExpensiveApp',
        category: 'software',
        amount: 50,
        currency: 'USD',
        cadence: 'monthly',
        last_used_days_ago: 90,
        waste_score: 90,
        confidence: 90,
        risk: 'high',
        status: 'active',
        recommended_action: 'cancel',
        next_renewal_date: renewalDate,
        usage_signal_available: true,
      });

      await db.saveAutoCancelState(userId, {
        subscription_id: 'sub_expensive_123',
        enabled: true,
        next_renewal_date: renewalDate,
        usage_source: 'subscription_signal',
        status: 'reminding',
        responded: false,
        last_reminder_stage: 'final_warning',
        updated_at: new Date().toISOString()
      });

      const result = await autoCancelEngine.runCheck(userId);
      const updatedState = await db.getAutoCancelState(userId, 'sub_expensive_123');
      assert.strictEqual(updatedState?.status, 'blocked', 'Should be blocked because amount > auto_action_limit');
    });
  });
}
