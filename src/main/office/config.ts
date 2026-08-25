import { readFileSync, writeFileSync } from 'node:fs';
import type { OfficeConfig, Station } from '../../shared/types';

function isStation(v: unknown): v is Station {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>; const g = s['grid'] as Record<string, unknown> | undefined;
  return typeof s['id'] === 'string' && typeof s['name'] === 'string' && Array.isArray(s['cwds']) && Array.isArray(s['skills'])
    && (s['cwds'] as unknown[]).every((c) => typeof c === 'string')
    && (s['skills'] as unknown[]).every((k) => typeof k === 'string')
    && !!g && typeof g['col'] === 'number' && typeof g['row'] === 'number';
}

export function loadConfig(file: string): OfficeConfig {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const stations = raw['stations'];
  if (!Array.isArray(stations) || !stations.every(isStation)) throw new Error(`${file}: "stations" must be an array of {id,name,cwds,skills,grid}`);
  const lobbyId = raw['lobbyId'];
  if (typeof lobbyId !== 'string' || !stations.some((s) => s.id === lobbyId)) throw new Error(`${file}: "lobbyId" must name a station`);
  const def = raw['defaultStationByCwd'];
  const defaultStationByCwd = typeof def === 'object' && def !== null ? (def as Record<string, string>) : {};
  return { stations, lobbyId, defaultStationByCwd };
}

export function saveConfig(file: string, cfg: OfficeConfig): void {
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}
