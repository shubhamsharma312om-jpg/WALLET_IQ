import React from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Lock, RotateCcw } from 'lucide-react';

interface DemoCaseQuickBarProps {
  onResetDemo: () => Promise<void>;
  isResetting?: boolean;
}

export const DemoCaseQuickBar: React.FC<DemoCaseQuickBarProps> = ({
  onResetDemo,
  isResetting,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Judge Demo Guide: 3 Canonical Scenarios
          </h3>
        </div>

        <button
          onClick={onResetDemo}
          disabled={isResetting}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto disabled:opacity-50 cursor-pointer"
          title="Reset database to clean pre-audit demo state"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Reset Demo State</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Case 1 */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-emerald-900/40 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-emerald-400 font-mono text-[11px]">CASE 1: SAFE AUTO-ACTION</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-semibold text-white">StreamFlix ($14.99/mo)</div>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            Unused for 187 days. Exceeds dormancy threshold (90d) and cost is under $20 limit &rarr; Autonomous Block 3 cancellation executes safely; crediting confirmed savings.
          </p>
        </div>

        {/* Case 2 */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-amber-900/40 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-amber-400 font-mono text-[11px]">CASE 2: AMBIGUOUS OVERLAP</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-semibold text-white">TuneWave vs MusicBox Premium</div>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            Both are streaming music. System refuses to assume user taste based only on usage &rarr; Routes to Action Center for explicit user resolution.
          </p>
        </div>

        {/* Case 3 */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-indigo-900/40 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-indigo-400 font-mono text-[11px]">CASE 3: GUARDRAIL PROTECTED</span>
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="font-semibold text-white">HealthGuard Insurance ($89/mo)</div>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            Category is "insurance". Guardrail policy strictly blocks autonomous cancellation &rarr; Marked 🔒 Protected with no normal cancel button.
          </p>
        </div>
      </div>
    </div>
  );
};
