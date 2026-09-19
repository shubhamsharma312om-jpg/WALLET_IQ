import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Music,
  CheckCircle2,
  Sparkles,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Check,
  X,
  Clock,
  Flame,
} from 'lucide-react';
import { Subscription, Decision, ApprovalRequest, EscalationRecord } from '../../../backend/models/index.ts';

interface ActionCenterProps {
  userId: string;
  subscriptions: (Subscription & { decision?: Decision; computedStatus?: string })[];
  onActionComplete: () => Promise<void>;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
  userId,
  subscriptions,
  onActionComplete,
}) => {
  const [processingChoice, setProcessingChoice] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);

  const fetchApprovalsAndEscalations = useCallback(async () => {
    try {
      const [apprRes, escRes] = await Promise.all([
        fetch(`/api/approvals?userId=${userId}`),
        fetch(`/api/escalations?userId=${userId}`),
      ]);
      if (apprRes.ok) {
        const data = await apprRes.json();
        setApprovals(data.approvals || []);
      }
      if (escRes.ok) {
        const data = await escRes.json();
        setEscalations(data.escalations || []);
      }
    } catch {
      // Non-blocking
    }
  }, [userId]);

  useEffect(() => {
    fetchApprovalsAndEscalations();
  }, [fetchApprovalsAndEscalations, subscriptions]);

  // Check if TuneWave and MusicBox are in overlap status
  const tuneWave = subscriptions.find((s) => s.subscription_id === 'sub_tunewave');
  const musicBox = subscriptions.find((s) => s.subscription_id === 'sub_musicbox');
  const fitPulse = subscriptions.find((s) => s.subscription_id === 'sub_fitpulse');

  const hasOverlapPending =
    (tuneWave?.decision?.requires_approval || musicBox?.decision?.requires_approval) &&
    tuneWave?.computedStatus !== 'Cancelled' &&
    musicBox?.computedStatus !== 'Cancelled';

  const hasFitPulsePending =
    fitPulse?.decision?.requires_approval &&
    fitPulse?.computedStatus !== 'Cancelled';

  const handleApproveRequest = async (approvalId: string) => {
    setProcessingChoice(approvalId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Approval execution failed');
      }
      setActionMessage({
        type: 'success',
        text: '✓ Action approved and executed via Block 3. Confirmed savings updated.',
      });
      await fetchApprovalsAndEscalations();
      await onActionComplete();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Approval failed: ${err.message}. Invariant enforced: No savings counted.`,
      });
    } finally {
      setProcessingChoice(null);
    }
  };

  const handleRejectRequest = async (approvalId: string) => {
    setProcessingChoice(approvalId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: 'Rejected by user in Action Center' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Rejection failed');
      }
      setActionMessage({
        type: 'success',
        text: '✓ Request rejected. No action taken and confirmed savings remains $0.',
      });
      await fetchApprovalsAndEscalations();
      await onActionComplete();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Rejection failed: ${err.message}`,
      });
    } finally {
      setProcessingChoice(null);
    }
  };

  const handleOverlapChoice = async (choice: 'keep_tunewave' | 'keep_musicbox' | 'keep_both') => {
    setProcessingChoice(choice);
    setActionMessage(null);

    try {
      const res = await fetch('/api/actions/overlap-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, choice }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute choice');
      }

      if (choice === 'keep_tunewave') {
        setActionMessage({
          type: 'success',
          text: '✓ Retained TuneWave. Cancelled MusicBox Premium via Block 3 (+$11.99/mo added to confirmed savings).',
        });
      } else if (choice === 'keep_musicbox') {
        setActionMessage({
          type: 'success',
          text: '✓ Retained MusicBox Premium. Cancelled TuneWave via Block 3 (+$9.99/mo added to confirmed savings).',
        });
      } else {
        setActionMessage({
          type: 'success',
          text: '✓ Retained both subscriptions. No cancellation executed; confirmed savings unchanged.',
        });
      }

      await onActionComplete();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Action failed: ${err.message}. Invariant enforced: No savings counted.`,
      });
    } finally {
      setProcessingChoice(null);
    }
  };

  const handleSingleDecision = async (subscriptionId: string, decision: 'cancel' | 'keep') => {
    setProcessingChoice(subscriptionId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/actions/${subscriptionId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          decision,
          reason: `User explicitly approved ${decision} in Action Center`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Decision execution failed');
      }

      setActionMessage({
        type: 'success',
        text: `✓ Decision executed via Orchestrator. Monthly savings updated in database.`,
      });

      await onActionComplete();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Action failed: ${err.message}. No savings credited.`,
      });
    } finally {
      setProcessingChoice(null);
    }
  };

  return (
    <section className="mb-8" id="action-center-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">ACTION CENTER</h2>
            <p className="text-xs text-slate-400">
              Decisions requiring human judgment. Guardrails mandate explicit user consent for ambiguous overlaps.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Human-in-the-Loop
        </span>
      </div>

      {actionMessage && (
        <div
          className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/40 border-red-800/60 text-red-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {userId === 'u_301' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Canonical CASE 2: Overlapping Music Subscriptions */}
          <div className="bg-slate-900/90 border border-amber-800/40 rounded-xl p-5 relative overflow-hidden shadow-md flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300 tracking-wider uppercase">
                    Potential Overlap Detected (Case 2)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
                  Streaming Music
                </span>
              </div>

              {/* Overlap comparison cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* TuneWave */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">TuneWave</span>
                    <span className="text-xs font-mono font-semibold text-slate-300">$9.99/mo</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 font-medium">Used 4 days ago</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Active daily listening habits</div>
                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Waste: 15</span>
                    <span>Confidence: 92%</span>
                  </div>
                </div>

                {/* MusicBox Premium */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">MusicBox Premium</span>
                    <span className="text-xs font-mono font-semibold text-slate-300">$11.99/mo</span>
                  </div>
                  <div className="text-[11px] text-amber-400 mt-1 font-medium">Used 40 days ago</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Dormant redundant catalog</div>
                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Waste: 70</span>
                    <span>Confidence: 91%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg mb-4 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-amber-300">Reason: </span>
                "Both subscriptions belong to the same music category. The system cannot determine which service you prefer.
                Guardrails prevent autonomous cancellation without explicit user direction."
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              <div className="text-[11px] text-slate-400 mb-2 font-medium">Select your desired resolution:</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-keep-tunewave"
                  disabled={Boolean(processingChoice) || !hasOverlapPending}
                  onClick={() => handleOverlapChoice('keep_tunewave')}
                  className="px-2.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {processingChoice === 'keep_tunewave' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Keep TuneWave'
                  )}
                </button>

                <button
                  id="btn-keep-musicbox"
                  disabled={Boolean(processingChoice) || !hasOverlapPending}
                  onClick={() => handleOverlapChoice('keep_musicbox')}
                  className="px-2.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {processingChoice === 'keep_musicbox' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Keep MusicBox'
                  )}
                </button>

                <button
                  id="btn-keep-both"
                  disabled={Boolean(processingChoice) || !hasOverlapPending}
                  onClick={() => handleOverlapChoice('keep_both')}
                  className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {processingChoice === 'keep_both' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Keep Both'
                  )}
                </button>
              </div>
              {!hasOverlapPending && (
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Resolved. Run a new audit or reset state to test again.
                </p>
              )}
            </div>
          </div>

          {/* Free-Trial to Paid Escalation (FitPulse Pro) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-300 tracking-wider uppercase">
                    Trial Conversion Approval Needed
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">
                  Fitness & Wellness
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">FitPulse Pro</h4>
                    <p className="text-[11px] text-slate-400">Category: Fitness • Unused 65 days</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white font-mono">$29.99/mo</div>
                    <span className="text-[10px] text-amber-400 font-medium">Converted from free trial</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-700/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Waste Score</span>
                    <span className="font-bold text-amber-400">85/100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Confidence</span>
                    <span className="font-bold text-cyan-400">94%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Guardrail</span>
                    <span className="font-bold text-amber-300">Exceeds $20 Limit</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg mb-4 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-cyan-300">Reason: </span>
                "Amount ($29.99) exceeds the safe autonomous threshold ($20.00). System has prepared the cancellation script but mandates human confirmation."
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-cancel-fitpulse"
                  disabled={Boolean(processingChoice) || !hasFitPulsePending}
                  onClick={() => handleSingleDecision('sub_fitpulse', 'cancel')}
                  className="px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {processingChoice === 'sub_fitpulse' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Confirm Cancel ($29.99/mo)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  id="btn-keep-fitpulse"
                  disabled={Boolean(processingChoice) || !hasFitPulsePending}
                  onClick={() => handleSingleDecision('sub_fitpulse', 'keep')}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Keep Active
                </button>
              </div>
              {!hasFitPulsePending && (
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Resolved. State recorded in SQLite persistence.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Pending Approvals Queue (Block 3 SQLite Store) */}
      {approvals.filter((a) => a.status === 'PENDING').length > 0 && (
        <div className="mt-4 bg-slate-900/90 border border-amber-700/40 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-300 tracking-wider uppercase">
                Pending Block 3 Human Approvals ({approvals.filter((a) => a.status === 'PENDING').length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Strict Invariant: $0 confirmed until approved</span>
          </div>

          <div className="space-y-2.5">
            {approvals
              .filter((a) => a.status === 'PENDING')
              .map((req) => (
                <div
                  key={req.approval_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{req.merchant}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50 uppercase">
                        {req.requested_action}
                      </span>
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        ${req.monthly_savings.toFixed(2)}/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{req.reason}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={Boolean(processingChoice)}
                      onClick={() => handleApproveRequest(req.approval_id)}
                      className="px-3 py-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {processingChoice === req.approval_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Execute</span>
                        </>
                      )}
                    </button>

                    <button
                      disabled={Boolean(processingChoice)}
                      onClick={() => handleRejectRequest(req.approval_id)}
                      className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Escalation Records (Block 3 Escalation Engine) */}
      {escalations.length > 0 && (
        <div className="mt-4 bg-slate-900/90 border border-red-800/40 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              <h3 className="text-xs font-bold text-red-300 tracking-wider uppercase">
                Block 3 Escalation Records ({escalations.length})
              </h3>
            </div>
            <span className="text-[10px] text-red-400 font-mono">Autonomous Execution Blocked</span>
          </div>

          <div className="space-y-2">
            {escalations.map((esc) => (
              <div
                key={esc.escalation_id}
                className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold text-red-200">
                    <span>{esc.merchant}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 font-mono uppercase">
                      Risk: {esc.risk}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{esc.reason}</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {esc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
