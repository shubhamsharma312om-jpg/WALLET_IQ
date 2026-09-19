import React from 'react';
import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { WorkflowProgress } from '../../../backend/models/index.ts';

interface AuditProgressBarProps {
  isRunning: boolean;
  currentProgressLogs: WorkflowProgress[];
  activeStageIndex: number;
  totalStages: number;
  onDismiss?: () => void;
  error?: string | null;
}

const STAGE_LABELS = [
  '1. Analyzing transactions...',
  '2. Detecting subscriptions...',
  '3. Evaluating waste...',
  '4. Checking guardrails...',
  '5. Executing safe actions...',
  '6. Preparing approval requests...',
  '7. Audit complete.',
];

export const AuditProgressBar: React.FC<AuditProgressBarProps> = ({
  isRunning,
  currentProgressLogs,
  activeStageIndex,
  totalStages = 7,
  onDismiss,
  error,
}) => {
  if (!isRunning && currentProgressLogs.length === 0 && !error) {
    return null;
  }

  const isCompleted = activeStageIndex >= totalStages && !error;
  const progressPercent = Math.min(100, Math.round((activeStageIndex / totalStages) * 100));

  return (
    <div
      className="bg-slate-900 border border-cyan-800/40 rounded-xl p-5 mb-6 shadow-xl relative overflow-hidden transition-all duration-300"
      id="audit-progress-card"
    >
      {/* Background glow banner */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Autonomous Orchestrator Workflow
              {isRunning && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  ACTIVE
                </span>
              )}
              {isCompleted && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  COMPLETED
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {isRunning
                ? `Running Stage ${activeStageIndex} of ${totalStages} across Block 1, Block 2, and Block 3...`
                : error
                ? 'Workflow encountered an error during execution.'
                : 'Full 7-stage audit cycle completed with real-time guardrails enforced.'}
            </p>
          </div>
        </div>

        {onDismiss && !isRunning && (
          <button
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-800/80 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${
            error
              ? 'bg-red-500'
              : isCompleted
              ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
              : 'bg-cyan-500'
          }`}
          style={{ width: `${error ? 100 : progressPercent}%` }}
        />
      </div>

      {/* 7 Stages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAGE_LABELS.map((label, idx) => {
          const stageNumber = idx + 1;
          const isDone = stageNumber < activeStageIndex || (stageNumber === 7 && isCompleted);
          const isCurrent = stageNumber === activeStageIndex && isRunning;
          const isPending = stageNumber > activeStageIndex;

          return (
            <div
              key={idx}
              className={`p-2 rounded-lg border text-left transition-all ${
                isCurrent
                  ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                  : isDone
                  ? 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                  : 'bg-slate-900/40 border-slate-800/50 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold">STAGE {stageNumber}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>
              <p
                className={`text-[11px] font-medium leading-snug line-clamp-2 ${
                  isCurrent ? 'text-cyan-200 font-semibold' : isDone ? 'text-slate-200' : 'text-slate-500'
                }`}
              >
                {label.replace(/^\d+\.\s*/, '')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Error Banner if any */}
      {error && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Pipeline Execution Alert:</span> {error}
            <p className="text-[11px] text-red-400/80 mt-0.5">
              Invariant rule enforced: Confirmed savings were not credited for unverified actions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
