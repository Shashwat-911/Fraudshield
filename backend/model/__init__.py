import os
import pickle
import numpy as np
import pandas as pd
import shap
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix
)
from imblearn.over_sampling import SMOTE

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "fraud_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.pkl")

FEATURES = [
    "amount", "hour_of_day", "transactions_last_hour",
    "is_new_device", "amount_zscore",
    "payment_method_enc", "location_enc", "device_type_enc"
]

_model = None
_scaler = None
_metrics = None


def generate_synthetic_data(n=2000):
    np.random.seed(42)
    n_legit = int(n * 0.93)
    n_fraud = n - n_legit

    legit = pd.DataFrame({
        "amount": np.random.lognormal(7, 1.2, n_legit),
        "hour_of_day": np.random.randint(6, 23, n_legit),
        "transactions_last_hour": np.random.randint(0, 5, n_legit),
        "is_new_device": np.random.choice([0, 1], n_legit, p=[0.85, 0.15]),
        "amount_zscore": np.random.normal(0, 1.2, n_legit),
        "payment_method_enc": np.random.randint(0, 4, n_legit),
        "location_enc": np.random.randint(0, 10, n_legit),
        "device_type_enc": np.random.randint(0, 3, n_legit),
        "is_fraud": 0
    })

    # Fraudulent — overlapping with legit to make detection harder and realistic
    n_hard = int(n_fraud * 0.4)   # hard borderline fraud cases
    n_easy = n_fraud - n_hard      # obvious fraud cases

    # Mix of card testing AND account takeover patterns
    n_card_test = n_easy // 2
    n_acct_takeover = n_easy - n_card_test

    fraud_card_test = pd.DataFrame({
        "amount": np.random.lognormal(5, 0.5, n_card_test),
        "hour_of_day": np.random.choice([0, 1, 2, 3, 23], n_card_test),
        "transactions_last_hour": np.random.randint(8, 15, n_card_test),
        "is_new_device": np.random.choice([0, 1], n_card_test, p=[0.1, 0.9]),
        "amount_zscore": np.random.normal(2.0, 0.8, n_card_test),
        "payment_method_enc": np.random.randint(0, 4, n_card_test),
        "location_enc": np.random.randint(0, 10, n_card_test),
        "device_type_enc": np.random.randint(0, 3, n_card_test),
        "is_fraud": 1
    })

    fraud_acct_takeover = pd.DataFrame({
        "amount": np.random.lognormal(12, 0.8, n_acct_takeover),
        "hour_of_day": np.random.choice([0, 1, 2, 3, 23], n_acct_takeover),
        "transactions_last_hour": np.random.randint(1, 4, n_acct_takeover),
        "is_new_device": np.ones(n_acct_takeover, dtype=int),
        "amount_zscore": np.random.normal(4.5, 0.5, n_acct_takeover),
        "payment_method_enc": np.random.randint(0, 4, n_acct_takeover),
        "location_enc": np.random.randint(0, 10, n_acct_takeover),
        "device_type_enc": np.random.randint(0, 3, n_acct_takeover),
        "is_fraud": 1
    })

    fraud_easy = pd.concat([fraud_card_test, fraud_acct_takeover], ignore_index=True)

    fraud_hard = pd.DataFrame({
        "amount": np.random.lognormal(7.5, 1.3, n_hard),
        "hour_of_day": np.random.randint(8, 22, n_hard),
        "transactions_last_hour": np.random.randint(3, 7, n_hard),
        "is_new_device": np.random.choice([0, 1], n_hard, p=[0.5, 0.5]),
        "amount_zscore": np.random.normal(1.5, 1.0, n_hard),
        "payment_method_enc": np.random.randint(0, 4, n_hard),
        "location_enc": np.random.randint(0, 10, n_hard),
        "device_type_enc": np.random.randint(0, 3, n_hard),
        "is_fraud": 1
    })

    df = pd.concat(
        [legit, fraud_easy, fraud_hard],
        ignore_index=True
    ).sample(frac=1, random_state=42)
    print(f"[FraudShield] Dataset: {len(legit)} legit, {len(fraud_easy)} fraud_easy, {len(fraud_hard)} fraud_hard")
    return df


def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    method_map = {"upi": 0, "card": 1, "netbanking": 2, "wallet": 3}
    device_map = {"mobile": 0, "desktop": 1, "tablet": 2}

    df = df.copy()
    if "payment_method" in df.columns:
        df["payment_method_enc"] = df["payment_method"].map(method_map).fillna(0).astype(int)
    if "device_type" in df.columns:
        df["device_type_enc"] = df["device_type"].map(device_map).fillna(0).astype(int)
    if "location" in df.columns:
        df["location_enc"] = df["location"].apply(lambda x: hash(x) % 10)
    return df


def train_model():
    global _model, _scaler, _metrics

    df = generate_synthetic_data(2000)
    X = df[FEATURES]
    y = df["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    sm = SMOTE(random_state=42)
    X_res, y_res = sm.fit_resample(X_train_sc, y_train)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        scale_pos_weight=10,
        eval_metric="logloss",
        random_state=42
    )
    model.fit(X_res, y_res)

    y_pred = model.predict(X_test_sc)
    y_prob = model.predict_proba(X_test_sc)[:, 1]

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    fp_cost = int(fp) * 500
    fn_cost = int(fn) * 5000

    metrics = {
        "precision": float(round(precision_score(y_test, y_pred), 4)),
        "recall": float(round(recall_score(y_test, y_pred), 4)),
        "f1": float(round(f1_score(y_test, y_pred), 4)),
        "auc_roc": float(round(roc_auc_score(y_test, y_prob), 4)),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        "fp_cost_inr": int(fp_cost),
        "fn_cost_inr": int(fn_cost),
        "total_cost_inr": int(fp_cost + fn_cost),
        "train_samples": int(len(X_res)),
        "test_samples": int(len(X_test))
    }

    os.makedirs("backend/model", exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    with open(METRICS_PATH, "wb") as f:
        pickle.dump(metrics, f)

    _model = model
    _scaler = scaler
    _metrics = metrics

    print(f"[FraudShield] Model trained — Precision: {metrics['precision']} | Recall: {metrics['recall']} | AUC: {metrics['auc_roc']}")
    return metrics


def load_model():
    global _model, _scaler, _metrics
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(SCALER_PATH, "rb") as f:
            _scaler = pickle.load(f)
        with open(METRICS_PATH, "rb") as f:
            _metrics = pickle.load(f)
    else:
        train_model()


def predict(transaction: dict) -> dict:
    global _model, _scaler
    if _model is None:
        load_model()

    df = pd.DataFrame([transaction])
    df = encode_categoricals(df)

    X = df[FEATURES].fillna(0)
    X_sc = _scaler.transform(X)

    fraud_score = float(_model.predict_proba(X_sc)[0][1])
    is_fraud = int(fraud_score >= 0.5)

    fraud_type = None
    if is_fraud:
        amount = transaction.get("amount", 0)
        velocity = transaction.get("transactions_last_hour", 0)
        new_device = transaction.get("is_new_device", 0)
        zscore = transaction.get("amount_zscore", 0)
        hour = transaction.get("hour_of_day", 12)

        if velocity >= 5:
            fraud_type = "card_testing"
        elif new_device and amount > 50000:
            fraud_type = "account_takeover"
        else:
            fraud_type = "friendly_fraud"

    # SHAP explainability
    explanation = []
    try:
        explainer = shap.TreeExplainer(_model)
        shap_values = explainer.shap_values(X_sc)

        if isinstance(shap_values, list):
            sv = shap_values[1][0]
        else:
            sv = shap_values[0] if shap_values.ndim > 1 else shap_values

        feature_impacts = []
        for feat, shap_val in zip(FEATURES, sv):
            feature_impacts.append({
                "feature": feat,
                "shap_value": round(float(shap_val), 4),
                "impact": "increases_fraud_risk" if shap_val > 0 else "decreases_fraud_risk",
                "magnitude": round(abs(float(shap_val)), 4)
            })

        explanation = sorted(
            feature_impacts,
            key=lambda x: x["magnitude"],
            reverse=True
        )[:5]

    except Exception as e:
        explanation = [{"error": f"SHAP unavailable: {str(e)}"}]

    return {
        "fraud_score": round(fraud_score, 4),
        "is_fraud": is_fraud,
        "fraud_type": fraud_type,
        "threshold": 0.5,
        "top_risk_factors": explanation
    }


def get_metrics() -> dict:
    global _metrics
    if _metrics is None:
        load_model()
    return _metrics
