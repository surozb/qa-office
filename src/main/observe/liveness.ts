import type { SessionRecord } from '../../shared/types';

export interface ProcessProbe {
  /** Windows FILETIME of the process start as a decimal string, or null if the pid is not running. */
  startFileTime(pid: number): Promise<string | null>;
}

export async function reapSessions(
  records: SessionRecord[], probe: ProcessProbe,
): Promise<{ live: SessionRecord[]; dead: SessionRecord[] }> {
  const live: SessionRecord[] = [], dead: SessionRecord[] = [];
  await Promise.all(records.map(async (r) => {
    let start: string | null = null;
    try { start = await probe.startFileTime(r.pid); } catch { start = null; }
    (start !== null && start === r.procStart ? live : dead).push(r);
  }));
  return { live, dead };
}
