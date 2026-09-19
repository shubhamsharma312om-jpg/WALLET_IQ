"""
Friend 1 Detection Service — Domain Models
Defines Pydantic models for transactions, emails, usage events, and detected subscriptions.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TransactionInput(BaseModel):
    transaction_id: str
    user_id: str
    merchant: str
    amount: float
    currency: str = "USD"
    date: str
    category: str = "general"
    payment_method: Optional[str] = None
    description: Optional[str] = None


class EmailInput(BaseModel):
    event_id: str
    user_id: str
    subject: str
    sender: str
    date: str
    snippet: str
    event_type: str
    metadata: Optional[Dict[str, Any]] = None


class UsageEventInput(BaseModel):
    event_id: str
    user_id: str
    service_name: str
    date: str
    event_type: str = "usage"
    metadata: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    user_id: str
    transactions: List[TransactionInput]
    emails: List[EmailInput] = []
    usage_events: List[UsageEventInput] = []


class TrialConversionDetails(BaseModel):
    trial_start_date: Optional[str] = None
    converted_date: Optional[str] = None
    trial_amount: float = 0.0
    converted_amount: float
    notes: Optional[str] = None


class PriceHikeDetails(BaseModel):
    previous_amount: float
    current_amount: float
    hike_percentage: float
    detected_from: str = "transactions"
    notice_date: Optional[str] = None


class Subscription(BaseModel):
    subscription_id: str
    merchant: str
    normalized_merchant: str
    category: str
    amount: float
    currency: str = "USD"
    billing_cadence: str = "monthly"
    monthly_equivalent: float
    first_detected_at: Optional[str] = None
    last_charged_at: Optional[str] = None
    occurrence_count: int = 1
    recurring: bool = True
    recurring_confidence: int = 90
    trial_conversion: bool = False
    trial_conversion_details: Optional[TrialConversionDetails] = None
    price_hike_detected: bool = False
    price_hike_details: Optional[PriceHikeDetails] = None
    last_used_at: Optional[str] = None
    days_since_use: int = 0
    usage_status: str = "active"
    usage_confidence: int = 90
    category_confidence: int = 95
    overlap_group_id: Optional[str] = None
    overlap_detected: bool = False
    overlap_confidence: int = 0
    overall_detection_confidence: int = 90
    evidence: List[str] = []
    source_transaction_ids: List[str] = []
    source_email_ids: List[str] = []


class AnalyzeResponse(BaseModel):
    user_id: str
    subscriptions: List[Subscription]
    events: List[Dict[str, Any]] = []
    analysis_summary: Dict[str, Any] = {}
    warnings: List[str] = []
