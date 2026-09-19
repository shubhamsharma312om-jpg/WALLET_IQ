import React, { useState, useEffect } from 'react';
import { ShieldCheck, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Guardrails } from '../../../backend/models/index.ts';

export const GuardrailConfigViewer: React.FC = () => {
  const [guardrails, setGuardrails] = useState<Guardrails>({
    auto_action_limit: 20,
    protected_categories: ['insurance', 'loan_payment'],
    minimum_confidence: 90,
    duplicate_subscriptions: 'require_approval',
    unused_after_days: 90,
  });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const fetchGuardrails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guardrails?userId=u_301');
      if (res.ok) {
        const data = await res.json();
        setGuardrails(data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardrails();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301', guardrails }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6" id="guardrails-panel">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Dynamic User Guardrails</h3>
            <p className="text-xs text-slate-400">
              User-configurable rules persisted in SQLite. The orchestrator never hardcodes these limits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGuardrails}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
        {/* Auto Action Limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Autonomous Action Limit (USD)
          </label>
          <input
            type="number"
            value={guardrails.auto_action_limit}
            onChange={(e) =>
              setGuardrails({ ...guardrails, auto_action_limit: Number(e.target.value) })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            Subscriptions costing above this threshold require manual user approval in the Action Center.
          </p>
        </div>

        {/* Minimum Confidence */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Minimum Confidence Threshold (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={guardrails.minimum_confidence}
            onChange={(e) =>
              setGuardrails({ ...guardrails, minimum_confidence: Number(e.target.value) })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            Block 2 waste confidence must equal or exceed this value before safe autonomous cancellation is permitted.
          </p>
        </div>

        {/* Inactivity Threshold */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Inactivity Trigger (Days Unused)
          </label>
          <input
            type="number"
            value={guardrails.unused_after_days}
            onChange={(e) =>
              setGuardrails({ ...guardrails, unused_after_days: Number(e.target.value) })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            Number of days since last active usage before subscription is flagged as waste candidate.
          </p>
        </div>

        {/* Duplicate Handling */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Duplicate / Overlapping Subscriptions Policy
          </label>
          <select
            value={guardrails.duplicate_subscriptions}
            onChange={(e) =>
              setGuardrails({
                ...guardrails,
                duplicate_subscriptions: e.target.value as Guardrails['duplicate_subscriptions'],
              })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="require_approval">require_approval (Ask User)</option>
            <option value="auto_cancel_lower_usage">auto_cancel_lower_usage</option>
            <option value="ignore">ignore</option>
          </select>
          <p className="text-[11px] text-slate-500">
            Case 2 policy: When TuneWave & MusicBox overlap, system must require approval rather than guessing.
          </p>
        </div>
      </div>

      {/* Protected Categories */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
          <span>Protected Categories (Strict Autonomous Cancellation Ban)</span>
          <span className="text-[11px] text-amber-400 font-mono">No bypass mechanism permitted</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {guardrails.protected_categories.map((cat: string, idx: number) => (
            <span
              key={idx}
              className="px-2.5 py-1 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded text-xs font-mono flex items-center gap-1.5"
            >
              <span>{cat}</span>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          Case 3 policy: Any subscription within these categories (e.g. HealthGuard Insurance) is automatically blocked from autonomous cancellation.
        </p>
      </div>

      {saveStatus === 'saved' && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Guardrails successfully persisted to SQLite database.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Failed to persist guardrails. Check database connection.
        </div>
      )}
    </div>
  );
};
