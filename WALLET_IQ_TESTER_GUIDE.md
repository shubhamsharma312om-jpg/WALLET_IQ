# WALLET_IQ — Official Tester, Judge & Teammate Guide

> **Current System Status:** Active & Integrated (Phase 2: Block 1 Integrated)  
> **Target Audience:** Hackathon Judges, Teammates, Technical Evaluators, and QA Testers  
> **Rule of Truth:** All behaviors, buttons, labels, and invariants described below are verified against the active codebase.

---

## 1. Product in One Minute

**WALLET_IQ** is an autonomous subscription and recurring-spend guardian agent. It monitors transactional streams and email receipts, detects recurring financial commitments, scores dormancy and wasteful spending, validates safety guardrails, and takes safe autonomous cancellation or downgrade actions—while escalating ambiguous cases to human judgment.

### The Core Problem It Solves
Consumers and businesses lose billions annually to "zombie subscriptions"—unnoticed price hikes, forgotten trial conversions, and dormant services. WALLET_IQ solves this with a **7-stage autonomous financial pipeline** governed by a strict invariant: **zero unconfirmed savings and zero high-risk autonomous actions without explicit human approval.**

---

## 2. Architecture & The 3 Core Blocks

WALLET_IQ is structured around three modular blocks coordinated by a central orchestrator:

```
[ Raw Transactions & Receipts ]
               │
               ▼
   ┌───────────────────────┐
   │        BLOCK 1        │  Detection & Financial Intelligence
   │  (Python FastAPI 8001 │  Analyzes transactions + emails → Subscriptions
   │   or Mock Standalone) │
   └───────────┬───────────┘
               │  IBlock1Adapter
               ▼
   ┌───────────────────────┐
   │     ORCHESTRATOR      │  Central Coordination Engine
   │   (Node / Express)    │  SQLite persistence & 7-stage workflow
   └─────┬───────────┬─────┘
         │           │
         │ IBlock2   │ IBlock3
         ▼           ▼
   ┌───────────┐ ┌───────────┐
   │  BLOCK 2  │ │  BLOCK 3  │
   │ Decision  │ │ Action    │  Executes safe cancellations, manages
   │ & Scoring │ │ Execution │  approval queues & escalation records
   └───────────┘ └───────────┘
```

* **Block 1 (Detection & Financial Intelligence):** Ingests raw banking transactions and receipt emails to detect recurring subscriptions, identify cadences, calculate days since last use, and compute preliminary confidence scores. Supports dual modes: live HTTP via Friend 1 microservice (`http://localhost:8001`) and standalone mock mode.
* **Block 2 (Decision & Waste Scoring Engine):** Analyzes detected subscriptions against waste algorithms and user-configured guardrails. Categorizes each item into `cancel`, `review`, `downgrade`, or `keep`, determines whether human approval is required, and assigns risk classifications (`low`, `medium`, `high`).
* **Block 3 (Autonomous Action & Escalation Engine):** Safely executes autonomous cancellations for qualifying low-risk subscriptions, routes ambiguous overlaps and high-value items to an approval queue, and records blocked actions in an audit escalation ledger.
* **Orchestrator Engine:** Coordinates all three blocks via decoupled adapter interfaces (`IBlock1Adapter`, `IBlock2Adapter`, `IBlock3Adapter`), persists state to a native SQLite database, and enforces strict financial invariants.

---

## 3. The 7-Stage Workflow Pipeline

When you click **Run Full Pipeline**, WALLET_IQ executes the complete 7-stage pipeline sequentially:

| Stage # | Pipeline Label | Operational Activity |
| :---: | :--- | :--- |
| **Stage 1** | `1. Analyzing transactions...` | Ingests transaction ledgers and email receipts for processing. |
| **Stage 2** | `2. Detecting subscriptions...` | Block 1 detects recurring merchants, cadences, and last usage. |
| **Stage 3** | `3. Evaluating waste...` | Block 2 evaluates dormancy, waste scores (0–100), and pricing trends. |
| **Stage 4** | `4. Checking guardrails...` | Validates against user-defined price limits, confidence thresholds, and protected categories. |
| **Stage 5** | `5. Executing safe actions...` | Block 3 executes autonomous cancellations for qualified low-risk items (e.g., StreamFlix). |
| **Stage 6** | `6. Preparing approval requests...` | Creates human-in-the-loop pending approval tickets for ambiguous items. |
| **Stage 7** | `7. Audit complete.` | Finalizes audit logs, commits confirmed savings, and updates UI state. |

---

## 4. Dashboard Layout & Control Guide

The dashboard is structured into organized visual zones designed for high scannability:

### Header Navigation & Controls
* **Brand Identity:** Shows **WALLET_IQ** with the status badge `PHASE 2: BLOCK 1 INTEGRATED`.
* **Block 1 Mode Toggle:**
  * `Friend 1 API (:8001)`: Connects directly to the live Python FastAPI service on port 8001 via `Block1HttpAdapter` (green pulse indicates healthy connection).
  * `Mock Standalone`: Uses internal fallback adapter (`MockBlock1Adapter`) for offline testing.
* **`Architect Hub` Button:** Opens the architectural contracts, interfaces, and test runner view.
* **`Run Detection Only` Button (`id="btn-run-detection"`):** Runs only Stages 1 & 2 (Block 1 extraction) without advancing to decisions or actions.
* **`Run Full Pipeline` Button (`id="btn-run-audit"`):** Executes the complete 7-stage pipeline end-to-end.

---

### Dashboard Sections (Top to Bottom)

#### A. Judge Demo Guide Quick Bar
Three quick-reference cards displaying the 3 canonical evaluation scenarios, plus the **`Reset Demo State`** button to return the database to pre-audit baseline at any time.

#### B. Top Summary Metric Cards (6 Key Indicators)
1. **Total Monthly Spend:** Current sum of active subscriptions (e.g., `$176.95/mo`).
2. **Potential Savings:** Value of all identified waste and items awaiting review (e.g., `$83.46/mo`).
3. **Confirmed Savings:** Only increases when an action is successfully executed by Block 3 (starts at `$0.00/mo`).
4. **Detected Subs:** Total number of monitored subscription agreements (6 items).
5. **Needs Approval:** Count of pending decisions awaiting human judgment in the Action Center.
6. **Protected:** Count of subscriptions shielded by guardrail safety rules.

#### C. Workflow Progress Bar
A live animated step-progress tracker that displays the active step during pipeline runs and displays detailed audit logs upon completion.

#### D. Action Center (Human-in-the-Loop)
Contains active human decision requests:
* **Case 2 Card (TuneWave vs. MusicBox Premium):** Multi-choice resolution buttons (`Keep TuneWave`, `Keep MusicBox`, `Keep Both`).
* **FitPulse Pro Card (Trial Conversion):** Buttons to `Confirm Cancel ($29.99/mo)` or `Keep Active`.
* **Pending Block 3 Human Approvals Queue:** Interactive queue of pending approval tickets with `Approve & Execute` and `Reject` buttons.
* **Block 3 Escalation Records:** Audit card showing items blocked from automated execution.

#### E. Protected Items Panel
Displays high-sensitivity subscriptions (e.g., HealthGuard Insurance) shielded from autonomous cancellation. Features a `🔒 PROTECTED` badge and explicit notification that autonomous cancellation is disabled by policy.

#### F. Subscriptions Ledger Table
A comprehensive table of all monitored subscriptions with:
* **Search Bar:** Real-time search filtering by merchant name or category.
* **Filter Pills:** Quick filters for `All`, `Active`, `Approval`, `Cancelled`, and `Protected`.
* **Columns:** Merchant & Category, Amount, Last Used, Waste Score, Confidence, Risk, Current Status, and Recommendation.

#### G. Bottom Dual Section
* **Activity Log:** Chronological, immutable ledger of all system events, cancellations, guardrail blocks, and approvals.
* **Monthly Review:** Financial impact card highlighting **Annualized Confirmed Savings** (`Monthly Confirmed × 12`), monthly run-rate savings, and audit breakdown.

#### H. Guardrail Settings Panel
Allows real-time modification of autonomous operation parameters:
* **Auto-Action Limit Slider:** `$5.00` to `$100.00` (Default: `$20.00`).
* **Minimum Confidence Slider:** `75%` to `99%` (Default: `90%`).
* **Unused Inactivity Threshold Slider:** `30` to `180` days (Default: `90 days`).
* **Protected Categories Tag Input:** Add or remove protected categories (defaults: `insurance`, `loan_payment`).
* **Duplicate Subscriptions Policy:** Toggle between `Require Human Approval` (recommended) and `Auto-Cancel Lower Usage` (aggressive).
* **Buttons:** `Save Rules` (persists to SQLite) and `Defaults` (resets to default rules).

---

## 5. The 3 Canonical Demo Scenarios

These three scenarios illustrate WALLET_IQ's governance model:

### Scenario 1: Safe Autonomous Action (StreamFlix)
* **Merchant:** StreamFlix ($14.99/mo)
* **Condition:** Last used 187 days ago (>90d threshold), waste score 95/100, confidence 96%, monthly cost $14.99 (<$20 limit).
* **Expected Outcome:** Block 3 autonomously cancels StreamFlix without bothering the user.
* **Savings Impact:** `$14.99/mo` is credited to Confirmed Savings. In the table, StreamFlix transitions to `Cancelled`.

### Scenario 2: Ambiguous Redundancy (TuneWave vs. MusicBox Premium)
* **Merchants:** TuneWave ($9.99/mo, used 4 days ago) vs. MusicBox Premium ($11.99/mo, used 40 days ago).
* **Condition:** Both provide streaming music. Even though MusicBox has lower usage, WALLET_IQ refuses to assume user preference.
* **Expected Outcome:** Guardrails classify the situation as an ambiguous overlap. No autonomous cancellation occurs. Routed to the Action Center.
* **Tester Action:** The tester clicks `Keep TuneWave`. MusicBox Premium is cancelled via Block 3; `$11.99/mo` is added to Confirmed Savings.

### Scenario 3: Guardrail Protection (HealthGuard Insurance)
* **Merchant:** HealthGuard Insurance ($89.00/mo)
* **Condition:** Category is `insurance`.
* **Expected Outcome:** The system detects high recurring cost, but guardrail policies strictly forbid autonomous actions on insurance.
* **Protection Display:** Appears in the **Protected Items** panel with a `🔒 PROTECTED` badge. No cancel button is displayed. Confirmed savings remains untouched.

---

## 6. The Confirmed Savings Invariant

> **Strict Rule:**  
> `Confirmed Savings` **ONLY** increases after Block 3 explicitly returns `status === 'success'` with a verified execution response.

* **Potential Savings** measures detected waste across all monitored accounts.
* **Pending approvals do NOT count as confirmed savings.**
* **Failed actions do NOT count as confirmed savings.**
* **Protected items do NOT count as confirmed savings.**
* **Annualized Confirmed Savings** is deterministically computed as:  
  $$\text{Annualized Savings} = \text{Confirmed Monthly Savings} \times 12$$

---

## 7. Step-by-Step Testing & Evaluation Script

Follow this 5-minute walkthrough to verify every capability of WALLET_IQ:

### Step 1: Baseline Verification
1. Ensure the app is loaded at `http://localhost:3000`.
2. Click **`Reset Demo State`** in the Judge Demo Guide quick bar.
3. Verify initial metrics:
   * Confirmed Savings: **`$0.00/mo`**
   * Needs Approval: **`2`** (MusicBox overlap + FitPulse trial)
   * Protected: **`1`** (HealthGuard Insurance)

### Step 2: Test Block 1 Detection Stage
1. Click **`Run Detection Only`** (`#btn-run-detection`).
2. Observe the progress bar advance through Stages 1 and 2, then complete.
3. Confirm that all 6 subscriptions are detected from transaction and email logs.

### Step 3: Test Full Pipeline Execution (Scenario 1)
1. Click **`Run Full Pipeline`** (`#btn-run-audit`).
2. Watch all 7 stages execute sequentially.
3. Verify that **StreamFlix** ($14.99/mo) was autonomously cancelled:
   * Confirmed Savings updates from `$0.00` to **`$14.99/mo`**.
   * StreamFlix row badge in Subscriptions table switches to a green `Cancelled` badge.
   * An entry appears in the Activity Log: `StreamFlix • auto_cancel • completed • +$14.99/mo`.

### Step 4: Test Human-in-the-Loop Overlap Resolution (Scenario 2)
1. Scroll to the **Action Center**.
2. Locate the **Potential Overlap Detected (Case 2)** card.
3. Click **`Keep TuneWave`** (`#btn-keep-tunewave`).
4. Verify results:
   * Success notification appears: *“✓ Retained TuneWave. Cancelled MusicBox Premium via Block 3 (+$11.99/mo added to confirmed savings).”*
   * Confirmed Savings increases to **`$26.98/mo`** ($14.99 + $11.99).
   * MusicBox Premium badge in the table changes to `Cancelled`.
   * TuneWave remains `Active`.

### Step 5: Test Trial Conversion Escalation (FitPulse Pro)
1. In the Action Center, locate the **Trial Conversion Approval Needed** card.
2. Note the reasoning: *Amount ($29.99) exceeds safe autonomous threshold ($20.00).*
3. Click **`Confirm Cancel ($29.99/mo)`** (`#btn-cancel-fitpulse`).
4. Verify results:
   * Confirmed Savings increases to **`$56.97/mo`** ($26.98 + $29.99).
   * Annualized Confirmed Savings in the Monthly Review card updates to **`$683.64/year`** ($56.97 × 12).

### Step 6: Test Guardrail Protection (Scenario 3)
1. Scroll to the **Protected Items** section.
2. Verify **HealthGuard Insurance ($89.00/mo)** is listed.
3. Note the explicit notice: *“Autonomous cancellation disabled by policy”*.
4. Confirm that under no circumstances does the system cancel this subscription.

### Step 7: Guardrail Experiment (Custom Rules)
1. Scroll to the **Guardrails** panel at the bottom.
2. Drag the **Auto-Action Limit** slider from `$20` down to `$5`.
3. Click **`Save Rules`** (button changes to *“Persisted”*).
4. Click **`Reset Demo State`**, then click **`Run Full Pipeline`**.
5. Observe the difference: StreamFlix ($14.99) is now *greater* than the new $5 threshold, so it is **not** cancelled autonomously—it escalates to the approval queue instead. Confirmed savings stays at `$0.00`.
6. Click **`Defaults`** and **`Save Rules`** to return to standard parameters.

### Step 8: Architect Hub & Automated Test Suite
1. Click **`Architect Hub`** in the top header.
2. Explore the tabs:
   * **Overview:** System flow and architecture diagram.
   * **Contracts:** TypeScript API contract inspector for Block 1, 2, and 3.
   * **Adapters:** Real-time health status of all adapter bridges.
   * **Workflow:** Detailed explanation of the 7-stage pipeline.
   * **Test Suite:** Click **`Run All Tests`** to execute all 62 contract and integration tests live in the browser.
3. Click **`Main Dashboard`** to return.

---

## 8. Real vs. Simulated Capabilities

To ensure full transparency during hackathon evaluation, the table below delineates real production code from simulated integrations:

| Component / Feature | Status | Description |
| :--- | :---: | :--- |
| **Orchestrator Engine** | **REAL** | Full TypeScript orchestration engine coordinating all blocks. |
| **SQLite Persistence** | **REAL** | Native Node.js `node:sqlite` database (`spendguardian.sqlite`) storing all entities. |
| **REST API Layer** | **REAL** | Express router exposing `/api/subscriptions`, `/api/audit/run`, `/api/guardrails`, etc. |
| **Block 1 Live HTTP Adapter** | **REAL** | Connects over HTTP to Python FastAPI service on port 8001 (`Block1HttpAdapter`). |
| **Block 1 Standalone Mock** | **Simulated / Mock** | Fallback mock adapter (`MockBlock1Adapter`) providing deterministic sample data. |
| **Block 2 Decision Engine** | **REAL** | Algorithmic scoring evaluating dormancy, waste score (0–100), and guardrails. |
| **Block 3 Execution Engine** | **REAL** | Workflow manager handling approval lifecycles, escalations, and invariant tracking. |
| **Card Network / Bank Cancellation API** | **Simulated / Mock** | Simulated in Block 3 engine adapter to avoid calling live banking or merchant APIs. |
| **Automated Test Suite** | **REAL** | 62 executable test assertions verifying contracts, error codes, and savings invariants. |

---

## 9. Failure & Edge Case Handling

WALLET_IQ is built with resilience patterns for common real-world edge cases:

1. **Teammate Microservice Offline:** If the Friend 1 service is unreachable, WALLET_IQ displays a yellow indicator in the header and gracefully falls back to the internal mock adapter without crashing.
2. **Missing Inactivity Data:** Subscriptions with incomplete usage data default to medium risk with human review required.
3. **Price Discrepancies:** Receipts indicating price hikes flag the subscription for immediate review.
4. **Network Execution Failure:** If Block 3 reports a failure during cancellation, the transaction is marked `Failed` in the ledger, an alert is logged, and **zero savings are credited** (preserving the savings invariant).

---

## 10. Quick Tester Checklist

Use this 60-second checklist to confirm all features are operational:

- [ ] Header shows **WALLET_IQ** and `PHASE 2: BLOCK 1 INTEGRATED`.
- [ ] Mode selector toggles between `Friend 1 API (:8001)` and `Mock Standalone`.
- [ ] `Run Detection Only` button successfully triggers Stages 1 & 2.
- [ ] `Run Full Pipeline` executes all 7 stages and cancels StreamFlix.
- [ ] Confirmed Savings starts at `$0.00` and increases to `$14.99` after audit.
- [ ] Action Center displays TuneWave vs. MusicBox overlap and FitPulse approval.
- [ ] Clicking `Keep TuneWave` adds `$11.99` to confirmed savings.
- [ ] Clicking `Confirm Cancel ($29.99/mo)` for FitPulse adds `$29.99` to confirmed savings.
- [ ] Annualized Confirmed Savings strictly equals `Confirmed Monthly × 12`.
- [ ] HealthGuard Insurance is listed under Protected Items with no cancel button.
- [ ] Sliders in Guardrail Settings panel adjust and persist values upon clicking `Save Rules`.
- [ ] `Reset Demo State` reliably resets metrics to clean pre-audit values.
- [ ] Architect Hub displays all contracts and runs 62/62 automated tests green.
