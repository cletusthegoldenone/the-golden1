export default function InvestorRelations() {
  return (
    <div className="glass p-8 rounded-3xl">
      <h2 className="text-3xl font-bold">Investor Relations</h2>
      <p className="text-white/70 mt-2">Where your trading fees and staking rewards go</p>
      <div className="mt-8 grid gap-6">
        {[
          { name: 'Developer', pct: 20 },
          { name: 'Platform Access Pool', pct: 25 },
          { name: 'Future Upgrades', pct: 30 },
          { name: 'Digital Bank Fund', pct: 25 }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span>{item.name}</span>
                <span className="font-mono">{item.pct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/40 mt-6">Platform access pool sustains staking infrastructure. No SOL rewards or profit sharing are paid to stakers.</p>
    </div>
  );
}
