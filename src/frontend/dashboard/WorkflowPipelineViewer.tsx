import React, { useState } from 'react';
import { Play, CheckCircle2, AlertCircle, Clock, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { WorkflowProgress, AuditRunResult } from '../../../backend/models/index.ts';

export const WorkflowPipelineViewer: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [progressStages, setProgressStages] = useState<WorkflowProgress[]>([]);
  const [auditResult, setAuditResult] = useState<AuditRunResult | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const runAudit = async () => {
    setRunning(true);
    setProgressStages([]);
    setAuditResult(null);

    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301' }),
      });

      const data = await res.json();
      if (data.success) {
        setProgressStages(data.workflowProgress || []);
        setAuditResult(data.result);
      }
    } catch (err) {
      console.error('Audit run error:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleUserApproveAction = async (subscriptionId: string) => {
    setExecutingActionId(subscriptionId);
    try {
      const res = await fetch('/api/action/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'u_301',
          subscriptionId,
          action: 'cancel',
        }),
      });

      if (res.ok) {
        // Refresh audit results
        const refreshRes = await fetch('/api/audit/results?userId=u_301');
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          if (auditResult) {
            setAuditResult({
              ...auditResult,
              savings: freshData.savings,
              auditEvents: freshData.auditEvents,
              pendingApprovals: auditResult.pendingApprovals.filter(
                (p: { subscription_id: string }) => p.subscription_id !== subscriptionId
              ),
            });
          }
        }
      }
    } catch (err) {
      console.error('Action approval error:', err);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="space-y-6" id="workflow-pipeline-panel">
      {/* Trigger & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-semibold text-white">Orchestrator Demo Mode: "Run Subscription Audit"</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Executes the end-to-end multi-block pipeline emitting all 7 structured workflow progress stages.
            </p>
          </div>

          <button
            onClick={runAudit}
            disabled={running}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Executing Audit Pipeline...' : 'Run Subscription Audit'}
          </button>
        </div>

        {/* Structured 7 Workflow Stages */}
        <div className="mt-6 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pipeline Progression Stages (7 Phases)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { num: 1, label: '1. Analyzing tx...' },
              { num: 2, label: '2. Detecting subs...' },
              { num: 3, label: '3. Evaluating waste...' },
              { num: 4, label: '4. Checking guardrails...' },
              { num: 5, label: '5. Executing actions...' },
              { num: 6, label: '6. Preparing approvals...' },
              { num: 7, label: '7. Audit complete.' },
            ].map((stageItem) => {
              const matched = progressStages.find((p) => p.stageNumber === stageItem.num);
              const isCompleted = matched && matched.status === 'completed';

              return (
                <div
                  key={stageItem.num}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : running
                      ? 'bg-slate-950 border-slate-800 text-slate-500'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-mono opacity-80">Phase {stageItem.num}</div>
                  <div className="text-xs font-semibold mt-1 truncate">{stageItem.label}</div>
                  <div className="mt-1 flex justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-700"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Audit Results when available */}
      {auditResult && (
        <div className="space-y-6">
          {/* Savings Metric Cards (Savings Rule Demonstration) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-mono text-slate-400">Potential Monthly Savings</div>
              <div className="text-2xl font-bold text-white mt-1">
                ${auditResult.savings.potential_savings.toFixed(2)}
                <span className="text-xs text-slate-400 font-normal"> /mo</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Calculated from Block 2 recommended cancellations and pending reviews.
              </p>
            </div>

            <div className="bg-slate-900 border border-emerald-800/60 rounded-xl p-5 bg-gradient-to-br from-slate-900 to-emerald-950/20">
              <div className="text-xs font-mono text-emerald-400 flex items-center justify-between">
                <span>Confirmed Monthly Savings</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ${auditResult.savings.confirmed_savings.toFixed(2)}
                <span className="text-xs text-emerald-400/80 font-normal"> /mo</span>
              </div>
              <p className="text-[11px] text-emerald-300/80 mt-2">
                Strict Savings Rule: Only increments after Block 3 confirms status: "success".
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-mono text-slate-400">Actions & Approvals</div>
              <div className="text-2xl font-bold text-white mt-1">
                {auditResult.autoExecutedActions.length} auto / {auditResult.pendingApprovals.length} pending
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Case 1 auto-executed; Case 2 awaiting user choice; Case 3 blocked.
              </p>
            </div>
          </div>

          {/* Action Center (Case 2: TuneWave vs MusicBox Overlap) */}
          {auditResult.pendingApprovals.length > 0 && (
            <div className="bg-slate-900 border border-amber-800/60 rounded-xl p-6">
              <div className="flex items-center space-x-2 text-amber-400 text-sm font-semibold mb-3">
                <UserCheck className="w-4 h-4" />
                <span>Action Center: User Approval Required (Case 2 Demonstration)</span>
              </div>
              <p className="text-xs text-slate-300 mb-4">
                The orchestrator detected overlapping music streaming subscriptions (TuneWave & MusicBox Premium). Per guardrails, the system does not guess user preference. Choose an action:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {auditResult.pendingApprovals.map((pending: { subscription_id: string; reason: string }) => (
                  <div key={pending.subscription_id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">
                        {pending.subscription_id === 'sub_tunewave' ? 'TuneWave ($9.99/mo)' : 'MusicBox Premium ($11.99/mo)'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded">
                        Requires Choice
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{pending.reason}</p>
                    <button
                      onClick={() => handleUserApproveAction(pending.subscription_id)}
                      disabled={executingActionId === pending.subscription_id}
                      className="w-full py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded text-xs font-medium border border-rose-700/50 transition-colors"
                    >
                      {executingActionId === pending.subscription_id ? 'Cancelling via Block 3...' : 'Approve Cancellation (Cancel This Service)'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Audit Event Log (Recorded in SQLite)
            </h4>
            <div className="divide-y divide-slate-800 font-mono text-xs">
              {auditResult.auditEvents.map((evt: any, idx: number) => (
                <div key={idx} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        evt.status === 'success'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : evt.status === 'blocked'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {evt.status}
                    </span>
                    <span className="text-white font-medium">{evt.merchant}</span>
                    <span className="text-slate-500">[{evt.action}]</span>
                  </div>
                  <div className="text-slate-400 text-[11px] truncate max-w-lg">{evt.reason}</div>
                  <div className="text-right">
                    {evt.savings > 0 ? (
                      <span className="text-emerald-400 font-semibold">+${evt.savings.toFixed(2)}/mo</span>
                    ) : (
                      <span className="text-slate-500">$0.00</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
