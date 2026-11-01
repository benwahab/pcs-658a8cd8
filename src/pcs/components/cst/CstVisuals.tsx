// Purely visual widgets for the CST dashboard (no data fetching, no business logic).

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const REGIONS: { key: string; label: string; d: string }[] = [
  { key: "agadez", label: "Agadez", d: "M150 150 L170 90 L230 40 L300 18 L342 38 L366 70 L372 120 L352 170 L300 176 L240 170 L200 160 Z" },
  { key: "tahoua", label: "Tahoua", d: "M100 170 L150 150 L200 160 L215 200 L205 245 L170 255 L130 250 L110 215 Z" },
  { key: "tillaberi", label: "Tillabéri", d: "M18 200 L60 174 L100 170 L110 215 L100 245 L76 266 L50 272 L28 252 Z" },
  { key: "dosso", label: "Dosso", d: "M100 245 L130 250 L142 282 L112 298 L80 288 L76 266 Z" },
  { key: "maradi", label: "Maradi", d: "M170 255 L205 245 L240 250 L246 286 L200 292 L168 282 Z" },
  { key: "zinder", label: "Zinder", d: "M205 245 L215 200 L200 160 L240 170 L300 176 L306 230 L290 282 L246 286 L240 250 Z" },
  { key: "diffa", label: "Diffa", d: "M300 176 L352 170 L386 200 L376 252 L340 272 L290 282 L306 230 Z" },
  { key: "niamey", label: "Niamey", d: "M66 230 L74 226 L80 233 L76 242 L67 241 Z" },
];

const LEVELS = [
  { label: "Très élevé", color: "#3f0f8f" },
  { label: "Élevé", color: "#6a35d0" },
  { label: "Moyen", color: "#9468e6" },
  { label: "Faible", color: "#bea4f2" },
  { label: "Très faible", color: "#e4dafb" },
];

export function NigerRegionMap({ counts }: { counts: Record<string, number> }) {
  const byKey: Record<string, number> = {};
  Object.entries(counts).forEach(([name, n]) => { const k = norm(name).replace(/\s+/g, ""); byKey[k] = (byKey[k] ?? 0) + n; });
  const max = Math.max(0, ...Object.values(byKey));
  const level = (n: number) => { if (!max || !n) return 4; const r = n / max; return r > 0.8 ? 0 : r > 0.55 ? 1 : r > 0.3 ? 2 : r > 0.1 ? 3 : 4; };
  return (
    <div className="cstMapWrap">
      <svg viewBox="0 0 400 310" className="cstNigerMap" role="img" aria-label="Carte du Niger par région">
        {REGIONS.map((r) => { const n = byKey[r.key] ?? 0; return (
          <path key={r.key} d={r.d} fill={LEVELS[level(n)].color} stroke="#fff" strokeWidth={2.2} strokeLinejoin="round">
            <title>{`${r.label} : ${n} signalement(s)`}</title>
          </path>
        ); })}
      </svg>
      <ul className="cstMapLegend">{LEVELS.map((l) => <li key={l.label}><i style={{ background: l.color }} />{l.label}</li>)}</ul>
    </div>
  );
}

export type TrendPoint = { label: string; received: number; treated: number; resolved: number };

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const W = 360, H = 150, L = 34, B = 20, T = 8;
  const max = Math.max(4, ...points.flatMap((p) => [p.received, p.treated, p.resolved]));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const x = (i: number) => L + (i * (W - L - 6)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const line = (k: keyof Omit<TrendPoint, "label">) => points.map((p, i) => `${x(i)},${y(p[k])}`).join(" ");
  const series: [keyof Omit<TrendPoint, "label">, string][] = [["received", "#5b21b6"], ["treated", "#3b82f6"], ["resolved", "#22c58b"]];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cstTrendSvg" role="img" aria-label="Évolution des signalements">
      <defs><linearGradient id="cstArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7c3aed" stopOpacity=".22" /><stop offset="1" stopColor="#7c3aed" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((g) => <g key={g}><line x1={L} x2={W - 4} y1={y(g * step)} y2={y(g * step)} stroke="#eceaf6" /><text x={L - 6} y={y(g * step) + 3} textAnchor="end">{(g * step).toLocaleString("fr-FR")}</text></g>)}
      {points.length > 1 && <polygon points={`${x(0)},${y(0)} ${line("received")} ${x(points.length - 1)},${y(0)}`} fill="url(#cstArea)" />}
      {series.map(([k, c]) => <g key={k}><polyline points={line(k)} fill="none" stroke={c} strokeWidth={1.8} />{points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p[k])} r={2.6} fill={c} />)}</g>)}
      {points.map((p, i) => <text key={p.label} x={x(i)} y={H - 4} textAnchor="middle">{p.label}</text>)}
    </svg>
  );
}

export function MiniDashboardPreview({ accent }: { accent: string }) {
  return (
    <div className="cstMiniPreview" aria-hidden="true">
      <span className="cstMiniSide" />
      <div className="cstMiniBody">
        <span className="cstMiniTop" />
        <div className="cstMiniKpis">{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>
        <div className="cstMiniCharts"><span className="cstMiniChart" style={{ ["--a" as any]: accent }} /><span className="cstMiniBlob" style={{ ["--a" as any]: accent }} /></div>
        <div className="cstMiniRows">{[0, 1, 2].map((i) => <i key={i} />)}</div>
      </div>
    </div>
  );
}
