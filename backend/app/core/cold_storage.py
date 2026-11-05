"""
Cold Storage Locker Availability Tracking & SMS Booking
=========================================================
Tracks cold storage facility capacity in key agricultural belts:
  - Agra / Nalanda potato belts (UP / Bihar)
  - Nashik / Lasalgaon onion-drying facilities (Maharashtra)
  - Kolar / Madanapalle tomato cold rooms (Karnataka / AP)
  - Malwa & Bundelkhand pulse storage (MP)

Prevents the core problem scenario: farmers dumping produce at
rock-bottom prices because they cannot find available cold space in time.
"""

import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Seed facilities for the 4 regional pilot belts (proposal-defined zones)
SEED_FACILITIES = [
    # Indo-Gangetic Plains — Potato belt
    {"name": "Agra Cold Storage Unit 1", "district": "Agra", "state": "Uttar Pradesh",
     "capacity_mt": 500, "available_mt": 180, "rate_per_mt_per_day": 2.5,
     "min_temp_c": 2, "contact": "+91-9876500001", "lat": 27.1767, "lon": 78.0081},
    {"name": "Nalanda Potato Locker Hub", "district": "Nalanda", "state": "Bihar",
     "capacity_mt": 300, "available_mt": 90, "rate_per_mt_per_day": 2.0,
     "min_temp_c": 3, "contact": "+91-9876500002", "lat": 25.1167, "lon": 85.4454},
    # Maharashtra Horticulture — Onion
    {"name": "Lasalgaon APMC Onion Chamber", "district": "Nashik", "state": "Maharashtra",
     "capacity_mt": 400, "available_mt": 60, "rate_per_mt_per_day": 3.0,
     "min_temp_c": 10, "contact": "+91-9876500003", "lat": 20.1159, "lon": 74.3487},
    {"name": "Nashik Grape Cold Room A", "district": "Nashik", "state": "Maharashtra",
     "capacity_mt": 200, "available_mt": 110, "rate_per_mt_per_day": 4.5,
     "min_temp_c": 1, "contact": "+91-9876500004", "lat": 20.0059, "lon": 73.7898},
    # Central India Pulse Belt
    {"name": "Indore Soybean Cold Hub", "district": "Indore", "state": "Madhya Pradesh",
     "capacity_mt": 600, "available_mt": 250, "rate_per_mt_per_day": 2.0,
     "min_temp_c": 8, "contact": "+91-9876500005", "lat": 22.7196, "lon": 75.8577},
    # Southern Vegetable Clusters
    {"name": "Kolar Tomato Cold Unit", "district": "Kolar", "state": "Karnataka",
     "capacity_mt": 150, "available_mt": 30, "rate_per_mt_per_day": 5.0,
     "min_temp_c": 4, "contact": "+91-9876500006", "lat": 13.1333, "lon": 78.1333},
    {"name": "Madanapalle Vegetable Locker", "district": "Chittoor", "state": "Andhra Pradesh",
     "capacity_mt": 200, "available_mt": 85, "rate_per_mt_per_day": 4.0,
     "min_temp_c": 5, "contact": "+91-9876500007", "lat": 13.5500, "lon": 78.5000},
]


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cold_storage_facilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            district TEXT NOT NULL,
            state TEXT NOT NULL,
            capacity_mt REAL DEFAULT 0,
            available_mt REAL DEFAULT 0,
            rate_per_mt_per_day REAL DEFAULT 0,
            min_temp_c REAL DEFAULT 4,
            contact TEXT,
            lat REAL,
            lon REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cold_storage_bookings (
            id TEXT PRIMARY KEY,
            facility_id INTEGER NOT NULL,
            farmer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            village TEXT,
            panchayat TEXT,
            crop TEXT NOT NULL,
            quantity_mt REAL NOT NULL,
            duration_days INTEGER NOT NULL,
            booked_at TEXT NOT NULL,
            status TEXT DEFAULT 'confirmed',
            token TEXT NOT NULL,
            estimated_cost REAL
        )
    """)
    # Seed facilities if empty
    count = conn.execute("SELECT COUNT(*) FROM cold_storage_facilities").fetchone()[0]
    if count == 0:
        for f in SEED_FACILITIES:
            conn.execute("""
                INSERT INTO cold_storage_facilities
                (name, district, state, capacity_mt, available_mt,
                 rate_per_mt_per_day, min_temp_c, contact, lat, lon)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (f["name"], f["district"], f["state"], f["capacity_mt"],
                  f["available_mt"], f["rate_per_mt_per_day"], f["min_temp_c"],
                  f["contact"], f["lat"], f["lon"]))
    conn.commit()


def search_facilities(db_path: str, district: str = "", state: str = "",
                      min_space_mt: float = 0) -> List[Dict[str, Any]]:
    """Search cold storage facilities by region and minimum available space."""
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _init_db(conn)
        query = "SELECT * FROM cold_storage_facilities WHERE available_mt >= ?"
        params: list = [min_space_mt]
        if district:
            query += " AND district LIKE ?"
            params.append(f"%{district}%")
        if state:
            query += " AND state LIKE ?"
            params.append(f"%{state}%")
        query += " ORDER BY available_mt DESC"
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def reserve_space(db_path: str, facility_id: int, farmer_name: str, phone: str,
                  village: str, panchayat: str, crop: str,
                  quantity_mt: float, duration_days: int) -> Dict[str, Any]:
    """
    Reserve cold storage space for a smallholder.
    Returns booking confirmation with SMS-ready token.
    Prevents double-booking via transaction and available_mt check.
    """
    import uuid, random, string
    booking_id = str(uuid.uuid4())[:8].upper()
    token = "".join(random.choices(string.digits, k=6))
    booked_at = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _init_db(conn)
        facility = conn.execute(
            "SELECT * FROM cold_storage_facilities WHERE id=?", (facility_id,)
        ).fetchone()
        if not facility:
            raise ValueError(f"Facility {facility_id} not found.")
        if facility["available_mt"] < quantity_mt:
            raise ValueError(
                f"Only {facility['available_mt']} MT available; "
                f"you requested {quantity_mt} MT."
            )
        estimated_cost = round(quantity_mt * duration_days * facility["rate_per_mt_per_day"], 2)
        conn.execute(
            "UPDATE cold_storage_facilities SET available_mt = available_mt - ? WHERE id=?",
            (quantity_mt, facility_id)
        )
        conn.execute("""
            INSERT INTO cold_storage_bookings
            (id, facility_id, farmer_name, phone, village, panchayat,
             crop, quantity_mt, duration_days, booked_at, status, token, estimated_cost)
            VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)
        """, (booking_id, facility_id, farmer_name, phone, village, panchayat,
              crop, quantity_mt, duration_days, booked_at, token, estimated_cost))
        conn.commit()
        updated = conn.execute(
            "SELECT available_mt FROM cold_storage_facilities WHERE id=?", (facility_id,)
        ).fetchone()

    sms_text = (
        f"FinGrow Cold Storage Booking Confirmed!\n"
        f"Booking: {booking_id} | Token: {token}\n"
        f"Facility: {facility['name']}\n"
        f"Crop: {crop} | Qty: {quantity_mt} MT | {duration_days} days\n"
        f"Est. Cost: Rs.{estimated_cost:,.0f}\n"
        f"Contact: {facility['contact']}"
    )
    return {
        "booking_id": booking_id,
        "token": token,
        "facility_name": facility["name"],
        "district": facility["district"],
        "state": facility["state"],
        "contact": facility["contact"],
        "crop": crop,
        "quantity_mt": quantity_mt,
        "duration_days": duration_days,
        "estimated_cost_inr": estimated_cost,
        "remaining_space_mt": updated["available_mt"] if updated else None,
        "booked_at": booked_at,
        "sms_confirmation": sms_text,
    }
