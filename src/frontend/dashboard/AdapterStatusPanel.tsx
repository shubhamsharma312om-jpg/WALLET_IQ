import React, { useEffect, useState } from 'react';
import { Layers, CheckCircle2, AlertTriangle, Link, Activity } from 'lucide-react';

export const AdapterStatusPanel: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = () => {
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => console.error('Failed to load system status:', err));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggleBlock1Mode = async (targetMode: 'real' | 'mock') => {
    setToggling(true);
    try {
      await fetch('/api/system/block1-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to switch mode:', err);
    } finally {
      setToggling(false);
    }
  };

  const isBlock1Real = systemStatus?.adapterModes?.block1?.includes('HTTP');
  const isFriend1Healthy = systemStatus?.friend1Service?.running;

  const adapters = [
    {
      block: 'Block 1 — Detection & Intelligence',
      targetUrl: isBlock1Real ? (systemStatus?.friend1Service?.endpoint || 'http://localhost:8001') : 'mock://block1',
      adapterName: isBlock1Real ? 'Block1HttpAdapter (Friend 1)' : 'MockBlock1Adapter',
      mode: systemStatus?.adapterModes?.block1 || 'MOCK_STANDALONE',
      endpoint: '/analyze-subscriptions',
      timeout: '8000ms',
      canToggle: true,
      serviceHealth: isFriend1Healthy,
    },
    {
      block: 'Block 2 — Decision, Scoring & Guardrails',
      targetUrl: systemStatus?.adapters?.block2?.url || 'http://localhost:4002',
      adapterName: systemStatus?.adapters?.block2?.name || 'Block2HttpAdapter',
      mode: systemStatus?.adapterModes?.block2 || 'MOCK_STANDALONE',
      endpoint: '/evaluate-subscriptions',
      timeout: '8000ms',
      canToggle: false,
    },
    {
      block: 'Block 3 — Autonomous Actions & Escalation',
      targetUrl: systemStatus?.adapters?.block3?.url || 'http://localhost:4003',
      adapterName: systemStatus?.adapters?.block3?.name || 'Block3HttpAdapter',
      mode: systemStatus?.adapterModes?.block3 || 'MOCK_STANDALONE',
      endpoint: '/execute-action',
      timeout: '10000ms',
      canToggle: false,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6" id="adapters-status-panel">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Adapter Boundary & Environment Routing</h3>
            <p className="text-xs text-slate-400">
              The orchestrator interacts strictly through adapter contracts, isolating teammate service mutations.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-3 py-1 rounded">
          <Activity className="w-3.5 h-3.5" />
          <span>Orchestrator: ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {adapters.map((a, idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">{a.block}</span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Active Adapter:</span>
                <span className="font-mono text-slate-200">{a.adapterName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Contract Endpoint:</span>
                <span className="font-mono text-cyan-300">{a.endpoint}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Base URL:</span>
                <span className="font-mono text-slate-300 truncate max-w-[150px]">{a.targetUrl}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Max Timeout:</span>
                <span className="font-mono text-amber-400">{a.timeout}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Execution Mode</span>
              {a.canToggle ? (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={toggling}
                    onClick={() => handleToggleBlock1Mode(isBlock1Real ? 'mock' : 'real')}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 text-cyan-300 text-[10px] font-mono rounded cursor-pointer transition-colors flex items-center gap-1"
                    title="Click to toggle between Mock and Friend 1 HTTP adapter"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isBlock1Real ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    {a.mode}
                    <span className="text-[9px] text-slate-400 underline ml-0.5">switch</span>
                  </button>
                </div>
              ) : (
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-mono rounded">
                  {a.mode}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
        <div className="text-slate-300 font-semibold mb-1">Teammate Integration Note:</div>
        <p>
          When teammates deliver their modules, simply point <code className="text-cyan-300">BLOCK1_BASE_URL</code>,{' '}
          <code className="text-cyan-300">BLOCK2_BASE_URL</code>, and{' '}
          <code className="text-cyan-300">BLOCK3_BASE_URL</code> in <code className="text-slate-200">.env</code> to their service ports.
          If their internal endpoint format differs, update the respective <code className="text-slate-200">transformRequest()</code> and{' '}
          <code className="text-slate-200">transformResponse()</code> methods inside <code className="text-purple-300">backend/adapters/</code>.
        </p>
      </div>
    </div>
  );
};
