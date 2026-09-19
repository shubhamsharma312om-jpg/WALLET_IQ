import React from 'react';
import { Database, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { MOCK_SUBSCRIPTIONS } from '../../../mock-data/index.ts';

export const MockDataViewer: React.FC = () => {
  return (
    <div className="space-y-6" id="mock-data-inspector">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Target Demo Dataset & Canonical Test Cases</h3>
              <p className="text-xs text-slate-400">
                Pre-configured mock fixtures ready to inject into Block 1 & 2 adapters for integration testing.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded">
            6 Normalized Subscriptions
          </span>
        </div>

        {/* Demo Cases Mapping Table */}
        <div className="mt-6 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Canonical Scenario Specifications
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Case 1 */}
            <div className="bg-slate-950/70 border border-emerald-900/40 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">CASE 1</span>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded text-[10px] font-mono border border-emerald-800">
                  Auto-Cancel
                </span>
              </div>
              <div className="text-sm font-semibold text-white">StreamFlix ($14.99/mo)</div>
              <p className="text-xs text-slate-300">
                Unused 187 days. Amount is within auto-action limit ($20) and confidence &gt;= 90%.
              </p>
              <div className="text-[11px] text-emerald-300/90 font-mono bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                <strong>Expected:</strong> Block 3 auto-cancels and counts exactly +$14.99/mo to confirmed savings.
              </div>
            </div>

            {/* Case 2 */}
            <div className="bg-slate-950/70 border border-amber-900/40 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">CASE 2</span>
                <span className="px-2 py-0.5 bg-amber-950 text-amber-300 rounded text-[10px] font-mono border border-amber-800">
                  Ask User
                </span>
              </div>
              <div className="text-sm font-semibold text-white">TuneWave + MusicBox Premium</div>
              <p className="text-xs text-slate-300">
                Both streaming music. TuneWave used 4d ago; MusicBox used 40d ago.
              </p>
              <div className="text-[11px] text-amber-300/90 font-mono bg-amber-950/40 p-2 rounded border border-amber-800/40">
                <strong>Expected:</strong> Overlap detected. Action Center prompts user choice; NO auto-decision.
              </div>
            </div>

            {/* Case 3 */}
            <div className="bg-slate-950/70 border border-rose-900/40 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono">CASE 3</span>
                <span className="px-2 py-0.5 bg-rose-950 text-rose-300 rounded text-[10px] font-mono border border-rose-800">
                  Guardrail Blocked
                </span>
              </div>
              <div className="text-sm font-semibold text-white">HealthGuard Insurance ($89/mo)</div>
              <p className="text-xs text-slate-300">
                Insurance policy. Belongs to protected_categories list.
              </p>
              <div className="text-[11px] text-rose-300/90 font-mono bg-rose-950/40 p-2 rounded border border-rose-800/40">
                <strong>Expected:</strong> Guardrail strictly blocks autonomous cancellation. No bypass allowed.
              </div>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="mt-8 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Mock Subscriptions In Database Seed
          </h4>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Merchant</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Inactivity</th>
                  <th className="p-3">Waste Score</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Event Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {MOCK_SUBSCRIPTIONS.map((sub) => (
                  <tr key={sub.subscription_id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-white">{sub.merchant}</td>
                    <td className="p-3 text-slate-400">{sub.category}</td>
                    <td className="p-3 text-emerald-400 font-semibold">${sub.amount.toFixed(2)}/mo</td>
                    <td className="p-3">
                      {sub.last_used_days_ago > 90 ? (
                        <span className="text-rose-400 font-semibold">{sub.last_used_days_ago} days</span>
                      ) : (
                        <span className="text-slate-400">{sub.last_used_days_ago} days</span>
                      )}
                    </td>
                    <td className="p-3">{sub.waste_score}/100</td>
                    <td className="p-3">{sub.confidence}%</td>
                    <td className="p-3 text-slate-400">
                      {sub.subscription_id === 'sub_cloudpro' && 'Price Increase (Email)'}
                      {sub.subscription_id === 'sub_fitpulse' && 'Trial-to-Paid Conversion'}
                      {sub.subscription_id === 'sub_streamflix' && 'Dormancy Notice'}
                      {sub.subscription_id === 'sub_healthguard' && 'Protected Category'}
                      {sub.subscription_id === 'sub_tunewave' && 'Active Overlap Primary'}
                      {sub.subscription_id === 'sub_musicbox' && 'Dormant Overlap Secondary'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
