"""
Friend 1 FastAPI Route Handlers — app/routes.py
Exposes POST /analyze-subscriptions and GET /health.
"""

from fastapi import APIRouter
from app.models import AnalyzeRequest, AnalyzeResponse
from app.detector import SubscriptionDetector

router = APIRouter()
detector = SubscriptionDetector()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "friend1-detection",
        "version": "1.0.0"
    }


@router.post("/analyze-subscriptions", response_model=AnalyzeResponse)
def analyze_subscriptions(request: AnalyzeRequest):
    subs = detector.analyze(
        user_id=request.user_id,
        transactions=request.transactions,
        emails=request.emails,
        usage_events=request.usage_events
    )

    summary = {
        "total_subscriptions_detected": len(subs),
        "recurring_subscriptions": sum(1 for s in subs if s.recurring),
        "price_hikes_detected": sum(1 for s in subs if s.price_hike_detected),
        "trial_conversions_detected": sum(1 for s in subs if s.trial_conversion),
        "overlaps_detected": sum(1 for s in subs if s.overlap_detected),
    }

    warnings = []
    if not request.transactions:
        warnings.append("No transactions provided for analysis.")

    return AnalyzeResponse(
        user_id=request.user_id,
        subscriptions=subs,
        events=[e.model_dump() for e in request.emails],
        analysis_summary=summary,
        warnings=warnings
    )
