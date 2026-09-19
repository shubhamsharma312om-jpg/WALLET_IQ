import { Router, Request, Response } from 'express';
import { GoogleOAuthService } from '../services/google-oauth.ts';
import { gmailTokenStore } from '../services/gmail-token-store.ts';

export function createAuthRouter(): Router {
  const router = Router();
  const oauthService = new GoogleOAuthService();

  // Redirects user to Google OAuth consent screen
  router.get('/gmail/start', (req: Request, res: Response) => {
    try {
      if (!oauthService.isConfigured()) {
        return res.status(400).json({
          error: 'Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.',
        });
      }

      const loginHint = req.query.loginHint as string | undefined;
      const userId = (req.query.userId as string) || 'u_301';

      const { url, state } = oauthService.generateAuthUrl(loginHint);

      // Store state for CSRF protection along with userId metadata
      gmailTokenStore.storeState(state, { userId });

      res.redirect(url);
    } catch (error: any) {
      console.error('Failed to start Gmail OAuth:', error);
      res.status(500).json({ error: 'Failed to initiate Google OAuth flow.' });
    }
  });

  // Handles Google OAuth callback
  router.get('/gmail/callback', async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const error = req.query.error as string;

      // Handle user denial
      if (error) {
        console.warn(`Google OAuth callback error: ${error}`);
        return res.redirect('/?gmail=denied');
      }

      if (!code || !state) {
        return res.redirect('/?gmail=invalid_request');
      }

      // Validate CSRF state
      const stateValidation = gmailTokenStore.validateAndConsumeState(state);
      if (!stateValidation.valid || !stateValidation.metadata) {
        return res.redirect('/?gmail=invalid_state');
      }

      const userId = stateValidation.metadata.userId || 'u_301';

      // Exchange code for tokens
      const tokens = await oauthService.exchangeCode(code);

      // Fetch user profile to get email address
      const email = await oauthService.getUserEmail(tokens.access_token);

      // Store tokens securely in-memory
      gmailTokenStore.storeTokens(userId, tokens, email);

      // Redirect back to dashboard with success param
      res.redirect('/?gmail=connected');
    } catch (error: any) {
      console.error('Google OAuth callback failed:', error);
      res.redirect('/?gmail=failed');
    }
  });

  // Returns Gmail connection status and masked email
  router.get('/gmail/status', (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || 'u_301';

      const isConfigured = oauthService.isConfigured();
      const isConnected = gmailTokenStore.isConnected(userId);
      const email = gmailTokenStore.getConnectedEmail(userId);

      // Mask email for privacy (e.g., test@gmail.com -> tes***@gmail.com)
      let maskedEmail = null;
      if (email) {
        const [localPart, domain] = email.split('@');
        if (localPart && domain) {
          maskedEmail = `${localPart.substring(0, Math.min(3, localPart.length))}***@${domain}`;
        }
      }

      res.json({
        configured: isConfigured,
        connected: isConnected,
        email: maskedEmail,
      });
    } catch (error: any) {
      console.error('Failed to get Gmail status:', error);
      res.status(500).json({ error: 'Failed to retrieve Gmail status.' });
    }
  });

  // Revokes tokens and disconnects Gmail
  router.post('/gmail/disconnect', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId || 'u_301';

      const storedTokens = gmailTokenStore.getTokens(userId);
      if (storedTokens && storedTokens.tokens.access_token) {
        try {
          // Attempt to revoke at Google (fire and forget, we disconnect locally regardless)
          await oauthService.revokeToken(storedTokens.tokens.access_token);
        } catch (revokeError) {
          console.warn('Failed to revoke Google token remotely, proceeding with local disconnect.', revokeError);
        }
      }

      gmailTokenStore.removeTokens(userId);

      res.json({ success: true, disconnected: true });
    } catch (error: any) {
      console.error('Failed to disconnect Gmail:', error);
      res.status(500).json({ error: 'Failed to disconnect Gmail.' });
    }
  });

  return router;
}
