import React, { useState } from 'react';
import { CheckCircle2, XCircle, Play, ShieldAlert, FileCheck } from 'lucide-react';

interface TestItem {
  name: string;
  passed: boolean;
  message?: string;
}

interface TestSuite {
  suite: string;
  tests: TestItem[];
  passedCount: number;
  totalCount: number;
}

interface TestReport {
  allPassed: boolean;
  totalTests: number;
  totalPassed: number;
  suites: TestSuite[];
}

export const TestRunnerPanel: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<TestReport | null>(null);

  const runTests = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error('Test execution failed:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6" id="test-runner-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Live Architectural Contract Test Runner</h3>
            <p className="text-xs text-slate-400">
              Validates schema transformations, adapter error mapping, savings invariants, and the 3 demo cases.
            </p>
          </div>
        </div>

        <button
          onClick={runTests}
          disabled={running}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running Test Suites...' : 'Run All 16 Contract Tests'}
        </button>
      </div>

      {/* Test Report View */}
      {report && (
        <div className="space-y-5">
          {/* Summary Banner */}
          <div
            className={`p-4 rounded-lg border flex items-center justify-between ${
              report.allPassed
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {report.allPassed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="text-sm font-semibold">
                {report.allPassed
                  ? 'All Architectural Contracts & Guardrail Invariants Verified (100% Passed)'
                  : 'Some Contract Tests Failed'}
              </span>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-950">
              {report.totalPassed} / {report.totalTests} Passed
            </span>
          </div>

          {/* Suites */}
          <div className="space-y-4">
            {report.suites.map((suite, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-white font-mono">{suite.suite}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {suite.passedCount}/{suite.totalCount} passed
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {suite.tests.map((test, tIdx) => (
                    <div
                      key={tIdx}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/50"
                    >
                      <div className="flex items-center space-x-2">
                        {test.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className={test.passed ? 'text-slate-300' : 'text-rose-300'}>
                          {test.name}
                        </span>
                      </div>
                      {test.message && (
                        <span className="text-[10px] text-rose-400 font-sans">{test.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && !running && (
        <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
          Click "Run All 16 Contract Tests" to execute the test suite against the backend orchestrator and adapters.
        </div>
      )}
    </div>
  );
};
