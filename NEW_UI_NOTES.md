# WALLET_IQ — Multi-page UI integration

This build keeps the existing Gmail OAuth and Gmail subscription scan features, while restoring the professional multi-page product structure.

## Pages

- `/` — public product home page
- `/how-it-works` — product walkthrough with a bundled local video player
- `/app` — workspace overview
- `/app/subscriptions` — recurring subscription inventory
- `/app/actions` — approvals and protected items
- `/app/activity` — activity log and savings review
- `/app/settings` — Gmail connection and decision guardrails
- `/architect` — developer architecture, contracts, adapters, workflow and tests

## Gmail flow

1. Choose **Live Gmail** in the workspace.
2. Connect Gmail through the existing `/auth/gmail/start` OAuth flow.
3. Google redirects back to `/app?gmail=connected`.
4. Click **Scan my subscriptions**.
5. The app scans Gmail billing/subscription messages, updates the practical dataset and refreshes the workspace pages.

Practical Gmail scanning no longer depends on the optional Friend 1 service on port `8001`. The external Block 1 service remains available for the demo/developer integration path when explicitly enabled.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

If `node_modules` was copied from a different operating system, run `npm install` again on the machine where you are running the project so Vite/esbuild install the correct native binaries.
