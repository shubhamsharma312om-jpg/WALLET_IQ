/**
 * SPENDGUARDIAN — Full-Stack Server Entry Point
 *
 * Mounts the orchestrator & contract API on /api and integrates Vite middleware
 * for the dashboard frontend. Runs on port 3000 (0.0.0.0).
 */

import express from 'express';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './backend/api/routes.ts';

function startFriend1Service() {
  const req = http.get('http://127.0.0.1:8001/health', (res) => {
    if (res.statusCode === 200) {
      console.log('Friend 1 detection service is active on port 8001.');
    }
  });

  req.on('error', () => {
    console.log('Spawning Friend 1 detection FastAPI service on port 8001...');
    try {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const child = spawn(pythonCmd, ['friend1-detection/main.py'], {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
      console.log('Friend 1 detection service spawned in background.');
    } catch (err: any) {
      console.warn('Could not spawn Friend 1 service:', err?.message);
    }
  });
}

async function startServer() {
  // Ensure Friend 1 service is available on port 8001
  startFriend1Service();

  const app = express();
  const PORT = 3000;

  // Body parser for JSON API requests
  app.use(express.json());

  // Mount backend API routes FIRST
  const { createAuthRouter } = await import('./backend/api/auth-routes.ts');
  app.use('/auth', createAuthRouter());
  app.use('/api', createApiRouter());

  // Vite middleware for development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpendGuardian server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});