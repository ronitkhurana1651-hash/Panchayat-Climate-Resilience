"""Tests for WhatsApp/IVR/SMS delivery gateway handlers."""
import pytest
from app.core.delivery_gateways import (
    handle_whatsapp_webhook, handle_ivr_request, format_sms_alert,
    MENU_STRINGS, OutboundMessage,
)


def test_whatsapp_greeting_returns_menu():
    payload = {"From": "+919876543210", "Body": "Hi", "lang": "en"}
    out = handle_whatsapp_webhook(payload, {})
    assert isinstance(out, OutboundMessage)
    assert "1" in out.body and "2" in out.body


def test_whatsapp_menu_in_hindi():
    payload = {"From": "+919876543210", "Body": "hello", "lang": "hi"}
    out = handle_whatsapp_webhook(payload, {})
    assert "मंडी" in out.body or "1" in out.body


def test_whatsapp_choice_1_weather():
    context = {"weather_alert": {"heat_index_c": 41.5, "rain_mm_per_hour": 0, "alerts": [
        {"type": "heat_warning", "severity": "warning", "title": "High Heat", "body": "Stay hydrated"}
    ]}}
    payload = {"From": "+919876543210", "Body": "1", "lang": "en"}
    out = handle_whatsapp_webhook(payload, context)
    assert "High Heat" in out.body or "heat" in out.body.lower()


def test_whatsapp_choice_2_mandi():
    context = {"mandi_prices": [
        {"name": "Onion", "price": 2200, "mandi": "Lasalgaon APMC"}
    ]}
    payload = {"From": "+919876543210", "Body": "2", "lang": "en"}
    out = handle_whatsapp_webhook(payload, context)
    assert "Onion" in out.body or "2200" in out.body


def test_whatsapp_choice_3_cold_storage():
    context = {"cold_storage": [
        {"name": "Test Cold Unit", "available_mt": 60, "rate_per_mt_per_day": 3, "contact": "+91-0000"}
    ]}
    payload = {"From": "+919876543210", "Body": "3", "lang": "en"}
    out = handle_whatsapp_webhook(payload, context)
    assert "Test Cold Unit" in out.body or "Cold Storage" in out.body


def test_whatsapp_choice_4_transport():
    context = {"transport_pools": {"total_pledges": 5, "savings": {
        "vehicle": "Mini Truck", "pooled_per_farmer_inr": 400,
        "freight_savings_pct": 65, "regional_market": "Nashik APMC"
    }}}
    payload = {"From": "+919876543210", "Body": "4", "lang": "en"}
    out = handle_whatsapp_webhook(payload, context)
    assert "400" in out.body or "Truck" in out.body or "savings" in out.body.lower()


def test_whatsapp_critical_alert_priority():
    context = {"weather_alert": {"heat_index_c": 44, "rain_mm_per_hour": 5, "alerts": [
        {"type": "heatstroke", "severity": "critical", "title": "HEATSTROKE DANGER", "body": "Stop work now"}
    ]}}
    payload = {"From": "+919876543210", "Body": "1", "lang": "en"}
    out = handle_whatsapp_webhook(payload, context)
    assert out.priority == 0


def test_ivr_welcome_message():
    payload = {"From": "+919876543210", "Digits": "", "lang": "hi"}
    result = handle_ivr_request(payload, {})
    assert "say" in result
    assert "gather" in result
    assert result["gather"] is True


def test_ivr_digit_response():
    payload = {"From": "+919876543210", "Digits": "2", "lang": "en"}
    result = handle_ivr_request(payload, {"mandi_prices": []})
    assert "say" in result
    assert result["gather"] is False


def test_sms_weather_alert_under_160():
    msg = format_sms_alert("weather", {"village": "Niphad", "heat_index_c": 41, "rain_mm_per_hour": 3})
    assert len(msg) <= 160
    assert "FinGrow" in msg


def test_sms_mandi_alert_under_160():
    msg = format_sms_alert("mandi", {"crop": "Onion", "price": 2200, "mandi": "Lasalgaon APMC"})
    assert len(msg) <= 160
    assert "Onion" in msg


def test_sms_cold_storage_alert_under_160():
    msg = format_sms_alert("cold_storage", {"name": "Lasalgaon Chamber", "available_mt": 60, "contact": "+91-9876500003"})
    assert len(msg) <= 160
