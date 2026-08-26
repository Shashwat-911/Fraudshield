import aiosqlite
import json
from datetime import datetime

DB_PATH = "fraudshield.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                amount REAL NOT NULL,
                merchant_id TEXT NOT NULL,
                customer_id TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                location TEXT NOT NULL,
                device_type TEXT NOT NULL,
                hour_of_day INTEGER NOT NULL,
                transactions_last_hour INTEGER NOT NULL,
                is_new_device INTEGER NOT NULL,
                amount_zscore REAL NOT NULL,
                fraud_score REAL,
                is_fraud INTEGER,
                fraud_type TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT NOT NULL,
                confidence REAL,
                model_version TEXT DEFAULT 'v1.0',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS chargeback_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT NOT NULL,
                fraud_type TEXT NOT NULL,
                dispute_letter TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.commit()


async def insert_transaction(tx: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO transactions (
                id, amount, merchant_id, customer_id,
                payment_method, location, device_type,
                hour_of_day, transactions_last_hour,
                is_new_device, amount_zscore,
                fraud_score, is_fraud, fraud_type, status
            ) VALUES (
                :id, :amount, :merchant_id, :customer_id,
                :payment_method, :location, :device_type,
                :hour_of_day, :transactions_last_hour,
                :is_new_device, :amount_zscore,
                :fraud_score, :is_fraud, :fraud_type, :status
            )
        """, tx)
        await db.commit()


async def insert_audit_log(transaction_id: str, action: str, reason: str, confidence: float = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO audit_log (transaction_id, action, reason, confidence)
            VALUES (?, ?, ?, ?)
        """, (transaction_id, action, reason, confidence))
        await db.commit()


async def insert_chargeback(transaction_id: str, fraud_type: str, letter: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO chargeback_responses (transaction_id, fraud_type, dispute_letter)
            VALUES (?, ?, ?)
        """, (transaction_id, fraud_type, letter))
        await db.commit()


async def get_all_transactions():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM transactions ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_audit_logs():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM audit_log ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_dashboard_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute(
            "SELECT COUNT(*) as total FROM transactions"
        ) as cur:
            total = (await cur.fetchone())["total"]

        async with db.execute(
            "SELECT COUNT(*) as flagged FROM transactions WHERE is_fraud = 1"
        ) as cur:
            flagged = (await cur.fetchone())["flagged"]

        async with db.execute(
            "SELECT COALESCE(SUM(amount), 0) as blocked FROM transactions WHERE is_fraud = 1"
        ) as cur:
            blocked = (await cur.fetchone())["blocked"]

        async with db.execute(
            "SELECT COALESCE(AVG(fraud_score), 0) as avg_score FROM transactions"
        ) as cur:
            avg_score = (await cur.fetchone())["avg_score"]

        return {
            "total_transactions": total,
            "flagged_fraud": flagged,
            "amount_blocked": round(blocked, 2),
            "avg_fraud_score": round(avg_score, 4),
            "precision": 0.0,
            "recall": 0.0
        }
