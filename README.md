# 🛡️ FraudShield
### AI-Powered Risk Manager for Razorpay Merchants — Track 02

> 🏆 **Razorpay AI Buildathon 2026 Submission** | **Track 02: AI Risk Manager**

| 🚀 **Live Web App** | ⚡ **API & Swagger Docs** | 🎥 **Video Demo Pitch** | 📊 **Track Focus** |
| :---: | :---: | :---: | :---: |
| **[fraudshield-frontend.vercel.app](https://fraudshield-frontend.vercel.app/)** | **[fraudshield-backend.onrender.com/docs](https://fraudshield-backend.onrender.com/docs)** | **[Watch Pitch Demo](#)** | **AI Risk Manager** |

---

## The Problem

Every day, Indian merchants silently lose money to three things:

- **Fraudulent transactions** that get charged back weeks later
- **Chargeback abuse** where merchants lose the dispute because they had no evidence
- **False declines** where good customers get blocked, hurting revenue

Most merchants have no real-time defense. FraudShield fixes that.

---

## What FraudShield Does

A judge can verify every claim below by running the app or hitting the live API.

| Capability | How it works | Where to see it |
|---|---|---|
| **Real-time fraud detection** | XGBoost classifier scores every transaction 0–100% | `POST /api/analyze` |
| **3 fraud types classified** | Card Testing, Account Takeover, Friendly Fraud | Transactions page |
| **Explains every decision** | SHAP values show which features drove the score | `top_risk_factors` in API response |
| **Razorpay webhook integration** | Listens for `payment.failed`, runs fraud analysis, logs result | `POST /api/webhook/razorpay` |
| **LLM chargeback response** | Claude generates dispute letter from transaction evidence only — no hallucination | Dispute button on any flagged transaction |
| **Fallback if LLM is down** | Deterministic template fires automatically, UI shows warning badge | Transactions page |
| **Append-only audit trail** | Every decision logged with action, reason, confidence, timestamp | Audit Log page |
| **Batch processing** | Analyze up to 200 transactions at once, get aggregate stats | `POST /api/batch` |
| **Online retraining** | Retrain model via API without restarting the server | `POST /api/retrain` |

---

## ML Model — Honest Numbers

Trained on 2,000 synthetic transactions. Evaluated on a held-out 20% test set (400 samples).
Class distribution: 93% legitimate, 7% fraud — realistic Indian payment data.

| Metric | Value | What it means |
|---|---|---|
| **Precision** | 0.72 | 72% of flagged transactions are real fraud |
| **Recall** | 0.93 | Catches 93% of all actual fraud |
| **F1 Score** | 0.81 | Balanced score across both |
| **AUC-ROC** | 0.997 | Near-perfect separation of fraud vs legit |
| **False Positive Cost** | ₹500 per blocked clean transaction | 10 FPs = ₹5,000 merchant friction |
| **False Negative Cost** | ₹5,000 per missed fraud | 2 FNs = ₹10,000 chargeback loss |

> The model is optimized for **recall over precision** — in fraud detection, 
> missing a fraud (₹5,000 loss) is far more costly than a false alarm (₹500 friction).
> This tradeoff is explicit and intentional.

### Why these metrics are trustworthy
- SMOTE oversampling applied only to training set, never to test set
- Test set is stratified — same 7% fraud ratio as real data
- No data leakage — scaler fitted on train, applied to test

---

## What Broke at 2 AM

**Problem 1 — Recall collapsed to 0.2 on first run**

93% of transactions are legitimate. The model learned to predict everything 
as "clean" and still got 93% accuracy. Classic class imbalance trap.

Fix: SMOTE oversampling on training set + `scale_pos_weight=10` in XGBoost.
Result: recall jumped from 0.2 → 0.93.

**Problem 2 — Account Takeover scoring as clean (fraud score: 3.4%)**

A ₹4,85,000 transaction at 3AM from an unrecognized device scored 3.4% — 
effectively approved. Root cause: training data had no account takeover pattern. 
The fraud_easy class was entirely high-velocity card testing, so the model 
never learned the high-value + new-device signature.

Fix: Split fraud_easy into two distinct archetypes — card_test (high velocity, 
low amount) and account_takeover (low velocity, very high amount, always new device).
Result: same transaction now scores 99.98% — correctly flagged as account_takeover.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           React Frontend (Vite)             │
│  Dashboard · Transactions · Audit · Analyze │
└──────────────────┬──────────────────────────┘
                   │ REST API (CORS configured)
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend                │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ XGBoost     │  │  Claude LLM Agent    │  │
│  │ + SMOTE     │  │  Chargeback letters  │  │
│  │ + SHAP      │  │  + fallback template │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  SQLite — Append-only Audit Trail    │   │
│  │  transactions · audit_log · chargebacks│ │
│  └──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Razorpay Webhook Integration        │
│  payment.failed → fraud analysis → log      │
│  HMAC SHA-256 signature verification        │
└─────────────────────────────────────────────┘
```

---

## Running It Locally (Two Commands)

**Backend**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
# Model trains automatically on first boot (~10 seconds)
# API docs at http://localhost:8000/docs
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## API Reference (Key Endpoints)

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/api/analyze` | Score a single transaction, returns fraud score + SHAP explanation |
| `POST` | `/api/batch?count=N` | Score N transactions (max 200), returns aggregate stats |
| `POST` | `/api/chargeback/{txn_id}` | Generate LLM dispute letter for a flagged transaction |
| `GET` | `/api/dashboard` | Live stats: total transactions, amount blocked, ML metrics |
| `GET` | `/api/audit` | Full append-only audit log |
| `POST` | `/api/webhook/razorpay` | Razorpay webhook receiver (HMAC verified) |
| `POST` | `/api/webhook/simulate` | Simulate a Razorpay webhook event |
| `POST` | `/api/retrain` | Retrain model on fresh data without restart |
| `GET` | `/api/metrics/confusion` | Full confusion matrix with cost breakdown |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| ML Model | XGBoost | Tabular fraud data, interpretability, production-grade |
| Imbalance | SMOTE | Oversample minority class without touching test set |
| Explainability | SHAP TreeExplainer | Per-prediction feature attribution, not just global importance |
| LLM | Claude (Anthropic) | Grounded generation — no hallucination beyond provided evidence |
| Backend | FastAPI | Async, auto-docs, Pydantic validation |
| Database | SQLite + aiosqlite | Append-only audit log, zero-config, portable |
| Frontend | React + Tailwind + Recharts | Fast, responsive, charts built-in |

---

## Test Suite

```bash
python -m pytest backend/tests/test_api.py -v
# 5 tests: health, clean txn, card testing, batch limit, 404 handling
# All passing on Python 3.14
```

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Backend | Render (free tier) | https://fraudshield-backend.onrender.com |
| Frontend | Vercel (free tier) | https://fraudshield-frontend.vercel.app |

---

*Built by Shashwat Yadav for Razorpay AI Buildathon 2026 — Track 02: AI Risk Manager*
*Submission deadline: September 5, 2026*
