'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CommunityMessage {
  id: string;
  user: string;
  avatar: string;
  content: string;
  timestamp: number;
  tier?: string;
  tierColor?: string;
}

const GOOSE_AVATARS = ['🪿', '🦆', '🐧', '🦅', '🦉', '🦜', '🐦', '🦚', '🦩', '🦢'];

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  Diamond: { label: '💎 Diamond', color: 'text-blue-400' },
  Platinum: { label: '💠 Platinum', color: 'text-cyan-400' },
  Gold: { label: '🥇 Gold', color: 'text-yellow-400' },
  Silver: { label: '🥈 Silver', color: 'text-gray-300' },
  Bronze: { label: '🥉 Bronze', color: 'text-amber-600' },
  Starter: { label: '🌱 Starter', color: 'text-green-500' },
  Trial: { label: '⏱ Trial', color: 'text-white/50' },
};

const SEED_MESSAGES: CommunityMessage[] = [
  { id: 'm1', user: 'degenGoose', avatar: '🪿', content: 'BONK looking spicy on the 15m, Cletus just flagged a volume spike 🔥', timestamp: Date.now() - 240000, tier: 'Gold', tierColor: 'text-yellow-400' },
  { id: 'm2', user: 'solanaHonk', avatar: '🦆', content: 'signal score just hit 87 on $PEPU, watching closely', timestamp: Date.now() - 195000, tier: 'Silver', tierColor: 'text-gray-300' },
  { id: 'm3', user: 'rugDetector9', avatar: '🦅', content: '$WEN just got flagged by the rug intelligence engine, dev wallet dumped 40% lol', timestamp: Date.now() - 150000, tier: 'Platinum', tierColor: 'text-cyan-400' },
  { id: 'm4', user: 'moonGoose', avatar: '🦉', content: 'anyone else catching JTO here? RSI at 38 on 1h', timestamp: Date.now() - 105000, tier: 'Diamond', tierColor: 'text-blue-400' },
  { id: 'm5', user: 'cletus_fan', avatar: '🐦', content: 'AI signal score just hit 94/100 on $PEPU, entering now', timestamp: Date.now() - 72000, tier: 'Gold', tierColor: 'text-yellow-400' },
  { id: 'm6', user: 'dexDeegen', avatar: '🦜', content: 'Cletus caught 3 breakouts today, this signal engine is something else', timestamp: Date.now() - 45000, tier: 'Silver', tierColor: 'text-gray-300' },
  { id: 'm7', user: 'honkmaster', avatar: '🪿', content: 'Cletus called the $BONK breakout 8 minutes before it pumped, this AI is cracked', timestamp: Date.now() - 20000, tier: 'Bronze', tierColor: 'text-amber-600' },
];

const BOT_RESPONSES = [
  'solid call, I was watching that one too 🦆',
  'gm flock 🪿',
  'just refreshed the scanner, 6 green signals rn',
  'dev wallet on that one is sketchy, checked rugcheck already',
  'volume/mcap ratio is insane on $BONK rn',
  'DYOR but Cletus AI has been right 3 times today already',
  'anyone in $JTO? entry looking clean',
  'the rug database update saved me from a $2k loss earlier',
  'Diamond tier whale just entered chat 👀',
];

const BOT_USERS = [
  { user: 'gooseWhale', avatar: '🦢', tier: 'Diamond', tierColor: 'text-blue-400' },
  { user: 'duckNukem', avatar: '🦆', tier: 'Platinum', tierColor: 'text-cyan-400' },
  { user: 'featherFund', avatar: '🦩', tier: 'Gold', tierColor: 'text-yellow-400' },
  { user: 'beakTrader', avatar: '🐦', tier: 'Bronze', tierColor: 'text-amber-600' },
  { user: 'waddle_vibe', avatar: '🐧', tier: 'Starter', tierColor: 'text-green-500' },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

interface MessageRowProps {
  msg: CommunityMessage;
  isSelf?: boolean;
}

function MessageRow({ msg, isSelf }: MessageRowProps) {
  return (
    <div className={`flex gap-2.5 ${isSelf ? 'flex-row-reverse' : ''} group`}>
      <div className="w-8 h-8 rounded-full bg-trading-surface border border-trading-border flex items-center justify-center text-sm shrink-0 select-none">
        {msg.avatar}
      </div>
      <div className={`max-w-[75%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div className={`flex items-center gap-1.5 text-xs ${isSelf ? 'flex-row-reverse' : ''}`}>
          <span className="font-semibold text-white/80">{msg.user}</span>
          {msg.tier && (
            <span className={`text-[10px] ${msg.tierColor ?? 'text-gray-500'} font-medium`}>
              {TIER_BADGES[msg.tier]?.label ?? msg.tier}
            </span>
          )}
          <span className="text-gray-600">{formatRelative(msg.timestamp)}</span>
        </div>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isSelf
              ? 'bg-trading-green text-black rounded-br-sm font-medium'
              : 'bg-trading-surface border border-trading-border text-white/90 rounded-bl-sm'
          }`}
        >
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function CommunityChat() {
  const [messages, setMessages] = useState<CommunityMessage[]>(SEED_MESSAGES);
  const [input, setInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(142);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Simulate incoming community messages
  useEffect(() => {
    const interval = setInterval(() => {
      const bot = BOT_USERS[Math.floor(Math.random() * BOT_USERS.length)];
      const newMsg: CommunityMessage = {
        id: Date.now().toString(),
        user: bot.user,
        avatar: bot.avatar,
        content: BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)],
        timestamp: Date.now(),
        tier: bot.tier,
        tierColor: bot.tierColor,
      };
      setMessages((prev) => [...prev.slice(-49), newMsg]);
      setOnlineCount((c) => Math.max(100, c + Math.floor(Math.random() * 5) - 2));
    }, 8000 + Math.random() * 7000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const newMsg: CommunityMessage = {
      id: Date.now().toString(),
      user: 'You',
      avatar: GOOSE_AVATARS[Math.floor(Math.random() * GOOSE_AVATARS.length)],
      content: text,
      timestamp: Date.now(),
      tier: 'Trial',
      tierColor: 'text-white/50',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] animate-fade-in">
      {/* Header */}
      <div className="trading-card p-4 mb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-trading-green/20 border border-trading-green/40 flex items-center justify-center text-xl">
              🪿
            </div>
            <div>
              <div className="font-bold">The Flock</div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-trading-green status-dot-live" />
                <span className="text-trading-green">{onlineCount} online</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500">Community Chat</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 text-[10px] hidden sm:flex">
            {Object.entries(TIER_BADGES).slice(0, 4).map(([key, val]) => (
              <span key={key} className={`${val.color} font-medium`}>{val.label}</span>
            ))}
          </div>
        </div>

        {/* Pinned announcement */}
        <div className="mt-3 bg-trading-surface border border-trading-border rounded-lg px-3 py-2 text-xs text-gray-400 flex items-start gap-2">
          <span className="text-trading-yellow shrink-0">📌</span>
          <span>
            <span className="text-white font-medium">Community Rules:</span> No pump &amp; dump coordination · Share signals, not shills · Diamond stakers get priority support ·{' '}
            <span className="text-trading-green">DYOR always</span>
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 trading-card p-4">
        {messages.map((msg) => (
          <MessageRow key={msg.id} msg={msg} isSelf={msg.user === 'You'} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="trading-card p-3 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to the flock..."
            className="flex-1 bg-trading-surface border border-trading-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-trading-green transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-4 py-2.5 rounded-xl bg-trading-green text-black font-bold text-sm hover:bg-trading-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
          >
            🪿
          </button>
        </div>
        <div className="text-xs text-gray-600 mt-1.5 text-center">
          Goose-themed · Press Enter to send
        </div>
      </div>
    </div>
  );
}
