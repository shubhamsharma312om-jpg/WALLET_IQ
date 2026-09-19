# Friend 1 — Detection & Subscription Intelligence Microservice

Standalone FastAPI service responsible for subscription detection and intelligence:
- Recurring transaction grouping and cadence detection
- Price hike detection with previous vs. current pricing
- Free-trial to paid tier conversion detection
- Service dormancy and usage recency estimation (e.g. StreamFlix 187 days unused)
- Multi-subscription category overlap detection (e.g. TuneWave and MusicBox Premium)
- Pure detection confidence scores without encroaching on Block 2 waste decisions

## Endpoints
- `GET /health` — Service health check
- `POST /analyze-subscriptions` — Analyze transactions and emails to produce detected subscriptions

## Running the Service
```bash
python main.py # Runs on port 8001
```

## Running Tests
```bash
pytest
```
