import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function searchFacilities(district = '', state = '', minSpace = 0) {
  try {
    const res = await fetch(`${API_BASE}/cold-storage/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district, state, min_space_mt: minSpace }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { facilities: SAMPLE_FACILITIES, count: SAMPLE_FACILITIES.length };
}

async function bookFacility(payload) {
  try {
    const res = await fetch(`${API_BASE}/cold-storage/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    throw new Error(err.detail || 'Booking failed');
  } catch (e) {
    throw e;
  }
}

const SAMPLE_FACILITIES = [
  { id: 1, name: 'Lasalgaon APMC Onion Chamber', district: 'Nashik', state: 'Maharashtra', capacity_mt: 400, available_mt: 60, rate_per_mt_per_day: 3.0, min_temp_c: 10, contact: '+91-9876500003' },
  { id: 2, name: 'Agra Cold Storage Unit 1', district: 'Agra', state: 'Uttar Pradesh', capacity_mt: 500, available_mt: 180, rate_per_mt_per_day: 2.5, min_temp_c: 2, contact: '+91-9876500001' },
  { id: 3, name: 'Kolar Tomato Cold Unit', district: 'Kolar', state: 'Karnataka', capacity_mt: 150, available_mt: 30, rate_per_mt_per_day: 5.0, min_temp_c: 4, contact: '+91-9876500006' },
  { id: 4, name: 'Indore Soybean Cold Hub', district: 'Indore', state: 'Madhya Pradesh', capacity_mt: 600, available_mt: 250, rate_per_mt_per_day: 2.0, min_temp_c: 8, contact: '+91-9876500005' },
  { id: 5, name: 'Nalanda Potato Locker Hub', district: 'Nalanda', state: 'Bihar', capacity_mt: 300, available_mt: 90, rate_per_mt_per_day: 2.0, min_temp_c: 3, contact: '+91-9876500002' },
];

function CapacityBar({ available, capacity }) {
  const usedPct = Math.round(((capacity - available) / capacity) * 100);
  const avlPct = 100 - usedPct;
  const color = avlPct > 50 ? 'bg-primary' : avlPct > 20 ? 'bg-tertiary' : 'bg-error';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
        <span>{available} MT free</span>
        <span>{capacity} MT total</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${avlPct}%` }} />
      </div>
    </div>
  );
}

export default function ColdStorageTracker() {
  const { t } = useTranslation();
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [facilities, setFacilities] = useState(SAMPLE_FACILITIES);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  const [bookingForm, setBookingForm] = useState({ farmer_name: '', phone: '', village: '', panchayat: '', crop: '', quantity_mt: '', duration_days: '' });
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const data = await searchFacilities(district, state, 0);
    setFacilities(data.facilities || SAMPLE_FACILITIES);
    setLoading(false);
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError('');
    try {
      const result = await bookFacility({
        facility_id: booking.id,
        ...bookingForm,
        quantity_mt: parseFloat(bookingForm.quantity_mt),
        duration_days: parseInt(bookingForm.duration_days, 10),
      });
      setBookingResult(result);
    } catch (err) {
      setBookingError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">ac_unit</span>
          Cold Storage Locker Hub
        </h2>
        <p className="text-on-surface-variant mt-1">
          Find available cold storage near you — prevent distress sales from perishable produce rotting in the heat.
        </p>
      </div>

      {/* Search bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <input
          className="flex-1 px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright text-on-surface"
          placeholder="District (e.g. Nashik, Agra, Kolar)"
          value={district}
          onChange={e => setDistrict(e.target.value)}
        />
        <input
          className="flex-1 px-4 py-3 rounded-xl border border-outline-variant bg-surface-bright text-on-surface"
          placeholder="State (e.g. Maharashtra, UP)"
          value={state}
          onChange={e => setState(e.target.value)}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Facility cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facilities.map(f => (
          <div key={f.id} className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-variant hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-on-surface">{f.name}</h3>
                <p className="text-sm text-on-surface-variant">{f.district}, {f.state}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${f.available_mt > 100 ? 'bg-primary/10 text-primary' : f.available_mt > 30 ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>
                {f.available_mt > 100 ? 'Available' : f.available_mt > 30 ? 'Limited' : 'Almost Full'}
              </span>
            </div>
            <CapacityBar available={f.available_mt} capacity={f.capacity_mt} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-surface-container p-2 rounded-lg">
                <div className="text-on-surface-variant text-xs">Rate</div>
                <div className="font-semibold text-on-surface">₹{f.rate_per_mt_per_day}/MT/day</div>
              </div>
              <div className="bg-surface-container p-2 rounded-lg">
                <div className="text-on-surface-variant text-xs">Min Temp</div>
                <div className="font-semibold text-on-surface">{f.min_temp_c}°C</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <a href={`tel:${f.contact}`} className="text-primary text-sm font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">call</span>
                {f.contact}
              </a>
              <button
                onClick={() => { setBooking(f); setBookingResult(null); setBookingError(''); }}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Book Space
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {booking && !bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-on-surface mb-1">Book Cold Storage</h3>
            <p className="text-sm text-on-surface-variant mb-4">{booking.name} · {booking.district}</p>
            {bookingError && <div className="mb-3 p-3 rounded-xl bg-error/10 text-error text-sm">{bookingError}</div>}
            <form onSubmit={handleBook} className="space-y-3">
              {[
                { key: 'farmer_name', label: 'Your Name', placeholder: 'e.g. Ramesh Kumar' },
                { key: 'phone', label: 'Mobile Number', placeholder: '+91 XXXXX XXXXX' },
                { key: 'village', label: 'Village', placeholder: 'Village name' },
                { key: 'panchayat', label: 'Panchayat', placeholder: 'Gram Panchayat name' },
                { key: 'crop', label: 'Crop / Produce', placeholder: 'e.g. Onion, Potato, Tomato' },
                { key: 'quantity_mt', label: 'Quantity (MT)', placeholder: 'e.g. 5', type: 'number' },
                { key: 'duration_days', label: 'Duration (Days)', placeholder: 'e.g. 30', type: 'number' },
              ].map(({ key, label, placeholder, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-on-surface mb-1">{label}</label>
                  <input
                    type={type}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm"
                    placeholder={placeholder}
                    value={bookingForm[key]}
                    onChange={e => setBookingForm(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setBooking(null)} className="flex-1 py-2 rounded-xl border border-outline-variant text-on-surface text-sm">Cancel</button>
                <button type="submit" disabled={bookingLoading} className="flex-1 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm">
                  {bookingLoading ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Confirmation */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
              <h3 className="text-lg font-bold text-on-surface mt-2">Booking Confirmed!</h3>
            </div>
            <div className="bg-primary/10 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant">Booking ID:</span><span className="font-bold text-on-surface">{bookingResult.booking_id}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Token:</span><span className="font-bold text-on-surface text-primary">{bookingResult.token}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Facility:</span><span className="font-semibold text-on-surface">{bookingResult.facility_name}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Est. Cost:</span><span className="font-bold text-on-surface">₹{bookingResult.estimated_cost_inr?.toLocaleString('en-IN')}</span></div>
            </div>
            <p className="text-xs text-on-surface-variant mt-3 text-center">Share this booking ID & token at the facility gate.</p>
            <button onClick={() => { setBooking(null); setBookingResult(null); }} className="w-full mt-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
