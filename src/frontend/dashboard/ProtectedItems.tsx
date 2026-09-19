import React from 'react';
import { ShieldCheck, Lock, AlertOctagon, Info } from 'lucide-react';
import { Subscription, Decision } from '../../../backend/models/index.ts';

interface ProtectedItemsProps {
  subscriptions: (Subscription & { decision?: Decision; computedStatus?: string })[];
}

export const ProtectedItems: React.FC<ProtectedItemsProps> = ({ subscriptions }) => {
  // Find all items whose decision guardrail status is 'blocked' or category is protected
  const protectedItems = subscriptions.filter(
    (s) => s.decision?.guardrail_status === 'blocked' || s.category === 'insurance' || s.category === 'loan_payment'
  );

  return (
    <section className="mb-8" id="protected-items-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Lock className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">PROTECTED ITEMS</h2>
            <p className="text-xs text-slate-400">
              High-sensitivity categories shielded from autonomous cancellation by user policy.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Autonomous Action Blocked
        </span>
      </div>

      {protectedItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
          No protected items detected.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {protectedItems.map((item) => {
            const reason =
              item.decision?.reason ||
              'Insurance is protected by your autonomous-action rules. No cancellation was attempted.';

            return (
              <div
                key={item.subscription_id}
                className="bg-slate-900/90 border border-indigo-900/40 rounded-xl p-5 relative overflow-hidden shadow-md group hover:border-indigo-800/60 transition-colors"
                id={`protected-item-${item.subscription_id}`}
              >
                {/* Visual badge top right */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{item.merchant}</h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-indigo-400" />
                        PROTECTED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 capitalize">
                      Category: {item.category.replace('_', ' ')} • Billed {item.cadence}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-bold text-white">${item.amount.toFixed(2)}</span>
                    <span className="text-xs text-slate-500">/{item.cadence === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>

                {/* Shield Reasoning Box */}
                <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-lg text-xs text-indigo-200 leading-relaxed flex items-start gap-2.5">
                  <AlertOctagon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Guardrail Enforcement: </span>
                    {reason}
                  </div>
                </div>

                {/* Explicitly no cancellation button; notice only */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Info className="w-3.5 h-3.5" />
                    <span>Autonomous cancellation disabled by policy</span>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    Confidence: {item.confidence}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
