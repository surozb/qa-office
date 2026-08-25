import type { OfficeConfig, Station } from '../../shared/types';

const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
const isPrefix = (root: string, cwd: string) => { const r = norm(root), c = norm(cwd); return c === r || c.startsWith(r + '\\'); };

export function placeOccupant(cwd: string, lastSkill: string | undefined, cfg: OfficeConfig): string {
  type Cand = { station: Station; root: string };
  const cands: Cand[] = [];
  for (const s of cfg.stations) for (const root of s.cwds) if (isPrefix(root, cwd)) cands.push({ station: s, root });
  if (cands.length === 0) return cfg.lobbyId;
  if (lastSkill) {
    const bySkill = cands.filter((c) => c.station.skills.includes(lastSkill));
    if (bySkill.length === 1) return bySkill[0]!.station.id;
  }
  const longest = cands.reduce((a, b) => (norm(b.root).length > norm(a.root).length ? b : a));
  const defKey = Object.keys(cfg.defaultStationByCwd).find((k) => norm(k) === norm(longest.root));
  const def = defKey ? cfg.defaultStationByCwd[defKey] : undefined;
  if (def && cfg.stations.some((s) => s.id === def)) return def;
  return longest.station.id;
}

export function assignFolder(cfg: OfficeConfig, cwd: string, stationId: string): OfficeConfig {
  return {
    ...cfg,
    defaultStationByCwd: { ...cfg.defaultStationByCwd, [cwd]: stationId },
    stations: cfg.stations.map((s) => (s.id === stationId && !s.cwds.includes(cwd) ? { ...s, cwds: [...s.cwds, cwd] } : s)),
  };
}
