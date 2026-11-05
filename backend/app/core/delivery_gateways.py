"""
Multi-Channel Zero-Barrier Delivery Gateway
=============================================
Implements the core accessibility promise of the SEVA FIRST proposal:
deliver climate, market, cold-storage, and logistics information through
channels that work on BASIC FEATURE PHONES with no app download needed.

Channels:
  1. WhatsApp Bot webhook handler (Twilio / Meta Cloud API compatible)
  2. IVR Voice telephony request handler (PSTN / cellular)
  3. SMS push formatter (plain text, < 160 chars per segment)
  4. Asynchronous message queue for < 2G network resilience (up to 5000ms dropout)

MENU (multilingual):
  1 → Local micro-weather & farmworker heat alert
  2 → Today's mandi prices & nearest high-paying market
  3 → Nearest cold storage space (with booking option)
  4 → Join / check pooled village truck for my crop
  0 → Speak to voice assistant (IVR)
"""

import logging
import queue
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Multilingual menu strings — English + Hindi + Marathi
MENU_STRINGS = {
    "en": (
        "FinGrow Panchayat Services:\n"
        "1 - Weather & Worker Safety Alert\n"
        "2 - Mandi Prices & Best Market\n"
        "3 - Cold Storage Space Near You\n"
        "4 - Join Pooled Village Truck\n"
        "0 - Voice Assistant\n"
        "Reply with number."
    ),
    "hi": (
        "फिनग्रो पंचायत सेवाएं:\n"
        "1 - मौसम और मजदूर सुरक्षा\n"
        "2 - मंडी भाव और बेहतर बाजार\n"
        "3 - पास का कोल्ड स्टोरेज\n"
        "4 - गांव का साझा ट्रक\n"
        "0 - आवाज़ सहायक\n"
        "नंबर भेजें।"
    ),
    "mr": (
        "फिनग्रो ग्रामपंचायत सेवा:\n"
        "1 - हवामान व कामगार सुरक्षा\n"
        "2 - मंडी भाव व चांगली बाजारपेठ\n"
        "3 - जवळचे शीतगृह\n"
        "4 - गावाचा सामूहिक ट्रक\n"
        "0 - आवाज सहाय्यक\n"
        "क्रमांक पाठवा।"
    ),
}


@dataclass
class InboundMessage:
    """Normalised inbound message from any channel (WhatsApp / SMS / IVR)."""
    channel: str          # 'whatsapp' | 'sms' | 'ivr'
    sender_phone: str
    body: str
    language: str = "en"
    received_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    media_url: Optional[str] = None   # For WhatsApp voice notes


@dataclass
class OutboundMessage:
    """Formatted reply ready for delivery through the originating channel."""
    channel: str
    recipient_phone: str
    body: str
    language: str = "en"
    is_voice: bool = False   # TTS synthesis needed for IVR
    priority: int = 1        # 1=normal, 0=critical (weather/heat alerts)


# ---------------------------------------------------------------------------
# Async queue for <2G network resilience
# Up to 5000ms dropout tolerance: messages are queued and retried.
# ---------------------------------------------------------------------------

class AsyncMessageQueue:
    """
    Lightweight in-process queue simulating MQTT offline-first behaviour.
    In production this would be backed by an MQTT broker or Redis stream.
    Critical alerts (priority=0) are retried up to 3× with 1500ms back-off.
    """
    def __init__(self):
        self._queue: queue.PriorityQueue = queue.PriorityQueue()
        self._worker = threading.Thread(target=self._process_loop, daemon=True)
        self._handlers: List[Callable[[OutboundMessage], None]] = []
        self._running = False

    def register_handler(self, fn: Callable[[OutboundMessage], None]) -> None:
        self._handlers.append(fn)

    def enqueue(self, msg: OutboundMessage) -> None:
        """Enqueue message; priority 0 goes first."""
        self._queue.put((msg.priority, time.time(), msg))
        if not self._running:
            self._running = True
            self._worker.start()

    def _process_loop(self) -> None:
        while True:
            try:
                _, _, msg = self._queue.get(timeout=1)
                retries = 3 if msg.priority == 0 else 1
                for attempt in range(retries):
                    try:
                        for handler in self._handlers:
                            handler(msg)
                        break
                    except Exception as exc:
                        logger.warning(
                            "Delivery attempt %d failed for %s: %s",
                            attempt + 1, msg.recipient_phone, exc
                        )
                        if attempt < retries - 1:
                            time.sleep(1.5)   # 1500ms back-off (< 5000ms dropout tolerance)
                self._queue.task_done()
            except queue.Empty:
                continue

# Singleton queue shared across all gateway calls
_mq = AsyncMessageQueue()


def _log_delivery(msg: OutboundMessage) -> None:
    """Default handler — logs the outbound message (replace with real Twilio/Meta call)."""
    logger.info(
        "[%s→%s] %s", msg.channel.upper(), msg.recipient_phone,
        msg.body[:80] + "..." if len(msg.body) > 80 else msg.body
    )


_mq.register_handler(_log_delivery)


# ---------------------------------------------------------------------------
# Menu router
# ---------------------------------------------------------------------------

def _route_menu_choice(body: str, lang: str, context: Dict[str, Any]) -> str:
    """Map inbound user choice to a reply message."""
    choice = body.strip()

    if choice == "1":
        alert = context.get("weather_alert", {})
        hi = alert.get("heat_index_c", "N/A")
        rain = alert.get("rain_mm_per_hour", 0)
        alerts = alert.get("alerts", [])
        if alerts:
            top = alerts[0]
            return f"[{top['severity'].upper()}] {top['title']}\n{top['body']}"
        return f"Weather OK. Heat index: {hi}°C, Rain: {rain}mm/h. No active alerts."

    if choice == "2":
        prices = context.get("mandi_prices", [])
        if not prices:
            return "Mandi prices not available right now. Try again in a few minutes."
        lines = ["Today's Mandi Prices (per quintal):"]
        for p in prices[:5]:
            lines.append(f"  {p.get('name','?')}: Rs.{p.get('price','?')} at {p.get('mandi','?')}")
        return "\n".join(lines)

    if choice == "3":
        storage = context.get("cold_storage", [])
        if not storage:
            return "No cold storage facilities found in your area. Contact district agriculture office."
        f = storage[0]
        return (
            f"Nearest Cold Storage:\n"
            f"{f.get('name')}\n"
            f"Available: {f.get('available_mt')} MT\n"
            f"Rate: Rs.{f.get('rate_per_mt_per_day')}/MT/day\n"
            f"Contact: {f.get('contact')}\n"
            f"Reply '3B' to book."
        )

    if choice == "4":
        pools = context.get("transport_pools", {})
        savings = pools.get("savings", {})
        n = pools.get("total_pledges", 0)
        return (
            f"Village Pooled Truck:\n"
            f"Farmers joined: {n}\n"
            f"Vehicle: {savings.get('vehicle','TBD')}\n"
            f"Each pays: Rs.{savings.get('pooled_per_farmer_inr','?')}\n"
            f"You save vs. individual: {savings.get('freight_savings_pct','?')}%\n"
            f"Market: {savings.get('regional_market','Regional APMC')}\n"
            f"Reply '4J' to join."
        )

    return MENU_STRINGS.get(lang, MENU_STRINGS["en"])


# ---------------------------------------------------------------------------
# Public handlers
# ---------------------------------------------------------------------------

def handle_whatsapp_webhook(payload: Dict[str, Any],
                            context: Dict[str, Any]) -> OutboundMessage:
    """
    Process an inbound WhatsApp message and return an OutboundMessage reply.
    Compatible with Twilio / Meta Cloud API webhook payload structure.
    """
    sender = payload.get("From", payload.get("from", "unknown"))
    body = payload.get("Body", payload.get("body", "")).strip()
    lang = payload.get("lang", "en")

    if not body or body in ("Hi", "Hello", "START", "hi", "hello"):
        reply_body = MENU_STRINGS.get(lang, MENU_STRINGS["en"])
    else:
        reply_body = _route_menu_choice(body, lang, context)

    out = OutboundMessage(
        channel="whatsapp",
        recipient_phone=sender,
        body=reply_body,
        language=lang,
        priority=0 if "ALERT" in reply_body.upper() or "[CRITICAL]" in reply_body else 1,
    )
    _mq.enqueue(out)
    return out


def handle_ivr_request(payload: Dict[str, Any],
                       context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle an IVR PSTN voice call.
    Returns TwiML-style dict for voice synthesis:
      { "say": "<text to speak>", "gather": True, "language": "hi-IN" }
    """
    digit = payload.get("Digits", payload.get("digit", "")).strip()
    lang = payload.get("lang", "hi")
    lang_code = {"en": "en-IN", "hi": "hi-IN", "mr": "mr-IN"}.get(lang, "hi-IN")

    if not digit:
        welcome = (
            "Namaste! FinGrow Panchayat Seva mein aapka swagat hai. "
            "Mausam ke liye 1 dabayein, Mandi bhav ke liye 2 dabayein, "
            "Cold Storage ke liye 3 dabayein, Truck booking ke liye 4 dabayein."
            if lang == "hi" else
            "Welcome to FinGrow Panchayat Services. "
            "Press 1 for Weather Alert, 2 for Mandi Prices, "
            "3 for Cold Storage, 4 for Pooled Truck."
        )
        return {"say": welcome, "gather": True, "language": lang_code}

    reply_body = _route_menu_choice(digit, lang, context)
    out = OutboundMessage(
        channel="ivr", recipient_phone=payload.get("From", ""),
        body=reply_body, language=lang, is_voice=True,
        priority=0 if "ALERT" in reply_body.upper() else 1,
    )
    _mq.enqueue(out)
    return {"say": reply_body, "gather": False, "language": lang_code}


def format_sms_alert(alert_type: str, data: Dict[str, Any],
                     lang: str = "en") -> str:
    """
    Format a critical alert as a plain-text SMS (< 160 chars per segment).
    Used for push notifications to basic feature phones.
    """
    if alert_type == "weather":
        village = data.get("village", "your village")
        hi = data.get("heat_index_c", "?")
        rain = data.get("rain_mm_per_hour", 0)
        msg = f"FinGrow ALERT {village}: Heat {hi}C"
        if rain >= 2:
            msg += f", Rain {rain}mm/h - Cover drying crops NOW!"
        return msg[:160]

    if alert_type == "mandi":
        crop = data.get("crop", "crop")
        price = data.get("price", "?")
        mandi = data.get("mandi", "mandi")
        return f"FinGrow Mandi: {crop} Rs.{price}/qt at {mandi}. Reply 4 to book truck."[:160]

    if alert_type == "cold_storage":
        name = data.get("name", "storage")
        space = data.get("available_mt", "?")
        contact = data.get("contact", "")
        return f"FinGrow: {name} has {space}MT free. Call {contact} to book."[:160]

    return f"FinGrow Update: {str(data)[:130]}"
