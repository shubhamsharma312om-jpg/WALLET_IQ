import React from 'react';
import { Shield, ArrowDown, Database, Cpu, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const ArchitectureOverview: React.FC = () => {
  return (
    <div className="space-y-6" id="architecture-overview-container">
      {/* Executive Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                WALLET_IQ — Architectural Contract & Integration Hub
              </h2>
              <p className="text-sm text-slate-400">
                Phase 0 Foundation: Establishing module boundaries, adapter abstractions, and orchestration contracts
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full text-xs font-mono font-medium">
            Phase 0: Architecture Only
          </span>
        </div>

        <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-4xl">
          WALLET_IQ is designed as <strong>ONE integrated product</strong> composed of three independently developed modules.
          To prevent tight coupling and decouple teammate implementations, the orchestrator depends solely on strict{' '}
          <strong className="text-emerald-400">Adapter Interfaces</strong>, not teammate internal code.
        </p>
      </div>

      {/* Core Product Flow Diagram */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6" id="data-flow-diagram">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          End-to-End Conceptual Product Flow
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center text-center">
          {/* Node 1 */}
          <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-lg">
            <div className="text-xs font-mono text-slate-400 mb-1">Entry Point</div>
            <div className="text-sm font-semibold text-white">USER & DASHBOARD</div>
            <div className="text-[11px] text-slate-400 mt-1">Audit Trigger</div>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">→</div>

          {/* Node 2 */}
          <div className="bg-blue-950/40 border border-blue-800/50 p-3 rounded-lg">
            <div className="text-xs font-mono text-blue-400 mb-1">BLOCK 1</div>
            <div className="text-sm font-semibold text-white">Detection & Intel</div>
            <div className="text-[11px] text-blue-300 mt-1">tx + emails → Subscriptions</div>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">→</div>

          {/* Node 3 */}
          <div className="bg-purple-950/40 border border-purple-800/50 p-3 rounded-lg">
            <div className="text-xs font-mono text-purple-400 mb-1">BLOCK 2</div>
            <div className="text-sm font-semibold text-white">Decision & Scoring</div>
            <div className="text-[11px] text-purple-300 mt-1">Waste + Guardrail check</div>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">→</div>

          {/* Node 4 */}
          <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-lg">
            <div className="text-xs font-mono text-emerald-400 mb-1">BLOCK 3</div>
            <div className="text-sm font-semibold text-white">Autonomous Actions</div>
            <div className="text-[11px] text-emerald-300 mt-1">Execution / Escalation</div>
          </div>
        </div>

        {/* Feedback Loop to Database & Dashboard */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>State & Persistence:</strong> Native SQLite stores subscriptions, transactions, decisions, guardrails, action results & audit logs.
            </span>
          </div>
          <div className="flex items-center gap-2 bg-amber-950/30 px-3 py-1.5 rounded border border-amber-800/40 text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong>Savings Rule:</strong> Confirmed savings ONLY increments on explicit Block 3 success.
            </span>
          </div>
        </div>
      </div>

      {/* Architectural Principles Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            Adapter Boundary Pattern
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Orchestrator relies strictly on <code className="text-blue-300">IBlock1Adapter</code>,{' '}
            <code className="text-purple-300">IBlock2Adapter</code>, and{' '}
            <code className="text-emerald-300">IBlock3Adapter</code>. If a teammate’s API shifts, only the adapter is adapted.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-2">
            <Shield className="w-4 h-4 text-purple-400" />
            Stateful Guardrails
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Guardrails are dynamically loaded from SQLite state (<code className="text-purple-300">auto_action_limit: $20</code>,{' '}
            <code className="text-purple-300">protected: ["insurance"]</code>). Never hardcoded.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Canonical Case Coverage
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Architected to verify Case 1 (StreamFlix auto-cancel), Case 2 (TuneWave + MusicBox overlap approval), and Case 3 (HealthGuard insurance guardrail blocked).
          </p>
        </div>
      </div>
    </div>
  );
};
