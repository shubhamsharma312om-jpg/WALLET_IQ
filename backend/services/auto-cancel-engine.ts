import { IDatabase } from '../database/interfaces.ts';
import {
  AutoCancelCheckResult,
  AutoCancelSettings,
  AutoCancelState,
  AutoCancelSubscriptionView,
  AutomationNotification,
  Decision,
  Guardrails,
  Subscription,
} from '../models/index.ts';
import { ActionEngine } from '../block3-engine/action-engine.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function addCadence(date: Date, cadence: Subscription['cadence']): Date {
  const next = new Date(date);
  if (cadence === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === 'quarterly') next.setUTCMonth(next.getUTCMonth() + 3);
  else if (cadence === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function dateInDays(days: number): string {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export class AutoCancelEngine {
  constructor(
    private readonly database: IDatabase,
    private readonly actionEngine: ActionEngine
  ) {}

  private defaultState(userId: string, sub: Subscription): AutoCancelState {
    const demoRenewalDays: Record<string, number> = {
      sub_streamflix: 10,
      sub_tunewave: 18,
      sub_musicbox: 7,
      sub_healthguard: 22,
      sub_cloudpro: 14,
      sub_fitpulse: 5,
    };

    const renewal = sub.next_renewal_date || (userId === 'u_301' ? dateInDays(demoRenewalDays[sub.subscription_id] ?? 12) : undefined);
    const usageKnown = Boolean(sub.usage_signal_available ?? (userId === 'u_301' || sub.last_used_days_ago > 0));

    return {
      user_id: userId,
      subscription_id: sub.subscription_id,
      enabled: true,
      next_renewal_date: renewal,
      renewal_date_source: sub.renewal_date_source || (userId === 'u_301' ? 'demo' : undefined),
      last_used_at: sub.last_used_at,
      usage_source: usageKnown ? 'subscription_signal' : 'unknown',
      status: renewal ? (usageKnown ? 'monitoring' : 'usage_unknown') : 'needs_renewal_date',
      responded: false,
      updated_at: new Date().toISOString(),
    };
  }

  private async getOrCreateState(userId: string, sub: Subscription): Promise<AutoCancelState> {
    const stored = await this.database.getAutoCancelState(userId, sub.subscription_id);
    if (stored) return stored;
    const created = this.defaultState(userId, sub);
    await this.database.saveAutoCancelState(userId, created);
    return created;
  }

  private rollCycleIfNeeded(state: AutoCancelState, sub: Subscription): AutoCancelState {
    if (state.status === 'cancelled') return state;
    if (!state.next_renewal_date) return state;
    let renewal = new Date(state.next_renewal_date);
    if (Number.isNaN(renewal.getTime())) return state;

    let changed = false;
    while (renewal.getTime() < Date.now() - HOUR_MS) {
      renewal = addCadence(renewal, sub.cadence);
      changed = true;
    }

    if (!changed) return state;
    return {
      ...state,
      next_renewal_date: renewal.toISOString(),
      cycle_key: undefined,
      last_reminder_stage: undefined,
      responded: false,
      response: undefined,
      snoozed_until: undefined,
      status: state.usage_source === 'unknown' ? 'usage_unknown' : 'monitoring',
      updated_at: new Date().toISOString(),
    };
  }

  private inactiveDays(sub: Subscription, state: AutoCancelState): number | null {
    if (state.manual_last_used_days_ago !== undefined) {
      return Math.max(0, Math.floor(state.manual_last_used_days_ago));
    }
    if (state.last_used_at) {
      const last = new Date(state.last_used_at).getTime();
      if (!Number.isNaN(last)) return Math.max(0, Math.floor((Date.now() - last) / DAY_MS));
    }
    if (state.usage_source !== 'unknown' && Number.isFinite(sub.last_used_days_ago)) {
      return Math.max(0, Math.floor(sub.last_used_days_ago));
    }
    return null;
  }

  private guardrailCheck(sub: Subscription, guardrails: Guardrails): { eligible: boolean; reason?: string } {
    if (guardrails.protected_categories.includes(sub.category.toLowerCase())) {
      return { eligible: false, reason: `${sub.category.replaceAll('_', ' ')} is a protected category.` };
    }
    if (sub.amount > guardrails.auto_action_limit) {
      return { eligible: false, reason: `Cost ${sub.currency} ${sub.amount.toFixed(2)} exceeds the autonomous-action limit.` };
    }
    const confidence = sub.detection_confidence ?? sub.confidence;
    if (confidence < guardrails.minimum_confidence) {
      return { eligible: false, reason: `Detection confidence ${confidence}% is below the ${guardrails.minimum_confidence}% minimum.` };
    }
    return { eligible: true };
  }

  private cycleKey(state: AutoCancelState): string {
    return state.next_renewal_date ? state.next_renewal_date.slice(0, 10) : 'unknown';
  }

  private async notify(userId: string, notification: AutomationNotification): Promise<boolean> {
    return this.database.addAutomationNotification(userId, notification);
  }

  private notificationBase(sub: Subscription, state: AutoCancelState, stage: string) {
    return `${sub.subscription_id}:${this.cycleKey(state)}:${stage}`;
  }

  public async getStatus(userId: string, runCheck = false): Promise<{
    settings: AutoCancelSettings;
    subscriptions: AutoCancelSubscriptionView[];
    notifications: AutomationNotification[];
  }> {
    if (runCheck) await this.runCheck(userId);
    const settings = await this.database.getAutoCancelSettings(userId);
    const guardrails = await this.database.getGuardrails(userId);
    const subscriptions = await this.database.getSubscriptions(userId);
    const views: AutoCancelSubscriptionView[] = [];

    for (const sub of subscriptions) {
      let state = await this.getOrCreateState(userId, sub);
      const rolled = this.rollCycleIfNeeded(state, sub);
      if (rolled !== state) {
        state = rolled;
        await this.database.saveAutoCancelState(userId, state);
      }
      const inactive = this.inactiveDays(sub, state);
      const renewalMs = state.next_renewal_date ? new Date(state.next_renewal_date).getTime() : NaN;
      const hours = Number.isNaN(renewalMs) ? null : Math.max(0, (renewalMs - Date.now()) / HOUR_MS);
      const guard = this.guardrailCheck(sub, guardrails);
      views.push({
        subscription: sub,
        state,
        inactive_days: inactive,
        days_until_renewal: hours === null ? null : hours / 24,
        hours_until_renewal: hours,
        eligible_for_auto_cancel: guard.eligible,
        guardrail_reason: guard.reason,
      });
    }

    return {
      settings,
      subscriptions: views,
      notifications: await this.database.getAutomationNotifications(userId),
    };
  }

  public async runCheck(userId: string): Promise<AutoCancelCheckResult> {
    const checkedAt = new Date().toISOString();
    const settings = await this.database.getAutoCancelSettings(userId);
    const guardrails = await this.database.getGuardrails(userId);
    const subscriptions = await this.database.getSubscriptions(userId);
    let remindersCreated = 0;
    let actionsTriggered = 0;
    let blocked = 0;
    const views: AutoCancelSubscriptionView[] = [];

    for (const sub of subscriptions) {
      let state = await this.getOrCreateState(userId, sub);
      state = this.rollCycleIfNeeded(state, sub);
      const inactive = this.inactiveDays(sub, state);
      const renewalMs = state.next_renewal_date ? new Date(state.next_renewal_date).getTime() : NaN;
      const hoursUntilRenewal = Number.isNaN(renewalMs) ? null : Math.max(0, (renewalMs - Date.now()) / HOUR_MS);
      const daysUntilRenewal = hoursUntilRenewal === null ? null : hoursUntilRenewal / 24;
      const guard = this.guardrailCheck(sub, guardrails);

      if (state.status === 'cancelled') {
        state.note = state.note || 'Cancellation has already been triggered for this subscription.';
      } else if (!state.next_renewal_date) {
        state.status = 'needs_renewal_date';
        state.note = 'Set or detect the next renewal date before automation can schedule reminders.';
      } else if (inactive === null) {
        state.status = 'usage_unknown';
        state.note = 'Gmail does not provide app-usage telemetry. Add a usage signal or set last-used manually.';
      } else if (!settings.enabled || !state.enabled) {
        state.status = 'monitoring';
        state.note = settings.enabled ? 'Auto-cancel is disabled for this subscription.' : 'Auto-cancel is disabled globally.';
      } else if (state.snoozed_until && new Date(state.snoozed_until).getTime() > Date.now()) {
        state.status = 'snoozed';
        state.note = `Snoozed until ${state.snoozed_until}.`;
      } else if (state.responded && state.response === 'keep') {
        state.status = 'kept_for_cycle';
        state.note = 'You chose to keep this subscription for the current renewal cycle.';
      } else if (inactive < settings.inactivity_days) {
        state.status = 'monitoring';
        state.note = `Usage is still inside the ${settings.inactivity_days}-day inactivity threshold.`;
      } else if (hoursUntilRenewal !== null) {
        const cycle = this.cycleKey(state);
        state.cycle_key = cycle;

        if (daysUntilRenewal !== null && daysUntilRenewal <= settings.first_reminder_days_before) {
          const created = await this.notify(userId, {
            user_id: userId,
            subscription_id: sub.subscription_id,
            type: 'reminder',
            title: `${sub.merchant} looks unused`,
            body: `${sub.merchant} has been inactive for ${inactive} days and renews in ${Math.max(1, Math.ceil(daysUntilRenewal))} day(s). Open Wallet IQ to keep, snooze, or cancel it.`,
            dedupe_key: this.notificationBase(sub, state, `reminder-${settings.first_reminder_days_before}d`),
            created_at: checkedAt,
            read: false,
            delivered: false,
          });
          if (created) remindersCreated++;
          state.status = 'reminding';
          state.last_reminder_stage = `${settings.first_reminder_days_before}d`;
        }

        if (daysUntilRenewal !== null && daysUntilRenewal <= settings.second_reminder_days_before) {
          const created = await this.notify(userId, {
            user_id: userId,
            subscription_id: sub.subscription_id,
            type: 'reminder',
            title: `Reminder: ${sub.merchant} renews soon`,
            body: `No response yet. ${sub.merchant} renews in ${Math.max(1, Math.ceil(daysUntilRenewal))} day(s). Auto-cancel is armed if the inactivity signal remains unchanged.`,
            dedupe_key: this.notificationBase(sub, state, `reminder-${settings.second_reminder_days_before}d`),
            created_at: checkedAt,
            read: false,
            delivered: false,
          });
          if (created) remindersCreated++;
          state.status = 'scheduled';
          state.last_reminder_stage = `${settings.second_reminder_days_before}d`;
        }

        if (hoursUntilRenewal <= settings.final_window_hours) {
          const created = await this.notify(userId, {
            user_id: userId,
            subscription_id: sub.subscription_id,
            type: 'final_warning',
            title: `Final warning: ${sub.merchant}`,
            body: `${sub.merchant} renews in about ${Math.max(1, Math.ceil(hoursUntilRenewal))} hour(s). If you do nothing, Wallet IQ will auto-cancel before renewal when guardrails permit.`,
            dedupe_key: this.notificationBase(sub, state, `final-${settings.final_window_hours}h`),
            created_at: checkedAt,
            read: false,
            delivered: false,
          });
          if (created) remindersCreated++;
          state.status = 'scheduled';
          state.last_reminder_stage = `${settings.final_window_hours}h`;

          if (settings.auto_cancel_when_ignored && !state.responded) {
            if (!guard.eligible) {
              blocked++;
              state.status = 'blocked';
              state.note = guard.reason;
              const createdBlocked = await this.notify(userId, {
                user_id: userId,
                subscription_id: sub.subscription_id,
                type: 'blocked',
                title: `Auto-cancel needs your approval: ${sub.merchant}`,
                body: guard.reason || 'A guardrail prevented autonomous cancellation.',
                dedupe_key: this.notificationBase(sub, state, 'guardrail-blocked'),
                created_at: checkedAt,
                read: false,
                delivered: false,
              });
              if (createdBlocked) remindersCreated++;
            } else {
              const decision: Decision = {
                subscription_id: sub.subscription_id,
                action: 'cancel',
                decision: 'AUTO_CANCEL',
                recommended_action: 'cancel',
                reason: `Auto-cancel policy: inactive for ${inactive} days, no response to renewal reminders, ${Math.ceil(hoursUntilRenewal)}h remaining before renewal.`,
                waste_score: Math.max(80, sub.waste_score),
                confidence: Math.max(guardrails.minimum_confidence, sub.confidence),
                decision_confidence: Math.max(guardrails.minimum_confidence, sub.confidence),
                risk: sub.risk,
                requires_approval: false,
                guardrail_status: 'passed',
                guardrail_result: 'allowed',
                autonomous_action_allowed: true,
                estimated_monthly_savings: sub.amount,
                evaluated_at: checkedAt,
              };
              const result = await this.actionEngine.processDecision(userId, sub, decision);
              actionsTriggered++;
              state.last_action_simulated = result.simulated;
              if (result.status === 'SUCCESS') {
                state.status = 'cancelled';
                state.responded = true;
                state.response = 'cancel_now';
                state.note = result.simulated
                  ? 'Cancellation workflow executed successfully in simulation mode.'
                  : 'Cancellation executed successfully before renewal.';
                await this.notify(userId, {
                  user_id: userId,
                  subscription_id: sub.subscription_id,
                  type: 'auto_cancelled',
                  title: `${sub.merchant} auto-cancelled`,
                  body: result.simulated
                    ? `The cancellation workflow fired before renewal. Your current Block 3 adapter is simulated, so no real merchant account was changed.`
                    : `${sub.merchant} was cancelled before the next renewal.`,
                  dedupe_key: this.notificationBase(sub, state, 'auto-cancel-success'),
                  created_at: checkedAt,
                  read: false,
                  delivered: false,
                });
              } else {
                state.status = 'failed';
                state.note = result.message || 'Cancellation execution failed.';
                await this.notify(userId, {
                  user_id: userId,
                  subscription_id: sub.subscription_id,
                  type: 'auto_cancel_failed',
                  title: `Auto-cancel failed: ${sub.merchant}`,
                  body: `${result.message || 'The cancellation adapter failed.'} Open Wallet IQ before renewal.`,
                  dedupe_key: this.notificationBase(sub, state, 'auto-cancel-failed'),
                  created_at: checkedAt,
                  read: false,
                  delivered: false,
                });
              }
            }
          }
        }
      }

      state.last_checked_at = checkedAt;
      state.updated_at = checkedAt;
      await this.database.saveAutoCancelState(userId, state);

      views.push({
        subscription: sub,
        state,
        inactive_days: inactive,
        days_until_renewal: daysUntilRenewal,
        hours_until_renewal: hoursUntilRenewal,
        eligible_for_auto_cancel: guard.eligible,
        guardrail_reason: guard.reason,
      });
    }

    return {
      checked_at: checkedAt,
      user_id: userId,
      evaluated: subscriptions.length,
      reminders_created: remindersCreated,
      actions_triggered: actionsTriggered,
      blocked,
      subscriptions: views,
    };
  }
}
