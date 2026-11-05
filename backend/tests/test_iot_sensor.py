"""Tests for IoT sensor telemetry ingestion and farmworker health alerts."""
import pytest
from app.core.iot_sensor import (
    SensorReading, heat_index, farmworker_health_alert, ingest_telemetry, latest_readings,
    HEAT_INDEX_CAUTION, HEAT_INDEX_WARNING, HEAT_INDEX_DANGER,
    PM25_MODERATE, PM25_UNHEALTHY, RAIN_OPEN_YARD_ALERT,
)


def make_reading(**kwargs):
    defaults = dict(
        node_id="NODE-001", village="Niphad", panchayat="Niphad GP",
        district="Nashik", state="Maharashtra",
        temperature_c=35.0, relative_humidity_pct=70.0,
        rain_mm_per_hour=0.0, pm25_ug_m3=0.0,
    )
    defaults.update(kwargs)
    return SensorReading(**defaults)


def test_heat_index_cool_conditions():
    hi = heat_index(25.0, 60.0)
    assert hi == 25.0


def test_heat_index_hot_humid():
    hi = heat_index(40.0, 80.0)
    assert hi > 40.0, "Heat index should exceed air temperature in hot humid conditions"


def test_heatstroke_danger_alert():
    reading = make_reading(temperature_c=44.0, relative_humidity_pct=85.0)
    result = farmworker_health_alert(reading)
    assert result["highest_severity"] == "critical"
    types = [a["type"] for a in result["alerts"]]
    assert "heatstroke" in types


def test_heat_warning_alert():
    reading = make_reading(temperature_c=39.0, relative_humidity_pct=75.0)
    result = farmworker_health_alert(reading)
    severities = [a["severity"] for a in result["alerts"]]
    assert "warning" in severities or "critical" in severities


def test_no_alert_cool():
    reading = make_reading(temperature_c=24.0, relative_humidity_pct=50.0)
    result = farmworker_health_alert(reading)
    assert result["highest_severity"] == "none"
    assert result["alert_count"] == 0


def test_smoke_unhealthy_alert():
    reading = make_reading(temperature_c=28.0, relative_humidity_pct=55.0, pm25_ug_m3=180.0)
    result = farmworker_health_alert(reading)
    types = [a["type"] for a in result["alerts"]]
    assert "smoke_unhealthy" in types
    assert result["highest_severity"] == "critical"


def test_smoke_moderate_alert():
    reading = make_reading(temperature_c=28.0, relative_humidity_pct=55.0, pm25_ug_m3=90.0)
    result = farmworker_health_alert(reading)
    types = [a["type"] for a in result["alerts"]]
    assert "smoke_moderate" in types


def test_open_yard_rain_alert():
    reading = make_reading(temperature_c=30.0, relative_humidity_pct=80.0, rain_mm_per_hour=5.0)
    result = farmworker_health_alert(reading)
    types = [a["type"] for a in result["alerts"]]
    assert "open_yard_rain" in types
    assert result["highest_severity"] == "critical"


def test_multiple_alerts_combined():
    reading = make_reading(temperature_c=43.0, relative_humidity_pct=85.0, rain_mm_per_hour=10.0)
    result = farmworker_health_alert(reading)
    assert result["alert_count"] >= 2
    assert result["highest_severity"] == "critical"


def test_ingest_telemetry_stores_and_returns(tmp_path):
    db_path = str(tmp_path / "iot_test.db")
    reading = make_reading(temperature_c=42.0, relative_humidity_pct=80.0, pm25_ug_m3=170.0)
    result = ingest_telemetry(db_path, reading)
    assert "alerts" in result
    assert result["node_id"] == "NODE-001"
    rows = latest_readings(db_path, "Nashik", limit=5)
    assert len(rows) == 1
    assert rows[0]["node_id"] == "NODE-001"


def test_latest_readings_empty_district(tmp_path):
    db_path = str(tmp_path / "iot_empty.db")
    rows = latest_readings(db_path, "NonExistentDistrict")
    assert rows == []
