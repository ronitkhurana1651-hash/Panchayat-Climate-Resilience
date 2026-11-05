"""
Verified Wholesale Buyer Registry & Escrow Trade Framework
==========================================================
Connects smallholder farmers directly to verified B2B wholesale
buyers, bypassing village-level middlemen who exploit the
lack of price transparency and produce perishability.

Escrow lifecycle:
  PENDING → ESCROW_FUNDED → DISPATCHED → DELIVERED → RELEASED
                                                     ↓ DISPUTED
"""

import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Seed verified buyers for pilot belts
SEED_BUYERS = [
    {"name": "Reliance Fresh Procurement Hub", "district": "Nashik", "state": "Maharashtra",
     "crops": "onion,tomato,grape", "min_order_qt": 50, "contact": "+91-9876501001",
     "verified": True, "avg_premium_pct": 15},
    {"name": "NAFED Procurement Centre", "district": "Agra", "state": "Uttar Pradesh",
     "crops": "potato,wheat", "min_order_qt": 100, "contact": "+91-9876501002",
     "verified": True, "avg_premium_pct": 12},
    {"name": "Big Basket Farm Collection", "district": "Kolar", "state": "Karnataka",
     "crops": "tomato,leafy vegetables", "min_order_qt": 20, "contact": "+91-9876501003",
     "verified": True, "avg_premium_pct": 20},
    {"name": "ITC Agri Business Hub", "district": "Indore", "state": "Madhya Pradesh",
     "crops": "soybean,wheat,chana", "min_order_qt": 200, "contact": "+91-9876501004",
     "verified": True, "avg_premium_pct": 10},
    {"name": "Warana FPO Bulk Buyer", "district": "Kolhapur", "state": "Maharashtra",
     "crops": "sugarcane,soybean", "min_order_qt": 100, "contact": "+91-9876501005",
     "verified": True, "avg_premium_pct": 8},
]

ESCROW_STATES = ["pending", "escrow_funded", "dispatched", "delivered", "released", "disputed"]


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS verified_buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            district TEXT,
            state TEXT,
            crops TEXT,
            min_order_qt REAL DEFAULT 0,
            contact TEXT,
            verified INTEGER DEFAULT 1,
            avg_premium_pct REAL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS escrow_trades (
            id TEXT PRIMARY KEY,
            buyer_id INTEGER NOT NULL,
            farmer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            village TEXT,
            panchayat TEXT,
            crop TEXT NOT NULL,
            quantity_qt REAL NOT NULL,
            agreed_price_per_qt REAL NOT NULL,
            total_value_inr REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            pool_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            notes TEXT
        )
    """)
    count = conn.execute("SELECT COUNT(*) FROM verified_buyers").fetchone()[0]
    if count == 0:
        for b in SEED_BUYERS:
            conn.execute("""
                INSERT INTO verified_buyers
                (name, district, state, crops, min_order_qt, contact, verified, avg_premium_pct)
                VALUES (?,?,?,?,?,?,?,?)
            """, (b["name"], b["district"], b["state"], b["crops"], b["min_order_qt"],
                  b["contact"], int(b["verified"]), b["avg_premium_pct"]))
    conn.commit()


def list_buyers(db_path: str, district: str = "", state: str = "",
                crop: str = "") -> List[Dict[str, Any]]:
    """List verified wholesale buyers optionally filtered by region/crop."""
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _init_db(conn)
        q = "SELECT * FROM verified_buyers WHERE verified=1"
        params: list = []
        if district:
            q += " AND district LIKE ?"
            params.append(f"%{district}%")
        if state:
            q += " AND state LIKE ?"
            params.append(f"%{state}%")
        if crop:
            q += " AND crops LIKE ?"
            params.append(f"%{crop}%")
        rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


def create_trade(db_path: str, buyer_id: int, farmer_name: str, phone: str,
                 village: str, panchayat: str, crop: str,
                 quantity_qt: float, agreed_price_per_qt: float,
                 pool_id: str = "", notes: str = "") -> Dict[str, Any]:
    """Initiate an escrow trade order between a smallholder and a verified buyer."""
    trade_id = "ESC-" + str(uuid.uuid4())[:8].upper()
    total_value = round(quantity_qt * agreed_price_per_qt, 2)
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _init_db(conn)
        buyer = conn.execute(
            "SELECT * FROM verified_buyers WHERE id=?", (buyer_id,)
        ).fetchone()
        if not buyer:
            raise ValueError(f"Buyer {buyer_id} not found.")
        conn.execute("""
            INSERT INTO escrow_trades
            (id, buyer_id, farmer_name, phone, village, panchayat,
             crop, quantity_qt, agreed_price_per_qt, total_value_inr,
             status, pool_id, created_at, updated_at, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)
        """, (trade_id, buyer_id, farmer_name, phone, village, panchayat,
              crop, quantity_qt, agreed_price_per_qt, total_value,
              pool_id, now, now, notes))
        conn.commit()
    return {
        "trade_id": trade_id,
        "buyer_name": dict(buyer)["name"],
        "crop": crop,
        "quantity_qt": quantity_qt,
        "agreed_price_per_qt": agreed_price_per_qt,
        "total_value_inr": total_value,
        "status": "pending",
        "created_at": now,
    }


def advance_trade_status(db_path: str, trade_id: str,
                         new_status: str) -> Dict[str, Any]:
    """Progress an escrow trade through its lifecycle."""
    if new_status not in ESCROW_STATES:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of {ESCROW_STATES}")
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _init_db(conn)
        conn.execute(
            "UPDATE escrow_trades SET status=?, updated_at=? WHERE id=?",
            (new_status, now, trade_id)
        )
        conn.commit()
        trade = conn.execute(
            "SELECT * FROM escrow_trades WHERE id=?", (trade_id,)
        ).fetchone()
    if not trade:
        raise ValueError(f"Trade {trade_id} not found.")
    return dict(trade)
