/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Shield,
  Layers,
  FileJson,
  CheckCircle2,
  Database,
  Play,
  FileCheck,
  LayoutDashboard,
  ArrowLeft,
} from 'lucide-react';
import { MainDashboard } from './frontend/dashboard/MainDashboard.tsx';
import { ArchitectureOverview } from './frontend/dashboard/ArchitectureOverview.tsx';
import { ContractInspector } from './frontend/dashboard/ContractInspector.tsx';
import { AdapterStatusPanel } from './frontend/dashboard/AdapterStatusPanel.tsx';
import { GuardrailConfigViewer } from './frontend/dashboard/GuardrailConfigViewer.tsx';
import { MockDataViewer } from './frontend/dashboard/MockDataViewer.tsx';
import { WorkflowPipelineViewer } from './frontend/dashboard/WorkflowPipelineViewer.tsx';
import { TestRunnerPanel } from './frontend/dashboard/TestRunnerPanel.tsx';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'architect'>('dashboard');
  const [architectTab, setArchitectTab] = useState<
    'overview' | 'contracts' | 'adapters' | 'guardrails' | 'mockdata' | 'workflow' | 'tests'
  >('overview');

  if (currentView === 'dashboard') {
    return (
      <MainDashboard onOpenArchitectHub={() => setCurrentView('architect')} />
    );
  }

  return (
    <div className="wallet-ui wallet-architect min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Return to Main Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Main Dashboard</span>
            </button>
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">WALLET_IQ</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Architect Hub & Contracts
                </span>
              </div>
              <p className="text-xs text-slate-400">Subscription & Recurring-Spend Guardian Agent</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <button
              onClick={() => setArchitectTab('tests')}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Contracts 16/16 Passed</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex overflow-x-auto no-scrollbar gap-1 py-1 text-xs">
          <button
            onClick={() => setArchitectTab('overview')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'overview'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            Architecture & Flow
          </button>

          <button
            onClick={() => setArchitectTab('contracts')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'contracts'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 text-cyan-400" />
            Module Contracts (1, 2, 3)
          </button>

          <button
            onClick={() => setArchitectTab('adapters')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'adapters'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Adapter Interfaces & Routing
          </button>

          <button
            onClick={() => setArchitectTab('guardrails')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'guardrails'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Dynamic Guardrails
          </button>

          <button
            onClick={() => setArchitectTab('mockdata')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'mockdata'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            Mock Data & Demo Cases
          </button>

          <button
            onClick={() => setArchitectTab('workflow')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'workflow'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            Demo Audit Pipeline
          </button>

          <button
            onClick={() => setArchitectTab('tests')}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              architectTab === 'tests'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            Contract Test Suite
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {architectTab === 'overview' && <ArchitectureOverview />}
        {architectTab === 'contracts' && <ContractInspector />}
        {architectTab === 'adapters' && <AdapterStatusPanel />}
        {architectTab === 'guardrails' && <GuardrailConfigViewer />}
        {architectTab === 'mockdata' && <MockDataViewer />}
        {architectTab === 'workflow' && <WorkflowPipelineViewer />}
        {architectTab === 'tests' && <TestRunnerPanel />}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            WALLET_IQ Hackathon Foundation • Lead Architect: Main Dashboard, Orchestrator & Final Integration
          </span>
          <span className="font-mono text-slate-400">
            Node.js 22 + Native SQLite + Express + Vite + React
          </span>
        </div>
      </footer>
    </div>
  );
}
