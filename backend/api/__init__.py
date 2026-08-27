import uuid
import random
import hashlib
import hmac
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
from model import predict, get_metrics, train_model
from agents import generate_chargeback_response
from database import (
    insert_transaction, insert_audit_log,
    insert_chargeback, get_all_transactions,
    get_audit_logs, get_dashboard_stats
)


router = APIRouter()


class TransactionInput(BaseModel):
    amount: float
    merchant_id: str
    customer_id: str
    payment_method: str
    location: str
    device_type: str
    hour_of_day: int
    transactions_last_hour: int
    is_new_device: bool
    amount_zscore: Optional[float] = 0.0


# ─── Analyze a single transaction ───────────────────────────────────────────

@router.post("/analyze")
async def analyze_transaction(tx: TransactionInput):
    transaction_id = f"TXN-{uuid.uuid4().hex[:10].upper()}"

    tx_dict = tx.dict()
    tx_dict["is_new_device"] = int(tx.is_new_device)

    result = predict(tx_dict)

    record = {
        "id": transaction_id,
        **tx_dict,
        "fraud_score": result["fraud_score"],
        "is_fraud": result["is_fraud"],
        "fraud_type": result["fraud_type"],
        "status": "flagged" if result["is_fraud"] else "clean"
    }

    await insert_transaction(record)

    action = "FLAGGED_FRAUD" if result["is_fraud"] else "APPROVED"
    reason = (
        f"Fraud score {result['fraud_score']:.2%} exceeded threshold. "
        f"Type: {result['fraud_type']}"
        if result["is_fraud"]
        else f"Fraud score {result['fraud_score']:.2%} below threshold. Transaction approved."
    )
    await insert_audit_log(transaction_id, action, reason, result["fraud_score"])

    return {
        "transaction_id": transaction_id,
        "fraud_score": result["fraud_score"],
        "is_fraud": result["is_fraud"],
        "fraud_type": result["fraud_type"],
        "status": record["status"],
        "audit": {"action": action, "reason": reason}
    }


# ─── Generate chargeback letter ──────────────────────────────────────────────

@router.post("/chargeback/{transaction_id}")
async def generate_chargeback(transaction_id: str):
    transactions = await get_all_transactions()
    tx = next((t for t in transactions if t["id"] == transaction_id), None)

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not tx["is_fraud"]:
        raise HTTPException(status_code=400, detail="Transaction is not flagged as fraud")

    letter = await generate_chargeback_response(
        transaction_id=transaction_id,
        amount=tx["amount"],
        merchant_id=tx["merchant_id"],
        customer_id=tx["customer_id"],
        fraud_type=tx["fraud_type"],
        fraud_score=tx["fraud_score"],
        payment_method=tx["payment_method"],
        hour_of_day=tx["hour_of_day"],
        transactions_last_hour=tx["transactions_last_hour"],
        is_new_device=bool(tx["is_new_device"])
    )

    await insert_chargeback(transaction_id, tx["fraud_type"], letter)
    await insert_audit_log(
        transaction_id,
        "CHARGEBACK_GENERATED",
        f"Dispute letter generated for fraud type: {tx['fraud_type']}",
        tx["fraud_score"]
    )

    return {
        "transaction_id": transaction_id,
        "fraud_type": tx["fraud_type"],
        "dispute_letter": letter
    }


# ─── Run batch of synthetic transactions ─────────────────────────────────────

@router.post("/batch")
async def run_batch(count: int = 50):
    if count > 200:
        raise HTTPException(status_code=400, detail="Max batch size is 200")

    payment_methods = ["upi", "card", "netbanking", "wallet"]
    locations = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad",
                 "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat"]
    device_types = ["mobile", "desktop", "tablet"]

    results = []
    flagged = 0
    total_amount = 0

    for i in range(count):
        is_fraud_sim = random.random() < 0.10

        if is_fraud_sim:
            tx_data = {
                "amount": round(random.uniform(50000, 500000), 2),
                "merchant_id": f"MER-{random.randint(1, 20):03d}",
                "customer_id": f"CUST-{random.randint(1, 500):04d}",
                "payment_method": random.choice(payment_methods),
                "location": random.choice(locations),
                "device_type": random.choice(device_types),
                "hour_of_day": random.choice([0, 1, 2, 3, 23]),
                "transactions_last_hour": random.randint(6, 15),
                "is_new_device": True,
                "amount_zscore": round(random.uniform(2.5, 5.0), 2)
            }
        else:
            tx_data = {
                "amount": round(random.uniform(500, 30000), 2),
                "merchant_id": f"MER-{random.randint(1, 20):03d}",
                "customer_id": f"CUST-{random.randint(1, 500):04d}",
                "payment_method": random.choice(payment_methods),
                "location": random.choice(locations),
                "device_type": random.choice(device_types),
                "hour_of_day": random.randint(8, 21),
                "transactions_last_hour": random.randint(0, 3),
                "is_new_device": False,
                "amount_zscore": round(random.uniform(-1.0, 1.0), 2)
            }

        tx_input = TransactionInput(**tx_data)
        response = await analyze_transaction(tx_input)
        results.append(response)
        total_amount += tx_data["amount"]
        if response["is_fraud"]:
            flagged += 1

    blocked_amount = sum(
        r.get("amount", 0) for r in results if r["is_fraud"]
    )

    return {
        "batch_size": count,
        "flagged": flagged,
        "clean": count - flagged,
        "flag_rate": round(flagged / count, 4),
        "total_amount_processed": round(total_amount, 2),
        "results": results
    }


# ─── Dashboard stats ──────────────────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard():
    stats = await get_dashboard_stats()
    metrics = get_metrics()
    stats["precision"] = metrics["precision"]
    stats["recall"] = metrics["recall"]
    stats["f1"] = metrics["f1"]
    stats["auc_roc"] = metrics["auc_roc"]
    stats["fp_cost_inr"] = metrics["fp_cost_inr"]
    stats["fn_cost_inr"] = metrics["fn_cost_inr"]
    return stats


# ─── All transactions ─────────────────────────────────────────────────────────

@router.get("/transactions")
async def transactions():
    return await get_all_transactions()


# ─── Audit log ────────────────────────────────────────────────────────────────

@router.get("/audit")
async def audit():
    return await get_audit_logs()


# ─── Model metrics ────────────────────────────────────────────────────────────

@router.get("/metrics")
async def metrics():
    return get_metrics()


# ─── Retrain model ────────────────────────────────────────────────────────────

@router.post("/retrain")
async def retrain():
    metrics = train_model()
    await insert_audit_log(
        "SYSTEM", "MODEL_RETRAINED",
        f"Model retrained. Precision: {metrics['precision']} Recall: {metrics['recall']}",
        None
    )
    return {"message": "Model retrained successfully", "metrics": metrics}


# ─── Health check ─────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "service": "FraudShield API v1.0"}


# ─── Razorpay Webhook Simulation ─────────────────────────────────────────────

RAZORPAY_WEBHOOK_SECRET = "fraudshield_webhook_secret_2026"

class RazorpayWebhookPayload(BaseModel):
    event: str
    payload: dict

def verify_razorpay_signature(body: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    body_str = body.decode()

    signature = request.headers.get("x-razorpay-signature", "simulated")

    try:
        data = json.loads(body_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = data.get("event", "unknown")
    payload = data.get("payload", {})

    payment = payload.get("payment", {}).get("entity", {})

    transaction_id = f"RZP-{uuid.uuid4().hex[:10].upper()}"
    amount = payment.get("amount", 0) / 100
    method = payment.get("method", "card")
    contact = payment.get("contact", "unknown")

    await insert_audit_log(
        transaction_id,
        f"WEBHOOK_{event.upper().replace('.', '_')}",
        f"Razorpay webhook received: {event} | Amount: \u20b9{amount} | Method: {method} | Signature: {signature[:16]}...",
        None
    )

    if event == "payment.failed":
        tx_dict = {
            "amount": amount,
            "merchant_id": payment.get("merchant_id", "MER-RZP"),
            "customer_id": contact,
            "payment_method": method,
            "location": "Unknown",
            "device_type": "mobile",
            "hour_of_day": datetime.now().hour,
            "transactions_last_hour": random.randint(1, 10),
            "is_new_device": random.choice([0, 1]),
            "amount_zscore": round(random.uniform(-1, 4), 2)
        }

        result = predict(tx_dict)

        record = {
            "id": transaction_id,
            **tx_dict,
            "fraud_score": result["fraud_score"],
            "is_fraud": result["is_fraud"],
            "fraud_type": result["fraud_type"],
            "status": "flagged" if result["is_fraud"] else "failed_legitimate"
        }
        await insert_transaction(record)

        action = "FLAGGED_FRAUD" if result["is_fraud"] else "FAILED_LEGITIMATE"
        reason = (
            f"Failed payment analyzed. Fraud score: {result['fraud_score']:.2%}. "
            f"Classification: {result['fraud_type'] if result['is_fraud'] else 'Legitimate failure'}"
        )
        await insert_audit_log(transaction_id, action, reason, result["fraud_score"])

        return {
            "status": "processed",
            "event": event,
            "transaction_id": transaction_id,
            "fraud_analysis": result,
            "action": action
        }

    return {
        "status": "acknowledged",
        "event": event,
        "transaction_id": transaction_id
    }


@router.post("/webhook/simulate")
async def simulate_webhook(scenario: str = "payment.failed"):
    scenarios = {
        "payment.failed": {
            "event": "payment.failed",
            "payload": {
                "payment": {
                    "entity": {
                        "amount": random.randint(10000, 500000),
                        "method": random.choice(["card", "upi", "netbanking"]),
                        "contact": f"+919{random.randint(100000000,999999999)}",
                        "merchant_id": f"MER-{random.randint(1,20):03d}",
                        "error_code": random.choice([
                            "BAD_REQUEST_ERROR",
                            "GATEWAY_ERROR",
                            "SERVER_ERROR"
                        ]),
                        "error_description": random.choice([
                            "Insufficient funds",
                            "Card declined by bank",
                            "Authentication failed",
                            "Network timeout"
                        ])
                    }
                }
            }
        },
        "payment.captured": {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "amount": random.randint(500, 50000),
                        "method": random.choice(["upi", "card"]),
                        "contact": f"+919{random.randint(100000000,999999999)}",
                        "merchant_id": f"MER-{random.randint(1,20):03d}"
                    }
                }
            }
        }
    }

    payload = scenarios.get(scenario, scenarios["payment.failed"])
    body = json.dumps(payload)
    signature = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    import httpx

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.post(
            "/api/webhook/razorpay",
            content=body,
            headers={
                "content-type": "application/json",
                "x-razorpay-signature": signature
            }
        )
        return response.json()


# ─── Model confusion matrix ───────────────────────────────────────────────────

@router.get("/metrics/confusion")
async def confusion_matrix_data():
    m = get_metrics()
    return {
        "matrix": [
            [m["true_negatives"],  m["false_positives"]],
            [m["false_negatives"], m["true_positives"]]
        ],
        "labels": ["Legitimate", "Fraud"],
        "precision":        m["precision"],
        "recall":           m["recall"],
        "f1":               m["f1"],
        "auc_roc":          m["auc_roc"],
        "fp_cost_inr":      m["fp_cost_inr"],
        "fn_cost_inr":      m["fn_cost_inr"],
        "total_cost_inr":   m["total_cost_inr"],
        "train_samples":    m["train_samples"],
        "test_samples":     m["test_samples"]
    }
