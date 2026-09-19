import { randomUUID } from 'crypto';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  obtained_at: number; // Date.now() timestamp
}

export class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/auth/gmail/callback`;
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  generateAuthUrl(loginHint?: string): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth is not configured');
    }

    const state = randomUUID();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    if (loginHint) {
      params.append('login_hint', loginHint);
    }

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state
    };
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      obtained_at: Date.now()
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      refresh_token: data.refresh_token || refreshToken, // Google sometimes doesn't return a new refresh token
      obtained_at: Date.now()
    };
  }

  async getUserEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.emailAddress) {
      throw new Error('No email address found in user profile');
    }

    return data.emailAddress;
  }

  async revokeToken(token: string): Promise<void> {
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token }).toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke token: ${response.status} ${response.statusText}`);
    }
  }
}
