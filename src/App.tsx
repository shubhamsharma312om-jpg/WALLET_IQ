/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck,
  FileJson,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Play,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { MainDashboard, WorkspacePage } from './frontend/dashboard/MainDashboard.tsx';
import { ArchitectureOverview } from './frontend/dashboard/ArchitectureOverview.tsx';
import { ContractInspector } from './frontend/dashboard/ContractInspector.tsx';
import { AdapterStatusPanel } from './frontend/dashboard/AdapterStatusPanel.tsx';
import { GuardrailConfigViewer } from './frontend/dashboard/GuardrailConfigViewer.tsx';
import { MockDataViewer } from './frontend/dashboard/MockDataViewer.tsx';
import { WorkflowPipelineViewer } from './frontend/dashboard/WorkflowPipelineViewer.tsx';
import { TestRunnerPanel } from './frontend/dashboard/TestRunnerPanel.tsx';

type RouteKey = 'home' | 'learn' | 'workspace' | 'architect';

type ArchitectTab = 'overview' | 'contracts' | 'adapters' | 'guardrails' | 'mockdata' | 'workflow' | 'tests';

const workspacePath: Record<WorkspacePage, string> = {
  overview: '/app',
  subscriptions: '/app/subscriptions',
  actions: '/app/actions',
  activity: '/app/activity',
  settings: '/app/settings',
};

function routeFromPath(pathname: string): { route: RouteKey; workspacePage: WorkspacePage } {
  if (pathname === '/learn' || pathname === '/how-it-works') return { route: 'learn', workspacePage: 'overview' };
  if (pathname === '/architect' || pathname.startsWith('/architect/')) return { route: 'architect', workspacePage: 'overview' };
  if (pathname.startsWith('/app/subscriptions')) return { route: 'workspace', workspacePage: 'subscriptions' };
  if (pathname.startsWith('/app/actions')) return { route: 'workspace', workspacePage: 'actions' };
  if (pathname.startsWith('/app/activity')) return { route: 'workspace', workspacePage: 'activity' };
  if (pathname.startsWith('/app/settings')) return { route: 'workspace', workspacePage: 'settings' };
  if (pathname.startsWith('/app')) return { route: 'workspace', workspacePage: 'overview' };
  return { route: 'home', workspacePage: 'overview' };
}

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="site-brand" onClick={onClick} aria-label="Wallet IQ home">
      <span className="site-brand-mark"><Shield size={19} /></span>
      <span>wallet<strong>iq</strong><b>.</b></span>
    </button>
  );
}

function PublicHeader({ navigate }: { navigate: (path: string) => void }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Brand onClick={() => navigate('/')} />
        <nav className="site-nav">
          <button onClick={() => navigate('/how-it-works')}>How it works</button>
          <button onClick={() => navigate('/app/subscriptions')}>Subscriptions</button>
          <button onClick={() => navigate('/app/settings')}>Settings</button>
        </nav>
        <button className="site-header-cta" onClick={() => navigate('/app')}>Open workspace <ArrowRight size={15} /></button>
      </div>
    </header>
  );
}

function HomePage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="public-site">
      <PublicHeader navigate={navigate} />
      <main>
        <section className="site-hero">
          <div className="site-hero-copy">
            <p className="site-kicker"><Sparkles size={14} /> Your recurring spend, finally clear</p>
            <h1>Spend less attention<br />on subscriptions.</h1>
            <p className="site-hero-lede">Wallet IQ finds recurring charges from your Gmail billing emails, organizes them, and puts every sensitive action behind your rules.</p>
            <div className="site-hero-actions">
              <button className="site-primary-cta" onClick={() => navigate('/app')}>Enter your workspace <ArrowRight size={16} /></button>
              <button className="site-secondary-cta" onClick={() => navigate('/how-it-works')}><Play size={15} /> Watch how it works</button>
            </div>
            <div className="site-trust-row">
              <span><CheckCircle2 size={14} /> Read-only Gmail</span>
              <span><CheckCircle2 size={14} /> Human approval guardrails</span>
              <span><CheckCircle2 size={14} /> Traceable actions</span>
            </div>
          </div>
          <div className="site-hero-visual">
            <div className="site-visual-orbit" />
            <img src="/media/more-life.webp" alt="A calm lifestyle scene representing more room for what matters" />
            <div className="site-floating-card top">
              <span>Potential monthly savings</span>
              <strong>$83.46</strong>
              <small>Across detected recurring spend</small>
            </div>
            <div className="site-floating-card bottom">
              <span className="site-live-dot" />
              <div><strong>Gmail connected</strong><small>Ready for a fresh scan</small></div>
            </div>
          </div>
        </section>

        <section className="site-proof-strip">
          <div><strong>01</strong><span>Connect Gmail</span></div>
          <div><strong>02</strong><span>Detect recurring spend</span></div>
          <div><strong>03</strong><span>Review recommendations</span></div>
          <div><strong>04</strong><span>Approve what matters</span></div>
        </section>

        <section className="site-feature-section">
          <div className="site-section-copy">
            <p className="site-kicker">DESIGNED FOR CALM</p>
            <h2>One product.<br />Clear places for every task.</h2>
            <p>The workspace is intentionally split into focused pages instead of forcing every table, setting and approval into one endless dashboard.</p>
          </div>
          <div className="site-feature-grid">
            <button onClick={() => navigate('/app/subscriptions')} className="site-feature-card">
              <Wallet size={22} /><span>Subscriptions</span><strong>See the full recurring-spend inventory.</strong><ArrowRight size={17} />
            </button>
            <button onClick={() => navigate('/app/actions')} className="site-feature-card green">
              <LockKeyhole size={22} /><span>Action Center</span><strong>Keep approvals and protected items separate.</strong><ArrowRight size={17} />
            </button>
            <button onClick={() => navigate('/app/activity')} className="site-feature-card">
              <Activity size={22} /><span>Activity & savings</span><strong>Follow the audit trail and savings over time.</strong><ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="site-video-preview">
          <div>
            <p className="site-kicker">PRODUCT WALKTHROUGH</p>
            <h2>See Wallet IQ in motion.</h2>
            <p>A short walkthrough shows the Gmail scan, subscription inventory, action review and guardrail settings as one connected flow.</p>
            <button className="site-primary-cta" onClick={() => navigate('/how-it-works')}><Play size={15} /> Open walkthrough</button>
          </div>
          <button className="site-video-poster" onClick={() => navigate('/how-it-works')} aria-label="Play product walkthrough">
            <img src="/media/more-life.webp" alt="" />
            <span className="site-play-button"><Play size={24} fill="currentColor" /></span>
            <span className="site-video-caption">Wallet IQ · 45 second overview</span>
          </button>
        </section>
      </main>
      <footer className="site-footer"><Brand onClick={() => navigate('/')} /><span>Subscription clarity without the clutter.</span><button onClick={() => navigate('/app')}>Open workspace</button></footer>
    </div>
  );
}

function LearnPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="public-site learn-page">
      <PublicHeader navigate={navigate} />
      <main className="learn-main">
        <section className="learn-hero">
          <p className="site-kicker">HOW IT WORKS</p>
          <h1>From inbox signal<br />to a decision you control.</h1>
          <p>Wallet IQ uses your connected Gmail account as a read-only billing signal, then passes detected subscriptions through the existing decision and guardrail pipeline.</p>
        </section>

        <section className="learn-video-shell">
          <div className="learn-video-copy">
            <span>PRODUCT WALKTHROUGH</span>
            <h2>A quick tour of the complete flow.</h2>
            <p>The video is bundled with the project, so the player works locally during your demo without relying on YouTube or an internet connection.</p>
          </div>
          <video className="learn-video" controls preload="metadata" poster="/media/more-life.webp">
            <source src="/media/wallet-iq-demo.mp4" type="video/mp4" />
            Your browser does not support the video element.
          </video>
        </section>

        <section className="learn-steps">
          <article><span>01</span><Mail size={22} /><h3>Connect Gmail</h3><p>OAuth keeps credentials outside the app. Wallet IQ requests Gmail read-only access and stores the connection for the active session.</p></article>
          <article><span>02</span><Database size={22} /><h3>Scan billing evidence</h3><p>Subscription, renewal, trial and price-change emails are normalized into structured signals for the audit pipeline.</p></article>
          <article><span>03</span><Shield size={22} /><h3>Apply guardrails</h3><p>Protected categories, confidence thresholds and approval rules determine what can proceed automatically and what must wait for you.</p></article>
          <article><span>04</span><Activity size={22} /><h3>Keep the trail</h3><p>Detected subscriptions, decisions, activity and savings remain visible on dedicated pages in the workspace.</p></article>
        </section>

        <section className="learn-cta">
          <div><p className="site-kicker">READY TO USE IT?</p><h2>Open the workspace and run a live scan.</h2></div>
          <button className="site-primary-cta" onClick={() => navigate('/app')}>Go to workspace <ArrowRight size={16} /></button>
        </section>
      </main>
    </div>
  );
}

function ArchitectHub({ onBack }: { onBack: () => void }) {
  const [architectTab, setArchitectTab] = useState<ArchitectTab>('overview');

  const tabs = useMemo(() => [
    { id: 'overview' as const, label: 'Architecture & Flow', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'contracts' as const, label: 'Module Contracts', icon: <FileJson className="w-3.5 h-3.5" /> },
    { id: 'adapters' as const, label: 'Adapters', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'guardrails' as const, label: 'Guardrails', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'mockdata' as const, label: 'Mock Data', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'workflow' as const, label: 'Audit Pipeline', icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'tests' as const, label: 'Contract Tests', icon: <FileCheck className="w-3.5 h-3.5" /> },
  ], []);

  return (
    <div className="wallet-ui wallet-architect min-h-screen flex flex-col">
      <header className="architect-header">
        <div className="architect-header-inner">
          <button onClick={onBack} className="wallet-secondary-button"><ArrowLeft className="w-4 h-4" />Workspace</button>
          <div className="architect-title"><span><Shield size={20} /></span><div><strong>WALLET_IQ</strong><small>Architect Hub & Contracts</small></div></div>
          <button onClick={() => setArchitectTab('tests')} className="architect-test-badge"><CheckCircle2 size={15} /> Contracts 16/16 passed</button>
        </div>
      </header>
      <div className="architect-tabs">{tabs.map(tab => <button key={tab.id} onClick={() => setArchitectTab(tab.id)} className={architectTab === tab.id ? 'active' : ''}>{tab.icon}{tab.label}</button>)}</div>
      <main className="architect-main">
        {architectTab === 'overview' && <ArchitectureOverview />}
        {architectTab === 'contracts' && <ContractInspector />}
        {architectTab === 'adapters' && <AdapterStatusPanel />}
        {architectTab === 'guardrails' && <GuardrailConfigViewer />}
        {architectTab === 'mockdata' && <MockDataViewer />}
        {architectTab === 'workflow' && <WorkflowPipelineViewer />}
        {architectTab === 'tests' && <TestRunnerPanel />}
      </main>
    </div>
  );
}

export default function App() {
  const [locationState, setLocationState] = useState(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setLocationState(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setLocationState(routeFromPath(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (locationState.route === 'home') return <HomePage navigate={navigate} />;
  if (locationState.route === 'learn') return <LearnPage navigate={navigate} />;
  if (locationState.route === 'architect') return <ArchitectHub onBack={() => navigate('/app')} />;

  return (
    <MainDashboard
      page={locationState.workspacePage}
      onNavigate={(page) => navigate(workspacePath[page])}
      onGoHome={() => navigate('/')}
      onOpenLearn={() => navigate('/how-it-works')}
      onOpenArchitectHub={() => navigate('/architect')}
    />
  );
}
