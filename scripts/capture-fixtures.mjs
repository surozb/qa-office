/* eslint-disable no-undef */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const home = join(homedir(), '.claude');
const out = join(process.cwd(), 'test', 'fixtures', 'captured');
mkdirSync(join(out, 'sessions'), { recursive: true }); mkdirSync(join(out, 'transcript'), { recursive: true });
const slug = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-');

for (const f of readdirSync(join(home, 'sessions')).filter((n) => n.endsWith('.json'))) {
  let j; try { j = JSON.parse(readFileSync(join(home, 'sessions', f), 'utf8')); } catch { continue; }
  if (j.messagingSocketPath) j.messagingSocketPath = '<redacted>';
  writeFileSync(join(out, 'sessions', f), JSON.stringify(j));
  const tp = join(home, 'projects', slug(j.cwd), `${j.sessionId}.jsonl`);
  try {
    const lines = readFileSync(tp, 'utf8').split('\n').filter(Boolean).slice(-200).map((l) => {
      try { const r = JSON.parse(l); for (const b of r.message?.content ?? []) if (b.type === 'tool_use' && b.input) for (const k of Object.keys(b.input)) if (typeof b.input[k] === 'string') b.input[k] = b.input[k].slice(0, 120); return JSON.stringify(r); }
      catch { return l; }
    });
    writeFileSync(join(out, 'transcript', `${j.name ?? j.sessionId}.jsonl`), lines.join('\n') + '\n');
    console.log(`captured ${f} → ${lines.length} transcript lines`);
  } catch { console.log(`captured ${f} (no transcript yet)`); }
}
