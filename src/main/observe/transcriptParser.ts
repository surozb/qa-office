import { basename } from 'node:path';
import { emoteFor } from '../../shared/emote';
import type { ActivityEvent } from '../../shared/types';

type Rec = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const clip = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function summarize(name: string, input: Rec): string {
  switch (name) {
    case 'Bash': case 'PowerShell': return clip(str(input['description']) ?? str(input['command']) ?? name);
    case 'Read': case 'Edit': case 'Write': case 'NotebookEdit': { const p = str(input['file_path']); return p ? basename(p) : name; }
    case 'Grep': case 'Glob': return clip(str(input['pattern']) ?? name);
    case 'Skill': return str(input['skill']) ?? name;
    case 'Agent': return clip(str(input['description']) ?? name);
    default: return name;
  }
}

export function parseTranscriptLine(line: string): ActivityEvent[] {
  if (!line.trim()) return [];
  let r: Rec;
  try { const v = JSON.parse(line); if (typeof v !== 'object' || v === null) return []; r = v as Rec; } catch { return []; }
  const sessionId = str(r['sessionId']); if (!sessionId) return [];
  const at = str(r['timestamp']) ?? '';
  const out: ActivityEvent[] = [];

  switch (r['type']) {
    case 'ai-title': { const t = str(r['aiTitle']); if (t) out.push({ kind: 'title', sessionId, title: t }); return out; }
    case 'user': {
      const msg = r['message'] as Rec | undefined; const c = msg?.['content'];
      if (typeof c === 'string' && !r['isMeta']) out.push({ kind: 'text', sessionId, at, role: 'user', text: clip(c, 200) });
      return out; // tool_result arrays are ignored
    }
    case 'assistant': {
      const branch = str(r['gitBranch']);
      if (branch && branch !== 'HEAD') out.push({ kind: 'branch', sessionId, branch });
      const msg = r['message'] as Rec | undefined;
      const content = Array.isArray(msg?.['content']) ? (msg!['content'] as Rec[]) : [];
      for (const b of content) {
        if (b['type'] === 'tool_use') {
          const name = str(b['name']) ?? 'unknown'; const input = (b['input'] as Rec) ?? {};
          out.push({ kind: 'tool', sessionId, at, tool: name, emote: emoteFor(name), summary: summarize(name, input) });
          if (name === 'Skill') { const s = str(input['skill']); if (s) out.push({ kind: 'skill', sessionId, at, skill: s }); }
        } else if (b['type'] === 'text') {
          const t = str(b['text']); if (t?.trim()) out.push({ kind: 'text', sessionId, at, role: 'assistant', text: clip(t, 200) });
        }
      }
      const u = msg?.['usage'] as Rec | undefined;
      if (u) out.push({ kind: 'usage', sessionId, at, input: num(u['input_tokens']), output: num(u['output_tokens']), cacheRead: num(u['cache_read_input_tokens']) });
      return out;
    }
    default: return out;
  }
}
