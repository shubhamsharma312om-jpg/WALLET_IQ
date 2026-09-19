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

export type WorkspacePage = 'overview' | 'subscriptions' | 'actions' | 'activity' | 'settings';

interface MainDashboardProps {
  page?: WorkspacePage;
  onNavigate?: (page: WorkspacePage) => void;
  onGoHome?: () => void;
  onOpenLearn?: () => void;
  onOpenArchitectHub?: () => void;
}

interface EnrichedSubscription extends Subscription {
  decision?: Decision;
  actionResult?: ActionResult;
  computedStatus?: string;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  page = 'overview',
  onNavigate,
  onGoHome,
  onOpenLearn,
  onOpenArchitectHub,
}) => {
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

  const navItems: Array<{ id: WorkspacePage; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <Wallet size={18} /> },
    { id: 'actions', label: 'Action Center', icon: <CheckCheck size={18} /> },
    { id: 'activity', label: 'Activity & savings', icon: <Activity size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Sliders size={18} /> },
  ];

  const navigateWorkspace = (target: WorkspacePage) => {
    onNavigate?.(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderGmailPanel = () => (
    <div className="wallet-gmail-panel mb-6 rounded-2xl">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <p className="wallet-eyebrow">LIVE DATA SOURCE</p>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scan className="w-5 h-5" /> Gmail subscription scanner
          </h2>
          <p className="text-sm mt-2 wallet-muted-copy">
            {!gmailStatus.connected
              ? 'Connect Gmail securely to find recurring charges, renewals, trials and price-change emails.'
              : auditRunning
              ? 'Scanning your inbox for billing and subscription signals…'
              : auditError
              ? `Scan failed: ${auditError}`
              : effectiveScanMetadata
              ? effectiveSubscriptions.length > 0
                ? `Last scan found ${effectiveSubscriptions.length} recurring charges.`
                : 'The scan completed successfully and did not find recurring charges.'
              : "Gmail is connected. Run a scan whenever you want to refresh your workspace."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {gmailStatus.connected ? (
            <>
              <div className="wallet-account-pill">
                <CheckCircle2 className="w-4 h-4" />
                <span>{gmailStatus.email}</span>
              </div>
              <button
                disabled={auditRunning}
                onClick={handleRunGmailScan}
                className="wallet-primary-button"
              >
                {auditRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                {auditRunning ? 'Scanning Gmail…' : 'Scan my subscriptions'}
              </button>
            </>
          ) : (
            <a href="/auth/gmail/start" className="wallet-google-button">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Gmail
            </a>
          )}
        </div>
      </div>

      {gmailStatus.connected && effectiveScanMetadata && (
        <div className="wallet-scan-stats mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><span>Emails scanned</span><strong>{effectiveScanMetadata.emailsScanned || 0}</strong></div>
          <div><span>Relevant emails</span><strong>{effectiveScanMetadata.relevantEmails || 0}</strong></div>
          <div><span>Subscriptions</span><strong>{effectiveSubscriptions.length}</strong></div>
          <div><span>Last scan</span><strong>{new Date(effectiveScanMetadata.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="wallet-ui wallet-dashboard min-h-screen flex flex-col font-sans">
      <header className="wallet-header sticky top-0 z-30">
        <div className="wallet-header-inner">
          <button className="wallet-brand" onClick={onGoHome} aria-label="Wallet IQ home">
            <span className="wallet-brand-symbol"><Shield className="w-5 h-5" /></span>
            <span className="wallet-brand-copy"><strong>wallet<span>iq</span><b>.</b></strong><small>Spend smarter, quietly.</small></span>
          </button>

          <nav className="wallet-top-links" aria-label="Product navigation">
            <button onClick={() => navigateWorkspace('overview')}>Workspace</button>
            <button onClick={onOpenLearn}>How it works</button>
            {onOpenArchitectHub && <button onClick={onOpenArchitectHub}>Developer</button>}
          </nav>

          <div className="wallet-header-actions">
            <div className="wallet-mode-switch">
              <button onClick={() => handleToggleDataMode('demo')} className={dataMode === 'demo' ? 'active' : ''}>Demo</button>
              <button onClick={() => handleToggleDataMode('practical')} className={dataMode === 'practical' ? 'active live' : ''}>
                <span className={`wallet-status-dot ${gmailStatus.connected ? 'connected' : ''}`} /> Live Gmail
              </button>
            </div>
            {dataMode === 'demo' && (
              <button disabled={auditRunning || detectionRunning} onClick={handleRunAudit} className="wallet-secondary-button">
                {auditRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {auditRunning ? 'Auditing…' : 'Run demo audit'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="wallet-layout">
        <aside className="wallet-sidebar" aria-label="Workspace navigation">
          <div className="wallet-workspace-label">
            <span><Wallet size={20} /></span>
            <div><strong>Your workspace</strong><small>Your spending, simplified</small></div>
          </div>
          <p className="wallet-eyebrow">YOUR SPACE</p>
          <nav>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigateWorkspace(item.id)}
                className={page === item.id ? 'active' : ''}
              >
                {item.icon}<span>{item.label}</span>{page === item.id && <ArrowUpRight size={14} />}
              </button>
            ))}
          </nav>
          <div className="wallet-sidebar-note">
            <Shield size={25} />
            <strong>You're in control.</strong>
            <p>Your preferences set the limits. Every review follows your existing rules.</p>
            <span>Make room for what matters.</span>
          </div>
          <div className="wallet-sidebar-signoff">A little clarity.<br /><em>A lot more freedom.</em></div>
        </aside>

        <main className="wallet-main flex-1">
          {page === 'overview' && (
            <>
              <div className="wallet-page-intro">
                <div>
                  <p className="wallet-eyebrow">YOUR MONEY, AT A GLANCE</p>
                  <h1>A little clarity.<br />A lot more control.</h1>
                  <p>See where your money goes, review recurring spend, and make room for what matters.</p>
                </div>
                <div className="wallet-intro-art" aria-hidden="true">
                  <img src="/media/more-life.webp" alt="" />
                  <span><Shield size={17} />Your money. Your rules.</span>
                </div>
              </div>

              {dataMode === 'demo' ? (
                <DemoCaseQuickBar onResetDemo={handleResetDemo} isResetting={resetting} />
              ) : renderGmailPanel()}

              <AuditProgressBar
                isRunning={auditRunning}
                currentProgressLogs={progressLogs}
                activeStageIndex={activeStageIndex}
                totalStages={7}
                error={auditError}
                onDismiss={() => { setActiveStageIndex(0); setProgressLogs([]); }}
              />

              {(dataMode === 'demo' || effectiveSubscriptions.length > 0) ? (
                <>
                  <div className="mb-7"><TopSummary summary={savingsSummary} loading={loading} /></div>
                  <div className="wallet-overview-grid">
                    <div className="wallet-overview-card">
                      <p className="wallet-eyebrow">NEXT STEP</p>
                      <h3>Review what needs your attention.</h3>
                      <p>Approvals and protected subscriptions are kept separate from routine spending so you can make decisions quickly.</p>
                      <button onClick={() => navigateWorkspace('actions')} className="wallet-text-button">Open Action Center <ArrowUpRight size={15} /></button>
                    </div>
                    <div className="wallet-overview-card soft">
                      <p className="wallet-eyebrow">FULL INVENTORY</p>
                      <h3>{effectiveSubscriptions.length} subscriptions in view.</h3>
                      <p>Inspect merchants, recurring amounts, confidence, source evidence and recommended actions in one dedicated page.</p>
                      <button onClick={() => navigateWorkspace('subscriptions')} className="wallet-text-button">View subscriptions <ArrowUpRight size={15} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="wallet-empty-state">
                  <Shield className="w-14 h-14" />
                  <h3>Your live workspace is ready.</h3>
                  <p>Connect Gmail and run a scan to populate subscriptions, savings and action recommendations.</p>
                </div>
              )}
            </>
          )}

          {page === 'subscriptions' && (
            <>
              <div className="wallet-section-heading">
                <div><p className="wallet-eyebrow">RECURRING SPEND</p><h1>Subscriptions</h1><p>One clean inventory of detected subscriptions and recurring charges.</p></div>
                {dataMode === 'practical' && gmailStatus.connected && <button onClick={handleRunGmailScan} disabled={auditRunning} className="wallet-primary-button"><RefreshCw className={`w-4 h-4 ${auditRunning ? 'animate-spin' : ''}`} />Refresh from Gmail</button>}
              </div>
              {dataMode === 'practical' && renderGmailPanel()}
              {(dataMode === 'demo' || effectiveSubscriptions.length > 0)
                ? <SubscriptionList subscriptions={effectiveSubscriptions} loading={loading} />
                : <div className="wallet-empty-state"><Wallet className="w-14 h-14" /><h3>No live subscriptions yet.</h3><p>Run a Gmail scan from this page or the Overview to build your subscription inventory.</p></div>}
            </>
          )}

          {page === 'actions' && (
            <>
              <div className="wallet-section-heading"><div><p className="wallet-eyebrow">HUMAN IN THE LOOP</p><h1>Action Center</h1><p>Approve sensitive decisions and see what Wallet IQ intentionally protects.</p></div></div>
              {(dataMode === 'demo' || effectiveSubscriptions.length > 0) ? (
                <>
                  <ActionCenter userId={dataMode === 'practical' ? 'u_practical' : 'u_301'} subscriptions={effectiveSubscriptions} onActionComplete={fetchDashboardData} />
                  <ProtectedItems subscriptions={effectiveSubscriptions} />
                </>
              ) : <div className="wallet-empty-state"><CheckCheck className="w-14 h-14" /><h3>Nothing needs attention yet.</h3><p>Run a live Gmail scan first. Any approvals or protected items will appear here.</p></div>}
            </>
          )}

          {page === 'activity' && (
            <>
              <div className="wallet-section-heading"><div><p className="wallet-eyebrow">TRACEABLE BY DESIGN</p><h1>Activity & savings</h1><p>See what the system detected, recommended and changed over time.</p></div></div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
            </>
          )}

          {page === 'settings' && (
            <>
              <div className="wallet-section-heading"><div><p className="wallet-eyebrow">YOUR RULES</p><h1>Settings</h1><p>Manage Gmail access, data mode and the guardrails that govern automated decisions.</p></div></div>
              <section className="wallet-settings-card">
                <div>
                  <p className="wallet-eyebrow">CONNECTED ACCOUNT</p>
                  <h2>Gmail</h2>
                  <p>{gmailStatus.connected ? `Connected as ${gmailStatus.email}. Wallet IQ only requests read-only Gmail access.` : 'Connect Gmail to scan billing and subscription emails using read-only access.'}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {gmailStatus.connected ? (
                    <>
                      <button onClick={handleRunGmailScan} disabled={auditRunning} className="wallet-primary-button"><Scan className="w-4 h-4" />Scan now</button>
                      <button onClick={async () => { await fetch('/auth/gmail/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'u_301' }) }); sessionStorage.removeItem('practical_scanned'); await fetchDashboardData('practical'); }} className="wallet-secondary-button">Disconnect Gmail</button>
                    </>
                  ) : <a href="/auth/gmail/start" className="wallet-google-button">Connect Gmail</a>}
                </div>
              </section>

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
          )}
        </main>
      </div>

      <footer className="wallet-footer">
        <span>WALLET_IQ — Subscription & recurring-spend guardian</span>
        <span>Read-only Gmail • Human approval guardrails • Traceable actions</span>
      </footer>
    </div>
  );
};
