"""Tests for cold storage facility search and locker booking."""
import pytest
from app.core.cold_storage import search_facilities, reserve_space, SEED_FACILITIES


def test_search_returns_all_when_no_filter(tmp_path):
    db_path = str(tmp_path / "cold.db")
    results = search_facilities(db_path)
    assert len(results) == len(SEED_FACILITIES)


def test_search_by_state(tmp_path):
    db_path = str(tmp_path / "cold.db")
    results = search_facilities(db_path, state="Maharashtra")
    assert all("Maharashtra" in r["state"] for r in results)
    assert len(results) >= 1


def test_search_by_district(tmp_path):
    db_path = str(tmp_path / "cold.db")
    results = search_facilities(db_path, district="Nashik")
    assert len(results) >= 1
    assert all("Nashik" in r["district"] for r in results)


def test_search_min_space_filter(tmp_path):
    db_path = str(tmp_path / "cold.db")
    results = search_facilities(db_path, min_space_mt=200)
    assert all(r["available_mt"] >= 200 for r in results)


def test_reserve_space_successful(tmp_path):
    db_path = str(tmp_path / "cold.db")
    search_facilities(db_path)
    result = reserve_space(
        db_path, facility_id=1,
        farmer_name="Ramesh Kumar", phone="+91-9876543210",
        village="Niphad", panchayat="Niphad GP",
        crop="Onion", quantity_mt=5.0, duration_days=30
    )
    assert "booking_id" in result
    assert "token" in result
    assert len(result["token"]) == 6
    assert result["estimated_cost_inr"] > 0
    assert "sms_confirmation" in result


def test_reserve_reduces_available_space(tmp_path):
    db_path = str(tmp_path / "cold.db")
    search_facilities(db_path)
    facs_before = {f["id"]: f["available_mt"] for f in search_facilities(db_path)}
    before = facs_before[1]
    reserve_space(db_path, facility_id=1, farmer_name="Test", phone="0000000000",
                  village="V", panchayat="P", crop="Onion",
                  quantity_mt=10.0, duration_days=10)
    facs_after = {f["id"]: f["available_mt"] for f in search_facilities(db_path)}
    after = facs_after[1]
    assert after == before - 10.0


def test_reserve_raises_on_overflow(tmp_path):
    db_path = str(tmp_path / "cold.db")
    search_facilities(db_path)
    with pytest.raises(ValueError, match="available"):
        reserve_space(db_path, facility_id=1, farmer_name="X", phone="0",
                      village="V", panchayat="P", crop="Tomato",
                      quantity_mt=99999.0, duration_days=1)


def test_reserve_raises_on_invalid_facility(tmp_path):
    db_path = str(tmp_path / "cold.db")
    search_facilities(db_path)
    with pytest.raises(ValueError, match="not found"):
        reserve_space(db_path, facility_id=9999, farmer_name="X", phone="0",
                      village="V", panchayat="P", crop="Potato",
                      quantity_mt=1.0, duration_days=1)
