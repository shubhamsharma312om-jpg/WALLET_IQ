/**
 * WALLET_IQ — Gmail Email Scanning Provider
 *
 * Scans Gmail for subscription-related emails and extracts structured data.
 * Produces EmailEvent[] compatible with existing Block 1 detection pipeline.
 *
 * This is EMAIL-BASED subscription detection, NOT bank transaction scanning.
 * No financial credentials are requested or stored.
 */

import type { EmailEvent, EmailEventType } from '../models/index.ts';

// ============================================================================
// Types
// ============================================================================

export interface GmailExtraction {
  source: 'gmail';
  sourceEmailId: string;
  merchant: string | null;
  amount: number | null;
  currency: string;
  cadence: string | null;
  eventType: EmailEventType;
  subject: string;
  sender: string;
  date: string;
  evidence: string[];
  confidence: number;
}

export interface GmailScanResult {
  source: 'gmail';
  scanId: string;
  scannedAt: string;
  gmailAccount: string;
  emailsScanned: number;
  relevantEmails: number;
  transactionsAvailable: false; // Gmail provides emails, NOT bank transactions
  events: EmailEvent[];
  rawExtractions: GmailExtraction[];
}

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

/**
 * Extracts a clean merchant name from an email From header.
 * e.g. "Netflix <billing@netflix.com>" → "Netflix"
 * e.g. "noreply@spotify.com" → "Spotify"
 */
export function extractMerchantFromSender(from: string): string {
  if (!from || from.trim().length === 0) return 'Unknown Sender';

  // Pattern: "Display Name <email@domain.com>"
  const displayNameMatch = from.match(/^([^<]+)</);
  if (displayNameMatch) {
    const name = displayNameMatch[1].trim();
    if (name.length > 0 && name !== 'noreply' && name !== 'no-reply') {
      return name;
    }
  }

  // Extract from email domain: user@merchant.com → Merchant
  const emailMatch = from.match(/@([a-zA-Z0-9-]+)\./);
  if (emailMatch) {
    const domain = emailMatch[1].toLowerCase();
    // Skip generic email providers
    const generic = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email'];
    if (!generic.includes(domain)) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }

  return 'Unknown Sender';
}

/**
 * Extracts monetary amounts from text.
 * Supports: $14.99, USD 29.99, ₹199.00, €9.99, £12.50
 */
export function extractAmountFromText(text: string): { amount: number; currency: string } | null {
  if (!text || text.trim().length === 0) return null;

  const patterns: Array<{ regex: RegExp; currency: string }> = [
    { regex: /\$\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'USD' },
    { regex: /USD\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'USD' },
    { regex: /₹\s*(\d{1,8}(?:[.,]\d{1,2})?)/, currency: 'INR' },
    { regex: /INR\s*(\d{1,8}(?:[.,]\d{1,2})?)/, currency: 'INR' },
    { regex: /€\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'EUR' },
    { regex: /EUR\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'EUR' },
    { regex: /£\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'GBP' },
    { regex: /GBP\s*(\d{1,6}(?:[.,]\d{1,2})?)/, currency: 'GBP' },
  ];

  for (const { regex, currency } of patterns) {
    const match = text.match(regex);
    if (match) {
      const rawAmount = match[1].replace(',', '.');
      const amount = parseFloat(rawAmount);
      if (!isNaN(amount) && amount > 0) {
        return { amount: Math.round(amount * 100) / 100, currency };
      }
    }
  }

  return null;
}

/**
 * Classifies an email into a subscription event type based on subject and snippet.
 */
export function classifyEmailType(subject: string, snippet: string): EmailEventType {
  const combined = `${subject} ${snippet}`.toLowerCase();

  if (/price\s*(increase|change|hike|adjust|updat)/i.test(combined)) return 'price_increase';
  if (/trial\s*(end|expir|convert|conclud|over)|free\s*trial/i.test(combined)) return 'trial_ending';
  if (/cancell?(ed|ation|ing)|unsubscrib/i.test(combined)) return 'cancellation_confirmation';
  if (/renew(al|ed)|auto.?renew/i.test(combined)) return 'renewal_notice';
  if (/receipt|invoice|payment\s*(confirm|success)|charged|billing\s*statement/i.test(combined)) return 'receipt';

  return 'other';
}

/**
 * Detects billing cadence from email text.
 */
export function detectCadence(subject: string, snippet: string): string | null {
  const combined = `${subject} ${snippet}`.toLowerCase();

  if (/\bweekly\b/.test(combined)) return 'weekly';
  if (/\bmonthly\b|\bper\s*month\b|\b\/\s*mo\b/.test(combined)) return 'monthly';
  if (/\bquarterly\b|\bevery\s*3\s*month/.test(combined)) return 'quarterly';
  if (/\bannual(ly)?\b|\byearly\b|\bper\s*year\b|\b\/\s*yr\b/.test(combined)) return 'yearly';

  return null;
}

/**
 * Detects if an email is purely promotional/marketing.
 */
export function isPromotionalEmail(subject: string, snippet: string): boolean {
  const combined = `${subject} ${snippet}`.toLowerCase();
  
  const promotionalPatterns = [
    /\b(50%|25%|75%|100%|amount|flat)\s*off\b/i,
    /\bspecial\s*offer\b/i,
    /\bdiscount\b/i,
    /\bpromotion(al)?\b/i,
    /\bcourse\s*offer\b/i,
    /\bpremium\s*available\b/i,
    /\bupgrade\s*now\b/i,
    /\bjoin\s*now\b/i,
    /\badvertisement\b/i,
    /\bsale\b/i,
    /\bcoupon\b/i,
    /\bnewsletter\b/i,
    /\bblack\s*friday\b/i,
    /\blimited\s*time\b/i,
    /\bsubscribe\s*today\b/i,
    /\bstart\s*your\s*free\s*trial\b/i,
    /\bwebinar\b/i,
    /\bmasterclass\b/i,
    /\beducational\s*offer\b/i,
    /\bproduct\s*announcement\b/i,
    /\bmarketing\b/i,
    /\baffiliate\b/i
  ];

  return promotionalPatterns.some(pattern => pattern.test(combined));
}

export function hasRecurringEvidence(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bmonthly\b/.test(t) ||
    /\bannually\b/.test(t) ||
    /\byearly\b/.test(t) ||
    /\bevery\s*month\b/.test(t) ||
    /\brecurring\b/.test(t) ||
    /\brenewal\b/.test(t) ||
    /\bnext\s*billing\s*date\b/.test(t) ||
    /\bnext\s*renewal\b/.test(t) ||
    /\bbilling\s*cycle\b/.test(t) ||
    /\bsubscription\s*period\b/.test(t) ||
    /\bauto-?renew(s|al)?\b/.test(t)
  );
}

export function hasPaymentEvidence(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /payment\s*(of\s*[^ ]+)?\s*was\s*(processed|successful)/.test(t) ||
    /you\s*were\s*charged/.test(t) ||
    /payment\s*successful/.test(t) ||
    /payment\s*received/.test(t) ||
    /receipt\s*for\s*(your\s*)?subscription/.test(t) ||
    /invoice\s*for\s*(your\s*)?subscription/.test(t) ||
    /renewal\s*payment/.test(t) ||
    /recurring\s*payment/.test(t) ||
    /billing\s*confirmation/.test(t) ||
    /monthly\s*payment\s*of\s*.*was\s*processed/.test(t) ||
    /annual\s*payment\s*of\s*.*was\s*processed/.test(t)
  );
}

export function hasSubscriptionEvidence(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /subscription\s*has\s*been\s*renewed/.test(t) ||
    /subscription\s*is\s*active/.test(t) ||
    /membership\s*has\s*been\s*renewed/.test(t) ||
    /plan\s*has\s*renewed/.test(t) ||
    /monthly\s*subscription\s*payment/.test(t) ||
    /annual\s*subscription\s*payment/.test(t) ||
    /subscription\s*will\s*renew\s*on/.test(t)
  );
}

// ============================================================================
// Gmail API Helpers
// ============================================================================

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';

const GMAIL_SEARCH_QUERY =
  '{subscription receipt invoice renewal renewed charged trial membership billing "price change" monthly annual yearly} newer_than:365d';

const MAX_MESSAGES = 200;

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: {
    headers?: GmailMessageHeader[];
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
    mimeType?: string;
  };
  snippet?: string;
}

function getHeader(headers: GmailMessageHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractTextFromParts(parts: GmailMessagePart[] | undefined): string {
  if (!parts) return '';
  let text = '';
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64Url(part.body.data) + '\n';
    }
    if (part.parts) {
      text += extractTextFromParts(part.parts);
    }
  }
  return text;
}

// ============================================================================
// GmailProvider Class
// ============================================================================

export class GmailProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Scans Gmail for subscription-related emails and returns structured data.
   */
  async scanEmails(userId: string, userEmail: string): Promise<GmailScanResult> {
    const scanId = `gmail_scan_${Date.now()}`;
    const scannedAt = new Date().toISOString();

    // Step 1: Search for relevant messages
    const messageIds = await this.searchMessages();

    // Step 2: Fetch full details for each message (in batches to avoid rate limits)
    const extractions: GmailExtraction[] = [];
    const batchSize = 10;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const messages = await Promise.all(
        batch.map(id => this.getMessage(id).catch(() => null))
      );

      for (const msg of messages) {
        if (!msg) continue;
        const extraction = this.extractFromMessage(msg);
        if (extraction) {
          extractions.push(extraction);
        }
      }
    }

    // Step 3: Convert extractions to EmailEvent[] for Block 1
    const events: EmailEvent[] = extractions.map((ext, index) => ({
      event_id: `gmail_${ext.sourceEmailId}_${index}`,
      user_id: userId,
      subject: ext.subject,
      sender: ext.sender,
      date: ext.date,
      snippet: ext.evidence.join('. '),
      event_type: ext.eventType,
      metadata: {
        source: 'gmail' as unknown,
        sourceEmailId: ext.sourceEmailId as unknown,
        merchant: (ext.merchant || undefined) as unknown,
        ...(ext.amount !== null ? {
          amount: ext.amount as unknown,
          currency: ext.currency as unknown,
        } : {}),
        ...(ext.cadence ? { cadence: ext.cadence as unknown } : {}),
        confidence: ext.confidence as unknown,
      },
    }));

    return {
      source: 'gmail',
      scanId,
      scannedAt,
      gmailAccount: userEmail,
      emailsScanned: messageIds.length,
      relevantEmails: extractions.length,
      transactionsAvailable: false,
      events,
      rawExtractions: extractions,
    };
  }

  /**
   * Searches Gmail for subscription-related messages.
   */
  private async searchMessages(): Promise<string[]> {
    const allIds: string[] = [];
    let pageToken: string | undefined;

    while (allIds.length < MAX_MESSAGES) {
      const url = new URL(`${GMAIL_API_BASE}/messages`);
      url.searchParams.set('q', GMAIL_SEARCH_QUERY);
      url.searchParams.set('maxResults', String(Math.min(100, MAX_MESSAGES - allIds.length)));
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Gmail access token expired or invalid');
        if (response.status === 403) throw new Error('Gmail API access denied. Check scopes.');
        throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        messages?: Array<{ id: string }>;
        nextPageToken?: string;
        resultSizeEstimate?: number;
      };

      if (data.messages) {
        allIds.push(...data.messages.map(m => m.id));
      }

      pageToken = data.nextPageToken;
      if (!pageToken || !data.messages?.length) break;
    }

    return allIds;
  }

  /**
   * Fetches a single Gmail message with full details.
   */
  private async getMessage(messageId: string): Promise<GmailMessage> {
    const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch message ${messageId}: ${response.status}`);
    }

    return response.json() as Promise<GmailMessage>;
  }

  /**
   * Extracts subscription-relevant data from a Gmail message.
   */
  private extractFromMessage(msg: GmailMessage): GmailExtraction | null {
    const headers = msg.payload?.headers;
    const subject = getHeader(headers, 'Subject');
    const from = getHeader(headers, 'From');
    const dateStr = getHeader(headers, 'Date');
    const snippet = msg.snippet || '';

    // Extract text body for deeper analysis
    let bodyText = '';
    if (msg.payload?.body?.data) {
      bodyText = decodeBase64Url(msg.payload.body.data);
    }
    if (msg.payload?.parts) {
      bodyText += extractTextFromParts(msg.payload.parts);
    }

    const combinedText = `${subject} ${snippet} ${bodyText}`;

    const merchantFromSender = extractMerchantFromSender(from);
    let merchant = merchantFromSender !== 'Unknown Sender' ? merchantFromSender : null;

    // For hackathon test emails (forwarded or sent from personal accounts), try to detect merchant from subject/body
    if (!merchant || ['gmail', 'yahoo', 'outlook'].some(d => from.toLowerCase().includes(d))) {
      const knownMerchants = ['Spotify', 'Netflix', 'Amazon', 'Hulu', 'Disney', 'Apple', 'Adobe', 'Gym', 'Fitness', 'Dropbox', 'Microsoft'];
      for (const m of knownMerchants) {
        if (new RegExp(`\\b${m}\\b`, 'i').test(combinedText)) {
          merchant = m;
          break;
        }
      }
    }

    const amountResult = extractAmountFromText(combinedText);
    const eventType = classifyEmailType(subject, `${snippet} ${bodyText.slice(0, 500)}`);
    const cadence = detectCadence(subject, `${snippet} ${bodyText.slice(0, 500)}`);

    // ============================================================================
    // GMAIL STRICT RELEVANCE FILTER (COMBINED EVIDENCE MODEL)
    // ============================================================================
    
    // We must have a clear merchant to proceed.
    if (!merchant) return null;

    const isPromo = isPromotionalEmail(subject, combinedText);
    const hasRec = hasRecurringEvidence(combinedText) || (cadence !== null);
    const hasPay = hasPaymentEvidence(combinedText);
    const hasSub = hasSubscriptionEvidence(combinedText);

    // Core rule: We need a Merchant + (Payment AND Recurring evidence) OR (Subscription evidence).
    // If it's promotional, we must have VERY strong payment AND subscription evidence to overcome it.
    
    let isCandidate = false;

    if (isPromo) {
      // If promotional, require explicit payment AND subscription proof (e.g. they actually paid and subscribed after a trial)
      if (amountResult && hasPay && hasSub) {
        isCandidate = true;
      }
    } else {
      // Normal email
      if ((hasPay && hasRec && amountResult) || hasSub) {
        isCandidate = true;
      }
    }

    if (!isCandidate) {
      return null;
    }
    // ============================================================================

    // Build comprehensive evidence array for transparency
    const evidence: string[] = [];
    evidence.push(`Merchant detected: ${merchant}`);
    if (amountResult) evidence.push(`Amount: ${amountResult.currency} ${amountResult.amount}`);
    if (cadence) evidence.push(`Cadence: ${cadence}`);
    if (hasPay) evidence.push(`Evidence: payment confirmation`);
    if (hasRec) evidence.push(`Evidence: recurring billing`);
    if (hasSub) evidence.push(`Evidence: subscription identified`);
    if (eventType !== 'other') evidence.push(`Type: ${eventType}`);

    // Calculate confidence strictly based on combined signals
    let confidence = 50; 
    if (hasPay) confidence += 20;
    if (hasSub) confidence += 20;
    if (hasRec) confidence += 10;
    if (merchant && merchant !== 'Unknown Sender') confidence += 5;
    confidence = Math.min(confidence, 100);

    // Parse date
    let parsedDate: string;
    try {
      const d = dateStr ? new Date(dateStr) : (msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date());
      parsedDate = d.toISOString();
    } catch {
      parsedDate = new Date().toISOString();
    }

    return {
      source: 'gmail',
      sourceEmailId: msg.id,
      merchant,
      amount: amountResult?.amount ?? null,
      currency: amountResult?.currency || 'USD',
      cadence,
      eventType,
      subject: subject.slice(0, 200),
      sender: from.slice(0, 200),
      date: parsedDate,
      evidence,
      confidence,
    };
  }
}
