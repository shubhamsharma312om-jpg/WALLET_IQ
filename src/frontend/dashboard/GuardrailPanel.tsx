import React, { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  Check,
  RotateCcw,
  Sliders,
  DollarSign,
  Percent,
  Clock,
  Lock,
  Layers,
  Loader2,
} from 'lucide-react';
import { Guardrails } from '../../../backend/models/index.ts';

interface GuardrailPanelProps {
  initialGuardrails?: Guardrails;
  onSave?: (updated: Guardrails) => Promise<void>;
}

export const GuardrailPanel: React.FC<GuardrailPanelProps> = ({
  initialGuardrails,
  onSave,
}) => {
  const [guardrails, setGuardrails] = useState<Guardrails>(
    initialGuardrails || {
      auto_action_limit: 20,
      protected_categories: ['insurance', 'loan_payment'],
      minimum_confidence: 90,
      duplicate_subscriptions: 'require_approval',
      unused_after_days: 90,
    }
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (initialGuardrails) {
      setGuardrails(initialGuardrails);
    }
  }, [initialGuardrails]);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      if (onSave) {
        await onSave(guardrails);
      } else {
        const res = await fetch('/api/guardrails', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'u_301', guardrails }),
        });
        if (!res.ok) throw new Error('Failed to save');
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setGuardrails({
      auto_action_limit: 20,
      protected_categories: ['insurance', 'loan_payment'],
      minimum_confidence: 90,
      duplicate_subscriptions: 'require_approval',
      unused_after_days: 90,
    });
  };

  const addCategory = () => {
    const cleaned = newCategory.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleaned && !guardrails.protected_categories.includes(cleaned)) {
      setGuardrails({
        ...guardrails,
        protected_categories: [...guardrails.protected_categories, cleaned],
      });
      setNewCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setGuardrails({
      ...guardrails,
      protected_categories: guardrails.protected_categories.filter((c) => c !== cat),
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm" id="guardrail-settings-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">GUARDRAILS</h3>
            <p className="text-[11px] text-slate-400">User-configurable constraints enforced prior to any autonomous action.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{savedSuccess ? 'Persisted' : 'Save Rules'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Auto Action Limit */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
              Auto-Action Limit
            </span>
            <span className="font-mono text-xs font-bold text-indigo-400">
              ${guardrails.auto_action_limit.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">Max monthly cost permitted for autonomous cancellation.</p>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={guardrails.auto_action_limit}
            onChange={(e) =>
              setGuardrails({ ...guardrails, auto_action_limit: Number(e.target.value) })
            }
            className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1">
            <span>$5 (Strict)</span>
            <span>$20 (Default)</span>
            <span>$100 (Relaxed)</span>
          </div>
        </div>

        {/* 2. Minimum Confidence */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-indigo-400" />
              Minimum Confidence
            </span>
            <span className="font-mono text-xs font-bold text-indigo-400">
              {guardrails.minimum_confidence}%
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">AI decision certainty threshold required before auto-cancel.</p>
          <input
            type="range"
            min="75"
            max="99"
            step="1"
            value={guardrails.minimum_confidence}
            onChange={(e) =>
              setGuardrails({ ...guardrails, minimum_confidence: Number(e.target.value) })
            }
            className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1">
            <span>75% (Lenient)</span>
            <span>90% (Default)</span>
            <span>99% (Deterministic)</span>
          </div>
        </div>

        {/* 3. Inactivity Threshold */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Unused Threshold
            </span>
            <span className="font-mono text-xs font-bold text-indigo-400">
              {guardrails.unused_after_days} days
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">Zero-activity period required to designate service as dormant.</p>
          <input
            type="range"
            min="30"
            max="180"
            step="15"
            value={guardrails.unused_after_days}
            onChange={(e) =>
              setGuardrails({ ...guardrails, unused_after_days: Number(e.target.value) })
            }
            className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1">
            <span>30 days</span>
            <span>90 days (Default)</span>
            <span>180 days</span>
          </div>
        </div>
      </div>

      {/* Row 2: Protected Categories & Duplicate Subscriptions Rule */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        {/* Protected Categories */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
          <div className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            Protected Categories (Autonomous Action Blocked)
          </div>
          <p className="text-[10px] text-slate-500 mb-2.5">
            Any subscription in these categories is strictly protected from autonomous modification.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {guardrails.protected_categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 text-[11px] font-mono capitalize"
              >
                {cat.replace('_', ' ')}
                <button
                  onClick={() => removeCategory(cat)}
                  className="hover:text-red-400 text-indigo-400 ml-0.5 text-xs font-bold"
                  title={`Remove ${cat}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add category (e.g. utilities)..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 flex-1"
            />
            <button
              onClick={addCategory}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Duplicate Subscriptions Rule */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Duplicate / Overlapping Subscriptions
            </div>
            <p className="text-[10px] text-slate-500 mb-3">
              Behavior when redundant services in the same category (e.g. TuneWave vs MusicBox) are detected.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="duplicate_rule"
                  checked={guardrails.duplicate_subscriptions === 'require_approval'}
                  onChange={() =>
                    setGuardrails({ ...guardrails, duplicate_subscriptions: 'require_approval' })
                  }
                  className="accent-indigo-500"
                />
                <span>Require Human Approval (Action Center)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400">
                  Recommended
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="duplicate_rule"
                  checked={guardrails.duplicate_subscriptions === 'auto_cancel_lower_usage'}
                  onChange={() =>
                    setGuardrails({ ...guardrails, duplicate_subscriptions: 'auto_cancel_lower_usage' })
                  }
                  className="accent-indigo-500"
                />
                <span>Auto-Cancel Lower Usage (Aggressive)</span>
              </label>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
            Rules automatically persist to backend SQLite database upon clicking Save.
          </div>
        </div>
      </div>
    </div>
  );
};
