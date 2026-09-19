import { OAuthTokens } from './google-oauth.ts';

export interface StoredToken {
  tokens: OAuthTokens;
  email: string;
  connectedAt: string; // ISO timestamp
}

interface PendingState {
  expiresAt: number;
  metadata?: Record<string, string>;
}

/**
 * In-memory token store for Gmail OAuth tokens.
 * 
 * IMPORTANT: This is a session-scoped in-memory storage. 
 * Tokens are lost on server restart, meaning users will need to reconnect 
 * their Gmail accounts if the server restarts.
 * 
 * Never expose tokens in API responses.
 */
export class GmailTokenStore {
  private tokens = new Map<string, StoredToken>();
  private states = new Map<string, PendingState>();

  constructor() {
    // Clean up expired CSRF states periodically (every 5 minutes)
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000).unref();
  }

  /**
   * Stores a CSRF state with an optional metadata payload. 
   * States expire after 10 minutes.
   */
  storeState(state: string, metadata?: Record<string, string>): void {
    const expiresIn = 10 * 60 * 1000; // 10 minutes
    this.states.set(state, {
      expiresAt: Date.now() + expiresIn,
      metadata
    });
  }

  /**
   * Validates a state and consumes it (one-time use).
   */
  validateAndConsumeState(state: string): { valid: boolean; metadata?: Record<string, string> } {
    const pendingState = this.states.get(state);
    
    if (!pendingState) {
      return { valid: false };
    }

    this.states.delete(state);

    if (Date.now() > pendingState.expiresAt) {
      return { valid: false };
    }

    return { valid: true, metadata: pendingState.metadata };
  }

  /**
   * Stores OAuth tokens for a user.
   */
  storeTokens(userId: string, tokens: OAuthTokens, email: string): void {
    this.tokens.set(userId, {
      tokens,
      email,
      connectedAt: new Date().toISOString()
    });
  }

  /**
   * Retrieves stored tokens for a user.
   */
  getTokens(userId: string): StoredToken | null {
    return this.tokens.get(userId) || null;
  }

  /**
   * Removes tokens for a user.
   */
  removeTokens(userId: string): void {
    this.tokens.delete(userId);
  }

  /**
   * Checks if a user has valid tokens stored.
   */
  isConnected(userId: string): boolean {
    return this.tokens.has(userId);
  }

  /**
   * Returns the connected email for a user, or null if not connected.
   */
  getConnectedEmail(userId: string): string | null {
    const stored = this.tokens.get(userId);
    return stored ? stored.email : null;
  }

  /**
   * Checks if a user's token is within 5 minutes of expiring.
   */
  needsRefresh(userId: string): boolean {
    const stored = this.tokens.get(userId);
    if (!stored) {
      return false;
    }

    const { tokens } = stored;
    // expires_in is in seconds
    const expiresAt = tokens.obtained_at + (tokens.expires_in * 1000);
    const fiveMinutes = 5 * 60 * 1000;

    return Date.now() >= expiresAt - fiveMinutes;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, pendingState] of this.states.entries()) {
      if (now > pendingState.expiresAt) {
        this.states.delete(state);
      }
    }
  }
}

export const gmailTokenStore = new GmailTokenStore();
