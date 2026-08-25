import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../../../src/main/office/config';

describe('config', () => {
  it('loads the shipped office.config.json', () => {
    const cfg = loadConfig(join(process.cwd(), 'office.config.json'));
    expect(cfg.stations.map((s) => s.id)).toContain('lobby');
    expect(cfg.stations.some((s) => s.id === cfg.lobbyId)).toBe(true);
  });
  it('rejects a config whose lobbyId names no station', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'bad.json');
    writeFileSync(f, JSON.stringify({ lobbyId: 'nope', defaultStationByCwd: {}, stations: [] }));
    expect(() => loadConfig(f)).toThrow(/lobbyId/);
  });
  it('round-trips through save', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'rt.json');
    const cfg = loadConfig(join(process.cwd(), 'office.config.json'));
    saveConfig(f, cfg);
    expect(JSON.parse(readFileSync(f, 'utf8'))).toEqual(cfg);
  });
});
