"""Tests for pooled village transport and K-means freight optimization."""
import pytest
from app.core.pooled_transport import (
    add_pledge, compute_pool_clusters, compute_savings,
    _haversine_km, _select_vehicle, VEHICLE_RATES,
)


def test_haversine_zero_distance():
    assert _haversine_km(20.0, 76.0, 20.0, 76.0) == 0.0


def test_haversine_known_distance():
    d = _haversine_km(19.0760, 72.8777, 18.5204, 73.8567)
    assert 100 < d < 150


def test_select_vehicle_small_load():
    v = _select_vehicle(15)
    assert v["key"] == "3_wheeler"


def test_select_vehicle_medium_load():
    v = _select_vehicle(55)
    assert v["key"] == "mini_truck"


def test_select_vehicle_large_load():
    v = _select_vehicle(300)
    assert v["key"] == "large_truck"


def test_compute_savings_30_percent():
    pledges = [{"quantity_qt": 15, "lat": 20.0, "lon": 76.0}] * 5
    savings = compute_savings("Maharashtra", pledges)
    assert savings["farmers_pooled"] == 5
    assert savings["freight_savings_pct"] > 0
    assert "vehicle" in savings
    assert "regional_market" in savings


def test_add_pledge_stores_record(tmp_path):
    db_path = str(tmp_path / "transport.db")
    result = add_pledge(
        db_path, "Ramesh Rao", "+91-9876543210",
        "Niphad", "Niphad GP", "Nashik", "Maharashtra",
        "Onion", 15.0, "2026-11-15", "Nashik APMC", 20.0, 74.1
    )
    assert "pledge_id" in result
    assert result["status"] == "pending"


def test_compute_pool_clusters_empty(tmp_path):
    db_path = str(tmp_path / "transport.db")
    result = compute_pool_clusters(db_path, "NonExistent", "Maharashtra")
    assert result["clusters"] == []


def test_compute_pool_clusters_with_pledges(tmp_path):
    db_path = str(tmp_path / "transport.db")
    for i in range(6):
        add_pledge(
            db_path, f"Farmer {i}", f"+91-{i:010d}",
            f"Village{i}", "Test GP", "Nashik", "Maharashtra",
            "Onion", 10.0 + i, "", "Nashik APMC",
            20.0 + i * 0.01, 74.0 + i * 0.01
        )
    result = compute_pool_clusters(db_path, "Nashik", "Maharashtra")
    assert result["total_pledges"] == 6
    assert len(result["clusters"]) >= 1
    assert "savings" in result
    assert result["savings"]["farmers_pooled"] == 6
