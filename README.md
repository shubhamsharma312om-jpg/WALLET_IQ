# SPENDGUARDIAN — Subscription & Recurring-Spend Guardian Agent
### Lead Architect Integration Hub & Contract Specifications

> **Scope Notice (Phase 0 — Foundation & Architecture):**
> This phase establishes the architecture, shared contracts, adapter abstractions, persistence interfaces, and contract validation tests for SpendGuardian. In accordance with architectural isolation rules, teammate implementations are decoupled via abstract adapter interfaces (`IBlock1Adapter`, `IBlock2Adapter`, `IBlock3Adapter`).

---

## 1. Executive Summary & Core Product Flow

SpendGuardian delivers **ONE unified application experience** to the user while maintaining strict modular separation across three independently developed modules:

```
                  USER & MAIN DASHBOARD
                            │
               (Trigger Subscription Audit)
                            ▼
              ORCHESTRATOR & STATE ENGINE
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  IBlock1Adapter     IBlock2Adapter     IBlock3Adapter
         │                  │                  │
         ▼                  ▼                  ▼
      BLOCK 1            BLOCK 2            BLOCK 3
 (Detection & Intel) (Scoring & Rules)  (Actions / Cancel)
         │                  │                  │
   Subscriptions        Decisions         Action Results
   (Structured JSON)  (Structured JSON) (Confirmed Savings)
         └──────────────────┬──────────────────┘
                            ▼
                  PERSISTENT STATE
                  (Native SQLite)
                            │
                            ▼
                  MAIN DASHBOARD
              (Audit Logs + Confirmed Savings)
```

---

## 2. Stable Conceptual Contracts

### BLOCK 1: Detection & Subscription Intelligence
* **Endpoint:** `POST /analyze-subscriptions` (Default Port: `4001`)
* **Request:**
  ```json
  {
    "user_id": "u_301",
    "transactions": [
      {
        "transaction_id": "tx_001",
        "user_id": "u_301",
        "merchant": "StreamFlix",
        "amount": 14.99,
        "currency": "USD",
        "date": "2026-09-01T08:00:00Z",
        "category": "streaming_video"
      }
    ],
    "emails": [
      {
        "event_id": "em_001",
        "user_id": "u_301",
        "subject": "StreamFlix Renewal",
        "sender": "billing@streamflix.com",
        "date": "2026-08-15T18:30:00Z",
        "snippet": "It has been over 5 months since your profile last streamed.",
        "event_type": "renewal_notice"
      }
    ]
  }
  ```
* **Response:**
  ```json
  {
    "user_id": "u_301",
    "subscriptions": [
      {
        "subscription_id": "sub_streamflix",
        "merchant": "StreamFlix",
        "category": "streaming_video",
        "amount": 14.99,
        "currency": "USD",
        "cadence": "monthly",
        "last_used_days_ago": 187,
        "waste_score": 95,
        "confidence": 96,
        "risk": "low",
        "status": "active",
        "recommended_action": "cancel"
      }
    ],
    "events": []
  }
  ```

---

### BLOCK 2: Decision, Scoring & Guardrails
* **Endpoint:** `POST /evaluate-subscriptions` (Default Port: `4002`)
* **Request:**
  ```json
  {
    "user_id": "u_301",
    "subscriptions": [...],
    "events": [...],
    "guardrails": {
      "auto_action_limit": 20,
      "protected_categories": ["insurance", "loan_payment"],
      "minimum_confidence": 90,
      "duplicate_subscriptions": "require_approval",
      "unused_after_days": 90
    }
  }
  ```
* **Response:**
  ```json
  {
    "user_id": "u_301",
    "decisions": [
      {
        "subscription_id": "sub_streamflix",
        "action": "cancel",
        "reason": "Unused for 187 days. Exceeds inactivity threshold (90d) and within safe limit ($20).",
        "waste_score": 95,
        "confidence": 96,
        "risk": "low",
        "requires_approval": false,
        "guardrail_status": "passed"
      }
    ]
  }
  ```

---

### BLOCK 3: Autonomous Actions & Escalation
* **Endpoint:** `POST /execute-action` (Default Port: `4003`)
* **Request:**
  ```json
  {
    "user_id": "u_301",
    "subscription": {
      "subscription_id": "sub_streamflix",
      "merchant": "StreamFlix",
      "amount": 14.99,
      "currency": "USD"
    },
    "decision": {
      "action": "cancel",
      "reason": "Autonomous inactivity cancellation"
    }
  }
  ```
* **Response:**
  ```json
  {
    "action_id": "act_streamflix_001",
    "status": "success",
    "action": "cancel",
    "monthly_savings": 14.99
  }
  ```

---

## 3. Adapter Architecture

The Orchestrator depends exclusively on abstract interfaces (`IBlock1Adapter`, `IBlock2Adapter`, `IBlock3Adapter`).
Each adapter implementation provides:
1. **Request transformation:** Maps domain entities into teammate API payload.
2. **Response transformation:** Validates raw JSON and coerces into typed domain models.
3. **Validation:** Checks for missing fields (e.g. `subscription_id`), out-of-bound numbers, or unexpected values.
4. **Timeout & fault tolerance:** Configurable timeouts (8s–10s) with classified error handling.
5. **Clear error mapping:** Converts HTTP/network faults into standardized `SpendGuardianError` codes.

```
orchestrator ──> IBlock1Adapter ──> Block1HttpAdapter ──> Block 1 Service
orchestrator ──> IBlock2Adapter ──> Block2HttpAdapter ──> Block 2 Service
orchestrator ──> IBlock3Adapter ──> Block3HttpAdapter ──> Block 3 Service
```

---

## 4. Savings Rule Invariants

There is a strict mathematical distinction between:
* **Potential Savings:** Derived from recommended actions and pending decisions.
* **Confirmed Savings:** **ONLY** increments when Block 3 explicitly returns:
  ```json
  {
    "status": "success",
    "monthly_savings": 14.99
  }
  ```
  Actions with `"status": "failed"`, `"status": "pending"`, or guardrail-blocked actions **NEVER** increase confirmed savings.

---

## 5. Canonical Demo Scenarios Supported

1. **CASE 1 (StreamFlix):**
   * $14.99/mo, unused 187 days.
   * Auto-action limit is $20, confidence 96% &ge; 90%.
   * **Outcome:** System auto-cancels via Block 3 and credits +$14.99/mo to confirmed savings.
2. **CASE 2 (TuneWave + MusicBox Premium):**
   * Both are music streaming services.
   * TuneWave was used 4 days ago; MusicBox Premium was used 40 days ago.
   * **Outcome:** Overlap is detected. The Action Center prompts the user to select which service to retain/cancel. The orchestrator **does not auto-decide**.
3. **CASE 3 (HealthGuard Insurance):**
   * $89/mo, category `insurance`.
   * **Outcome:** Guardrail blocks autonomous action (`guardrail_status: "blocked"`). No bypass mechanism exists.

---

## 6. Project Structure

```
spendguardian/
├── backend/
│   ├── models/           # Shared domain models, enums & error classes
│   │   └── index.ts
│   ├── adapters/         # Adapter interfaces, HTTP implementations & mock stubs
│   │   ├── interfaces.ts
│   │   ├── block1.adapter.ts
│   │   ├── block2.adapter.ts
│   │   ├── block3.adapter.ts
│   │   └── mock.adapters.ts
│   ├── orchestrator/     # Core 7-stage orchestrator pipeline
│   │   ├── interfaces.ts
│   │   └── orchestrator.ts
│   ├── database/         # SQLite persistence via Node 22 native node:sqlite
│   │   ├── interfaces.ts
│   │   └── sqlite.database.ts
│   └── api/              # REST routes for audit, guardrails, actions & tests
│       └── routes.ts
├── modules/              # Teammate contract specs & workspace boundaries
│   ├── block1-detection/ # (contract.json & README.md)
│   ├── block2-decision/  # (contract.json & README.md)
│   └── block3-actions/   # (contract.json & README.md)
├── mock-data/            # Normalized demo fixtures
│   ├── transactions.json
│   ├── emails.json
│   ├── subscriptions.json
│   ├── guardrails.json
│   └── index.ts
├── tests/                # 16 automated contract & invariant tests
│   ├── contracts.test.ts
│   ├── adapters.test.ts
│   ├── savings-rules.test.ts
│   ├── guardrails-and-cases.test.ts
│   └── run-all-tests.ts
├── src/                  # Architect Dashboard UI (Vite + React)
│   ├── frontend/dashboard/
│   │   ├── ArchitectureOverview.tsx
│   │   ├── ContractInspector.tsx
│   │   ├── AdapterStatusPanel.tsx
│   │   ├── GuardrailConfigViewer.tsx
│   │   ├── MockDataViewer.tsx
│   │   ├── WorkflowPipelineViewer.tsx
│   │   └── TestRunnerPanel.tsx
│   ├── App.tsx
│   └── main.tsx
├── server.ts             # Express server with Vite middleware on port 3000
├── package.json
├── tsconfig.json
├── metadata.json
└── .env.example
```

---

## 7. Teammate Integration Protocol

When teammate modules are delivered:
1. **Do NOT blindly copy raw files into the orchestrator codebase.**
2. Inspect:
   - Module folder structure and entry points.
   - Dependencies and runtime requirements.
   - Exposed API routes and payload schemas.
   - Required environment variables.
3. Configure teammate ports in `.env`:
   ```env
   BLOCK1_BASE_URL="http://localhost:4001"
   BLOCK2_BASE_URL="http://localhost:4002"
   BLOCK3_BASE_URL="http://localhost:4003"
   ```
4. If a teammate's service uses different field names or nested wrappers, update the adapter's `transformRequest` and `transformResponse` inside `backend/adapters/`. **Do not rewrite orchestrator business logic or dashboard code.**

---

## 8. Running the Application & Test Suite

### Running Contract Tests (CLI):
```bash
npm test
# or: npx tsx tests/run-all-tests.ts
```
All 16 contract, adapter, savings rule, and canonical scenario tests execute and report status.

### Running the Full-Stack Dev Server:
```bash
npm run dev
```
Binds to `http://0.0.0.0:3000`. Serves the backend REST API on `/api/*` and mounts the Vite dashboard on the root.

### Building for Production:
```bash
npm run build
```
Generates frontend static assets in `dist/` and compiles `server.ts` to `dist/server.cjs`.
