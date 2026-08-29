import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import app

client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_lifespan():
    with client:
        yield

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_clean_transaction():
    payload = {
        "amount": 1200.0,
        "merchant_id": "MER-001",
        "customer_id": "CUST-001",
        "payment_method": "upi",
        "location": "Mumbai",
        "device_type": "mobile",
        "hour_of_day": 14,
        "transactions_last_hour": 1,
        "is_new_device": False,
        "amount_zscore": 0.1
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_fraud"] == 0
    assert "top_risk_factors" in data

def test_card_testing_fraud():
    payload = {
        "amount": 100.0,
        "merchant_id": "MER-002",
        "customer_id": "CUST-002",
        "payment_method": "card",
        "location": "Delhi",
        "device_type": "mobile",
        "hour_of_day": 2,
        "transactions_last_hour": 12,
        "is_new_device": True,
        "amount_zscore": 0.5
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_fraud"] == 1
    assert data["fraud_type"] == "card_testing"

def test_batch_boundary_cap():
    response = client.post("/api/batch?count=250")
    assert response.status_code == 400
    assert response.json()["detail"] == "Max batch size is 200"

def test_chargeback_not_found():
    response = client.post("/api/chargeback/TXN-NONEXISTENT")
    assert response.status_code == 404
