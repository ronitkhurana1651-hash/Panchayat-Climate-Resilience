import React, { useState } from 'react';

const MENU = `FinGrow Panchayat Services:
1 - Weather & Worker Safety Alert
2 - Mandi Prices & Best Market
3 - Cold Storage Space Near You
4 - Join Pooled Village Truck
0 - Voice Assistant
Reply with number.`;

const RESPONSES = {
  '1': '[WARNING] High Heat — Limit Outdoor Work\nHeat index 39°C. Avoid heavy outdoor work between 11:00–15:00. Ensure hydration every 20 minutes. Mandatory 10-min rest per hour.',
  '2': 'Today\'s Mandi Prices (per quintal):\n  Onion: ₹2,200 at Lasalgaon APMC\n  Wheat: ₹2,450 at Akola APMC\n  Soybean: ₹4,820 at Nagpur APMC\n  Tomato: ₹1,800 at Kolar APMC\n  Chana: ₹5,200 at Akola APMC',
  '3': 'Nearest Cold Storage:\nLasalgaon APMC Onion Chamber\nAvailable: 60 MT\nRate: ₹3/MT/day\nContact: +91-9876500003\nReply \'3B\' to book.',
  '4': 'Village Pooled Truck:\nFarmers joined: 7\nVehicle: Mini Truck (1.5T)\nEach pays: ₹440\nYou save vs. individual: 71.4%\nMarket: Nashik APMC / Lasalgaon\nReply \'4J\' to join.',
  '0': 'Connecting to voice assistant...\n📞 Calling FinGrow IVR helpline...\nPress 1 for Weather, 2 for Mandi, 3 for Cold Storage, 4 for Truck.',
  '3B': '✅ Cold Storage Booking Confirmed!\nBooking: BKNG-4F2A | Token: 847291\nFacility: Lasalgaon APMC Onion Chamber\nCrop: Onion | Qty: 5 MT | 30 days\nEst. Cost: ₹4,500\nContact: +91-9876500003',
  '4J': '✅ You have joined the pooled truck!\nPledge ID: POOL-7G3B\nCluster: Niphad–Yeola Route\nVehicle: Mini Truck departing Saturday 6AM\nYou will receive SMS confirmation.',
};

const IVR_RESPONSES = {
  '': 'Namaste! FinGrow Panchayat Seva mein aapka swagat hai.\nMausam ke liye 1 dabayein.\nMandi bhav ke liye 2 dabayein.\nCold Storage ke liye 3 dabayein.\nTruck booking ke liye 4 dabayein.',
  '1': '🌡️ Mausam Alert: Aaj garmi bahut tez hai. Heat index 39°C. Dopahar 11 baje se 3 baje ke beech bahar kaam mat karein. Pani peete rahein.',
  '2': '📊 Aaj ke Mandi Bhav: Pyaz 2200 rupaye quintal Lasalgaon mein. Gehun 2450 rupaye Akola mein. Soybean 4820 rupaye Nagpur mein.',
  '3': '❄️ Cold Storage: Lasalgaon APMC Onion Chamber mein 60 MT jagah hai. Rate 3 rupaye per MT per din. Booking ke liye 9876500003 par call karein.',
  '4': '🚚 Pooled Truck: Aapke ilaake mein 7 kisan truck share kar rahe hain. Nashik APMC ja rahe hain. Har kisan ko sirf 440 rupaye lagenge.',
};

export default function WhatsAppVoiceSimulator() {
  const [mode, setMode] = useState('whatsapp');
  const [waMessages, setWaMessages] = useState([{ from: 'bot', text: MENU }]);
  const [waInput, setWaInput] = useState('');
  const [ivrStep, setIvrStep] = useState('');
  const [ivrHistory, setIvrHistory] = useState([{ from: 'ivr', text: IVR_RESPONSES[''] }]);

  const sendWA = () => {
    if (!waInput.trim()) return;
    const userMsg = { from: 'user', text: waInput };
    const botReply = RESPONSES[waInput.trim()] || MENU;
    setWaMessages(prev => [...prev, userMsg, { from: 'bot', text: botReply }]);
    setWaInput('');
  };

  const pressIVR = (digit) => {
    const userMsg = { from: 'user', text: `Pressed: ${digit}` };
    const botReply = { from: 'ivr', text: IVR_RESPONSES[digit] || 'Invalid option. Please press 1, 2, 3, or 4.' };
    setIvrHistory(prev => [...prev, userMsg, botReply]);
    setIvrStep(digit);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div>
        <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">smartphone</span>
          WhatsApp & Voice Bot Simulator
        </h2>
        <p className="text-on-surface-variant mt-1">
          Experience how a smallholder with a basic feature phone accesses all services — no smartphone or app download needed.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3">
        {[['whatsapp', 'chat', 'WhatsApp Bot'], ['ivr', 'phone_in_talk', 'IVR Voice Call']].map(([m, icon, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${mode === m ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {mode === 'whatsapp' && (
        <div className="max-w-sm mx-auto">
          {/* Phone frame */}
          <div className="bg-gray-800 rounded-[2.5rem] p-3 shadow-2xl">
            <div className="bg-[#075E54] rounded-t-[2rem] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]">agriculture</span>
              </div>
              <div>
                <div className="text-white font-semibold text-sm">FinGrow Panchayat</div>
                <div className="text-green-200 text-xs">Online</div>
              </div>
            </div>
            <div className="bg-[#ECE5DD] min-h-[350px] max-h-[350px] overflow-y-auto p-3 space-y-2">
              {waMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${msg.from === 'user' ? 'bg-[#DCF8C6] text-gray-800 rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#F0F0F0] rounded-b-[2rem] px-3 py-2 flex gap-2 items-center">
              <input
                className="flex-1 px-3 py-2 rounded-full bg-white text-sm text-gray-800 outline-none"
                placeholder="Type message…"
                value={waInput}
                onChange={e => setWaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendWA()}
              />
              <button onClick={sendWA} className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]">send</span>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-on-surface-variant mt-3">Type 1, 2, 3, 4, or 0 to navigate services</p>
        </div>
      )}

      {mode === 'ivr' && (
        <div className="max-w-sm mx-auto">
          {/* Phone keypad frame */}
          <div className="bg-gray-800 rounded-[2.5rem] p-3 shadow-2xl">
            <div className="bg-gray-900 rounded-t-[2rem] px-4 py-3 text-center">
              <div className="text-green-400 text-xs mb-1">📞 Connected to FinGrow IVR</div>
              <div className="text-white font-semibold">+91-1800-FINGROW</div>
            </div>
            <div className="bg-gray-900 min-h-[200px] max-h-[200px] overflow-y-auto p-3 space-y-2">
              {ivrHistory.map((msg, i) => (
                <div key={i} className={`text-sm rounded-lg px-3 py-2 ${msg.from === 'user' ? 'bg-primary/20 text-green-300 text-right' : 'bg-gray-700 text-white whitespace-pre-wrap'}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            {/* Keypad */}
            <div className="bg-gray-900 rounded-b-[2rem] p-4">
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                  <button key={d} onClick={() => ['1','2','3','4','0'].includes(d) && pressIVR(d)}
                    className={`h-12 rounded-xl font-bold text-lg transition-colors ${['1','2','3','4','0'].includes(d) ? 'bg-primary text-on-primary hover:bg-primary/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <button onClick={() => { setIvrHistory([{ from: 'ivr', text: IVR_RESPONSES[''] }]); setIvrStep(''); }}
                className="w-full mt-3 py-2 rounded-xl bg-error text-white text-sm font-semibold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">call_end</span>
                End Call
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-on-surface-variant mt-3">Press 1–4 on the keypad. Works on any basic feature phone.</p>
        </div>
      )}
    </div>
  );
}
