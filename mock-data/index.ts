/**
 * SPENDGUARDIAN — Mock Data Hub
 *
 * Provides strongly typed access to hackathon demo dataset:
 * - StreamFlix ($14.99, unused 187 days)
 * - TuneWave ($9.99, used 4 days ago)
 * - MusicBox Premium ($11.99, used 40 days ago)
 * - HealthGuard Insurance ($89.00, insurance category)
 * - CloudPro ($19.99, price increase detected)
 * - FitPulse Pro ($29.99, free-trial-to-paid conversion)
 */

import {
  Transaction,
  EmailEvent,
  Subscription,
  Guardrails,
} from '../backend/models/index.ts';

import rawTransactions from './transactions.json' with { type: 'json' };
import rawEmails from './emails.json' with { type: 'json' };
import rawSubscriptions from './subscriptions.json' with { type: 'json' };
import rawGuardrails from './guardrails.json' with { type: 'json' };

export const MOCK_TRANSACTIONS: Transaction[] = rawTransactions as Transaction[];
export const MOCK_EMAILS: EmailEvent[] = rawEmails as EmailEvent[];
export const MOCK_SUBSCRIPTIONS: Subscription[] = rawSubscriptions as Subscription[];
export const MOCK_GUARDRAILS: Guardrails = rawGuardrails as Guardrails;

export function getMockUserPayload(userId = 'u_301') {
  return {
    user_id: userId,
    transactions: MOCK_TRANSACTIONS.filter((t) => !t.user_id || t.user_id === userId),
    emails: MOCK_EMAILS.filter((e) => !e.user_id || e.user_id === userId),
    subscriptions: MOCK_SUBSCRIPTIONS,
    guardrails: MOCK_GUARDRAILS,
  };
}
