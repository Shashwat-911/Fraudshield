import os
import httpx
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

FRAUD_TYPE_CONTEXT = {
    "card_testing": {
        "description": "Multiple rapid small transactions detected from same source",
        "evidence_points": [
            "Unusually high transaction frequency in short window",
            "Pattern consistent with automated card validation attempts",
            "Transactions occur in rapid succession below typical alert thresholds"
        ]
    },
    "account_takeover": {
        "description": "High-value transaction from unrecognized device",
        "evidence_points": [
            "Transaction initiated from a device not previously associated with account",
            "Transaction amount significantly above customer historical average",
            "Access pattern inconsistent with established customer behavior"
        ]
    },
    "friendly_fraud": {
        "description": "Suspicious transaction with anomalous risk profile",
        "evidence_points": [
            "Transaction risk score exceeded fraud threshold",
            "Multiple anomalous signals detected simultaneously",
            "Pattern matches known friendly fraud behavioral signatures"
        ]
    }
}


async def generate_chargeback_response(
    transaction_id: str,
    amount: float,
    merchant_id: str,
    customer_id: str,
    fraud_type: str,
    fraud_score: float,
    payment_method: str,
    hour_of_day: int,
    transactions_last_hour: int,
    is_new_device: bool
) -> str:

    if not ANTHROPIC_API_KEY:
        return _fallback_response(
            transaction_id, amount, merchant_id,
            fraud_type, fraud_score
        )

    context = FRAUD_TYPE_CONTEXT.get(fraud_type, FRAUD_TYPE_CONTEXT["friendly_fraud"])

    evidence_list = "\n".join(
        f"  - {point}" for point in context["evidence_points"]
    )

    prompt = f"""You are a fraud analyst writing a chargeback dispute response letter for a merchant.
Use ONLY the transaction data provided below. Do not invent any facts.

TRANSACTION DATA:
- Transaction ID: {transaction_id}
- Amount: INR {amount:,.2f}
- Merchant ID: {merchant_id}
- Customer ID: {customer_id}
- Payment Method: {payment_method}
- Hour of transaction: {hour_of_day}:00
- Transactions in last hour from same source: {transactions_last_hour}
- New/unrecognized device: {"Yes" if is_new_device else "No"}
- AI Fraud Score: {fraud_score:.2%} (threshold: 50%)
- Fraud Classification: {fraud_type.replace("_", " ").title()}
- Fraud Pattern: {context["description"]}

DETECTED EVIDENCE:
{evidence_list}

Write a formal chargeback dispute response letter that:
1. States the merchant's position clearly
2. Cites only the evidence listed above (no invented facts)
3. References the AI fraud score and classification
4. Requests chargeback reversal
5. Is professional, concise, and under 300 words

Start directly with "Dear Disputes Team," — no preamble."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 600,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                }
            )

            if response.status_code == 200:
                data = response.json()
                return data["content"][0]["text"]
            else:
                return _fallback_response(
                    transaction_id, amount, merchant_id,
                    fraud_type, fraud_score
                )

    except Exception as e:
        return _fallback_response(
            transaction_id, amount, merchant_id,
            fraud_type, fraud_score,
            error=str(e)
        )


def _fallback_response(
    transaction_id: str,
    amount: float,
    merchant_id: str,
    fraud_type: str,
    fraud_score: float,
    error: str = None
) -> str:
    context = FRAUD_TYPE_CONTEXT.get(fraud_type, FRAUD_TYPE_CONTEXT["friendly_fraud"])
    evidence = context["evidence_points"]

    note = ""
    if error:
        note = f"\n[NOTE: Generated via fallback template. LLM error: {error}]"

    return f"""Dear Disputes Team,

We are writing to formally dispute the chargeback raised against Transaction ID: {transaction_id}.

Our AI-powered fraud detection system flagged this transaction with a fraud score of {fraud_score:.2%}, 
exceeding our 50% threshold, and classified it as: {fraud_type.replace('_', ' ').title()}.

EVIDENCE SUMMARY:
- {evidence[0]}
- {evidence[1]}
- {evidence[2]}

Transaction Amount: INR {amount:,.2f}
Merchant ID: {merchant_id}
Fraud Classification: {context["description"]}

Based on the above automated detection evidence, we respectfully request that this chargeback 
be reversed. Our system's detection is grounded strictly in observable transaction signals 
and does not rely on assumptions beyond the data provided.

We are happy to provide full audit logs upon request.

Sincerely,
FraudShield Risk Team
Merchant: {merchant_id}{note}
"""
