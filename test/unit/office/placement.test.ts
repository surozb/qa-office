import { describe, it, expect } from 'vitest';
import { placeOccupant, assignFolder } from '../../../src/main/office/placement';
import type { OfficeConfig } from '../../../src/shared/types';

const cfg: OfficeConfig = {
  lobbyId: 'lobby',
  defaultStationByCwd: { 'C:\\A\\repo': 'lab' },
  stations: [
    { id: 'design', name: 'Design', grid: { col: 0, row: 0 }, cwds: ['C:\\A\\repo'], skills: ['write-test-case'] },
    { id: 'lab',    name: 'Lab',    grid: { col: 1, row: 0 }, cwds: ['C:\\A\\repo'], skills: ['write-automation-test'] },
    { id: 'db',     name: 'DB',     grid: { col: 2, row: 0 }, cwds: ['C:\\A\\db'],   skills: ['database-explorer'] },
    { id: 'lobby',  name: 'Lobby',  grid: { col: 0, row: 1 }, cwds: [], skills: [] },
  ],
};

describe('placeOccupant', () => {
  it('unknown cwd → lobby', () => { expect(placeOccupant('D:\\elsewhere', undefined, cfg)).toBe('lobby'); });
  it('single-station cwd → that station', () => { expect(placeOccupant('C:\\A\\db', undefined, cfg)).toBe('db'); });
  it('subfolder of a bound cwd still matches', () => { expect(placeOccupant('C:\\A\\db\\scripts', undefined, cfg)).toBe('db'); });
  it('prefix must be on a path boundary', () => { expect(placeOccupant('C:\\A\\dbx', undefined, cfg)).toBe('lobby'); });
  it('shared cwd + last skill picks the skill\'s station', () => {
    expect(placeOccupant('C:\\A\\repo', 'write-test-case', cfg)).toBe('design');
  });
  it('shared cwd + unknown skill → configured default', () => {
    expect(placeOccupant('C:\\A\\repo', 'something-else', cfg)).toBe('lab');
  });
  it('shared cwd + no skill → configured default', () => { expect(placeOccupant('C:\\A\\repo', undefined, cfg)).toBe('lab'); });
  it('is case-insensitive on Windows paths', () => { expect(placeOccupant('c:\\a\\DB', undefined, cfg)).toBe('db'); });
});

describe('assignFolder', () => {
  it('adds the cwd to the station and sets it as default, without mutating input', () => {
    const next = assignFolder(cfg, 'D:\\new', 'db');
    expect(next.stations.find((s) => s.id === 'db')?.cwds).toContain('D:\\new');
    expect(next.defaultStationByCwd['D:\\new']).toBe('db');
    expect(cfg.stations.find((s) => s.id === 'db')?.cwds).not.toContain('D:\\new');
  });
});
