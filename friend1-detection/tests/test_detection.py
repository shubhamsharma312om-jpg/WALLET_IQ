"""
Friend 1 Detection Test Suite — tests/test_detection.py
Tests core detection logic, schema contracts, and canonical demo cases.
"""

import json
import sys
from pathlib import Path

# Ensure friend1-detection root is on python path
MODULE_ROOT = Path(__file__).parent.parent
if str(MODULE_ROOT) not in sys.path:
    sys.path.insert(0, str(MODULE_ROOT))

from fastapi.testclient import TestClient
from main import app
from app.detector import SubscriptionDetector
from app.models import TransactionInput, EmailInput, Subscription

client = TestClient(app)

DEMO_DIR = Path(__file__).parent.parent / "demo"


def load_demo_fixtures():
    with open(DEMO_DIR / "transactions.json", "r") as f:
        raw_txs = json.load(f)
    with open(DEMO_DIR / "emails.json", "r") as f:
        raw_emails = json.load(f)
    transactions = [TransactionInput(**t) for t in raw_txs]
    emails = [EmailInput(**e) for e in raw_emails]
    return transactions, emails


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "friend1-detection"


def test_subscription_model_import_and_instantiation():
    # Verifies defect fix: Subscription imported and usable
    sub = Subscription(
        subscription_id="sub_test",
        merchant="Test Merchant",
        normalized_merchant="Test Merchant",
        category="streaming_video",
        amount=9.99,
        currency="USD",
        billing_cadence="monthly",
        monthly_equivalent=9.99,
        occurrence_count=1,
        recurring=True,
        overall_detection_confidence=95,
    )
    assert sub.subscription_id == "sub_test"
    assert sub.amount == 9.99


def test_detect_streamflix_dormant_187_days():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    streamflix = next((s for s in results if s.merchant == "StreamFlix"), None)
    assert streamflix is not None
    assert streamflix.amount == 14.99
    assert streamflix.billing_cadence == "monthly"
    assert streamflix.days_since_use == 187
    assert streamflix.usage_status == "dormant"
    assert streamflix.recurring is True
    assert streamflix.overall_detection_confidence >= 90


def test_detect_overlap_music_services():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    tunewave = next((s for s in results if s.merchant == "TuneWave"), None)
    musicbox = next((s for s in results if s.merchant == "MusicBox Premium"), None)

    assert tunewave is not None
    assert musicbox is not None
    assert tunewave.amount == 9.99
    assert musicbox.amount == 11.99

    # Both must be flagged with category overlap
    assert tunewave.overlap_detected is True
    assert musicbox.overlap_detected is True
    assert tunewave.overlap_group_id == "overlap_streaming_music"
    assert musicbox.overlap_group_id == "overlap_streaming_music"

    # Crucial boundary: Friend 1 must NOT choose which one to cancel
    assert not hasattr(tunewave, "recommended_action") or getattr(tunewave, "recommended_action", None) is None


def test_detect_price_hike_cloudpro():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    cloudpro = next((s for s in results if s.merchant == "CloudPro"), None)
    assert cloudpro is not None
    assert cloudpro.amount == 19.99
    assert cloudpro.price_hike_detected is True
    assert cloudpro.price_hike_details is not None
    assert cloudpro.price_hike_details.previous_amount == 14.99
    assert cloudpro.price_hike_details.current_amount == 19.99


def test_detect_trial_conversion_fitpulse():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    fitpulse = next((s for s in results if s.merchant == "FitPulse Pro"), None)
    assert fitpulse is not None
    assert fitpulse.amount == 29.99
    assert fitpulse.trial_conversion is True
    assert fitpulse.trial_conversion_details is not None
    assert fitpulse.trial_conversion_details.converted_amount == 29.99


def test_detect_insurance_category():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    healthguard = next((s for s in results if s.merchant == "HealthGuard Insurance"), None)
    assert healthguard is not None
    assert healthguard.amount == 89.00
    assert healthguard.category == "insurance"


def test_no_empty_subscription_ids():
    txs, emails = load_demo_fixtures()
    detector = SubscriptionDetector()
    results = detector.analyze(user_id="u_301", transactions=txs, emails=emails)

    for sub in results:
        assert sub.subscription_id is not None
        assert len(sub.subscription_id.strip()) > 0
        assert sub.subscription_id.startswith("sub_")


def test_api_analyze_subscriptions_endpoint():
    with open(DEMO_DIR / "transactions.json", "r") as f:
        raw_txs = json.load(f)
    with open(DEMO_DIR / "emails.json", "r") as f:
        raw_emails = json.load(f)

    payload = {
        "user_id": "u_301",
        "transactions": raw_txs,
        "emails": raw_emails,
        "usage_events": []
    }

    response = client.post("/analyze-subscriptions", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "u_301"
    assert len(body["subscriptions"]) >= 5
    assert "analysis_summary" in body
