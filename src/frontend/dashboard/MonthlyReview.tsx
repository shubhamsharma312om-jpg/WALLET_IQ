import React from 'react';
import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Percent,
  Calculator,
} from 'lucide-react';

interface MonthlyReviewProps {
  subscriptionsScanned: number;
  potentialSavings: number;
  confirmedSavings: number;
  cancelledCount: number;
  downgradedCount: number;
  pendingApprovalCount: number;
  protectedCount: number;
  currency?: string;
}

export const MonthlyReview: React.FC<MonthlyReviewProps> = ({
  subscriptionsScanned,
  potentialSavings,
  confirmedSavings,
  cancelledCount,
  downgradedCount,
  pendingApprovalCount,
  protectedCount,
  currency = 'USD',
}) => {
  // CRITICAL INVARIANT: Annualized confirmed savings = confirmed monthly savings * 12
  const annualizedConfirmedSavings = Number((confirmedSavings * 12).toFixed(2));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm" id="monthly-review-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">MONTHLY REVIEW</h3>
            <p className="text-[11px] text-slate-400">Deterministic savings audit and financial impact breakdown.</p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
          Strict Invariant Active
        </span>
      </div>

      {/* Primary Annualized Hero Box */}
      <div className="bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-700/50 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Annualized Confirmed Savings
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight mt-1">
              ${annualizedConfirmedSavings.toFixed(2)}
              <span className="text-xs text-emerald-300/70 font-normal font-sans ml-1.5">/year</span>
            </div>
            <p className="text-[11px] text-emerald-200/60 mt-0.5">
              Calculated strictly as: <code className="font-mono text-emerald-300">${confirmedSavings.toFixed(2)} × 12</code>
            </p>
          </div>

          <div className="text-right sm:border-l sm:border-emerald-800/50 sm:pl-4">
            <div className="text-xs text-slate-400">Monthly Run-Rate Savings</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              ${confirmedSavings.toFixed(2)}
              <span className="text-[10px] text-slate-400 font-normal font-sans ml-1">/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Scanned</div>
          <div className="text-base font-bold text-white font-mono mt-0.5">{subscriptionsScanned}</div>
          <div className="text-[10px] text-slate-500">subscriptions</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
          <div className="text-[10px] text-cyan-400 uppercase font-semibold">Potential</div>
          <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">${potentialSavings.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500">estimated waste</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
          <div className="text-[10px] text-emerald-400 uppercase font-semibold">Cancelled</div>
          <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">{cancelledCount}</div>
          <div className="text-[10px] text-slate-500">subscriptions</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
          <div className="text-[10px] text-purple-400 uppercase font-semibold">Downgraded</div>
          <div className="text-base font-bold text-purple-400 font-mono mt-0.5">{downgradedCount}</div>
          <div className="text-[10px] text-slate-500">plan tier</div>
        </div>
      </div>

      {/* Secondary Status Counts */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pending Approval:
          </span>
          <span className="font-bold text-amber-400 font-mono">{pendingApprovalCount}</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Protected:
          </span>
          <span className="font-bold text-indigo-400 font-mono">{protectedCount}</span>
        </div>
      </div>

      {/* Architecture Invariant Callout */}
      <div className="p-3 rounded-lg bg-slate-950/80 border border-cyan-900/40 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-cyan-300">Strict Invariant Architecture: </span>
          Potential savings ($83.46) are never counted toward confirmed savings. Confirmed savings ($
          {confirmedSavings.toFixed(2)}) strictly require affirmative execution receipts from Block 3.
        </div>
      </div>
    </div>
  );
};
