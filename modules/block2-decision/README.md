# BLOCK 2 — Decision, Scoring & Guardrails

## Purpose & Scope
This module is developed independently by the Decision & Scoring teammate.
Its responsibility is to take detected subscriptions, email events, and user-configured guardrails to compute recommended decisions (`cancel`, `keep`, `ask_user`, `pause`, `downgrade`), evaluate guardrail statuses (`passed`, `blocked`, `requires_approval`), and detect overlapping services.

## Conceptual API Contract

### Endpoint:
`POST /evaluate-subscriptions`

### Request Payload:
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
  "events": [],
  "guardrails": {
    "auto_action_limit": 20,
    "protected_categories": ["insurance", "loan_payment"],
    "minimum_confidence": 90,
    "duplicate_subscriptions": "require_approval",
    "unused_after_days": 90
  }
}
```

### Response Payload:
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

## Demo Cases Required
- **CASE 1 (StreamFlix)**: $14.99, unused 187 days -> `action: "cancel"`, `guardrail_status: "passed"`, `requires_approval: false`.
- **CASE 2 (TuneWave + MusicBox Premium)**: Overlap detected -> `action: "ask_user"`, `requires_approval: true`, list other id in `overlapping_subscription_ids`.
- **CASE 3 (HealthGuard Insurance)**: Category insurance -> `guardrail_status: "blocked"`, `risk: "high"`, cannot be cancelled autonomously.

## Integration Instructions for Teammate
1. Implement decision engine inside this directory or deploy as a standalone service.
2. Expose the endpoint above (default port: `4002`).
3. Set `BLOCK2_BASE_URL` in `.env` (e.g. `http://localhost:4002`).
4. If your final implementation uses different field names, update `backend/adapters/block2.adapter.ts`.
