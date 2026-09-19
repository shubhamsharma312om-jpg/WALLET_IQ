import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Loader2,
  PauseCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import {
  AutoCancelSettings,
  AutoCancelSubscriptionView,
  AutomationNotification,
} from '../../../backend/models/index.ts';

interface AutoCancelCenterProps {
  userId: string;
  onDataChanged?: () => Promise<void> | void;
}

interface AutomationStatusPayload {
  success: boolean;
  settings: AutoCancelSettings;
  subscriptions: AutoCancelSubscriptionView[];
  notifications: AutomationNotification[];
}

const defaultSettings: AutoCancelSettings = {
  enabled: false,
  inactivity_days: 20,
  first_reminder_days_before: 10,
  second_reminder_days_before: 5,
  final_window_hours: 48,
  auto_cancel_when_ignored: true,
  desktop_notifications: true,
};

function fmtDate(value?: string) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusCopy(view: AutoCancelSubscriptionView) {
  const { state } = view;
  const labels: Record<string, string> = {
    monitoring: 'Monitoring',
    needs_renewal_date: 'Renewal date needed',
    usage_unknown: 'Usage signal needed',
    reminding: 'Reminder sent',
    scheduled: 'Auto-cancel armed',
    kept_for_cycle: 'Keeping this cycle',
    snoozed: 'Snoozed',
    cancelled: 'Cancelled',
    blocked: 'Guardrail blocked',
    failed: 'Action failed',
  };
  return labels[state.status] || state.status;
}

function statusTone(status: string) {
  if (status === 'cancelled') return 'success';
  if (status === 'blocked' || status === 'failed') return 'danger';
  if (status === 'scheduled' || status === 'reminding') return 'warn';
  return 'neutral';
}

export const AutoCancelCenter: React.FC<AutoCancelCenterProps> = ({ userId, onDataChanged }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<AutoCancelSettings>(defaultSettings);
  const [views, setViews] = useState<AutoCancelSubscriptionView[]>([]);
  const [notifications, setNotifications] = useState<AutomationNotification[]>([]);
  const [editingUsage, setEditingUsage] = useState<Record<string, string>>({});
  const [editingRenewal, setEditingRenewal] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const fetchStatus = useCallback(async (runCheck = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/automation/status?userId=${encodeURIComponent(userId)}${runCheck ? '&runCheck=true' : ''}`);
      if (!res.ok) throw new Error('Could not load automation status');
      const data = (await res.json()) as AutomationStatusPayload;
      setSettings(data.settings || defaultSettings);
      setViews(data.subscriptions || []);
      setNotifications(data.notifications || []);
    } catch (err: any) {
      setMessage(err.message || 'Could not load automation status');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus(false);
  }, [fetchStatus]);

  const summary = useMemo(() => ({
    armed: views.filter((v) => v.state.status === 'scheduled' || v.state.status === 'reminding').length,
    unknown: views.filter((v) => v.state.status === 'usage_unknown' || v.state.status === 'needs_renewal_date').length,
    cancelled: views.filter((v) => v.state.status === 'cancelled').length,
  }), [views]);

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save automation settings');
      setSettings(data.settings);
      setMessage(data.settings.enabled ? 'Auto-cancel policy is active.' : 'Auto-cancel policy is paused.');
      await fetchStatus(false);
    } catch (err: any) {
      setMessage(err.message || 'Failed to save automation settings');
    } finally {
      setSaving(false);
    }
  };

  const runCheck = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/automation/run-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Automation check failed');
      const result = data.result;
      setMessage(`Checked ${result.evaluated} subscription(s): ${result.reminders_created} reminder(s), ${result.actions_triggered} action(s).`);
      await fetchStatus(false);
      await onDataChanged?.();
    } catch (err: any) {
      setMessage(err.message || 'Automation check failed');
    } finally {
      setRunning(false);
    }
  };

  const updateSubscription = async (subscriptionId: string, patch: Record<string, unknown>) => {
    setMessage(null);
    const res = await fetch(`/api/automation/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update automation state');
    await fetchStatus(false);
  };

  const respond = async (subscriptionId: string, response: 'keep' | 'snooze' | 'mark_used' | 'cancel_now') => {
    setMessage(null);
    try {
      const res = await fetch(`/api/automation/subscriptions/${encodeURIComponent(subscriptionId)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response, hours: 48 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record response');
      setMessage(response === 'keep' ? 'Kept for this renewal cycle.' : response === 'snooze' ? 'Snoozed for 48 hours.' : response === 'mark_used' ? 'Usage countdown restarted today.' : 'Cancellation workflow triggered.');
      await fetchStatus(false);
      await onDataChanged?.();
    } catch (err: any) {
      setMessage(err.message || 'Could not record response');
    }
  };

  const enableDesktopNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      setMessage('This browser does not support desktop notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setMessage(permission === 'granted' ? 'Laptop notifications are enabled for this browser.' : 'Notification permission was not granted.');
  };

  const markAllRead = async () => {
    await Promise.all(notifications.filter((n) => n.id && !n.read).map((n) => fetch(`/api/automation/notifications/${n.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, read: true }),
    })));
    await fetchStatus(false);
  };

  return (
    <div className="auto-cancel-page">
      <section className="auto-cancel-hero">
        <div>
          <p className="wallet-eyebrow">INACTIVITY → REMINDERS → ACTION</p>
          <h2>Cancel unused subscriptions before they renew.</h2>
          <p>
            Wallet IQ watches the inactivity signal and next renewal date, sends staged reminders, and can trigger cancellation in the final {settings.final_window_hours}-hour window if you never respond.
          </p>
          <div className="auto-cancel-timeline">
            <span><strong>{settings.inactivity_days}d</strong> inactive</span>
            <i />
            <span><strong>{settings.first_reminder_days_before}d</strong> first reminder</span>
            <i />
            <span><strong>{settings.second_reminder_days_before}d</strong> follow-up</span>
            <i />
            <span><strong>{settings.final_window_hours}h</strong> final warning</span>
            <i />
            <span><strong>Auto</strong> cancel</span>
          </div>
        </div>
        <div className="auto-cancel-hero-badge">
          <ShieldCheck size={28} />
          <strong>{settings.enabled ? 'Policy active' : 'Policy paused'}</strong>
          <span>Existing guardrails still apply.</span>
        </div>
      </section>

      <section className="auto-cancel-settings-grid">
        <div className="auto-policy-card">
          <div className="auto-card-heading"><div><p className="wallet-eyebrow">POLICY</p><h3>Automatic cancellation</h3></div><TimerReset size={22} /></div>
          <label className="auto-toggle-row">
            <div><strong>Enable inactivity protection</strong><span>Run the reminder and final-window workflow automatically.</span></div>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
          </label>
          <div className="auto-field-grid">
            <label><span>Inactive after</span><div><input type="number" min="1" max="365" value={settings.inactivity_days} onChange={(e) => setSettings({ ...settings, inactivity_days: Number(e.target.value) })} /><b>days</b></div></label>
            <label><span>First reminder</span><div><input type="number" min="1" max="60" value={settings.first_reminder_days_before} onChange={(e) => setSettings({ ...settings, first_reminder_days_before: Number(e.target.value) })} /><b>days before</b></div></label>
            <label><span>Second reminder</span><div><input type="number" min="1" max="60" value={settings.second_reminder_days_before} onChange={(e) => setSettings({ ...settings, second_reminder_days_before: Number(e.target.value) })} /><b>days before</b></div></label>
            <label><span>Final window</span><select value={settings.final_window_hours} onChange={(e) => setSettings({ ...settings, final_window_hours: Number(e.target.value) === 24 ? 24 : 48 })}><option value={48}>48 hours</option><option value={24}>24 hours</option></select></label>
          </div>
          <label className="auto-toggle-row compact">
            <div><strong>Cancel when reminders are ignored</strong><span>If there is no Keep / Snooze / Used response by the final window.</span></div>
            <input type="checkbox" checked={settings.auto_cancel_when_ignored} onChange={(e) => setSettings({ ...settings, auto_cancel_when_ignored: e.target.checked })} />
          </label>
          <div className="auto-card-actions">
            <button className="wallet-primary-button" onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />}Save policy</button>
            <button className="wallet-secondary-button" onClick={runCheck} disabled={running}>{running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={15} />}Run check now</button>
          </div>
        </div>

        <div className="auto-notification-card">
          <div className="auto-card-heading"><div><p className="wallet-eyebrow">LAPTOP ALERTS</p><h3>Desktop notifications</h3></div><BellRing size={22} /></div>
          <p>Wallet IQ uses the browser's system-notification permission. Alerts appear on your laptop while the browser/app session can receive them.</p>
          <div className={`notification-permission ${notificationPermission}`}>
            <Bell size={18} /><div><strong>{notificationPermission === 'granted' ? 'Notifications allowed' : notificationPermission === 'denied' ? 'Notifications blocked' : notificationPermission === 'unsupported' ? 'Unsupported browser' : 'Permission not granted yet'}</strong><span>{notificationPermission === 'granted' ? 'New renewal reminders can appear as desktop notifications.' : 'Enable permission to surface renewal reminders outside the page.'}</span></div>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && <button className="wallet-secondary-button" onClick={enableDesktopNotifications}><BellRing size={15} />Enable laptop notifications</button>}
          <div className="auto-mini-stats">
            <div><strong>{summary.armed}</strong><span>armed</span></div>
            <div><strong>{summary.unknown}</strong><span>need data</span></div>
            <div><strong>{summary.cancelled}</strong><span>cancelled</span></div>
          </div>
        </div>
      </section>

      {message && <div className="auto-inline-message"><Sparkles size={16} />{message}</div>}

      <section className="auto-subscriptions-section">
        <div className="auto-section-header">
          <div><p className="wallet-eyebrow">MONITORED SUBSCRIPTIONS</p><h3>Renewal countdowns</h3><p>Each subscription can have its own renewal date, usage signal, and automation switch.</p></div>
          <span>{views.length} tracked</span>
        </div>

        {loading ? <div className="wallet-empty-state"><Loader2 className="w-10 h-10 animate-spin" /><h3>Loading automation state…</h3></div> : views.length === 0 ? <div className="wallet-empty-state"><CalendarClock className="w-12 h-12" /><h3>No subscriptions to monitor yet.</h3><p>Run a Gmail scan or use Demo Mode first.</p></div> : (
          <div className="auto-subscription-list">
            {views.map((view) => {
              const sub = view.subscription;
              const state = view.state;
              const usageValue = editingUsage[sub.subscription_id] ?? (view.inactive_days === null ? '' : String(view.inactive_days));
              const renewalValue = editingRenewal[sub.subscription_id] ?? (state.next_renewal_date ? new Date(state.next_renewal_date).toISOString().slice(0, 10) : '');
              return (
                <article className="auto-subscription-card" key={sub.subscription_id}>
                  <div className="auto-sub-main">
                    <div className="auto-sub-title-row">
                      <div><strong>{sub.merchant}</strong><span>{sub.currency} {sub.amount.toFixed(2)} / {sub.cadence}</span></div>
                      <span className={`auto-status-pill ${statusTone(state.status)}`}>{statusCopy(view)}</span>
                    </div>
                    <div className="auto-sub-metrics">
                      <div><Clock3 size={15} /><span>Last used</span><strong>{view.inactive_days === null ? 'Unknown' : `${view.inactive_days}d ago`}</strong></div>
                      <div><CalendarClock size={15} /><span>Next renewal</span><strong>{fmtDate(state.next_renewal_date)}</strong><small>{state.renewal_date_source ? state.renewal_date_source.replace('_', ' ') : ''}</small></div>
                      <div><TimerReset size={15} /><span>Time remaining</span><strong>{view.hours_until_renewal === null ? '—' : view.hours_until_renewal <= 72 ? `${Math.ceil(view.hours_until_renewal)}h` : `${Math.ceil(view.days_until_renewal || 0)}d`}</strong></div>
                      <div><ShieldCheck size={15} /><span>Guardrail</span><strong>{view.eligible_for_auto_cancel ? 'Eligible' : 'Needs review'}</strong></div>
                    </div>
                    {state.note && <p className="auto-state-note">{state.note}</p>}
                    {!view.eligible_for_auto_cancel && view.guardrail_reason && <p className="auto-guardrail-note"><TriangleAlert size={14} />{view.guardrail_reason}</p>}
                  </div>

                  <div className="auto-sub-controls">
                    <label className="auto-sub-switch"><span>Auto-cancel</span><input type="checkbox" checked={state.enabled} onChange={(e) => updateSubscription(sub.subscription_id, { enabled: e.target.checked }).catch((err) => setMessage(err.message))} /></label>
                    <div className="auto-inline-fields">
                      <label><span>Last used (days ago)</span><div><input type="number" min="0" value={usageValue} placeholder="e.g. 20" onChange={(e) => setEditingUsage({ ...editingUsage, [sub.subscription_id]: e.target.value })} /><button onClick={() => updateSubscription(sub.subscription_id, { lastUsedDaysAgo: Number(usageValue) }).then(() => setEditingUsage((prev) => ({ ...prev, [sub.subscription_id]: '' }))).catch((err) => setMessage(err.message))}><Check size={13} /></button></div></label>
                      <label><span>Next renewal</span><div><input type="date" value={renewalValue} onChange={(e) => setEditingRenewal({ ...editingRenewal, [sub.subscription_id]: e.target.value })} /><button onClick={() => updateSubscription(sub.subscription_id, { nextRenewalDate: renewalValue ? `${renewalValue}T09:00:00` : null }).catch((err) => setMessage(err.message))}><Check size={13} /></button></div></label>
                    </div>
                    <div className="auto-response-actions">
                      <button onClick={() => respond(sub.subscription_id, 'mark_used')}><RefreshCw size={14} />I used this</button>
                      <button onClick={() => respond(sub.subscription_id, 'keep')}><ShieldCheck size={14} />Keep this renewal</button>
                      <button onClick={() => respond(sub.subscription_id, 'snooze')}><PauseCircle size={14} />Snooze 48h</button>
                      <button className="danger" onClick={() => respond(sub.subscription_id, 'cancel_now')}><XCircle size={14} />Cancel now</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="auto-notification-feed">
        <div className="auto-section-header">
          <div><p className="wallet-eyebrow">REMINDER INBOX</p><h3>Automation notifications</h3><p>The same events that can appear on your laptop are kept here for traceability.</p></div>
          {notifications.some((n) => !n.read) && <button className="wallet-secondary-button" onClick={markAllRead}>Mark all read</button>}
        </div>
        <div className="auto-feed-list">
          {notifications.length === 0 ? <div className="auto-feed-empty">No reminders generated yet.</div> : notifications.slice(0, 12).map((n) => (
            <div className={`auto-feed-item ${n.read ? '' : 'unread'}`} key={n.id || n.dedupe_key}>
              <div className="auto-feed-icon">{n.type === 'auto_cancelled' ? <Check size={16} /> : n.type === 'blocked' || n.type === 'auto_cancel_failed' ? <TriangleAlert size={16} /> : <Bell size={16} />}</div>
              <div><strong>{n.title}</strong><p>{n.body}</p><span>{new Date(n.created_at).toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="auto-reality-note">
        <TriangleAlert size={18} />
        <div>
          <strong>What is real vs. simulated in this build</strong>
          <p>Reminder scheduling, renewal countdowns, notification records, inactivity decisions, and the automatic trigger are fully implemented. Gmail is read-only and cannot see actual Spotify usage. Also, the current default Block 3 adapter simulates merchant cancellation; connect a merchant-specific cancellation adapter or live Block 3 service to change a real subscription account.</p>
        </div>
      </section>
    </div>
  );
};
