# 🛡️ FraudShield — AI Risk Manager

> AI-powered fraud detection and chargeback response system built for Razorpay AI Buildathon — Track 02.

## What it does

- Detects fraudulent transactions in real-time using XGBoost (trained on 2000 synthetic transactions)
- Classifies fraud type: Card Testing, Account Takeover, Friendly Fraud
- Auto-generates chargeback dispute letters using Claude AI (with fallback template)
- Logs every decision to an append-only audit trail
- Shows honest ML metrics: Precision, Recall, F1, AUC-ROC, False Positive Cost

## Architecture

Frontend (React + Tailwind + Vite)
↕ REST API
Backend (FastAPI + Python)
├── ML Model (XGBoost + SMOTE)
├── LLM Agent (Claude API)
└── Database (SQLite audit trail)


## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Frontend | React 18, Tailwind, Recharts  |
| Backend  | FastAPI, Uvicorn              |
| ML       | XGBoost, scikit-learn, SMOTE  |
| LLM      | Claude (Anthropic API)        |
| Database | SQLite (aiosqlite)            |
| Deploy   | Render (backend), Vercel (frontend) |

## Setup & Run

### Backend
```bash
cd fraudshield/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd fraudshield/frontend
npm install
npm run dev
```

Open http://localhost:5173

## ML Metrics (on held-out test set)

Evaluated on 20% hold-out from 2000 synthetic transactions with SMOTE balancing.

- Precision: measures how many flagged transactions are actually fraud
- Recall: measures how many actual frauds were caught
- False Positive Cost: ₹500 per good transaction incorrectly blocked
- False Negative Cost: ₹5,000 per fraud missed

## What broke at 2 AM

Class imbalance (93% legit vs 7% fraud) caused recall to collapse to 0.2 on first run.
Fixed by applying SMOTE oversampling on training set and tuning XGBoost scale_pos_weight=10.
Result: recall jumped to 0.85+ without sacrificing precision below 0.80.

## Audit Trail

Every transaction decision is logged with:
- Action taken (APPROVED / FLAGGED_FRAUD / CHARGEBACK_GENERATED)
- Reason (human-readable explanation)
- Confidence score
- Timestamp

## Deployment

- Backend: deploy /backend to Render.com (free tier, add ANTHROPIC_API_KEY env var)
- Frontend: deploy /frontend to Vercel (free tier, update API URL to Render URL)

---

Built for Razorpay AI Buildathon 2026 — Track 02: AI Risk Manager
