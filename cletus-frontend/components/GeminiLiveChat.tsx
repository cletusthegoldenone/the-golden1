// src/components/GeminiLiveChat.tsx (new or replace existing)
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function GeminiLiveChat() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "I'm Cletus Live. What are we hunting today? 🚀" }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { publicKey } = useWallet();
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/ai', { // or your existing /api/ai
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, wallet: publicKey?.toBase58(), history: messages })
    });
    const data = await res.json();

    setMessages(prev => [...prev, { role: 'assistant', content: data.answer || data.response || "No response" }]);
    setLoading(false);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="glass h-[520px] flex flex-col rounded-3xl border border-white/10">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-emerald-500 text-black' : 'bg-white/5'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-white/50">Cletus thinking...</div>}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-white/10 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} className="flex-1 bg-zinc-900 border border-white/20 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500" placeholder="Ask about any token..." />
        <button onClick={send} className="px-6 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-semibold">Send</button>
      </div>
    </div>
  );
}
