import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from database import init_db
from model import load_model
from api import router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[FraudShield] Starting up...")
    await init_db()
    print("[FraudShield] Database initialized.")
    load_model()
    print("[FraudShield] ML model loaded.")
    yield
    print("[FraudShield] Shutting down.")


app = FastAPI(
    title="FraudShield API",
    description="AI-powered fraud detection and chargeback response system for Razorpay merchants.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://fraudshield-mbh2.onrender.com",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "FraudShield",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }
