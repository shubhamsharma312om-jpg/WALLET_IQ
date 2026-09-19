"""
Friend 1 Detection Microservice Entry Point — main.py
"""

from fastapi import FastAPI
from app.routes import router

app = FastAPI(
    title="Friend 1 — SpendGuardian Detection & Intelligence",
    version="1.0.0",
    description="Standalone detection microservice for recurring subscriptions, price hikes, trial conversions, and overlaps."
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    # Default port: 8001 as specified in friend1-detection README
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
