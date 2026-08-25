import type { SessionRecord, SessionStatus } from '../../shared/types';

function isStatus(v: unknown): v is SessionStatus { return v === 'busy' || v === 'idle'; }

export function parseSessionFile(text: string): SessionRecord | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const pid = o['pid'], sessionId = o['sessionId'], cwd = o['cwd'], procStart = o['procStart'], status = o['status'];
  if (typeof pid !== 'number' || typeof sessionId !== 'string' || typeof cwd !== 'string') return null;
  if (typeof procStart !== 'string' || !isStatus(status)) return null;
  return {
    pid, sessionId, cwd, procStart, status,
    name: typeof o['name'] === 'string' && o['name'] ? o['name'] : sessionId.slice(0, 8),
    kind: typeof o['kind'] === 'string' ? o['kind'] : 'unknown',
    startedAt: typeof o['startedAt'] === 'number' ? o['startedAt'] : 0,
    updatedAt: typeof o['updatedAt'] === 'number' ? o['updatedAt'] : 0,
  };
}
