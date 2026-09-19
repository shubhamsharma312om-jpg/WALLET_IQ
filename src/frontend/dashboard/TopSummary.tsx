import React from 'react';
import { DollarSign, TrendingUp, CheckCircle2, Layers, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SummaryData {
  totalRecurringSpend: number;
  potentialSavings: number;
  confirmedSavings: number;
  subscriptionsScanned: number;
  pendingApprovalCount: number;
  protectedCount: number;
  currency?: string;
}

interface TopSummaryProps {
  summary: SummaryData;
  loading?: boolean;
}

export const TopSummary: React.FC<TopSummaryProps> = ({ summary, loading }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="top-summary-metrics">
      {/* 1. Total Recurring Spend */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider">Total Monthly Spend</span>
          <DollarSign className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight font-mono">
          {loading ? '...' : `$${summary.totalRecurringSpend.toFixed(2)}`}
          <span className="text-[10px] text-slate-500 font-sans font-normal ml-1">/mo</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">Active recurring commitments</p>
      </div>

      {/* 2. Potential Savings */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-cyan-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Potential Savings</span>
          <TrendingUp className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-xl font-bold text-cyan-400 tracking-tight font-mono">
          {loading ? '...' : `$${summary.potentialSavings.toFixed(2)}`}
          <span className="text-[10px] text-cyan-400/70 font-sans font-normal ml-1">/mo</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">Flagged waste & pending review</p>
      </div>

      {/* 3. Confirmed Savings */}
      <div className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-700 transition-colors">
        <div className="flex items-center justify-between text-emerald-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider font-semibold">Confirmed Savings</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-emerald-400 tracking-tight font-mono">
          {loading ? '...' : `$${summary.confirmedSavings.toFixed(2)}`}
          <span className="text-[10px] text-emerald-400/80 font-sans font-normal ml-1">/mo</span>
        </div>
        <p className="text-[10px] text-emerald-300/70 mt-1 truncate">Verified by Block 3 actions</p>
      </div>

      {/* 4. Subscriptions Detected */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider">Detected Subs</span>
          <Layers className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-white tracking-tight font-mono">
          {loading ? '...' : summary.subscriptionsScanned}
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">Scanned in intelligence audit</p>
      </div>

      {/* 5. Requiring Approval */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-amber-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Needs Approval</span>
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-xl font-bold text-amber-400 tracking-tight font-mono">
          {loading ? '...' : summary.pendingApprovalCount}
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">Action Center decisions</p>
      </div>

      {/* 6. Protected / Blocked */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-indigo-400 mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Protected</span>
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-xl font-bold text-indigo-400 tracking-tight font-mono">
          {loading ? '...' : summary.protectedCount}
        </div>
        <p className="text-[10px] text-slate-500 mt-1 truncate">Guardrail-enforced rules</p>
      </div>
    </div>
  );
};
