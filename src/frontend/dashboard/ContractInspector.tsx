import React, { useState } from 'react';
import { FileJson, ArrowRight, Code2 } from 'lucide-react';

export const ContractInspector: React.FC = () => {
  const [activeBlock, setActiveBlock] = useState<'block1' | 'block2' | 'block3'>('block1');

  const contracts = {
    block1: {
      title: 'BLOCK 1 — Detection & Subscription Intelligence',
      endpoint: 'POST /analyze-subscriptions',
      port: '4001',
      envVar: 'BLOCK1_BASE_URL',
      adapterClass: 'Block1HttpAdapter implements IBlock1Adapter',
      errorCodes: ['BLOCK_1_UNAVAILABLE', 'INVALID_BLOCK_1_RESPONSE', 'MISSING_SUBSCRIPTION_ID'],
      inputSample: {
        user_id: 'u_301',
        transactions: [
          {
            transaction_id: 'tx_streamflix_01',
            merchant: 'StreamFlix',
            amount: 14.99,
            currency: 'USD',
            date: '2026-09-01T08:00:00Z',
            category: 'streaming_video',
          },
        ],
        emails: [
          {
            event_id: 'email_streamflix_inactive',
            subject: 'We miss you on StreamFlix',
            sender: 'billing@streamflix.com',
            date: '2026-08-15T18:30:00Z',
            snippet: 'It has been over 5 months since your last stream.',
            event_type: 'renewal_notice',
          },
        ],
      },
      outputSample: {
        user_id: 'u_301',
        subscriptions: [
          {
            subscription_id: 'sub_streamflix',
            merchant: 'StreamFlix',
            category: 'streaming_video',
            amount: 14.99,
            currency: 'USD',
            cadence: 'monthly',
            last_used_days_ago: 187,
            waste_score: 95,
            confidence: 96,
            risk: 'low',
            status: 'active',
            recommended_action: 'cancel',
          },
        ],
        events: [],
      },
    },
    block2: {
      title: 'BLOCK 2 — Decision, Scoring & Guardrails',
      endpoint: 'POST /evaluate-subscriptions',
      port: '4002',
      envVar: 'BLOCK2_BASE_URL',
      adapterClass: 'Block2HttpAdapter implements IBlock2Adapter',
      errorCodes: ['BLOCK_2_UNAVAILABLE', 'INVALID_BLOCK_2_RESPONSE', 'MISSING_SUBSCRIPTION_ID'],
      inputSample: {
        user_id: 'u_301',
        subscriptions: [
          {
            subscription_id: 'sub_streamflix',
            merchant: 'StreamFlix',
            amount: 14.99,
            last_used_days_ago: 187,
            waste_score: 95,
            confidence: 96,
            risk: 'low',
          },
        ],
        events: [],
        guardrails: {
          auto_action_limit: 20,
          protected_categories: ['insurance', 'loan_payment'],
          minimum_confidence: 90,
          duplicate_subscriptions: 'require_approval',
          unused_after_days: 90,
        },
      },
      outputSample: {
        user_id: 'u_301',
        decisions: [
          {
            subscription_id: 'sub_streamflix',
            action: 'cancel',
            reason: 'Unused for 187 days. Exceeds inactivity threshold (90d) and within safe limit ($20).',
            waste_score: 95,
            confidence: 96,
            risk: 'low',
            requires_approval: false,
            guardrail_status: 'passed',
          },
        ],
      },
    },
    block3: {
      title: 'BLOCK 3 — Autonomous Actions & Escalation',
      endpoint: 'POST /execute-action',
      port: '4003',
      envVar: 'BLOCK3_BASE_URL',
      adapterClass: 'Block3HttpAdapter implements IBlock3Adapter',
      errorCodes: ['BLOCK_3_UNAVAILABLE', 'INVALID_BLOCK_3_RESPONSE', 'ACTION_FAILED'],
      inputSample: {
        user_id: 'u_301',
        subscription: {
          subscription_id: 'sub_streamflix',
          merchant: 'StreamFlix',
          amount: 14.99,
          currency: 'USD',
        },
        decision: {
          action: 'cancel',
          reason: 'Autonomous inactivity cancellation',
        },
      },
      outputSample: {
        action_id: 'act_streamflix_001',
        status: 'success',
        action: 'cancel',
        monthly_savings: 14.99,
      },
    },
  };

  const current = contracts[activeBlock];

  return (
    <div className="space-y-6" id="contracts-inspector">
      {/* Block Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveBlock('block1')}
          className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-t border-x ${
            activeBlock === 'block1'
              ? 'bg-slate-900 border-slate-700 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          BLOCK 1 — Detection Contract
        </button>
        <button
          onClick={() => setActiveBlock('block2')}
          className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-t border-x ${
            activeBlock === 'block2'
              ? 'bg-slate-900 border-slate-700 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          BLOCK 2 — Decision Contract
        </button>
        <button
          onClick={() => setActiveBlock('block3')}
          className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-t border-x ${
            activeBlock === 'block3'
              ? 'bg-slate-900 border-slate-700 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          BLOCK 3 — Actions Contract
        </button>
      </div>

      {/* Contract Detail Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">Target Service Specification</span>
            <h3 className="text-lg font-semibold text-white mt-1">{current.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-cyan-300">
              {current.endpoint}
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300">
              Port: {current.port}
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300">
              Env: {current.envVar}
            </span>
          </div>
        </div>

        {/* Adapter metadata & Error codes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              Adapter Responsibility
            </div>
            <div className="text-xs font-mono text-slate-400">{current.adapterClass}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Transforms orchestrator models to teammate endpoint. Validates response schemas and catches network timeouts.
            </p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              Classified Error Codes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {current.errorCodes.map((code) => (
                <span key={code} className="px-2 py-0.5 bg-rose-950/40 text-rose-300 border border-rose-800/50 rounded text-[10px] font-mono">
                  {code}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* JSON Request / Response Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Contract */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Request Schema (Input)
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80">
              {JSON.stringify(current.inputSample, null, 2)}
            </pre>
          </div>

          {/* Output Contract */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Response Schema (Output)
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80">
              {JSON.stringify(current.outputSample, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
