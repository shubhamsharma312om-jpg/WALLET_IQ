import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Play,
  Loader2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Activity,
  Scan,
  LayoutDashboard,
  Wallet,
  ArrowUpRight,
  LockKeyhole,
  CheckCheck,
} from 'lucide-react';
import { TopSummary } from './TopSummary.tsx';
import { AuditProgressBar } from './AuditProgressBar.tsx';
import { ActionCenter } from './ActionCenter.tsx';
import { ProtectedItems } from './ProtectedItems.tsx';
import { SubscriptionList } from './SubscriptionList.tsx';
import { ActivityLog } from './ActivityLog.tsx';
import { MonthlyReview } from './MonthlyReview.tsx';
import { GuardrailPanel } from './GuardrailPanel.tsx';
import { DemoCaseQuickBar } from './DemoCaseQuickBar.tsx';
import {
  Subscription,
  Decision,
  ActionResult,
  AuditEvent,
  Guardrails,
  WorkflowProgress,
} from '../../../backend/models/index.ts';

interface MainDashboardProps {
  onOpenArchitectHub?: () => void;
}

interface EnrichedSubscription extends Subscription {
  decision?: Decision;
  actionResult?: ActionResult;
  computedStatus?: string;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({ onOpenArchitectHub }) => {
  const [loading, setLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [progressLogs, setProgressLogs] = useState<WorkflowProgress[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Core application state fetched from backend API
  const [subscriptions, setSubscriptions] = useState<EnrichedSubscription[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrails | undefined>(undefined);
  const [savingsSummary, setSavingsSummary] = useState({
    totalRecurringSpend: 156.93,
    potentialSavings: 83.46,
    confirmedSavings: 0,
    subscriptionsScanned: 6,
    cancelledCount: 0,
    downgradedCount: 0,
    pendingApprovalCount: 2,
    protectedCount: 1,
    currency: 'USD',
  });

  const [block1Mode, setBlock1Mode] = useState<'mock' | 'real'>('real');
  const [friend1Running, setFriend1Running] = useState<boolean>(true);
  const [detectionRunning, setDetectionRunning] = useState(false);

  // Gmail Integration State
  const [gmailStatus, setGmailStatus] = useState({ configured: false, connected: false, email: null as string | null });
  const [dataMode, setDataMode] = useState<'demo' | 'practical'>('demo');
  const [scanMetadata, setScanMetadata] = useState<any>(null);

  // Fetch current state from backend API
  const fetchDashboardData = useCallback(async (overrideMode?: 'demo' | 'practical') => {
    try {
      setLoading(true);

      // 1. Get Mode & Status first
      const [statusRes, dataModeRes, gmailRes, scanRes] = await Promise.all([
        fetch('/api/system/status'),
        fetch('/api/system/data-mode'),
        fetch('/auth/gmail/status?userId=u_301'), // auth is still mapped to u_301/shared internally
        fetch('/api/gmail/scan/latest')
      ]);

      let currentMode: 'demo' | 'practical' = 'demo';
      if (dataModeRes.ok) {
        const modeData = await dataModeRes.json();
        currentMode = modeData.mode || 'demo';
      }
      
      const activeMode = overrideMode || currentMode;
      setDataMode(activeMode);
      
      const activeUserId = activeMode === 'practical' ? 'u_practical' : 'u_301';

      if (gmailRes.ok) {
        const gStatus = await gmailRes.json();
        setGmailStatus(gStatus);
      }

      if (scanRes.ok) {
        const sData = await scanRes.json();
        if (activeMode === 'practical' && sessionStorage.getItem('practical_scanned') !== 'true') {
          setScanMetadata(null);
        } else {
          setScanMetadata(sData);
        }
      } else {
        setScanMetadata(null);
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const isReal = Boolean(statusData?.adapterModes?.block1?.includes('HTTP'));
        setBlock1Mode(isReal ? 'real' : 'mock');
        setFriend1Running(Boolean(statusData?.friend1Service?.running));
      }

      // 2. Fetch data specifically for active user
      const [subsRes, activityRes, savingsRes, guardrailsRes] = await Promise.all([
        fetch(`/api/subscriptions?userId=${activeUserId}`),
        fetch(`/api/activity?userId=${activeUserId}`),
        fetch(`/api/savings?userId=${activeUserId}`),
        fetch(`/api/guardrails?userId=${activeUserId}`)
      ]);

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        // Enforce session boundary for practical mode
        if (activeMode === 'practical' && sessionStorage.getItem('practical_scanned') !== 'true') {
          setSubscriptions([]);
        } else {
          setSubscriptions(subsData.subscriptions || []);
        }
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (activeMode === 'practical' && sessionStorage.getItem('practical_scanned') !== 'true') {
          setAuditEvents([]);
        } else {
          setAuditEvents(activityData.events || []);
        }
      }

      if (savingsRes.ok) {
        const savingsData = await savingsRes.json();
        if (activeMode === 'practical' && sessionStorage.getItem('practical_scanned') !== 'true') {
          setSavingsSummary({ ...savingsData, potentialSavings: 0, confirmedSavings: 0, subscriptionsScanned: 0 });
        } else {
          setSavingsSummary(savingsData);
        }
      }

      if (guardrailsRes.ok) {
        const gData = await guardrailsRes.json();
        setGuardrails(gData);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check URL params for Gmail OAuth result
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get('gmail');
    if (gmailResult) {
      if (gmailResult === 'connected') {
        // Auto-switch to practical mode if they just connected
        handleToggleDataMode('practical');
      }
      // Remove param from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return; // handleToggleDataMode will fetch
    }
    
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Session enforcement: If we are in practical mode but haven't scanned this session, hide data
  const hasScannedThisSession = typeof window !== 'undefined' && sessionStorage.getItem('practical_scanned') === 'true';
  const effectiveSubscriptions = (dataMode === 'practical' && !hasScannedThisSession) ? [] : subscriptions;
  const effectiveScanMetadata = (dataMode === 'practical' && !hasScannedThisSession) ? null : scanMetadata;

  const handleToggleDataMode = async (target: 'demo' | 'practical') => {
    try {
      await fetch('/api/system/data-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: target }),
      });
      if (target === 'practical') {
        // Switching into practical should not show old practical scan data 
        // if they didn't scan this session. The fetchDashboardData takes care of this.
      }
      await fetchDashboardData(target);
    } catch (err) {
      console.error('Failed to toggle data mode:', err);
    }
  };

  // Run Gmail Scan (Practical Mode)
  const handleRunGmailScan = async () => {
    setAuditRunning(true);
    setAuditError(null);
    setProgressLogs([]);
    setActiveStageIndex(1);

    try {
      // Step 1: Scan Gmail
      const scanRes = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301' }),
      });

      const scanData = await scanRes.json();
      if (!scanRes.ok || !scanData.success) {
        throw new Error(scanData.error || 'Gmail scan failed');
      }

      // Step 2: Finalize
      if (scanData.workflowProgress) {
        setProgressLogs(scanData.workflowProgress);
      }
      
      // Persist the session proof so fresh loads clear it but the current session sees it
      sessionStorage.setItem('practical_scanned', 'true');
      
      setActiveStageIndex(7);
      await fetchDashboardData();
    } catch (err: any) {
      setAuditError(err.message || 'Scan failed');
      console.error('Scan run error:', err);
    } finally {
      setAuditRunning(false);
    }
  };

  // Toggle Block 1 Mode (Mock vs Friend 1 HTTP)
  const handleToggleBlock1Mode = async (target: 'mock' | 'real') => {
    try {
      await fetch('/api/system/block1-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: target }),
      });
      setBlock1Mode(target);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to toggle block 1 mode:', err);
    }
  };

  // Run Detection Only (Phase 2 Milestone: Block 1 Detection Stage)
  const handleRunDetectionOnly = async () => {
    setDetectionRunning(true);
    setAuditError(null);
    setProgressLogs([]);
    setActiveStageIndex(1);

    try {
      const stageTimer = setTimeout(() => {
        setActiveStageIndex(2);
      }, 400);

      const res = await fetch('/api/detection/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301', adapterMode: block1Mode }),
      });

      clearTimeout(stageTimer);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Detection execution failed');
      }

      if (data.workflowProgress) {
        setProgressLogs(data.workflowProgress);
      }
      setActiveStageIndex(2);
      await fetchDashboardData();
    } catch (err: any) {
      setAuditError(err.message || 'Detection failed');
      console.error('Detection run error:', err);
    } finally {
      setDetectionRunning(false);
    }
  };

  // Primary Action: Run Subscription Audit
  const handleRunAudit = async () => {
    setAuditRunning(true);
    setAuditError(null);
    setProgressLogs([]);
    setActiveStageIndex(1);

    try {
      // Simulate real-time progress steps while the orchestrator executes
      const stageInterval = setInterval(() => {
        setActiveStageIndex((prev) => (prev < 6 ? prev + 1 : prev));
      }, 350);

      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301', adapterMode: block1Mode }),
      });

      clearInterval(stageInterval);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Audit pipeline execution failed');
      }

      // Set final completed logs
      if (data.workflowProgress) {
        setProgressLogs(data.workflowProgress);
      }
      setActiveStageIndex(7);

      // Refresh all state from backend
      await fetchDashboardData();
    } catch (err: any) {
      setAuditError(err.message || 'Audit failed');
      console.error('Audit run error:', err);
    } finally {
      setAuditRunning(false);
    }
  };

  // Reset Demo State
  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await fetch('/api/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_301' }),
      });
      setProgressLogs([]);
      setActiveStageIndex(0);
      setAuditError(null);
      await fetchDashboardData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="wallet-ui wallet-dashboard min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Main Navigation / Bar */}
      <header className="wallet-header border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Logo & Product Identity */}
          <div className="wallet-brand flex items-center space-x-3">
            <div className="wallet-brand-symbol p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg text-white shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="wallet-wordmark font-extrabold text-base tracking-tight text-white">wallet<span>iq</span><b>.</b></span>
                <span className="wallet-build-badge text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  PHASE 2: BLOCK 1 INTEGRATED
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Subscription & Recurring-Spend Guardian Agent</p>
            </div>
          </div>

          {/* Block 1 Adapter Mode Selector & Action Buttons */}
          <div className="wallet-header-actions flex flex-wrap items-center gap-2.5">
            {/* Mode Switcher Pill */}
            <div className="wallet-mode-switch flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleToggleDataMode('demo')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  dataMode === 'demo'
                    ? 'bg-slate-800 text-slate-200 border border-slate-700 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Use Demo Data"
              >
                <span>Demo Mode</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleDataMode('practical')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  dataMode === 'practical'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Use Real Gmail Data"
              >
                <span className={`w-2 h-2 rounded-full ${gmailStatus.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>Practical Mode</span>
              </button>
            </div>

            {onOpenArchitectHub && (
              <button
                onClick={onOpenArchitectHub}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Inspect contracts, adapters & run contract tests"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Architect Hub</span>
              </button>
            )}

            {dataMode === 'practical' ? (
              // Practical Mode Buttons
              gmailStatus.connected ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{gmailStatus.email}</span>
                  </div>
                  <button
                    disabled={auditRunning}
                    onClick={handleRunGmailScan}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {auditRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scanning Gmail...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        <span>Scan My Subscriptions</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <a
                  href="/auth/gmail/start"
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs tracking-wide shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Connect Gmail</span>
                </a>
              )
            ) : (
              // Demo Mode Buttons
              <>
                {/* Run Detection Only Button (Block 1 Milestone) */}
                <button
                  id="btn-run-detection"
                  disabled={detectionRunning || auditRunning}
                  onClick={handleRunDetectionOnly}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-cyan-700/60 font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  title="Execute Block 1 detection stage only through IBlock1Adapter"
                >
                  {detectionRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Run Detection Only</span>
                    </>
                  )}
                </button>

                {/* Run Full Pipeline Audit Button */}
                <button
                  id="btn-run-audit"
                  disabled={auditRunning || detectionRunning}
                  onClick={handleRunAudit}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {auditRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Auditing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Run Full Pipeline</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="wallet-layout">
        <aside className="wallet-sidebar" aria-label="Workspace navigation">
          <div className="wallet-workspace-label"><span><Wallet size={20} /></span><div><strong>Your workspace</strong><small>Your spending, simplified</small></div></div>
          <p className="wallet-eyebrow">YOUR SPACE</p>
          <nav>
            <a href="#workspace-overview"><LayoutDashboard size={18} />Overview <ArrowUpRight size={14} /></a>
            {(dataMode === 'demo' || subscriptions.length > 0) && <>
              <a href="#subscriptions-section"><Wallet size={18} />Subscriptions</a>
              <a href="#action-center-section"><CheckCheck size={18} />Action Center</a>
              <a href="#protected-items-section"><LockKeyhole size={18} />Protected Items</a>
              <a href="#activity-log-card"><Activity size={18} />Activity &amp; savings</a>
              <a href="#guardrail-settings-panel"><Sliders size={18} />Your preferences</a>
            </>}
          </nav>
          <div className="wallet-sidebar-note"><Shield size={25} /><strong>You're in control.</strong><p>Your preferences set the limits. Every review follows your existing rules.</p><span>Make room for what matters.</span></div>
          <div className="wallet-sidebar-signoff">A little clarity.<br /><em>A lot more freedom.</em></div>
        </aside>
      {/* Main Content Container */}
      <main id="workspace-overview" className="wallet-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        <div className="wallet-page-intro">
          <div><p className="wallet-eyebrow">YOUR MONEY, AT A GLANCE</p><h1>A little clarity.<br />A lot more control.</h1><p>See where your money goes, and make room for what matters.</p></div>
          <div className="wallet-intro-art" aria-hidden="true"><img src="/media/more-life.webp" alt="" /><span><Shield size={17} />Your money. Your rules.</span></div>
        </div>
        {/* 1. Judge Demo Guide Quick Bar (Only in Demo Mode) */}
        {dataMode === 'demo' && (
          <DemoCaseQuickBar onResetDemo={handleResetDemo} isResetting={resetting} />
        )}

        {/* Practical Mode - Gmail Status Panel */}
        {dataMode === 'practical' && (
          <div className="wallet-gmail-panel mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-400" />
                  Practical Mode: Gmail Scanner
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {!gmailStatus.connected
                    ? "Connect your Gmail account to scan for real subscriptions."
                    : auditRunning
                    ? "Scanning inbox for subscription receipts..."
                    : auditError
                    ? `Scan failed: ${auditError}`
                    : scanMetadata
                    ? subscriptions.length > 0
                      ? `Scan completed successfully. Found ${subscriptions.length} recurring charges.`
                      : `Scan completed successfully — no subscriptions found`
                    : "Ready to scan. Click 'Scan My Subscriptions' to begin."}
                </p>
              </div>
              
              {gmailStatus.connected && (
                <div className="wallet-scan-stats flex gap-4 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-xs">Account</span>
                    <span className="text-emerald-400 font-medium">{gmailStatus.email}</span>
                  </div>
                  {scanMetadata && (
                    <>
                      <div className="flex flex-col border-l border-slate-800 pl-4">
                        <span className="text-slate-500 text-xs">Emails Scanned</span>
                        <span className="text-slate-200">{scanMetadata.emailsScanned || 0}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-800 pl-4">
                        <span className="text-slate-500 text-xs">Relevant</span>
                        <span className="text-slate-200">{scanMetadata.relevantEmails || 0}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-800 pl-4">
                        <span className="text-slate-500 text-xs">Last Scan</span>
                        <span className="text-slate-200">
                          {new Date(scanMetadata.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-slate-800 pl-4 text-emerald-400">
                        <span className="text-emerald-500/70 text-xs">Proof</span>
                        <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                          Dataset created ✓
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex flex-col border-l border-slate-800 pl-4">
                    <span className="text-slate-500 text-xs">Status</span>
                    <span className="text-slate-200">
                      {auditRunning ? "Scanning..." : auditError ? "Failed" : scanMetadata ? "Scanned" : "Ready"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. 7-Stage Workflow Progress Card - Always visible during scan */}
        <AuditProgressBar
          isRunning={auditRunning}
          currentProgressLogs={progressLogs}
          activeStageIndex={activeStageIndex}
          totalStages={7}
          error={auditError}
          onDismiss={() => {
            setActiveStageIndex(0);
            setProgressLogs([]);
          }}
        />

        {/* Main Dashboard Content - Only show if we have data or if in demo mode */}
        {(dataMode === 'demo' || subscriptions.length > 0) ? (
          <>
            {/* 2. Top Summary Metrics */}
            <div className="mb-6">
              <TopSummary summary={savingsSummary} loading={loading} />
            </div>

        {/* 4. Action Center (Human-in-the-Loop Overlap & Approvals) */}
        <ActionCenter
          subscriptions={subscriptions}
          onActionComplete={fetchDashboardData}
        />

        {/* 5. Protected Items (Shielded Categories) */}
        <ProtectedItems subscriptions={subscriptions} />

        {/* 6. Subscriptions Table & Detail View */}
        <SubscriptionList subscriptions={subscriptions} loading={loading} />

        {/* 7. Bottom Dual Section: Activity Log & Monthly Review */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ActivityLog events={auditEvents} loading={loading} />
          <MonthlyReview
            subscriptionsScanned={savingsSummary.subscriptionsScanned}
            potentialSavings={savingsSummary.potentialSavings}
            confirmedSavings={savingsSummary.confirmedSavings}
            cancelledCount={savingsSummary.cancelledCount}
            downgradedCount={savingsSummary.downgradedCount}
            pendingApprovalCount={savingsSummary.pendingApprovalCount}
            protectedCount={savingsSummary.protectedCount}
            currency={savingsSummary.currency}
          />
        </div>

        {/* 8. Guardrail Settings Panel */}
        <GuardrailPanel
          initialGuardrails={guardrails}
          onSave={async (updated) => {
            await fetch('/api/guardrails', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: dataMode === 'practical' ? 'u_practical' : 'u_301', guardrails: updated }),
            });
            await fetchDashboardData(dataMode);
          }}
        />
        </>
        ) : (
          <div className="wallet-empty-state flex flex-col items-center justify-center py-20 text-slate-500">
            <Shield className="w-16 h-16 text-slate-800 mb-4" />
            <h3 className="text-xl font-medium text-slate-400">No subscriptions found yet.</h3>
            <p className="mt-2 text-sm">Click 'Scan My Subscriptions' to populate your practical dashboard.</p>
          </div>
        )}
      </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-4 px-4 sm:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WALLET_IQ — Autonomous Subscription & Recurring-Spend Guardian Agent</span>
          <span className="font-mono text-[11px] text-slate-400">
            Phase 1 Dashboard • Invariant Rule Enforced
          </span>
        </div>
      </footer>
    </div>
  );
};
