# BLOCK 3 — Autonomous Actions & Escalation

## Purpose & Scope
This module is developed independently by the Actions & Escalation teammate.
Its responsibility is to execute autonomous cancellations, pauses, or escalations when requested by the orchestrator, and return explicit action confirmation and verified monthly savings.

## Conceptual API Contract

### Endpoint:
`POST /execute-action`

### Request Payload:
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
    "reason": "Unused for 187 days"
  }
}
```

### Response Payload:
```json
{
  "action_id": "act_001",
  "status": "success",
  "action": "cancel",
  "monthly_savings": 14.99
}
```

## Critical Integration Rules
1. **Savings Rule**:
   - `monthly_savings` in confirmed savings will **ONLY** increase if `status === "success"`.
   - If action fails, return:
     ```json
     {
       "action_id": "act_fail_001",
       "status": "failed",
       "action": "cancel",
       "monthly_savings": 0
     }
     ```
     The dashboard will display the failure and will NOT credit any savings.
2. Expose the endpoint above (default port: `4003`).
3. Set `BLOCK3_BASE_URL` in `.env` (e.g. `http://localhost:4003`).
4. If your final implementation uses different field names, map them in `backend/adapters/block3.adapter.ts`.
