import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  ArrowDownRight,
  XCircle,
  HelpCircle,
  Shield,
  Layers,
} from 'lucide-react';
import { Subscription, Decision, ActionResult } from '../../../backend/models/index.ts';

interface EnrichedSubscription extends Subscription {
  decision?: Decision;
  actionResult?: ActionResult;
  computedStatus?: string;
}

interface SubscriptionListProps {
  subscriptions: EnrichedSubscription[];
  loading?: boolean;
}

export const SubscriptionList: React.FC<SubscriptionListProps> = ({
  subscriptions,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.merchant.toLowerCase().includes(search.toLowerCase()) ||
      sub.category.toLowerCase().includes(search.toLowerCase());

    const status = sub.computedStatus || sub.status;
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && status === 'active';
    if (statusFilter === 'cancelled') return matchesSearch && status === 'Cancelled';
    if (statusFilter === 'pending') return matchesSearch && status === 'Pending Approval';
    if (statusFilter === 'protected') return matchesSearch && status === 'Protected';
    return matchesSearch;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Cancelled
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Pending Approval
          </span>
        );
      case 'Protected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 font-semibold">
            <Lock className="w-3 h-3" />
            Protected
          </span>
        );
      case 'Blocked':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-semibold">
            <XCircle className="w-3 h-3" />
            Blocked
          </span>
        );
      case 'Downgraded':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-400 border border-purple-800/60 font-semibold">
            <ArrowDownRight className="w-3 h-3" />
            Downgraded
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-semibold">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Active
          </span>
        );
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high':
        return <span className="text-[10px] font-mono text-red-400">High</span>;
      case 'medium':
        return <span className="text-[10px] font-mono text-amber-400">Med</span>;
      case 'low':
      default:
        return <span className="text-[10px] font-mono text-emerald-400">Low</span>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'cancel':
        return <span className="text-red-400 font-semibold uppercase text-[10px]">Cancel</span>;
      case 'review':
        return <span className="text-amber-400 font-semibold uppercase text-[10px]">Review</span>;
      case 'downgrade':
        return <span className="text-purple-400 font-semibold uppercase text-[10px]">Downgrade</span>;
      case 'keep':
      default:
        return <span className="text-slate-400 font-semibold uppercase text-[10px]">Keep</span>;
    }
  };

  return (
    <section className="mb-8" id="subscriptions-section">
      {/* Header with Search and Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Subscriptions</h2>
            <p className="text-xs text-slate-400">
              {subscriptions.length} recurring services monitored across financial intelligence pipelines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search merchant or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-56"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            {(['all', 'active', 'pending', 'cancelled', 'protected'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded capitalize transition-colors font-medium text-[11px] ${
                  statusFilter === filter
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter === 'pending' ? 'Approval' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Merchant & Category</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Last Used</th>
                <th className="py-3 px-3 text-center">Waste Score</th>
                <th className="py-3 px-3 text-center">Confidence</th>
                <th className="py-3 px-3 text-center">Risk</th>
                <th className="py-3 px-3 text-center">Current Status</th>
                <th className="py-3 px-4 text-right">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Loading subscriptions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No subscriptions matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => {
                  const status = sub.computedStatus || sub.status;
                  const isCancelled = status === 'Cancelled';
                  const isProtected = status === 'Protected';
                  const isPending = status === 'Pending Approval';

                  return (
                    <tr
                      key={sub.subscription_id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isCancelled
                          ? 'bg-emerald-950/10'
                          : isProtected
                          ? 'bg-indigo-950/10'
                          : isPending
                          ? 'bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* Merchant & Category */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm">{sub.merchant}</span>
                          {sub.is_trial_conversion && (
                            <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-950/90 text-blue-300 border border-blue-800/60 font-semibold" title="Converted from free trial to paid subscription">
                              Trial Conversion
                            </span>
                          )}
                          {sub.price_hike_detected && (
                            <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-800/60 font-semibold" title={`Price increased from $${sub.previous_amount ?? sub.price_hike_details?.previous_amount ?? '?'} to $${sub.amount}`}>
                              Price Hike {sub.previous_amount ? `($${sub.previous_amount}→$${sub.amount})` : ''}
                            </span>
                          )}
                          {(sub.duplicate_group || sub.overlap_detected) && (
                            <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/90 text-purple-300 border border-purple-800/60 font-semibold" title={`Overlapping subscription group: ${sub.duplicate_group || 'detected'}`}>
                              Overlap: {sub.duplicate_group ? sub.duplicate_group.replace('overlap_', '') : 'group'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {sub.category.replace('_', ' ')}
                        </div>
                      </td>

                      {/* Amount & Cadence */}
                      <td className="py-3 px-3 font-mono">
                        <span className="font-bold text-white">${sub.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 ml-0.5">/{sub.cadence === 'monthly' ? 'mo' : 'yr'}</span>
                      </td>

                      {/* Last Used */}
                      <td className="py-3 px-3">
                        <div
                          className={`font-medium ${
                            sub.last_used_days_ago > 90
                              ? 'text-red-400 font-semibold'
                              : sub.last_used_days_ago > 30
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {sub.last_used_days_ago === 0
                            ? 'Today'
                            : `${sub.last_used_days_ago} days ago`}
                        </div>
                        <div className="text-[10px] text-slate-500">Activity signal</div>
                      </td>

                      {/* Waste Score */}
                      <td className="py-3 px-3 text-center">
                        {sub.awaiting_decision || (!sub.decision && sub.waste_score === 0) ? (
                          <span className="inline-block text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded italic" title="Waste scoring is assigned by Block 2 Decision Engine">
                            Awaiting Decision
                          </span>
                        ) : (
                          <div className="inline-flex items-center justify-center font-mono font-bold px-2 py-0.5 rounded text-xs">
                            <span
                              className={
                                (sub.decision?.waste_score ?? sub.waste_score) >= 80
                                  ? 'text-red-400'
                                  : (sub.decision?.waste_score ?? sub.waste_score) >= 50
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }
                            >
                              {sub.decision?.waste_score ?? sub.waste_score}
                            </span>
                            <span className="text-[10px] text-slate-600">/100</span>
                          </div>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-3 text-center font-mono">
                        <div className="flex flex-col items-center">
                          <span className="text-cyan-400 font-semibold">{sub.detection_confidence || sub.confidence}%</span>
                          <span className="text-[9px] text-slate-500">Detection</span>
                          {sub.decision?.decision_confidence !== undefined && (
                            <div className="mt-0.5 text-[10px] text-indigo-300">
                              <span>{sub.decision.decision_confidence}%</span>
                              <span className="text-[8px] text-slate-400 ml-0.5">Decision</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Risk */}
                      <td className="py-3 px-3 text-center font-mono">
                        {sub.awaiting_decision || (!sub.decision && sub.waste_score === 0) ? (
                          <span className="text-[10px] text-slate-500 italic">Pending Block 2</span>
                        ) : (
                          getRiskBadge(sub.decision?.risk || sub.risk)
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(status)}
                      </td>

                      {/* Recommended Action */}
                      <td className="py-3 px-4 text-right">
                        {sub.awaiting_decision || (!sub.decision && sub.recommended_action === 'review' && sub.waste_score === 0) ? (
                          <span className="inline-flex items-center text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                            Awaiting Decision Engine
                          </span>
                        ) : sub.decision?.decision === 'AUTO_CANCEL' ? (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-red-300 bg-red-950/80 border border-red-800/60 px-2 py-0.5 rounded">
                            Auto-Cancel
                          </span>
                        ) : sub.decision?.decision === 'PROTECTED' ? (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded">
                            Protected
                          </span>
                        ) : sub.decision?.decision === 'REQUIRE_APPROVAL' ? (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded">
                            Require Approval
                          </span>
                        ) : (
                          <div>{getActionBadge(sub.decision?.recommended_action || sub.decision?.action || sub.recommended_action)}</div>
                        )}
                        {sub.decision?.reason && (
                          <div className="text-[10px] text-slate-400 max-w-xs ml-auto truncate" title={sub.decision.reason}>
                            {sub.decision.reason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
