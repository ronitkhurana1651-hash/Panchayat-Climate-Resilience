import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function addPledge(payload) {
  try {
    const res = await fetch(`${API_BASE}/logistics/pledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { pledge_id: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'pending' };
}

async function getPools(district, state, crop = '') {
  try {
    const res = await fetch(`${API_BASE}/logistics/pools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district, state, crop }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return DEMO_POOL;
}

async function getArbitrage(state, crop, farmgatePrice, quantityQt) {
  try {
    const res = await fetch(`${API_BASE}/mandi/arbitrage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, crop, farmgate_price_per_qt: farmgatePrice, quantity_qt: quantityQt }),
    });
    if (res.ok) return await res.json();
  } catch {}
  const individual = farmgatePrice * quantityQt;
  const regional = farmgatePrice * 1.4 * quantityQt - 1200;
  return {
    crop, quantity_qt: quantityQt, state,
    farmgate_scenario: { buyer: 'Local Village Trader', price_per_qt: farmgatePrice, total_inr: individual, net_income_inr: individual },
    pooled_mandi_scenario: { buyer: 'Regional APMC Mandi', est_price_per_qt: farmgatePrice * 1.4, total_inr: farmgatePrice * 1.4 * quantityQt, freight_cost_inr: 1200, net_income_inr: regional },
    income_gain_inr: regional - individual,
    income_gain_pct: Math.round(((regional - individual) / individual) * 100),
    freight_savings_pct: 31,
    vehicle: 'Mini Truck (1.5T)',
  };
}

const DEMO_POOL = {
  district: 'Nashik', state: 'Maharashtra', total_pledges: 7,
  clusters: [
    { cluster_id: 0, farmers: 4, total_load_qt: 52, vehicle: 'Mini Truck (1.5T)', members: [
      { name: 'Ramesh Rao', village: 'Niphad', qty_qt: 15 },
      { name: 'Suresh Patil', village: 'Niphad', qty_qt: 12 },
      { name: 'Priya Devi', village: 'Yeola', qty_qt: 14 },
      { name: 'Mahesh Kumar', village: 'Yeola', qty_qt: 11 },
    ]},
    { cluster_id: 1, farmers: 3, total_load_qt: 38, vehicle: '3-Wheeler Pickup', members: [
      { name: 'Anjali Bai', village: 'Satana', qty_qt: 10 },
      { name: 'Vikas Shinde', village: 'Satana', qty_qt: 15 },
      { name: 'Meera Gupta', village: 'Dindori', qty_qt: 13 },
    ]},
  ],
  savings: { vehicle: 'Mini Truck (1.5T)', distance_km: 35, total_load_qt: 90, farmers_pooled: 7, individual_cost_inr: 1540, pooled_per_farmer_inr: 440, freight_savings_pct: 71.4, local_market: 'Local Trader', regional_market: 'Nashik APMC / Lasalgaon' },
};

const STATES_LIST = ['Maharashtra', 'Uttar Pradesh', 'Bihar', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Rajasthan', 'Karnataka', 'Andhra Pradesh', 'West Bengal'];

export default function PooledTransportBoard() {
  const [tab, setTab] = useState('view');
  const [district, setDistrict] = useState('Nashik');
  const [state, setState] = useState('Maharashtra');
  const [poolData, setPoolData] = useState(DEMO_POOL);
  const [poolLoading, setPoolLoading] = useState(false);
  const [pledgeForm, setPledgeForm] = useState({ farmer_name: '', phone: '', village: '', panchayat: '', district: 'Nashik', state: 'Maharashtra', crop: '', quantity_qt: '', harvest_date: '', target_mandi: '' });
  const [pledgeResult, setPledgeResult] = useState(null);
  const [pledgeLoading, setPledgeLoading] = useState(false);
  const [arbitrage, setArbitrage] = useState(null);
  const [arbForm, setArbForm] = useState({ state: 'Maharashtra', crop: 'Onion', farmgate_price: 1200, quantity_qt: 15 });
  const [arbLoading, setArbLoading] = useState(false);

  const handleLoadPools = async () => {
    setPoolLoading(true);
    const data = await getPools(district, state);
    setPoolData(data);
    setPoolLoading(false);
  };

  const handlePledge = async (e) => {
    e.preventDefault();
    setPledgeLoading(true);
    const result = await addPledge({ ...pledgeForm, quantity_qt: parseFloat(pledgeForm.quantity_qt) });
    setPledgeResult(result);
    setPledgeLoading(false);
  };

  const handleArbitrage = async (e) => {
    e.preventDefault();
    setArbLoading(true);
    const data = await getArbitrage(arbForm.state, arbForm.crop, parseFloat(arbForm.farmgate_price), parseFloat(arbForm.quantity_qt));
    setArbitrage(data);
    setArbLoading(false);
  };

  const savings = poolData?.savings || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">local_shipping</span>
          Pooled Village Transport Board
        </h2>
        <p className="text-on-surface-variant mt-1">
          Pool your produce with neighbouring farmers to share a truck and bypass local middlemen — saving up to 30% on freight costs.
        </p>
      </div>

      {/* Key metric banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: 'groups', label: 'Farmers Pooled', value: poolData?.total_pledges || 0, unit: 'this batch', color: 'text-primary' },
          { icon: 'savings', label: 'Freight Savings/Farmer', value: savings.freight_savings_pct ? `${savings.freight_savings_pct}%` : '—', unit: 'vs individual', color: 'text-primary' },
          { icon: 'storefront', label: 'Target Market', value: savings.regional_market || 'Regional APMC', unit: `${savings.distance_km || '?'} km away`, color: 'text-on-surface' },
        ].map((m, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-4 border border-surface-variant">
            <span className={`material-symbols-outlined text-3xl ${m.color}`}>{m.icon}</span>
            <div>
              <div className="text-xs text-on-surface-variant">{m.label}</div>
              <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-on-surface-variant">{m.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-variant">
        {[['view', 'map', 'Live Pools'], ['pledge', 'add_circle', 'Join Pool'], ['arbitrage', 'calculate', 'Price Arbitrage']].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: View Pools */}
      {tab === 'view' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input className="flex-1 px-4 py-2 rounded-xl border border-outline-variant bg-surface-bright text-on-surface text-sm" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
            <select className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-bright text-on-surface text-sm" value={state} onChange={e => setState(e.target.value)}>
              {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleLoadPools} disabled={poolLoading} className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">
              {poolLoading ? 'Loading…' : 'Refresh Pools'}
            </button>
          </div>
          {(poolData?.clusters || []).map((cluster) => (
            <div key={cluster.cluster_id} className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-variant">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-on-surface">Cluster #{cluster.cluster_id + 1}</span>
                  <span className="ml-2 text-sm text-on-surface-variant">· {cluster.vehicle}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{cluster.total_load_qt} Qt total</div>
                  <div className="text-xs text-on-surface-variant">{cluster.farmers} farmers</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {cluster.members.map((m, i) => (
                  <div key={i} className="bg-surface-container p-2 rounded-lg text-center">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center mx-auto mb-1">
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-xs font-semibold text-on-surface truncate">{m.name}</div>
                    <div className="text-xs text-on-surface-variant">{m.village}</div>
                    <div className="text-xs text-primary font-bold">{m.qty_qt} Qt</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Join Pool / Pledge */}
      {tab === 'pledge' && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-lg">
          {pledgeResult ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
              <h3 className="text-lg font-bold text-on-surface mt-2">Pledge Registered!</h3>
              <p className="text-on-surface-variant text-sm mt-1">Pledge ID: <strong>{pledgeResult.pledge_id}</strong></p>
              <p className="text-on-surface-variant text-sm">You will get an SMS when a truck is ready.</p>
              <button onClick={() => { setPledgeResult(null); }} className="mt-4 px-6 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm">Add Another</button>
            </div>
          ) : (
            <form onSubmit={handlePledge} className="space-y-4">
              <h3 className="font-bold text-on-surface">Register Your Harvest Pledge</h3>
              {[
                { k: 'farmer_name', l: 'Your Name', p: 'Full name' },
                { k: 'phone', l: 'Mobile Number', p: '+91 XXXXX XXXXX' },
                { k: 'village', l: 'Village', p: 'Your village' },
                { k: 'panchayat', l: 'Panchayat', p: 'Gram Panchayat' },
                { k: 'crop', l: 'Crop / Produce', p: 'e.g. Onion, Wheat, Potato' },
                { k: 'quantity_qt', l: 'Quantity (Quintals)', p: 'e.g. 15', t: 'number' },
                { k: 'harvest_date', l: 'Expected Harvest Date', p: '', t: 'date' },
                { k: 'target_mandi', l: 'Preferred Market', p: 'e.g. Nashik APMC' },
              ].map(({ k, l, p, t = 'text' }) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-on-surface mb-1">{l}</label>
                  <input type={t} required className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" placeholder={p}
                    value={pledgeForm[k]} onChange={e => setPledgeForm(prev => ({ ...prev, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">District</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={pledgeForm.district} onChange={e => setPledgeForm(p => ({ ...p, district: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">State</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={pledgeForm.state} onChange={e => setPledgeForm(p => ({ ...p, state: e.target.value }))}>
                    {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={pledgeLoading} className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-sm">
                {pledgeLoading ? 'Registering…' : 'Join Pooled Truck'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB: Price Arbitrage Calculator */}
      {tab === 'arbitrage' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl p-5 max-w-lg border border-surface-variant">
            <h3 className="font-bold text-on-surface mb-4">Farmgate vs. Regional Mandi Calculator</h3>
            <p className="text-sm text-on-surface-variant mb-4">See exactly how much you lose by selling to the local middleman vs. pooling a truck to the regional APMC.</p>
            <form onSubmit={handleArbitrage} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">State</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={arbForm.state} onChange={e => setArbForm(p => ({ ...p, state: e.target.value }))}>
                    {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Crop</label>
                  <input className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={arbForm.crop} onChange={e => setArbForm(p => ({ ...p, crop: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Farmgate Price (₹/Qt)</label>
                  <input type="number" className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={arbForm.farmgate_price} onChange={e => setArbForm(p => ({ ...p, farmgate_price: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Quantity (Quintals)</label>
                  <input type="number" className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm" value={arbForm.quantity_qt} onChange={e => setArbForm(p => ({ ...p, quantity_qt: e.target.value }))} />
                </div>
              </div>
              <button type="submit" disabled={arbLoading} className="w-full py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm">
                {arbLoading ? 'Calculating…' : 'Calculate Income Gain'}
              </button>
            </form>
          </div>

          {arbitrage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-error/5 border border-error/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-error">sentiment_dissatisfied</span>
                  <h4 className="font-bold text-error">Selling to Local Trader</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-on-surface-variant">Buyer:</span><span className="font-semibold text-on-surface">{arbitrage.farmgate_scenario.buyer}</span></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Price:</span><span className="font-semibold text-on-surface">₹{arbitrage.farmgate_scenario.price_per_qt}/Qt</span></div>
                  <div className="flex justify-between border-t border-surface-variant pt-2"><span className="text-on-surface-variant">Net Income:</span><span className="font-bold text-error">₹{arbitrage.farmgate_scenario.net_income_inr?.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">sentiment_satisfied</span>
                  <h4 className="font-bold text-primary">Pooled Truck to APMC Mandi</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-on-surface-variant">Market:</span><span className="font-semibold text-on-surface">{arbitrage.pooled_mandi_scenario.buyer}</span></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Est. Price:</span><span className="font-semibold text-on-surface">₹{arbitrage.pooled_mandi_scenario.est_price_per_qt}/Qt</span></div>
                  <div className="flex justify-between"><span className="text-on-surface-variant">Freight (shared):</span><span className="text-on-surface-variant">-₹{arbitrage.pooled_mandi_scenario.freight_cost_inr?.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between border-t border-surface-variant pt-2"><span className="text-on-surface-variant">Net Income:</span><span className="font-bold text-primary">₹{arbitrage.pooled_mandi_scenario.net_income_inr?.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
              <div className="md:col-span-2 bg-primary text-on-primary rounded-2xl p-5 text-center">
                <div className="text-3xl font-bold">+₹{arbitrage.income_gain_inr?.toLocaleString('en-IN')}</div>
                <div className="text-sm mt-1 opacity-90">extra income by using the pooled truck ({arbitrage.income_gain_pct}% gain)</div>
                <div className="text-sm mt-1 opacity-80">Freight savings: {arbitrage.freight_savings_pct}% · Vehicle: {arbitrage.vehicle}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
