import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  Clock,
  DollarSign,
  Activity,
  XCircle,
} from 'lucide-react';
import { AuditEvent } from '../../../backend/models/index.ts';

interface ActivityLogProps {
  events: AuditEvent[];
  loading?: boolean;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events, loading }) => {
  const getEventIcon = (event: AuditEvent) => {
    if (event.status === 'success' && event.savings > 0) {
      return (
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
      );
    }
    if (event.status === 'blocked' || event.action === 'guardrail_protect') {
      return (
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-indigo-400" />
        </div>
      );
    }
    if (event.status === 'pending') {
      return (
        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </div>
      );
    }
    if (event.status === 'failed') {
      return (
        <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
        <Activity className="w-3.5 h-3.5 text-slate-300" />
      </div>
    );
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm" id="activity-log-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">ACTIVITY LOG</h3>
            <p className="text-[11px] text-slate-400">Chronological ledger of autonomous and user-approved actions.</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500">{events.length} events logged</span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading audit history...</div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No activity recorded yet. Run a Subscription Audit to generate ledger entries.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {events.map((event, idx) => (
            <div
              key={event.id || idx}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                {getEventIcon(event)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{event.merchant}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {event.action}
                    </span>
                    <span
                      className={`text-[10px] font-mono capitalize ${
                        event.status === 'success'
                          ? 'text-emerald-400'
                          : event.status === 'blocked'
                          ? 'text-indigo-400'
                          : event.status === 'pending'
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      [{event.status}]
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-snug line-clamp-2">
                    {event.reason}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {event.savings > 0 ? (
                  <div className="text-emerald-400 font-mono font-bold text-xs">
                    +${event.savings.toFixed(2)}/mo
                  </div>
                ) : (
                  <div className="text-slate-500 font-mono text-[10px]">$0.00 saved</div>
                )}
                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
