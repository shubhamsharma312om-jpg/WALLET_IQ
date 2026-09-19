# BLOCK 1 — Detection & Subscription Intelligence

## Purpose & Scope
This module is developed independently by the Detection & Subscription Intelligence teammate.
Its responsibility is to analyze raw bank transactions and email receipts/notifications to detect active recurring subscriptions, quantify waste scores, and assess confidence.

## Conceptual API Contract

### Endpoint:
`POST /analyze-subscriptions`

### Request Payload:
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
      "category": "streaming_video",
      "payment_method": "Visa ...4242",
      "description": "StreamFlix Standard Subscription"
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

### Response Payload:
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

## Integration Instructions for Teammate
1. Implement your detection logic inside this directory or deploy as a standalone microservice.
2. Expose the endpoint above (default port: `4001`).
3. Set `BLOCK1_BASE_URL` in `.env` (e.g. `http://localhost:4001`).
4. If your final implementation uses different field names or routes, update `backend/adapters/block1.adapter.ts` to map your payload rather than changing the orchestrator!
