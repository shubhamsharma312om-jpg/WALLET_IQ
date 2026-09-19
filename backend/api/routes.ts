/**
 * SPENDGUARDIAN — Backend API Routes & Controllers
 *
 * Exposes REST endpoints for the dashboard to trigger audits, inspect contracts,
 * update guardrails, view audit logs, check system health, and run tests.
 */

import { Router, Request, Response } from 'express';
import { SQLiteDatabase } from '../database/sqlite.database.ts';
import {
  Block1HttpAdapter,
} from '../adapters/block1.adapter.ts';
import {
  IBlock1Adapter,
} from '../adapters/interfaces.ts';
import {
  Block2HttpAdapter,
} from '../adapters/block2.adapter.ts';
import {
  Block3HttpAdapter,
} from '../adapters/block3.adapter.ts';
import {
  MockBlock1Adapter,
  MockBlock2Adapter,
  MockBlock3Adapter,
} from '../adapters/mock.adapters.ts';
import { Orchestrator } from '../orchestrator/orchestrator.ts';
import {
  MOCK_TRANSACTIONS,
  MOCK_EMAILS,
  MOCK_GUARDRAILS,
  MOCK_SUBSCRIPTIONS,
} from '../../mock-data/index.ts';
import { runAllTests } from '../../tests/run-all-tests.ts';
import { Guardrails, WorkflowProgress } from '../models/index.ts';

export function createApiRouter(): Router {
  const router = Router();

  // Primary database instance
  const db = new SQLiteDatabase();

  // Adapter configuration: By default, supports both Mock and Real Friend 1 HttpAdapter
  let useLiveBlock1 = Boolean(process.env.BLOCK1_LIVE === 'true' || process.env.BLOCK1_BASE_URL);
  const useLiveBlock2 = Boolean(process.env.BLOCK2_LIVE === 'true');
  const useLiveBlock3 = Boolean(process.env.BLOCK3_LIVE === 'true');

  let block1: IBlock1Adapter = useLiveBlock1 ? new Block1HttpAdapter() : new MockBlock1Adapter();
  const block2 = useLiveBlock2 ? new Block2HttpAdapter() : new MockBlock2Adapter();
  const block3 = useLiveBlock3 ? new Block3HttpAdapter() : new MockBlock3Adapter();

  let orchestrator = new Orchestrator(block1, block2, block3, db);

  // Initialize DB on boot
  db.initialize().catch((err) => console.error('DB init failed:', err));

  // Helper to ensure initial mock dataset is seeded if database is clean
  const ensureInitialSeed = async (userId: string) => {
    // Only seed Demo data for the demo user
    if (userId !== 'u_301') return;

    const existing = await db.getSubscriptions(userId);
    if (existing.length === 0) {
      await db.saveSubscriptions(userId, MOCK_SUBSCRIPTIONS);
      await db.saveTransactions(userId, MOCK_TRANSACTIONS);
      const guardrails = await db.getGuardrails(userId);

      // Pre-seed decisions from default mock state
      const initialDecisions = [
        {
          subscription_id: 'sub_streamflix',
          action: 'cancel' as const,
          reason: 'Unused for 187 days. Exceeds inactivity threshold (90d) and within auto limit ($20).',
          waste_score: 95,
          confidence: 96,
          risk: 'low' as const,
          requires_approval: false,
          guardrail_status: 'passed' as const,
        },
        {
          subscription_id: 'sub_tunewave',
          action: 'ask_user' as const,
          reason: 'Both subscriptions belong to the same music category. The system cannot determine which service you prefer.',
          waste_score: 15,
          confidence: 92,
          risk: 'medium' as const,
          requires_approval: true,
          guardrail_status: 'requires_approval' as const,
          overlapping_subscription_ids: ['sub_musicbox'],
        },
        {
          subscription_id: 'sub_musicbox',
          action: 'ask_user' as const,
          reason: 'Both subscriptions belong to the same music category. The system cannot determine which service you prefer.',
          waste_score: 70,
          confidence: 91,
          risk: 'medium' as const,
          requires_approval: true,
          guardrail_status: 'requires_approval' as const,
          overlapping_subscription_ids: ['sub_tunewave'],
        },
        {
          subscription_id: 'sub_healthguard',
          action: 'keep' as const,
          reason: 'Insurance is protected by your autonomous-action rules. No cancellation was attempted.',
          waste_score: 10,
          confidence: 98,
          risk: 'high' as const,
          requires_approval: false,
          guardrail_status: 'blocked' as const,
        },
        {
          subscription_id: 'sub_cloudpro',
          action: 'keep' as const,
          reason: 'Recent price increase detected via email. User notified.',
          waste_score: 45,
          confidence: 90,
          risk: 'low' as const,
          requires_approval: false,
          guardrail_status: 'passed' as const,
        },
        {
          subscription_id: 'sub_fitpulse',
          action: 'cancel' as const,
          reason: 'Free trial converted to paid. High waste score and exceeds $20 auto-action threshold.',
          waste_score: 85,
          confidence: 94,
          risk: 'low' as const,
          requires_approval: true,
          guardrail_status: 'requires_approval' as const,
        },
      ];

      await db.saveDecisions(userId, initialDecisions);

      // Initial savings: StreamFlix ($14.99) + FitPulse ($29.99) + MusicBox ($11.99) + others = $83.46 potential, $0 confirmed
      const totalPotential = 83.46;
      await db.updateSavingsSummary(userId, {
        potential_savings: totalPotential,
        confirmed_savings: 0,
        currency: 'USD',
        last_updated: new Date().toISOString(),
      });

      // Initial audit events
      await db.addAuditEvent(userId, {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        merchant: 'HealthGuard Insurance',
        action: 'guardrail_protect',
        status: 'blocked',
        reason: 'Insurance is protected by your autonomous-action rules. No cancellation was attempted.',
        savings: 0,
        subscription_id: 'sub_healthguard',
      });
      await db.addAuditEvent(userId, {
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        merchant: 'MusicBox Premium',
        action: 'approval_requested',
        status: 'pending',
        reason: 'MusicBox awaiting approval — Potential overlap with TuneWave detected',
        savings: 0,
        subscription_id: 'sub_musicbox',
      });
    }
  };

  // Seed on boot for default user
  ensureInitialSeed('u_301').catch(console.error);

  // 1. Health check
  router.get('/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'SPENDGUARDIAN Orchestrator',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Subscriptions List
  router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      await ensureInitialSeed(userId);
      const subscriptions = await db.getSubscriptions(userId);
      const decisions = await db.getDecisions(userId);
      const actionResults = await db.getActionResults(userId);

      // Merge decision info and action results with subscriptions
      const enriched = subscriptions.map((sub) => {
        const decision = decisions.find((d) => d.subscription_id === sub.subscription_id);
        const action = actionResults.find((a) => a.subscription_id === sub.subscription_id);

        let currentStatus: string = sub.status;
        if (action?.status === 'success') {
          currentStatus = 'Cancelled';
        } else if (action?.status === 'failed') {
          currentStatus = 'Failed';
        } else if (decision?.guardrail_status === 'blocked') {
          currentStatus = 'Protected';
        } else if (decision?.requires_approval) {
          currentStatus = 'Pending Approval';
        } else if (sub.recommended_action === 'downgrade') {
          currentStatus = 'Downgraded';
        }

        return {
          ...sub,
          decision,
          actionResult: action,
          computedStatus: currentStatus,
        };
      });

      res.json({ subscriptions: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Activity / Audit Log
  router.get('/activity', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      await ensureInitialSeed(userId);
      const events = await db.getAuditEvents(userId);
      res.json({ events });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Savings Summary & Monthly Review Report
  router.get('/savings', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      await ensureInitialSeed(userId);
      const savings = await db.getSavingsSummary(userId);
      const subscriptions = await db.getSubscriptions(userId);
      const decisions = await db.getDecisions(userId);
      const actionResults = await db.getActionResults(userId);

      const totalMonthlySpend = subscriptions.reduce((sum, s) => sum + s.amount, 0);
      const cancelledCount = actionResults.filter((a) => a.status === 'success' && a.action === 'cancel').length;
      const downgradedCount = subscriptions.filter((s) => s.recommended_action === 'downgrade').length;
      const pendingApprovalCount = decisions.filter((d) => d.requires_approval).length;
      const protectedCount = decisions.filter((d) => d.guardrail_status === 'blocked').length;

      res.json({
        totalRecurringSpend: Number(totalMonthlySpend.toFixed(2)),
        potentialSavings: Number(savings.potential_savings.toFixed(2)),
        confirmedSavings: Number(savings.confirmed_savings.toFixed(2)),
        annualizedConfirmedSavings: Number((savings.confirmed_savings * 12).toFixed(2)),
        subscriptionsScanned: subscriptions.length,
        cancelledCount,
        downgradedCount,
        pendingApprovalCount,
        protectedCount,
        currency: savings.currency || 'USD',
        lastUpdated: savings.last_updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. System Status & Adapter Configuration
  router.get('/system/status', async (_req: Request, res: Response) => {
    try {
      const status = await orchestrator.getSystemStatus();

      let friend1Healthy = false;
      try {
        const resp = await fetch('http://localhost:8001/health', { signal: AbortSignal.timeout(800) });
        friend1Healthy = resp.ok;
      } catch {
        friend1Healthy = false;
      }

      res.json({
        ...status,
        database: 'SQLite (node:sqlite native)',
        adapterModes: {
          block1: useLiveBlock1 ? 'HTTP (Friend 1 Service)' : 'MOCK_STANDALONE',
          block2: useLiveBlock2 ? 'HTTP' : 'MOCK_STANDALONE',
          block3: useLiveBlock3 ? 'HTTP' : 'MOCK_STANDALONE',
        },
        friend1Service: {
          running: friend1Healthy,
          port: 8001,
          endpoint: 'http://localhost:8001/analyze-subscriptions',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Switch Block 1 Adapter Mode (Mock vs Friend 1 HTTP)
  router.post('/system/block1-mode', (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode === 'real' || mode === 'live' || mode === 'http') {
      useLiveBlock1 = true;
      block1 = new Block1HttpAdapter();
      orchestrator = new Orchestrator(block1, block2, block3, db);
      return res.json({ status: 'ok', mode: 'real', adapter: 'Block1HttpAdapter' });
    } else if (mode === 'mock') {
      useLiveBlock1 = false;
      block1 = new MockBlock1Adapter();
      orchestrator = new Orchestrator(block1, block2, block3, db);
      return res.json({ status: 'ok', mode: 'mock', adapter: 'MockBlock1Adapter' });
    }
    res.status(400).json({ error: 'Invalid mode. Use "real" or "mock".' });
  });

  // 3. Contracts metadata
  router.get('/contracts', (_req: Request, res: Response) => {
    res.json({
      block1: {
        endpoint: 'POST /analyze-subscriptions',
        input: { user_id: 'string', transactions: 'Transaction[]', emails: 'EmailEvent[]' },
        output: { user_id: 'string', subscriptions: 'Subscription[]', events: 'EmailEvent[]' },
      },
      block2: {
        endpoint: 'POST /evaluate-subscriptions',
        input: { user_id: 'string', subscriptions: 'Subscription[]', events: 'EmailEvent[]', guardrails: 'Guardrails' },
        output: { user_id: 'string', decisions: 'Decision[]' },
      },
      block3: {
        endpoint: 'POST /execute-action',
        input: { user_id: 'string', subscription: 'Subscription', decision: 'Decision' },
        output: { action_id: 'string', status: 'success | failed | pending | escalated', action: 'string', monthly_savings: 'number' },
      },
    });
  });

  // 4. Mock Data Viewer
  router.get('/mock-data', (_req: Request, res: Response) => {
    res.json({
      transactions: MOCK_TRANSACTIONS,
      emails: MOCK_EMAILS,
      subscriptions: MOCK_SUBSCRIPTIONS,
      guardrails: MOCK_GUARDRAILS,
    });
  });

  // 5. Guardrails: GET and PUT
  router.get('/guardrails', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      const guardrails = await db.getGuardrails(userId);
      res.json(guardrails);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/guardrails', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || 'u_301';
      const newGuardrails: Guardrails = req.body.guardrails;
      if (!newGuardrails) {
        return res.status(400).json({ error: 'Missing guardrails payload' });
      }
      await db.saveGuardrails(userId, newGuardrails);
      res.json({ status: 'updated', guardrails: newGuardrails });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Run Subscription Audit (Supports /audit, /audit/run, and /detection/run)
  const handleAuditRun = async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || 'u_301';
      const stopAfterBlock1 = Boolean(
        req.body.stopAfterBlock1 ?? req.body.detectionOnly ?? (req.path.includes('/detection') ? true : false)
      );
      const adapterMode = req.body.adapterMode as string | undefined;

      let activeBlock1 = block1;
      if (adapterMode === 'real' || adapterMode === 'http' || adapterMode === 'live') {
        activeBlock1 = new Block1HttpAdapter();
      } else if (adapterMode === 'mock') {
        activeBlock1 = new MockBlock1Adapter();
      }

      const activeOrchestrator =
        activeBlock1 === block1 ? orchestrator : new Orchestrator(activeBlock1, block2, block3, db);

      const progressLogs: WorkflowProgress[] = [];

      const result = await activeOrchestrator.runSubscriptionAudit({
        userId,
        transactions: req.body.transactions || MOCK_TRANSACTIONS,
        emails: req.body.emails || MOCK_EMAILS,
        stopAfterBlock1,
        onProgress: (prog) => progressLogs.push(prog),
      });

      res.json({
        success: true,
        workflowProgress: progressLogs,
        result,
        adapterUsed: activeBlock1.name,
        stoppedAfterBlock1: stopAfterBlock1,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
        code: err.code || 'UNKNOWN_ERROR',
      });
    }
  };

  router.post('/audit/run', handleAuditRun);
  router.post('/audit', handleAuditRun);
  router.post('/detection/run', handleAuditRun);

  // ==========================================
  // PRACTICAL MODE: GMAIL INTEGRATION
  // ==========================================

  let currentDataMode: 'demo' | 'practical' = 'demo';
  let lastGmailScan: any = null;

  router.get('/system/data-mode', (_req: Request, res: Response) => {
    res.json({ mode: currentDataMode });
  });

  router.post('/system/data-mode', (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode !== 'demo' && mode !== 'practical') {
      return res.status(400).json({ error: 'Mode must be demo or practical' });
    }
    currentDataMode = mode;
    res.json({ success: true, mode: currentDataMode });
  });

  router.post('/gmail/scan', async (req: Request, res: Response) => {
    try {
      // Practical mode strictly operates on 'u_practical' to isolate from Demo data
      const userId = 'u_practical';
      const oauthUserId = 'u_301'; // OAuth tokens are stored centrally

      if (currentDataMode !== 'practical') {
        return res.status(400).json({ error: 'System must be in practical mode to scan live Gmail.' });
      }

      const { gmailTokenStore } = await import('../services/gmail-token-store.ts');
      const { GmailProvider } = await import('../adapters/gmail.provider.ts');

      const storedTokens = gmailTokenStore.getTokens(oauthUserId);
      if (!storedTokens || !storedTokens.tokens.access_token) {
        return res.status(401).json({ error: 'Gmail not connected. Please authenticate first.' });
      }

      // Check if token needs refresh
      if (gmailTokenStore.needsRefresh(oauthUserId) && storedTokens.tokens.refresh_token) {
        const { GoogleOAuthService } = await import('../services/google-oauth.ts');
        const oauthService = new GoogleOAuthService();
        try {
          const newTokens = await oauthService.refreshToken(storedTokens.tokens.refresh_token);
          gmailTokenStore.storeTokens(oauthUserId, newTokens, storedTokens.email);
        } catch (refreshErr) {
          console.error('Failed to refresh Gmail token:', refreshErr);
          return res.status(401).json({ error: 'Gmail authentication expired. Please reconnect.' });
        }
      }

      // Perform the scan using the refreshed/active token
      const activeTokens = gmailTokenStore.getTokens(oauthUserId);
      const provider = new GmailProvider(activeTokens!.tokens.access_token);
      
      const scanResult = await provider.scanEmails(activeTokens!.email);
      lastGmailScan = scanResult;

      // Write practical scan JSON artifact for demo/hackathon proof
      const fs = await import('fs');
      const path = await import('path');
      const dataDir = path.join(process.cwd(), 'data', 'practical-scans');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const artifactPath = path.join(dataDir, `practical-scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(artifactPath, JSON.stringify({
        source: 'gmail',
        scanStatus: 'success',
        scannedAt: scanResult.scannedAt,
        emailsScanned: scanResult.emailsScanned,
        relevantEmails: scanResult.relevantEmails,
        subscriptionsDetected: scanResult.events.length,
        emails: scanResult.events
      }, null, 2));

      // Clear previous practical data before new scan
      const dbSync = (db as any).ensureDb ? (db as any).ensureDb() : null;
      if (dbSync) {
        dbSync.exec(`
          DELETE FROM subscriptions WHERE user_id = '${userId}';
          DELETE FROM decisions WHERE user_id = '${userId}';
          DELETE FROM action_results WHERE user_id = '${userId}';
          DELETE FROM audit_events WHERE user_id = '${userId}';
        `);
      }

      // Initialize default savings summary and guardrails for practical user if not exists
      const existingGuardrails = await db.getGuardrails(userId);
      if (!existingGuardrails || existingGuardrails.auto_action_limit === undefined) {
         await db.saveGuardrails(userId, {
           auto_action_limit: 20,
           minimum_confidence: 90,
           protected_categories: ['insurance', 'health', 'utilities'],
           duplicate_subscriptions: 'require_approval',
           unused_after_days: 90
         });
      }

      // Feed the scanned emails into the Orchestrator
      // Note: We pass empty transactions array because Gmail only gives us emails
      const progressLogs: WorkflowProgress[] = [];
      const result = await orchestrator.runSubscriptionAudit({
        userId,
        transactions: [], 
        emails: scanResult.events,
        stopAfterBlock1: false, // Run the full 7-stage pipeline
        onProgress: (prog) => progressLogs.push(prog),
      });

      // Update the artifact with the normalized subscriptions found by Block 1
      fs.writeFileSync(artifactPath, JSON.stringify({
        source: 'gmail',
        scanStatus: 'success',
        scannedAt: scanResult.scannedAt,
        emailsScanned: scanResult.emailsScanned,
        relevantEmails: scanResult.relevantEmails,
        subscriptionsDetected: result.subscriptions.length,
        emails: scanResult.events,
        subscriptions: result.subscriptions
      }, null, 2));

      res.json({
        success: true,
        scanResult: {
          scannedAt: scanResult.scannedAt,
          emailsScanned: scanResult.emailsScanned,
          relevantEmails: scanResult.relevantEmails,
        },
        workflowProgress: progressLogs,
        result
      });
    } catch (err: any) {
      console.error('Gmail scan failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/gmail/scan/latest', (_req: Request, res: Response) => {
    if (!lastGmailScan) {
      return res.status(404).json({ error: 'No recent scan found' });
    }
    res.json(lastGmailScan);
  });


  // 7. Audit Results & Current State
  router.get('/audit/results', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      await ensureInitialSeed(userId);
      const subscriptions = await db.getSubscriptions(userId);
      const decisions = await db.getDecisions(userId);
      const actionResults = await db.getActionResults(userId);
      const auditEvents = await db.getAuditEvents(userId);
      const savings = await db.getSavingsSummary(userId);
      const guardrails = await db.getGuardrails(userId);

      const approvalRequests = await db.getApprovalRequests(userId);
      const escalationRecords = await db.getEscalationRecords(userId);

      res.json({
        userId,
        subscriptions,
        decisions,
        actionResults,
        auditEvents,
        savings,
        guardrails,
        approvalRequests,
        escalationRecords,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approvals API
  router.get('/approvals', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      const approvals = await db.getApprovalRequests(userId);
      res.json({ success: true, approvals });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/approvals/:id/approve', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || 'u_301';
      const approvalId = req.params.id;
      const result = await orchestrator.block3Engine.approveApprovalRequest(userId, approvalId, {
        actionOverride: req.body.actionOverride,
      });
      const savings = await db.getSavingsSummary(userId);
      res.json({ success: true, result, updatedSavings: savings });
    } catch (err: any) {
      res.status(err.httpStatus || 400).json({ success: false, error: err.message, code: err.code });
    }
  });

  router.post('/approvals/:id/reject', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || 'u_301';
      const approvalId = req.params.id;
      const reason = req.body.reason || 'User explicitly rejected action';
      const result = await orchestrator.block3Engine.rejectApprovalRequest(userId, approvalId, reason);
      const savings = await db.getSavingsSummary(userId);
      res.json({ success: true, result, updatedSavings: savings });
    } catch (err: any) {
      res.status(err.httpStatus || 400).json({ success: false, error: err.message, code: err.code });
    }
  });

  // Escalations API
  router.get('/escalations', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';
      const escalations = await db.getEscalationRecords(userId);
      res.json({ success: true, escalations });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. User approved action (Action Center execution)
  router.post('/action/execute', async (req: Request, res: Response) => {
    try {
      const { userId = 'u_301', subscriptionId, action = 'cancel' } = req.body;
      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId is required' });
      }

      const result = await orchestrator.executeUserApprovedAction(userId, subscriptionId, {
        action,
        reason: 'User approved in Action Center',
      });

      const savings = await db.getSavingsSummary(userId);

      res.json({
        success: true,
        actionResult: result,
        updatedSavings: savings,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
        code: err.code || 'ACTION_FAILED',
      });
    }
  });

  // 8b. Decision on individual subscription (:id)
  router.post('/actions/:id/decision', async (req: Request, res: Response) => {
    try {
      const subscriptionId = req.params.id;
      const { userId = 'u_301', decision = 'cancel', reason = 'User decision' } = req.body;

      const result = await orchestrator.executeUserApprovedAction(userId, subscriptionId, {
        action: decision,
        reason,
      });

      const savings = await db.getSavingsSummary(userId);
      res.json({
        success: true,
        actionResult: result,
        updatedSavings: savings,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
        code: err.code || 'ACTION_FAILED',
      });
    }
  });

  // 8c. Canonical Overlap Decision Handler (CASE 2: TuneWave vs MusicBox)
  router.post('/actions/overlap-choice', async (req: Request, res: Response) => {
    try {
      const { userId = 'u_301', choice } = req.body;
      // choice can be: 'keep_tunewave', 'keep_musicbox', 'keep_both'
      if (choice === 'keep_tunewave') {
        // Cancel MusicBox Premium
        const result = await orchestrator.executeUserApprovedAction(userId, 'sub_musicbox', {
          action: 'cancel',
          reason: 'User decided to keep TuneWave and cancel MusicBox Premium overlap',
        });
        // Mark TuneWave decision as keep
        await db.saveDecisions(userId, [{
          subscription_id: 'sub_tunewave',
          action: 'keep',
          reason: 'User selected TuneWave over MusicBox Premium',
          waste_score: 15,
          confidence: 100,
          risk: 'low',
          requires_approval: false,
          guardrail_status: 'passed',
        }]);
        const savings = await db.getSavingsSummary(userId);
        return res.json({ success: true, cancelled: 'MusicBox Premium', retained: 'TuneWave', savings, actionResult: result });
      } else if (choice === 'keep_musicbox') {
        // Cancel TuneWave
        const result = await orchestrator.executeUserApprovedAction(userId, 'sub_tunewave', {
          action: 'cancel',
          reason: 'User decided to keep MusicBox Premium and cancel TuneWave overlap',
        });
        // Mark MusicBox decision as keep
        await db.saveDecisions(userId, [{
          subscription_id: 'sub_musicbox',
          action: 'keep',
          reason: 'User selected MusicBox Premium over TuneWave',
          waste_score: 15,
          confidence: 100,
          risk: 'low',
          requires_approval: false,
          guardrail_status: 'passed',
        }]);
        const savings = await db.getSavingsSummary(userId);
        return res.json({ success: true, cancelled: 'TuneWave', retained: 'MusicBox Premium', savings, actionResult: result });
      } else if (choice === 'keep_both') {
        // Retain both: Mark both decisions as keep, requires_approval: false
        await db.saveDecisions(userId, [
          {
            subscription_id: 'sub_tunewave',
            action: 'keep',
            reason: 'User explicitly elected to keep both TuneWave and MusicBox Premium subscriptions',
            waste_score: 15,
            confidence: 100,
            risk: 'low',
            requires_approval: false,
            guardrail_status: 'passed',
          },
          {
            subscription_id: 'sub_musicbox',
            action: 'keep',
            reason: 'User explicitly elected to keep both TuneWave and MusicBox Premium subscriptions',
            waste_score: 70,
            confidence: 100,
            risk: 'medium',
            requires_approval: false,
            guardrail_status: 'passed',
          },
        ]);
        await db.addAuditEvent(userId, {
          timestamp: new Date().toISOString(),
          merchant: 'TuneWave & MusicBox Premium',
          action: 'user_retained_both',
          status: 'success',
          reason: 'User explicitly kept both music subscriptions after reviewing overlap',
          savings: 0,
          subscription_id: 'sub_tunewave',
        });
        const savings = await db.getSavingsSummary(userId);
        return res.json({ success: true, retained: 'Both', savings });
      } else {
        return res.status(400).json({ error: 'Invalid choice. Must be keep_tunewave, keep_musicbox, or keep_both' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8d. Reset Database to Clean Demo State
  router.post('/system/reset', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || 'u_301';
      // Reset by running a fresh audit or re-initializing
      const dbSync = (db as any).ensureDb ? (db as any).ensureDb() : null;
      if (dbSync) {
        dbSync.exec(`
          DELETE FROM subscriptions WHERE user_id = '${userId}';
          DELETE FROM decisions WHERE user_id = '${userId}';
          DELETE FROM action_results WHERE user_id = '${userId}';
          DELETE FROM audit_events WHERE user_id = '${userId}';
          DELETE FROM savings_summary WHERE user_id = '${userId}';
        `);
      }
      await ensureInitialSeed(userId);
      res.json({ success: true, message: 'Database reset to canonical initial state' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Run Contract & Unit Test Suite live
  router.post('/tests/run', async (_req: Request, res: Response) => {
    try {
      const report = await runAllTests();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
