# QA Office — Phase 1 "Observatory" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only Electron app that draws the QA pipeline as a pixel office and shows every live Claude Code session on this machine at its station, with live status, current tool, token spend, and an activity log.

**Architecture:** Electron main process owns three observers — `RegistryWatcher` (who exists, from `~/.claude/sessions/*.json`), `TranscriptTailer` (what they do, from `~/.claude/projects/**/*.jsonl`), and `OfficeStore` (where they stand, from `office.config.json`). All parsing is pure functions tested against fixtures. Main pushes one `OfficeState` snapshot to the renderer over IPC; the renderer draws it with PixiJS v8 and React overlays. Nothing in phase 1 writes under `~/.claude`.

**Tech Stack:** Electron 44 · electron-vite 5 · TypeScript 5 · React 19 · PixiJS 8.20 · Zustand · chokidar 5 · Vitest 4 · ESLint 9. Node 22 / npm 10 (present on the machine).

**Spec:** `docs/superpowers/specs/2026-08-25-qa-office-design.md` — executors read spec §4 (verified facts), §5 (architecture, one-way rule), §6 (floor), §8 (data flow), §9 (errors), §10 phase 1 acceptance.

## Global Constraints

- **One-way rule (spec §5.1):** modules under `src/main/observe/` must never write under `~/.claude` and never open `messagingSocketPath`. Enforced by ESLint `no-restricted-imports` (`net`, `child_process` banned there) and `no-restricted-properties` (`fs.writeFile*`, `fs.appendFile*`, `fs.rm*`, `fs.unlink*`, `fs.rename*` banned there). Task 3 installs the rule; every later observe-module task must pass lint.
- **Liveness (spec §4):** a session is live iff its `pid` is running **and** the process's `StartTime.ToFileTime()` equals the registry `procStart` string (verified identical on 4 live PIDs, 2026-08-25).
- **Stale files are normal (spec §9):** killed terminals leave `sessions/<pid>.json` behind; reap on every scan, never treat as an error.
- **Half-written JSONL lines (spec §9):** skip, remember byte offset, retry on next change. Never throw.
- **Unknown transcript record types:** ignore with a debug log.
- **Repository:** `C:\careerGrowth\projects\qa-office`, branch `main`, remote `github.com/surozb/qa-office`. Commit identity `Suraj Maharjan <surozb@gmail.com>` (already set locally).
- **Windows-only for phase 1.** Paths use `path.join`/`os.homedir()`; process probe is PowerShell-based.
- **Phase 1 acceptance (spec §10):** the live worktree sessions appear at correct stations with live status, and killing a terminal removes its sprite within 5 s.

---

## File structure

```
qa-office/
  package.json  tsconfig.json  tsconfig.node.json  tsconfig.web.json
  electron.vite.config.ts  eslint.config.js  vitest.config.ts
  office.config.json                      ← station map (user-editable)
  src/
    shared/
      types.ts                            ← SessionRecord, Occupant, Station, ActivityEvent, OfficeState, IPC names
      emote.ts                            ← tool name → emote category (pure)
    main/
      index.ts                            ← Electron bootstrap; composes observers; pushes state over IPC
      observe/                            ← READ-ONLY zone (lint-enforced)
        registryParser.ts                 ← parseSessionFile(text) → SessionRecord | null
        liveness.ts                       ← ProcessProbe interface + reapSessions()
        windowsProcessProbe.ts            ← PowerShell-backed ProcessProbe
        registryWatcher.ts                ← chokidar over ~/.claude/sessions → upsert/gone events
        transcriptParser.ts               ← parseTranscriptLine(text) → ActivityEvent | null
        transcriptTailer.ts               ← byte-offset tail of one .jsonl → ActivityEvent stream
        transcriptLocator.ts              ← (cwd, sessionId) → transcript path
      office/
        config.ts                         ← load/validate/save office.config.json
        placement.ts                      ← placeOccupant(cwd, lastSkill, config) → stationId (pure)
        officeStore.ts                    ← merges events → OfficeState; emits on change
    preload/
      index.ts                            ← contextBridge: office.onState / office.assignFolder
    renderer/
      index.html  main.tsx  store.ts      ← Zustand store fed by preload
      floor/
        Floor.tsx                         ← mounts PixiJS Application
        RoomLayer.ts  SpriteLayer.ts  Camera.ts
      panels/
        SidePanel.tsx  ActivityLog.tsx  LobbyAssign.tsx  Legend.tsx
  test/
    fixtures/
      sessions/                           ← scrubbed real ~/.claude/sessions/*.json
      transcript/                         ← scrubbed real JSONL excerpts
    unit/                                 ← vitest specs, mirror src paths
  scripts/
    capture-fixtures.mjs                  ← copies + scrubs live files into test/fixtures
```

---

### Task 1: Project scaffold — window opens, tests run, lint runs

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `electron.vite.config.ts`, `vitest.config.ts`, `eslint.config.js`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`
- Create: `test/unit/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `lint`, `typecheck` used by every later task.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "qa-office",
  "version": "0.1.0",
  "private": true,
  "description": "Pixel-office control tower over live Claude Code sessions for QA automation.",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit",
    "fixtures": "node scripts/capture-fixtures.mjs"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^44.0.0",
    "electron-vite": "^5.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^6.0.0",
    "vitest": "^4.1.0"
  },
  "dependencies": {
    "chokidar": "^5.0.0",
    "pixi.js": "^8.20.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig files**

`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }] }
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "skipLibCheck": true,
    "composite": true, "types": ["node"], "outDir": "out/tsc-node"
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "test/**/*", "electron.vite.config.ts", "vitest.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "jsx": "react-jsx",
    "strict": true, "noUncheckedIndexedAccess": true, "skipLibCheck": true,
    "composite": true, "lib": ["ES2022", "DOM", "DOM.Iterable"], "outDir": "out/tsc-web"
  },
  "include": ["src/renderer/**/*", "src/shared/**/*", "src/preload/index.d.ts"]
}
```

- [ ] **Step 3: Write electron.vite.config.ts and vitest.config.ts**

`electron.vite.config.ts`:
```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {},
  preload: {},
  renderer: { plugins: [react()] },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/unit/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 4: Write eslint.config.js (base rules; the observe-zone rule is added in Task 3)**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
```

- [ ] **Step 5: Write the minimal Electron entry points**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400, height: 900, title: 'QA Office',
    backgroundColor: '#13151d',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  else win.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

`src/preload/index.ts`:
```ts
import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('office', { version: '0.1.0' });
```

`src/renderer/index.html`:
```html
<!doctype html>
<html><head><meta charset="UTF-8"><title>QA Office</title>
<style>html,body,#root{margin:0;height:100%;background:#13151d;color:#e9e7dc;font-family:Consolas,monospace}</style>
</head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
```

`src/renderer/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<h1 style={{ padding: 20 }}>QA Office</h1>);
```

- [ ] **Step 6: Write the smoke test**

`test/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('toolchain', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 7: Install and verify all four commands**

Run: `npm install`
Run: `npm test` → Expected: `1 passed`
Run: `npm run typecheck` → Expected: exit 0
Run: `npm run lint` → Expected: exit 0
Run: `npm run dev` → Expected: a window titled "QA Office" opens showing the heading. Close it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + pixi + vitest"
```

---

### Task 2: Shared types and the emote mapping

**Files:**
- Create: `src/shared/types.ts`, `src/shared/emote.ts`
- Test: `test/unit/shared/emote.test.ts`

**Interfaces:**
- Produces (used by every later task, names are binding):

```ts
// src/shared/types.ts
export type SessionStatus = 'busy' | 'idle';
export interface SessionRecord {
  pid: number; sessionId: string; cwd: string; name: string;
  status: SessionStatus; kind: string; procStart: string;
  startedAt: number; updatedAt: number;
}
export type Emote = 'search' | 'read' | 'edit' | 'shell' | 'browser' | 'skill' | 'delegate' | 'think' | 'other';
export type ActivityEvent =
  | { kind: 'tool'; sessionId: string; at: string; tool: string; emote: Emote; summary: string }
  | { kind: 'text'; sessionId: string; at: string; role: 'user' | 'assistant'; text: string }
  | { kind: 'usage'; sessionId: string; at: string; input: number; output: number; cacheRead: number }
  | { kind: 'title'; sessionId: string; title: string }
  | { kind: 'branch'; sessionId: string; branch: string }
  | { kind: 'skill'; sessionId: string; at: string; skill: string };
export interface Station { id: string; name: string; cwds: string[]; skills: string[]; grid: { col: number; row: number } }
export interface OfficeConfig { stations: Station[]; defaultStationByCwd: Record<string, string>; lobbyId: string }
export type OccupantOrigin = 'walkin' | 'staff';
export interface Occupant {
  sessionId: string; name: string; pid: number; cwd: string; stationId: string;
  status: SessionStatus | 'gone'; origin: OccupantOrigin; title?: string; branch?: string;
  currentTool?: string; emote?: Emote; tokens: { input: number; output: number; cacheRead: number };
  lastSkill?: string; lastSeen: string;
}
export interface OfficeState { stations: Station[]; lobbyId: string; occupants: Occupant[]; log: LogLine[]; generatedAt: string }
export interface LogLine { at: string; sessionId: string; name: string; text: string }
export const IPC = { state: 'office:state', assignFolder: 'office:assignFolder', requestState: 'office:requestState' } as const;
```

- [ ] **Step 1: Write the failing emote test**

`test/unit/shared/emote.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { emoteFor } from '../../../src/shared/emote';

describe('emoteFor', () => {
  it.each([
    ['Grep', 'search'], ['Glob', 'search'], ['Read', 'read'],
    ['Edit', 'edit'], ['Write', 'edit'], ['NotebookEdit', 'edit'],
    ['Bash', 'shell'], ['PowerShell', 'shell'],
    ['mcp__playwright__browser_click', 'browser'],
    ['Skill', 'skill'], ['Agent', 'delegate'],
    ['mcp__ado__wit_query', 'other'], ['SomethingNew', 'other'],
  ])('%s → %s', (tool, emote) => { expect(emoteFor(tool)).toBe(emote); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/shared/emote.test.ts` → Expected: FAIL, cannot find module `emote`

- [ ] **Step 3: Write types.ts (contents exactly as in Interfaces above) and emote.ts**

`src/shared/emote.ts`:
```ts
import type { Emote } from './types';

const EXACT: Record<string, Emote> = {
  Grep: 'search', Glob: 'search', WebSearch: 'search', WebFetch: 'read',
  Read: 'read', Edit: 'edit', Write: 'edit', NotebookEdit: 'edit',
  Bash: 'shell', PowerShell: 'shell', Skill: 'skill', Agent: 'delegate',
};

export function emoteFor(tool: string): Emote {
  const hit = EXACT[tool];
  if (hit) return hit;
  if (tool.startsWith('mcp__playwright')) return 'browser';
  return 'other';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/unit/shared/emote.test.ts` → Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
git add src/shared test/unit/shared
git commit -m "feat(shared): office types and tool→emote mapping"
```

---

### Task 3: Registry parser + the one-way lint rule

**Files:**
- Create: `src/main/observe/registryParser.ts`
- Create: `test/fixtures/sessions/live-busy.json`, `test/fixtures/sessions/live-idle.json`, `test/fixtures/sessions/malformed.json`
- Modify: `eslint.config.js` (add the observe-zone restriction)
- Test: `test/unit/observe/registryParser.test.ts`

**Interfaces:**
- Produces: `parseSessionFile(text: string): SessionRecord | null` — `null` for unparseable or incomplete files (missing `pid`, `sessionId`, `cwd`, `procStart`, or `status`).

- [ ] **Step 1: Create fixtures (scrubbed copies of real files — shape from spec §4)**

`test/fixtures/sessions/live-busy.json`:
```json
{"pid":22920,"sessionId":"c7b16729-09da-4724-828b-8918c8ad094c","cwd":"C:\\careerGrowth","startedAt":1787544714812,"procStart":"134320183121973136","version":"2.1.241","peerProtocol":1,"peerFeatures":["notify_idle"],"kind":"interactive","entrypoint":"cli","messagingSocketPath":"\\\\.\\pipe\\LOCAL\\cc-msg-320ef4c91da85882e49ec6edf4f97fb1","name":"careergrowth-9c","nameSource":"derived","nameSince":1787544714812,"status":"busy","updatedAt":1787566523439,"statusUpdatedAt":1787566523439}
```

`test/fixtures/sessions/live-idle.json`:
```json
{"pid":18232,"sessionId":"c51ac6bf-a9f1-40a7-a525-f6ac7d2b2677","cwd":"C:\\MaitriAutomation\\CaptureManage","startedAt":1787555135837,"procStart":"134320287348532402","version":"2.1.241","peerProtocol":1,"peerFeatures":["notify_idle"],"kind":"interactive","entrypoint":"cli","messagingSocketPath":"\\\\.\\pipe\\LOCAL\\cc-msg-fba3093b4e2ff6d7b36e329112079c43","name":"capturemanage-b3","nameSource":"derived","nameSince":1787555135837,"status":"idle","updatedAt":1787566540363,"statusUpdatedAt":1787566540363}
```

`test/fixtures/sessions/malformed.json` (deliberately truncated):
```json
{"pid":1,"sessionId":"x","cwd":"C:\\x"
```

- [ ] **Step 2: Write the failing test**

`test/unit/observe/registryParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSessionFile } from '../../../src/main/observe/registryParser';

const fx = (n: string) => readFileSync(join(__dirname, '../../fixtures/sessions', n), 'utf8');

describe('parseSessionFile', () => {
  it('parses a live busy session', () => {
    expect(parseSessionFile(fx('live-busy.json'))).toEqual({
      pid: 22920, sessionId: 'c7b16729-09da-4724-828b-8918c8ad094c', cwd: 'C:\\careerGrowth',
      name: 'careergrowth-9c', status: 'busy', kind: 'interactive',
      procStart: '134320183121973136', startedAt: 1787544714812, updatedAt: 1787566523439,
    });
  });
  it('parses idle status', () => { expect(parseSessionFile(fx('live-idle.json'))?.status).toBe('idle'); });
  it('never exposes messagingSocketPath', () => {
    expect(JSON.stringify(parseSessionFile(fx('live-busy.json')))).not.toContain('pipe');
  });
  it('returns null for truncated JSON', () => { expect(parseSessionFile(fx('malformed.json'))).toBeNull(); });
  it('returns null when required fields are missing', () => {
    expect(parseSessionFile(JSON.stringify({ pid: 5, cwd: 'C:\\x' }))).toBeNull();
  });
  it('falls back to sessionId prefix when name is absent', () => {
    const j = JSON.parse(fx('live-busy.json')); delete j.name;
    expect(parseSessionFile(JSON.stringify(j))?.name).toBe('c7b16729');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/unit/observe/registryParser.test.ts` → Expected: FAIL, cannot find module

- [ ] **Step 4: Implement the parser**

`src/main/observe/registryParser.ts`:
```ts
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/unit/observe/registryParser.test.ts` → Expected: 6 passed

- [ ] **Step 6: Add the one-way lint rule for the observe zone**

Insert into `eslint.config.js` before the final `);`:
```js
  {
    files: ['src/main/observe/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'net', message: 'observe zone is read-only: no sockets (spec §5.1)' },
          { name: 'node:net', message: 'observe zone is read-only: no sockets (spec §5.1)' },
          { name: 'child_process', message: 'observe zone must not spawn; use the ProcessProbe interface' },
          { name: 'node:child_process', message: 'observe zone must not spawn; use the ProcessProbe interface' },
        ],
      }],
      'no-restricted-properties': ['error',
        ...['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'rm', 'rmSync', 'unlink', 'unlinkSync',
            'rename', 'renameSync', 'createWriteStream', 'truncate', 'truncateSync']
          .map((p) => ({ object: 'fs', property: p, message: 'observe zone is read-only (spec §5.1)' })),
      ],
    },
  },
```

- [ ] **Step 7: Prove the rule fires, then remove the probe lines**

Temporarily add to `src/main/observe/registryParser.ts`:
```ts
import * as fs from 'node:fs'; fs.writeFileSync('x', '');
```
Run: `npm run lint` → Expected: error containing `observe zone is read-only (spec §5.1)`
Delete those lines. Run: `npm run lint` → Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add src/main/observe/registryParser.ts test/fixtures/sessions test/unit/observe eslint.config.js
git commit -m "feat(observe): session registry parser + read-only lint zone"
```

---

### Task 4: Liveness — ProcessProbe interface, reaper, Windows implementation

**Files:**
- Create: `src/main/observe/liveness.ts`, `src/main/process/windowsProcessProbe.ts`
- Test: `test/unit/observe/liveness.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ProcessProbe { startFileTime(pid: number): Promise<string | null>; } // null = not running
export async function reapSessions(records: SessionRecord[], probe: ProcessProbe): Promise<{ live: SessionRecord[]; dead: SessionRecord[] }>;
export class WindowsProcessProbe implements ProcessProbe { constructor(ttlMs?: number) }
```
- `windowsProcessProbe.ts` lives in `src/main/process/`, **outside** the observe zone, because it spawns PowerShell. The observe zone sees only the interface.

- [ ] **Step 1: Write the failing test**

`test/unit/observe/liveness.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { reapSessions, type ProcessProbe } from '../../../src/main/observe/liveness';
import type { SessionRecord } from '../../../src/shared/types';

const rec = (pid: number, procStart: string): SessionRecord => ({
  pid, procStart, sessionId: `s${pid}`, cwd: 'C:\\x', name: `n${pid}`, status: 'idle', kind: 'interactive', startedAt: 0, updatedAt: 0,
});
const fakeProbe = (table: Record<number, string | null>): ProcessProbe => ({ startFileTime: async (pid) => table[pid] ?? null });

describe('reapSessions', () => {
  it('keeps sessions whose pid is alive with matching start time', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({ 10: '111' }));
    expect(r.live.map((s) => s.pid)).toEqual([10]); expect(r.dead).toEqual([]);
  });
  it('reaps a dead pid', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({}));
    expect(r.live).toEqual([]); expect(r.dead.map((s) => s.pid)).toEqual([10]);
  });
  it('reaps a reused pid (start time mismatch)', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({ 10: '999' }));
    expect(r.dead.map((s) => s.pid)).toEqual([10]);
  });
  it('treats a probe failure as dead, not as an exception', async () => {
    const probe: ProcessProbe = { startFileTime: async () => { throw new Error('pwsh exploded'); } };
    expect((await reapSessions([rec(10, '111')], probe)).dead).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/observe/liveness.test.ts` → Expected: FAIL, cannot find module

- [ ] **Step 3: Implement liveness.ts (observe zone — interface + pure reaper)**

`src/main/observe/liveness.ts`:
```ts
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
```

- [ ] **Step 4: Implement the Windows probe (outside the observe zone)**

`src/main/process/windowsProcessProbe.ts`:
```ts
import { execFile } from 'node:child_process';
import type { ProcessProbe } from '../observe/liveness';

/** One PowerShell call per TTL window; answers every pid from that snapshot. */
export class WindowsProcessProbe implements ProcessProbe {
  private cache = new Map<number, string>();
  private cacheAt = 0;
  private inflight: Promise<void> | null = null;
  constructor(private readonly ttlMs = 1500) {}

  async startFileTime(pid: number): Promise<string | null> {
    if (Date.now() - this.cacheAt > this.ttlMs) {
      this.inflight ??= this.refresh().finally(() => { this.inflight = null; });
      await this.inflight;
    }
    return this.cache.get(pid) ?? null;
  }

  private refresh(): Promise<void> {
    const script = 'Get-Process | ForEach-Object { try { "$($_.Id),$($_.StartTime.ToFileTime())" } catch {} }';
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => {
          if (!err) {
            const next = new Map<number, string>();
            for (const line of stdout.split(/\r?\n/)) {
              const [pid, ft] = line.split(',');
              if (pid && ft) next.set(Number(pid), ft.trim());
            }
            this.cache = next;
          }
          this.cacheAt = Date.now(); resolve();
        });
    });
  }
}
```

- [ ] **Step 5: Run tests, lint, typecheck**

Run: `npx vitest run test/unit/observe/liveness.test.ts` → Expected: 4 passed
Run: `npm run lint && npm run typecheck` → Expected: exit 0

- [ ] **Step 6: Manually verify the PowerShell one-liner against a real session**

Run: `powershell -NoProfile -Command "Get-Process claude | % { \"$($_.Id),$($_.StartTime.ToFileTime())\" }"`
Expected: one line per running Claude Code session; each second column equals `procStart` in `~/.claude/sessions/<pid>.json`.

- [ ] **Step 7: Commit**

```bash
git add src/main/observe/liveness.ts src/main/process test/unit/observe/liveness.test.ts
git commit -m "feat(observe): pid+procStart liveness reaper with PowerShell probe"
```

---

### Task 5: RegistryWatcher — sessions dir → upsert/gone events

**Files:**
- Create: `src/main/observe/registryWatcher.ts`
- Test: `test/unit/observe/registryWatcher.test.ts`

**Interfaces:**
- Consumes: `parseSessionFile`, `reapSessions`, `ProcessProbe`
- Produces:
```ts
export class RegistryWatcher extends EventEmitter {
  constructor(opts: { dir: string; probe: ProcessProbe; pollMs?: number });
  start(): Promise<void>; stop(): Promise<void>;
  snapshot(): SessionRecord[];
  // events: 'upsert' (SessionRecord) · 'gone' (SessionRecord)
}
```
- Design: chokidar reacts to file changes; **additionally** a poll every `pollMs` (default 2000) re-runs the reaper, because a killed terminal changes no file — its JSON just goes stale. The poll is what makes "sprite gone within 5 s" hold.

- [ ] **Step 1: Write the failing test (real temp dir, fake probe)**

`test/unit/observe/registryWatcher.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RegistryWatcher } from '../../../src/main/observe/registryWatcher';
import type { ProcessProbe } from '../../../src/main/observe/liveness';

const rec = (pid: number, name: string, status = 'busy') => JSON.stringify({
  pid, sessionId: `sid-${pid}`, cwd: 'C:\\x', name, status, kind: 'interactive', procStart: `ft${pid}`, startedAt: 1, updatedAt: 1,
});
const alive = new Set<number>();
const probe: ProcessProbe = { startFileTime: async (pid) => (alive.has(pid) ? `ft${pid}` : null) };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dir: string; let w: RegistryWatcher;
afterEach(async () => { await w?.stop(); rmSync(dir, { recursive: true, force: true }); alive.clear(); });

describe('RegistryWatcher', () => {
  it('emits upsert for live files present at start and ignores dead ones', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); writeFileSync(join(dir, '2.json'), rec(2, 'two'));
    alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 200 });
    const ups: string[] = []; w.on('upsert', (r) => ups.push(r.name));
    await w.start();
    expect(ups).toEqual(['one']); expect(w.snapshot().map((r) => r.pid)).toEqual([1]);
  });
  it('emits gone when a process dies even though its file remains', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 150 });
    const gone: number[] = []; w.on('gone', (r) => gone.push(r.pid));
    await w.start(); alive.delete(1); await wait(500);
    expect(gone).toEqual([1]); expect(w.snapshot()).toEqual([]);
  });
  it('emits upsert on status change of a live session', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 150 });
    const statuses: string[] = []; w.on('upsert', (r) => statuses.push(r.status));
    await w.start(); writeFileSync(join(dir, '1.json'), rec(1, 'one', 'idle')); await wait(500);
    expect(statuses).toEqual(['busy', 'idle']);
  });
  it('does not emit upsert twice for identical content', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 100 });
    let n = 0; w.on('upsert', () => n++);
    await w.start(); await wait(450);
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/observe/registryWatcher.test.ts` → Expected: FAIL, cannot find module

- [ ] **Step 3: Implement the watcher**

`src/main/observe/registryWatcher.ts`:
```ts
import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseSessionFile } from './registryParser';
import { reapSessions, type ProcessProbe } from './liveness';
import type { SessionRecord } from '../../shared/types';

export class RegistryWatcher extends EventEmitter {
  private readonly dir: string; private readonly probe: ProcessProbe; private readonly pollMs: number;
  private live = new Map<number, SessionRecord>();
  private watcher?: FSWatcher; private timer?: NodeJS.Timeout; private scanning = false;

  constructor(opts: { dir: string; probe: ProcessProbe; pollMs?: number }) {
    super(); this.dir = opts.dir; this.probe = opts.probe; this.pollMs = opts.pollMs ?? 2000;
  }

  snapshot(): SessionRecord[] { return [...this.live.values()]; }

  async start(): Promise<void> {
    await this.scan();
    this.watcher = chokidar.watch(this.dir, { ignoreInitial: true, depth: 0 });
    this.watcher.on('all', () => { void this.scan(); });
    this.timer = setInterval(() => { void this.scan(); }, this.pollMs);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.watcher?.close();
  }

  private async scan(): Promise<void> {
    if (this.scanning) return; this.scanning = true;
    try {
      let names: string[] = [];
      try { names = (await readdir(this.dir)).filter((n) => n.endsWith('.json')); } catch { names = []; }
      const parsed: SessionRecord[] = [];
      for (const n of names) {
        try { const r = parseSessionFile(await readFile(join(this.dir, n), 'utf8')); if (r) parsed.push(r); }
        catch { /* mid-write or vanished; next scan */ }
      }
      const { live } = await reapSessions(parsed, this.probe);
      const seen = new Set<number>();
      for (const r of live) {
        seen.add(r.pid);
        const prev = this.live.get(r.pid);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) { this.live.set(r.pid, r); this.emit('upsert', r); }
      }
      for (const [pid, r] of this.live) if (!seen.has(pid)) { this.live.delete(pid); this.emit('gone', r); }
    } finally { this.scanning = false; }
  }
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run test/unit/observe/registryWatcher.test.ts` → Expected: 4 passed
Run: `npm run lint` → Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/main/observe/registryWatcher.ts test/unit/observe/registryWatcher.test.ts
git commit -m "feat(observe): registry watcher with poll-based reaping"
```

---

### Task 6: Transcript parser — one JSONL line → ActivityEvent

**Files:**
- Create: `src/main/observe/transcriptParser.ts`
- Create: `test/fixtures/transcript/sample.jsonl`
- Test: `test/unit/observe/transcriptParser.test.ts`

**Interfaces:**
- Consumes: `emoteFor`, `ActivityEvent`
- Produces: `parseTranscriptLine(line: string): ActivityEvent[]` — zero or more events per line (an assistant record with a `tool_use` block yields both a `tool` event and a `usage` event). Returns `[]` for blank, truncated, or unknown lines. **Never throws.**

Record shapes (verified 2026-08-25 against a real transcript; only the fields we read):

| `type` | fields used |
|---|---|
| `assistant` | `sessionId`, `timestamp`, `gitBranch`, `isSidechain`, `message.content[]` (`{type:'tool_use',name,input}` or `{type:'text',text}`), `message.usage.{input_tokens,output_tokens,cache_read_input_tokens}` |
| `user` | `sessionId`, `timestamp`, `isMeta`, `message.content` — a string (typed prompt) or an array of `tool_result` blocks (ignored) |
| `ai-title` | `sessionId`, `aiTitle` |
| everything else (`attachment`, `system`, `mode`, `last-prompt`, `file-history-*`, `queue-operation`, `permission-mode`, `atis-latch`) | ignored |

Tool summaries: `Bash`/`PowerShell` → `input.description ?? input.command` (first 80 chars); `Read`/`Edit`/`Write` → `input.file_path` basename; `Grep`/`Glob` → `input.pattern`; `Skill` → `input.skill` and **also** emits a `skill` event; `Agent` → `input.description`; else → tool name.

- [ ] **Step 1: Create the fixture (scrubbed real lines — one JSON object per line)**

`test/fixtures/transcript/sample.jsonl`:
```
{"type":"user","sessionId":"S1","timestamp":"2026-08-24T07:09:10.000Z","cwd":"C:\\MaitriAutomation\\CaptureManage","gitBranch":"HEAD","isSidechain":false,"isMeta":null,"promptSource":"typed","message":{"role":"user","content":"hello we are testing the casMigration folder in dev"}}
{"type":"ai-title","aiTitle":"casMigration folder test","sessionId":"S1"}
{"type":"assistant","sessionId":"S1","timestamp":"2026-08-24T07:09:40.045Z","cwd":"C:\\MaitriAutomation\\CaptureManage","gitBranch":"test/CPTR-3136-cas-migration","isSidechain":false,"message":{"role":"assistant","model":"claude-sonnet-5","stop_reason":"tool_use","usage":{"input_tokens":2,"cache_creation_input_tokens":684,"cache_read_input_tokens":53775,"output_tokens":376},"content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"find . -ipath '*casMigration*'","description":"Find casMigration folder files"}}]}}
{"type":"user","sessionId":"S1","timestamp":"2026-08-24T07:09:41.000Z","gitBranch":"HEAD","isSidechain":false,"sourceToolAssistantUUID":"u1","message":{"role":"user","content":[{"tool_use_id":"toolu_01","type":"tool_result","content":"./jenkins/Jenkinsfile-casmigration","is_error":false}]}}
{"type":"assistant","sessionId":"S1","timestamp":"2026-08-24T07:09:50.000Z","gitBranch":"HEAD","isSidechain":false,"message":{"role":"assistant","model":"claude-sonnet-5","stop_reason":"tool_use","usage":{"input_tokens":5,"cache_read_input_tokens":100,"output_tokens":40},"content":[{"type":"tool_use","id":"toolu_02","name":"Skill","input":{"skill":"database-explorer","args":"list tables"}}]}}
{"type":"assistant","sessionId":"S1","timestamp":"2026-08-24T07:10:00.000Z","gitBranch":"HEAD","isSidechain":false,"message":{"role":"assistant","model":"claude-sonnet-5","stop_reason":"end_turn","usage":{"input_tokens":3,"cache_read_input_tokens":200,"output_tokens":120},"content":[{"type":"text","text":"Found the casMigration folder; the Jenkinsfile lives under jenkins/."}]}}
{"type":"system","subtype":"turn_duration","durationMs":15279,"sessionId":"S1","timestamp":"2026-08-24T07:10:01.000Z"}
{"type":"assistant","sessionId":"S1","timestamp":"2026-08-24T07:10:0
```
(The last line is intentionally truncated — a mid-append read.)

- [ ] **Step 2: Write the failing test**

`test/unit/observe/transcriptParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTranscriptLine } from '../../../src/main/observe/transcriptParser';

const lines = readFileSync(join(__dirname, '../../fixtures/transcript/sample.jsonl'), 'utf8').split('\n');
const L = (i: number) => lines[i]!;

describe('parseTranscriptLine', () => {
  it('typed user prompt → text event', () => {
    expect(parseTranscriptLine(L(0))).toEqual([
      { kind: 'text', sessionId: 'S1', at: '2026-08-24T07:09:10.000Z', role: 'user', text: 'hello we are testing the casMigration folder in dev' },
    ]);
  });
  it('ai-title → title event', () => {
    expect(parseTranscriptLine(L(1))).toEqual([{ kind: 'title', sessionId: 'S1', title: 'casMigration folder test' }]);
  });
  it('assistant tool_use → tool + usage + branch events', () => {
    expect(parseTranscriptLine(L(2))).toEqual([
      { kind: 'branch', sessionId: 'S1', branch: 'test/CPTR-3136-cas-migration' },
      { kind: 'tool', sessionId: 'S1', at: '2026-08-24T07:09:40.045Z', tool: 'Bash', emote: 'shell', summary: 'Find casMigration folder files' },
      { kind: 'usage', sessionId: 'S1', at: '2026-08-24T07:09:40.045Z', input: 2, output: 376, cacheRead: 53775 },
    ]);
  });
  it('tool_result user record → nothing', () => { expect(parseTranscriptLine(L(3))).toEqual([]); });
  it('Skill tool_use → tool event AND skill event', () => {
    const ev = parseTranscriptLine(L(4));
    expect(ev).toContainEqual({ kind: 'skill', sessionId: 'S1', at: '2026-08-24T07:09:50.000Z', skill: 'database-explorer' });
    expect(ev).toContainEqual({ kind: 'tool', sessionId: 'S1', at: '2026-08-24T07:09:50.000Z', tool: 'Skill', emote: 'skill', summary: 'database-explorer' });
  });
  it('assistant text → text event + usage', () => {
    const ev = parseTranscriptLine(L(5));
    expect(ev).toContainEqual({ kind: 'text', sessionId: 'S1', at: '2026-08-24T07:10:00.000Z', role: 'assistant', text: 'Found the casMigration folder; the Jenkinsfile lives under jenkins/.' });
    expect(ev).toContainEqual({ kind: 'usage', sessionId: 'S1', at: '2026-08-24T07:10:00.000Z', input: 3, output: 120, cacheRead: 200 });
  });
  it('system record → nothing', () => { expect(parseTranscriptLine(L(6))).toEqual([]); });
  it('truncated line → nothing, no throw', () => { expect(parseTranscriptLine(L(7))).toEqual([]); });
  it('blank line → nothing', () => { expect(parseTranscriptLine('')).toEqual([]); });
  it('gitBranch "HEAD" is not reported as a branch', () => {
    expect(parseTranscriptLine(L(5)).some((e) => e.kind === 'branch')).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/unit/observe/transcriptParser.test.ts` → Expected: FAIL, cannot find module

- [ ] **Step 4: Implement the parser**

`src/main/observe/transcriptParser.ts`:
```ts
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/unit/observe/transcriptParser.test.ts` → Expected: 10 passed

- [ ] **Step 6: Commit**

```bash
git add src/main/observe/transcriptParser.ts test/fixtures/transcript test/unit/observe/transcriptParser.test.ts
git commit -m "feat(observe): transcript line parser (tool, text, usage, title, branch, skill)"
```

---

### Task 7: TranscriptTailer — byte-offset tail with partial-line safety

**Files:**
- Create: `src/main/observe/transcriptTailer.ts`
- Test: `test/unit/observe/transcriptTailer.test.ts`

**Interfaces:**
- Consumes: `parseTranscriptLine`
- Produces:
```ts
export class TranscriptTailer extends EventEmitter {
  constructor(opts: { file: string; fromStart?: boolean });  // fromStart=false → only new lines after start()
  start(): Promise<void>; stop(): Promise<void>;
  // events: 'events' (ActivityEvent[]) — one emission per read that produced ≥1 event
}
```
- Design: keep a byte offset; on each change read from offset to EOF; split on `\n`; the **last segment without a trailing newline is kept in a carry buffer** and prepended next time. If the file shrinks (rotation), reset offset to 0.

- [ ] **Step 1: Write the failing test**

`test/unit/observe/transcriptTailer.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TranscriptTailer } from '../../../src/main/observe/transcriptTailer';
import type { ActivityEvent } from '../../../src/shared/types';

const title = (t: string) => JSON.stringify({ type: 'ai-title', sessionId: 'S', aiTitle: t });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dir: string; let t: TranscriptTailer;
afterEach(async () => { await t?.stop(); rmSync(dir, { recursive: true, force: true }); });

describe('TranscriptTailer', () => {
  it('fromStart reads existing lines', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, title('one') + '\n' + title('two') + '\n');
    t = new TranscriptTailer({ file: f, fromStart: true });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start();
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['one', 'two']);
  });
  it('default skips existing lines and emits only appended ones', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, title('old') + '\n');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start(); appendFileSync(f, title('new') + '\n'); await wait(400);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['new']);
  });
  it('holds a partial line until its newline arrives', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, '');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start();
    const full = title('split'); appendFileSync(f, full.slice(0, 20)); await wait(300);
    expect(got).toEqual([]);
    appendFileSync(f, full.slice(20) + '\n'); await wait(400);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['split']);
  });
  it('tolerates a file that does not exist yet', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'later.jsonl');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start(); writeFileSync(f, title('born') + '\n'); await wait(500);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['born']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/observe/transcriptTailer.test.ts` → Expected: FAIL, cannot find module

- [ ] **Step 3: Implement the tailer**

`src/main/observe/transcriptTailer.ts`:
```ts
import { EventEmitter } from 'node:events';
import { open, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseTranscriptLine } from './transcriptParser';
import type { ActivityEvent } from '../../shared/types';

export class TranscriptTailer extends EventEmitter {
  private readonly file: string; private readonly fromStart: boolean;
  private offset = 0; private carry = ''; private watcher?: FSWatcher; private reading = false; private pending = false;

  constructor(opts: { file: string; fromStart?: boolean }) { super(); this.file = opts.file; this.fromStart = opts.fromStart ?? false; }

  async start(): Promise<void> {
    if (!this.fromStart) { try { this.offset = (await stat(this.file)).size; } catch { this.offset = 0; } }
    else await this.read();
    // watch the directory so a not-yet-existing file is picked up when created
    this.watcher = chokidar.watch(dirname(this.file), { ignoreInitial: true, depth: 0 });
    this.watcher.on('all', (_ev, p) => { if (p === this.file) void this.read(); });
  }

  async stop(): Promise<void> { await this.watcher?.close(); }

  private async read(): Promise<void> {
    if (this.reading) { this.pending = true; return; }
    this.reading = true;
    try {
      let size: number; try { size = (await stat(this.file)).size; } catch { return; }
      if (size < this.offset) { this.offset = 0; this.carry = ''; }        // truncated/rotated
      if (size === this.offset) return;
      const fh = await open(this.file, 'r');
      try {
        const buf = Buffer.alloc(size - this.offset);
        const { bytesRead } = await fh.read(buf, 0, buf.length, this.offset);
        this.offset += bytesRead;
        const text = this.carry + buf.subarray(0, bytesRead).toString('utf8');
        const parts = text.split('\n');
        this.carry = parts.pop() ?? '';                                        // last piece has no newline yet
        const events: ActivityEvent[] = [];
        for (const line of parts) events.push(...parseTranscriptLine(line.replace(/\r$/, '')));
        if (events.length) this.emit('events', events);
      } finally { await fh.close(); }
    } finally {
      this.reading = false;
      if (this.pending) { this.pending = false; void this.read(); }
    }
  }
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run test/unit/observe/transcriptTailer.test.ts` → Expected: 4 passed
Run: `npm run lint` → Expected: exit 0 (`open` with `'r'` and `stat` are reads)

- [ ] **Step 5: Commit**

```bash
git add src/main/observe/transcriptTailer.ts test/unit/observe/transcriptTailer.test.ts
git commit -m "feat(observe): byte-offset transcript tailer with partial-line carry"
```

---

### Task 8: Transcript locator — (cwd, sessionId) → file path

**Files:**
- Create: `src/main/observe/transcriptLocator.ts`
- Test: `test/unit/observe/transcriptLocator.test.ts`

**Interfaces:**
- Produces:
```ts
export function projectSlug(cwd: string): string;   // "C:\MaitriAutomation\CaptureManage" → "C--MaitriAutomation-CaptureManage"
export function transcriptPath(claudeHome: string, cwd: string, sessionId: string): string;
```
- Verified slug rule (2026-08-25, from `~/.claude/projects/`): every character that is not `[A-Za-z0-9]` becomes `-`; case is preserved (`C--MaitriAutomation-CaptureManage`, `c--careerGrowth` both exist — the drive letter's case follows what Claude Code recorded as `cwd`). Path = `<claudeHome>/projects/<slug>/<sessionId>.jsonl`.

- [ ] **Step 1: Write the failing test**

`test/unit/observe/transcriptLocator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { projectSlug, transcriptPath } from '../../../src/main/observe/transcriptLocator';

describe('projectSlug', () => {
  it.each([
    ['C:\\MaitriAutomation\\CaptureManage', 'C--MaitriAutomation-CaptureManage'],
    ['c:\\careerGrowth', 'c--careerGrowth'],
    ['C:\\MaitriAutomation\\capture-qa-automation\\Evaire', 'C--MaitriAutomation-capture-qa-automation-Evaire'],
    ['C:\\Users\\Suraj.Maharjan', 'C--Users-Suraj-Maharjan'],
  ])('%s → %s', (cwd, slug) => { expect(projectSlug(cwd)).toBe(slug); });
});

describe('transcriptPath', () => {
  it('joins home, projects, slug and sessionId', () => {
    expect(transcriptPath('C:\\Users\\me\\.claude', 'C:\\x\\y', 'abc'))
      .toBe('C:\\Users\\me\\.claude\\projects\\C--x-y\\abc.jsonl');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/observe/transcriptLocator.test.ts` → Expected: FAIL

- [ ] **Step 3: Implement**

`src/main/observe/transcriptLocator.ts`:
```ts
import { join } from 'node:path';

export function projectSlug(cwd: string): string { return cwd.replace(/[^A-Za-z0-9]/g, '-'); }

export function transcriptPath(claudeHome: string, cwd: string, sessionId: string): string {
  return join(claudeHome, 'projects', projectSlug(cwd), `${sessionId}.jsonl`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/unit/observe/transcriptLocator.test.ts` → Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/main/observe/transcriptLocator.ts test/unit/observe/transcriptLocator.test.ts
git commit -m "feat(observe): transcript path locator"
```

---

### Task 9: Office config + station placement

**Files:**
- Create: `office.config.json`, `src/main/office/config.ts`, `src/main/office/placement.ts`
- Test: `test/unit/office/placement.test.ts`, `test/unit/office/config.test.ts`

**Interfaces:**
- Consumes: `Station`, `OfficeConfig`
- Produces:
```ts
export function placeOccupant(cwd: string, lastSkill: string | undefined, cfg: OfficeConfig): string; // stationId
export function loadConfig(file: string): OfficeConfig;            // throws on invalid shape, with a readable message
export function saveConfig(file: string, cfg: OfficeConfig): void; // office/ is NOT in the observe zone; writing our own config is allowed
export function assignFolder(cfg: OfficeConfig, cwd: string, stationId: string): OfficeConfig; // pure; returns new config
```
- Placement rules (spec §6.1): (1) candidate stations = those whose `cwds` contain a **case-insensitive path prefix** of `cwd` (compare with trailing separator so `C:\a\b` does not match `C:\a\bc`); (2) if `lastSkill` is in exactly one candidate's `skills`, that station; (3) else `defaultStationByCwd[longestMatchingCwd]` if set; (4) else the candidate with the longest matching `cwd`; (5) no candidate → `lobbyId`.

- [ ] **Step 1: Write the initial config (real folders; skills from spec §6.1)**

`office.config.json`:
```json
{
  "lobbyId": "lobby",
  "defaultStationByCwd": {
    "C:\\MaitriAutomation\\capture-qa-automation": "automation-lab",
    "C:\\MaitriAutomation\\capture-qa-automation-react": "automation-lab",
    "C:\\MaitriAutomation\\CaptureManage": "automation-lab",
    "C:\\MaitriAutomation\\newunique-tool": "automation-lab"
  },
  "stations": [
    { "id": "intake",         "name": "Intake",           "grid": { "col": 0, "row": 0 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\capture-qa-automation-react", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["from-jira", "jira-fetcher"] },
    { "id": "test-design",    "name": "Test Design",      "grid": { "col": 1, "row": 0 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\capture-qa-automation-react", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["write-test-case", "write-test-case-capture", "qase-fetcher", "code-walker", "write-spec"] },
    { "id": "automation-lab", "name": "Automation Lab",   "grid": { "col": 2, "row": 0 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\capture-qa-automation-react", "C:\\MaitriAutomation\\CaptureManage", "C:\\MaitriAutomation\\newunique-tool"],
      "skills": ["write-automation-test", "write-automation-test-capture", "dom-locator-automation", "add-page-coverage", "add-api-coverage"] },
    { "id": "data-kitchen",   "name": "Data Kitchen",     "grid": { "col": 3, "row": 0 },
      "cwds": ["C:\\MaitriAutomation\\CaptureImpDatabase", "C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["add-test-data-generator", "add-test-data-generator-capture", "database-explorer"] },
    { "id": "ci-watchtower",  "name": "CI Watchtower",    "grid": { "col": 0, "row": 1 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["jenkins-build-investigator"] },
    { "id": "triage",         "name": "Triage & Repair",  "grid": { "col": 1, "row": 1 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\capture-qa-automation-react", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["heal-automation-test", "heal-automation-test-capture", "triage-bug", "triage-bug-capture"] },
    { "id": "records",        "name": "Records Office",   "grid": { "col": 2, "row": 1 },
      "cwds": ["C:\\MaitriAutomation\\capture-qa-automation", "C:\\MaitriAutomation\\capture-qa-automation-react", "C:\\MaitriAutomation\\CaptureManage"],
      "skills": ["qase-integration", "check-automation-coverage", "check-automation-coverage-capture", "audit-qase-data", "test-coverage-analyzer", "generate-qase-csv"] },
    { "id": "your-desk",      "name": "Your Desk",        "grid": { "col": 3, "row": 1 }, "cwds": [], "skills": [] },
    { "id": "lobby",          "name": "Lobby",            "grid": { "col": 0, "row": 2 }, "cwds": [], "skills": [] }
  ]
}
```

- [ ] **Step 2: Write the failing placement test**

`test/unit/office/placement.test.ts`:
```ts
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
```

- [ ] **Step 3: Write the failing config test**

`test/unit/office/config.test.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify both fail**

Run: `npx vitest run test/unit/office` → Expected: FAIL, cannot find modules

- [ ] **Step 5: Implement placement.ts**

`src/main/office/placement.ts`:
```ts
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
```

- [ ] **Step 6: Implement config.ts**

`src/main/office/config.ts`:
```ts
import { readFileSync, writeFileSync } from 'node:fs';
import type { OfficeConfig, Station } from '../../shared/types';

function isStation(v: unknown): v is Station {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>; const g = s['grid'] as Record<string, unknown> | undefined;
  return typeof s['id'] === 'string' && typeof s['name'] === 'string' && Array.isArray(s['cwds']) && Array.isArray(s['skills'])
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
```

- [ ] **Step 7: Run tests, lint, typecheck**

Run: `npx vitest run test/unit/office` → Expected: 12 passed
Run: `npm run lint && npm run typecheck` → Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add office.config.json src/main/office/config.ts src/main/office/placement.ts test/unit/office
git commit -m "feat(office): station config and cwd/skill placement rules"
```

---

### Task 10: OfficeStore — merge events into one OfficeState

**Files:**
- Create: `src/main/office/officeStore.ts`
- Test: `test/unit/office/officeStore.test.ts`

**Interfaces:**
- Consumes: `SessionRecord`, `ActivityEvent`, `OfficeConfig`, `placeOccupant`
- Produces:
```ts
export class OfficeStore extends EventEmitter {
  constructor(cfg: OfficeConfig, opts?: { maxLog?: number; now?: () => string });
  setConfig(cfg: OfficeConfig): void;                 // re-places everyone
  upsertSession(r: SessionRecord): void;
  sessionGone(r: SessionRecord): void;                // marks status 'gone'; removed after removeGone()
  applyEvents(events: ActivityEvent[]): void;
  removeGone(olderThanMs: number): void;              // drop 'gone' occupants whose lastSeen is older
  state(): OfficeState;
  // event: 'change' (OfficeState) — debounced to at most one per 100 ms
}
```
- Log lines (spec §6.2 activity log): a `tool` event logs `"▸ Bash  Find casMigration folder files"`; a `skill` event logs `"⚑ skill database-explorer"`; a `title` event logs `"✎ titled: …"`; `upsertSession` for a new pid logs `"● joined <station name>"`; `sessionGone` logs `"○ left"`. `text` and `usage` events update state but do not log (too noisy).

- [ ] **Step 1: Write the failing test**

`test/unit/office/officeStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { OfficeStore } from '../../../src/main/office/officeStore';
import type { OfficeConfig, SessionRecord } from '../../../src/shared/types';

const cfg: OfficeConfig = {
  lobbyId: 'lobby', defaultStationByCwd: { 'C:\\A\\repo': 'lab' },
  stations: [
    { id: 'design', name: 'Design', grid: { col: 0, row: 0 }, cwds: ['C:\\A\\repo'], skills: ['write-test-case'] },
    { id: 'lab', name: 'Lab', grid: { col: 1, row: 0 }, cwds: ['C:\\A\\repo'], skills: [] },
    { id: 'lobby', name: 'Lobby', grid: { col: 0, row: 1 }, cwds: [], skills: [] },
  ],
};
const sess = (pid: number, cwd = 'C:\\A\\repo'): SessionRecord => ({
  pid, sessionId: `s${pid}`, cwd, name: `n${pid}`, status: 'busy', kind: 'interactive', procStart: 'x', startedAt: 0, updatedAt: 0,
});
const mk = () => new OfficeStore(cfg, { now: () => '2026-08-25T10:00:00.000Z' });

describe('OfficeStore', () => {
  it('places a new session and logs the join', () => {
    const st = mk(); st.upsertSession(sess(1));
    const s = st.state();
    expect(s.occupants).toHaveLength(1);
    expect(s.occupants[0]).toMatchObject({ sessionId: 's1', stationId: 'lab', status: 'busy', origin: 'walkin', tokens: { input: 0, output: 0, cacheRead: 0 } });
    expect(s.log.at(-1)?.text).toBe('● joined Lab');
  });
  it('unknown cwd lands in the lobby', () => { const st = mk(); st.upsertSession(sess(2, 'Z:\\q')); expect(st.state().occupants[0]?.stationId).toBe('lobby'); });
  it('tool event sets current tool + emote and logs', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'tool', sessionId: 's1', at: 't', tool: 'Grep', emote: 'search', summary: 'data-testid' }]);
    expect(st.state().occupants[0]).toMatchObject({ currentTool: 'Grep', emote: 'search' });
    expect(st.state().log.at(-1)?.text).toBe('▸ Grep  data-testid');
  });
  it('usage accumulates', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'usage', sessionId: 's1', at: 't', input: 2, output: 10, cacheRead: 100 }, { kind: 'usage', sessionId: 's1', at: 't', input: 3, output: 5, cacheRead: 50 }]);
    expect(st.state().occupants[0]?.tokens).toEqual({ input: 5, output: 15, cacheRead: 150 });
  });
  it('skill event re-places the occupant', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'skill', sessionId: 's1', at: 't', skill: 'write-test-case' }]);
    expect(st.state().occupants[0]).toMatchObject({ stationId: 'design', lastSkill: 'write-test-case' });
  });
  it('title and branch are recorded', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'title', sessionId: 's1', title: 'CAS tests' }, { kind: 'branch', sessionId: 's1', branch: 'test/x' }]);
    expect(st.state().occupants[0]).toMatchObject({ title: 'CAS tests', branch: 'test/x' });
  });
  it('events for unknown sessions are ignored', () => {
    const st = mk(); st.applyEvents([{ kind: 'title', sessionId: 'ghost', title: 'x' }]); expect(st.state().occupants).toEqual([]);
  });
  it('gone marks then removeGone drops', () => {
    let t = 0; const st = new OfficeStore(cfg, { now: () => new Date(t).toISOString() });
    st.upsertSession(sess(1)); st.sessionGone(sess(1));
    expect(st.state().occupants[0]?.status).toBe('gone'); expect(st.state().log.at(-1)?.text).toBe('○ left');
    t = 10_000; st.removeGone(5_000); expect(st.state().occupants).toEqual([]);
  });
  it('setConfig re-places everyone', () => {
    const st = mk(); st.upsertSession(sess(2, 'Z:\\q'));
    st.setConfig({ ...cfg, stations: cfg.stations.map((s) => (s.id === 'lab' ? { ...s, cwds: [...s.cwds, 'Z:\\q'] } : s)) });
    expect(st.state().occupants[0]?.stationId).toBe('lab');
  });
  it('log is capped', () => {
    const st = new OfficeStore(cfg, { maxLog: 3 }); st.upsertSession(sess(1));
    for (let i = 0; i < 5; i++) st.applyEvents([{ kind: 'tool', sessionId: 's1', at: 't', tool: 'Read', emote: 'read', summary: `f${i}` }]);
    expect(st.state().log).toHaveLength(3); expect(st.state().log.at(-1)?.text).toBe('▸ Read  f4');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/unit/office/officeStore.test.ts` → Expected: FAIL

- [ ] **Step 3: Implement the store**

`src/main/office/officeStore.ts`:
```ts
import { EventEmitter } from 'node:events';
import { placeOccupant } from './placement';
import type { ActivityEvent, LogLine, Occupant, OfficeConfig, OfficeState, SessionRecord } from '../../shared/types';

export class OfficeStore extends EventEmitter {
  private cfg: OfficeConfig;
  private occ = new Map<string, Occupant>();   // by sessionId
  private log: LogLine[] = [];
  private readonly maxLog: number; private readonly now: () => string;
  private timer?: NodeJS.Timeout;

  constructor(cfg: OfficeConfig, opts: { maxLog?: number; now?: () => string } = {}) {
    super(); this.cfg = cfg; this.maxLog = opts.maxLog ?? 500; this.now = opts.now ?? (() => new Date().toISOString());
  }

  private stationName(id: string): string { return this.cfg.stations.find((s) => s.id === id)?.name ?? id; }
  private push(o: Occupant, text: string): void {
    this.log.push({ at: this.now(), sessionId: o.sessionId, name: o.name, text });
    if (this.log.length > this.maxLog) this.log.splice(0, this.log.length - this.maxLog);
  }
  private changed(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.emit('change', this.state()); }, 100);
  }

  setConfig(cfg: OfficeConfig): void {
    this.cfg = cfg;
    for (const o of this.occ.values()) o.stationId = placeOccupant(o.cwd, o.lastSkill, cfg);
    this.changed();
  }

  upsertSession(r: SessionRecord): void {
    const prev = this.occ.get(r.sessionId);
    if (prev) { prev.status = r.status; prev.name = r.name; prev.lastSeen = this.now(); this.changed(); return; }
    const o: Occupant = {
      sessionId: r.sessionId, name: r.name, pid: r.pid, cwd: r.cwd, status: r.status, origin: 'walkin',
      stationId: placeOccupant(r.cwd, undefined, this.cfg), tokens: { input: 0, output: 0, cacheRead: 0 }, lastSeen: this.now(),
    };
    this.occ.set(o.sessionId, o); this.push(o, `● joined ${this.stationName(o.stationId)}`); this.changed();
  }

  sessionGone(r: SessionRecord): void {
    const o = this.occ.get(r.sessionId); if (!o) return;
    o.status = 'gone'; o.lastSeen = this.now(); this.push(o, '○ left'); this.changed();
  }

  removeGone(olderThanMs: number): void {
    const cutoff = Date.parse(this.now()) - olderThanMs;
    for (const [id, o] of this.occ) if (o.status === 'gone' && Date.parse(o.lastSeen) < cutoff) this.occ.delete(id);
    this.changed();
  }

  applyEvents(events: ActivityEvent[]): void {
    for (const e of events) {
      const o = this.occ.get(e.sessionId); if (!o) continue;
      switch (e.kind) {
        case 'tool': o.currentTool = e.tool; o.emote = e.emote; o.lastSeen = this.now(); this.push(o, `▸ ${e.tool}  ${e.summary}`); break;
        case 'skill': o.lastSkill = e.skill; o.stationId = placeOccupant(o.cwd, e.skill, this.cfg); this.push(o, `⚑ skill ${e.skill}`); break;
        case 'usage': o.tokens = { input: o.tokens.input + e.input, output: o.tokens.output + e.output, cacheRead: o.tokens.cacheRead + e.cacheRead }; break;
        case 'title': o.title = e.title; this.push(o, `✎ titled: ${e.title}`); break;
        case 'branch': o.branch = e.branch; break;
        case 'text': o.lastSeen = this.now(); break;
      }
    }
    if (events.length) this.changed();
  }

  state(): OfficeState {
    return { stations: this.cfg.stations, lobbyId: this.cfg.lobbyId, occupants: [...this.occ.values()].map((o) => ({ ...o, tokens: { ...o.tokens } })), log: [...this.log], generatedAt: this.now() };
  }
}
```

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `npx vitest run test/unit/office/officeStore.test.ts` → Expected: 10 passed
Run: `npm run lint && npm run typecheck` → Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/main/office/officeStore.ts test/unit/office/officeStore.test.ts
git commit -m "feat(office): OfficeStore merges registry + transcript events into OfficeState"
```

---

### Task 11: Main-process composition + preload bridge

**Files:**
- Modify: `src/main/index.ts`
- Create: `src/main/observatory.ts`, `src/preload/index.ts` (replace), `src/preload/index.d.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–10.
- Produces (renderer-facing, via `window.office`):
```ts
interface OfficeApi {
  onState(cb: (s: OfficeState) => void): () => void;   // returns unsubscribe
  requestState(): void;
  assignFolder(cwd: string, stationId: string): void;
}
```
- `Observatory` owns one `RegistryWatcher`, one `TranscriptTailer` per live session (created on `upsert`, stopped on `gone`), and the `OfficeStore`. Tailers start with `fromStart: false` so the floor does not replay an hour of history at boot; the store still gets `title`/`branch` from the **first read of the last 64 KB** of the file (done once per new tailer via `readTail`) — this gives a title and branch immediately without full replay.

- [ ] **Step 1: Write observatory.ts**

`src/main/observatory.ts`:
```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { open, stat } from 'node:fs/promises';
import { RegistryWatcher } from './observe/registryWatcher';
import { TranscriptTailer } from './observe/transcriptTailer';
import { transcriptPath } from './observe/transcriptLocator';
import { parseTranscriptLine } from './observe/transcriptParser';
import { WindowsProcessProbe } from './process/windowsProcessProbe';
import { OfficeStore } from './office/officeStore';
import { loadConfig, saveConfig } from './office/config';
import { assignFolder } from './office/placement';
import type { OfficeState, SessionRecord } from '../shared/types';

const TAIL_BYTES = 64 * 1024;

/** Read the last ≤64 KB of a transcript once, keeping only title/branch/skill events (cheap warm start). */
async function readTail(file: string): Promise<ReturnType<typeof parseTranscriptLine>> {
  try {
    const size = (await stat(file)).size; const from = Math.max(0, size - TAIL_BYTES);
    const fh = await open(file, 'r');
    try {
      const buf = Buffer.alloc(size - from); const { bytesRead } = await fh.read(buf, 0, buf.length, from);
      const lines = buf.subarray(0, bytesRead).toString('utf8').split('\n'); if (from > 0) lines.shift();
      return lines.flatMap((l) => parseTranscriptLine(l)).filter((e) => e.kind === 'title' || e.kind === 'branch' || e.kind === 'skill');
    } finally { await fh.close(); }
  } catch { return []; }
}

export class Observatory {
  readonly claudeHome = join(homedir(), '.claude');
  readonly store: OfficeStore;
  private readonly configFile: string;
  private readonly registry: RegistryWatcher;
  private tailers = new Map<string, TranscriptTailer>();
  private reaper?: NodeJS.Timeout;

  constructor(configFile: string) {
    this.configFile = configFile;
    this.store = new OfficeStore(loadConfig(configFile));
    this.registry = new RegistryWatcher({ dir: join(this.claudeHome, 'sessions'), probe: new WindowsProcessProbe(), pollMs: 2000 });
    this.registry.on('upsert', (r: SessionRecord) => { this.store.upsertSession(r); void this.ensureTailer(r); });
    this.registry.on('gone', (r: SessionRecord) => { this.store.sessionGone(r); void this.dropTailer(r.sessionId); });
  }

  async start(): Promise<void> {
    await this.registry.start();
    this.reaper = setInterval(() => this.store.removeGone(60_000), 10_000);
  }

  async stop(): Promise<void> {
    if (this.reaper) clearInterval(this.reaper);
    await this.registry.stop();
    await Promise.all([...this.tailers.values()].map((t) => t.stop()));
  }

  state(): OfficeState { return this.store.state(); }

  assignFolder(cwd: string, stationId: string): void {
    const next = assignFolder(loadConfig(this.configFile), cwd, stationId);
    saveConfig(this.configFile, next);
    this.store.setConfig(next);
  }

  private async ensureTailer(r: SessionRecord): Promise<void> {
    if (this.tailers.has(r.sessionId)) return;
    const file = transcriptPath(this.claudeHome, r.cwd, r.sessionId);
    const t = new TranscriptTailer({ file, fromStart: false });
    this.tailers.set(r.sessionId, t);
    t.on('events', (ev) => this.store.applyEvents(ev));
    this.store.applyEvents(await readTail(file));
    await t.start();
  }

  private async dropTailer(sessionId: string): Promise<void> {
    const t = this.tailers.get(sessionId); if (!t) return;
    this.tailers.delete(sessionId); await t.stop();
  }
}
```

- [ ] **Step 2: Rewrite src/main/index.ts to host the observatory and bridge IPC**

`src/main/index.ts`:
```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { Observatory } from './observatory';
import { IPC, type OfficeState } from '../shared/types';

let win: BrowserWindow | undefined;
const configFile = join(app.isPackaged ? app.getPath('userData') : process.cwd(), 'office.config.json');
const obs = new Observatory(configFile);

function send(s: OfficeState): void { win?.webContents.send(IPC.state, s); }

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400, height: 900, title: 'QA Office', backgroundColor: '#13151d',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  win.webContents.on('did-finish-load', () => send(obs.state()));
}

app.whenReady().then(async () => {
  obs.store.on('change', send);
  ipcMain.on(IPC.requestState, () => send(obs.state()));
  ipcMain.on(IPC.assignFolder, (_e, cwd: string, stationId: string) => {
    if (typeof cwd === 'string' && typeof stationId === 'string') obs.assignFolder(cwd, stationId);
  });
  createWindow();
  await obs.start();
});
app.on('window-all-closed', () => { void obs.stop().finally(() => app.quit()); });
```

- [ ] **Step 3: Write the preload bridge and its type declaration**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type OfficeState } from '../shared/types';

contextBridge.exposeInMainWorld('office', {
  onState(cb: (s: OfficeState) => void): () => void {
    const h = (_e: unknown, s: OfficeState) => cb(s);
    ipcRenderer.on(IPC.state, h);
    return () => ipcRenderer.off(IPC.state, h);
  },
  requestState(): void { ipcRenderer.send(IPC.requestState); },
  assignFolder(cwd: string, stationId: string): void { ipcRenderer.send(IPC.assignFolder, cwd, stationId); },
});
```

`src/preload/index.d.ts`:
```ts
import type { OfficeState } from '../shared/types';
export interface OfficeApi {
  onState(cb: (s: OfficeState) => void): () => void;
  requestState(): void;
  assignFolder(cwd: string, stationId: string): void;
}
declare global { interface Window { office: OfficeApi } }
```

- [ ] **Step 4: Temporary renderer proof — print the state**

Replace `src/renderer/main.tsx` body with:
```tsx
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { OfficeState } from '../shared/types';

function App() {
  const [s, setS] = useState<OfficeState | null>(null);
  useEffect(() => { const off = window.office.onState(setS); window.office.requestState(); return off; }, []);
  return <pre style={{ padding: 16, fontSize: 12 }}>{s ? JSON.stringify({ n: s.occupants.length, occupants: s.occupants.map((o) => [o.name, o.stationId, o.status, o.currentTool]), lastLog: s.log.at(-1) }, null, 2) : 'waiting…'}</pre>;
}
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 5: Run it against the real machine**

Run: `npm run typecheck && npm run lint` → Expected: exit 0
Run: `npm run dev` → Expected: the window lists every currently running Claude Code terminal (names like `capturemanage-b3`) with a station id and `busy`/`idle`; typing a command in one of those terminals updates `currentTool` within ~1 s.
Then: close one of those terminals → its entry shows `gone` within 5 s. Reopen — it reappears.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/observatory.ts src/preload
git add src/renderer/main.tsx
git commit -m "feat(main): observatory composition + IPC bridge to renderer"
```

---

### Task 12: Renderer — Zustand store + PixiJS floor (rooms, sprites, status, emotes)

**Files:**
- Create: `src/renderer/store.ts`, `src/renderer/floor/Floor.tsx`, `src/renderer/floor/layout.ts`, `src/renderer/floor/RoomLayer.ts`, `src/renderer/floor/SpriteLayer.ts`
- Modify: `src/renderer/main.tsx`, `src/renderer/index.html`
- Test: `test/unit/renderer/layout.test.ts`

**Interfaces:**
- Consumes: `window.office`, `OfficeState`
- Produces:
```ts
// store.ts
export const useOffice: UseBoundStore<StoreApi<{ state: OfficeState | null; selected: string | null; follow: boolean; select(id: string | null): void; toggleFollow(): void }>>;
// layout.ts (pure — tested)
export const ROOM_W = 300, ROOM_H = 190, GAP = 16, PAD = 16;
export function roomRect(grid: { col: number; row: number }): { x: number; y: number; w: number; h: number };
export function seatPosition(room: { x: number; y: number; w: number; h: number }, index: number): { x: number; y: number }; // 3 per row, 44px apart
```
- Visual language (from the approved mockup): ink `#13151d` ground, room `#232838` with `#39415a` border, grid lines `#2b3147`; status dot amber `#ffb454` busy · green `#7dd98f` idle · grey `#6b7390` gone; walk-in body `#4a5068`. Emote glyphs drawn as text in a small bubble: search 🔍 · read 📖 · edit ✏️ · shell ⌨ · browser 🌐 · skill ⚑ · delegate 👥 · other ⋯. Sprites are Pixi `Graphics` (head/body/legs rectangles) — no external assets in phase 1.

- [ ] **Step 1: Write the failing layout test**

`test/unit/renderer/layout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { roomRect, seatPosition, ROOM_W, ROOM_H, GAP, PAD } from '../../../src/renderer/floor/layout';

describe('layout', () => {
  it('places rooms on a grid with gaps', () => {
    expect(roomRect({ col: 0, row: 0 })).toEqual({ x: PAD, y: PAD, w: ROOM_W, h: ROOM_H });
    expect(roomRect({ col: 2, row: 1 })).toEqual({ x: PAD + 2 * (ROOM_W + GAP), y: PAD + (ROOM_H + GAP), w: ROOM_W, h: ROOM_H });
  });
  it('seats occupants three per row inside the room', () => {
    const r = roomRect({ col: 0, row: 0 });
    const a = seatPosition(r, 0), b = seatPosition(r, 1), d = seatPosition(r, 3);
    expect(b.x - a.x).toBe(44); expect(b.y).toBe(a.y);
    expect(d.x).toBe(a.x); expect(d.y - a.y).toBe(40);
    expect(d.x).toBeGreaterThan(r.x); expect(d.y).toBeLessThan(r.y + r.h);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run test/unit/renderer/layout.test.ts` → FAIL

- [ ] **Step 3: Implement layout.ts**

`src/renderer/floor/layout.ts`:
```ts
export const ROOM_W = 300, ROOM_H = 190, GAP = 16, PAD = 16;
export interface Rect { x: number; y: number; w: number; h: number }
export function roomRect(grid: { col: number; row: number }): Rect {
  return { x: PAD + grid.col * (ROOM_W + GAP), y: PAD + grid.row * (ROOM_H + GAP), w: ROOM_W, h: ROOM_H };
}
export function seatPosition(room: Rect, index: number): { x: number; y: number } {
  const col = index % 3, row = Math.floor(index / 3);
  return { x: room.x + 36 + col * 44, y: room.y + 64 + row * 40 };
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run test/unit/renderer/layout.test.ts` → 2 passed

- [ ] **Step 5: Write the Zustand store**

`src/renderer/store.ts`:
```ts
import { create } from 'zustand';
import type { OfficeState } from '../shared/types';

interface OfficeUi {
  state: OfficeState | null; selected: string | null; follow: boolean;
  setState(s: OfficeState): void; select(id: string | null): void; toggleFollow(): void;
}
export const useOffice = create<OfficeUi>((set) => ({
  state: null, selected: null, follow: false,
  setState: (state) => set({ state }),
  select: (selected) => set((u) => ({ selected, follow: selected === u.selected ? u.follow : false })),
  toggleFollow: () => set((u) => ({ follow: !u.follow })),
}));
```

- [ ] **Step 6: Write RoomLayer.ts (draws stations once per state change)**

`src/renderer/floor/RoomLayer.ts`:
```ts
import { Container, Graphics, Text } from 'pixi.js';
import { roomRect } from './layout';
import type { Station } from '../../shared/types';

const C = { room: 0x232838, border: 0x39415a, grid: 0x2b3147, text: 0xe9e7dc, dim: 0x6b7390, selected: 0xffb454 };

export class RoomLayer extends Container {
  private drawn = new Map<string, Container>();

  render(stations: Station[], counts: Map<string, number>, selectedStation: string | null): void {
    this.removeChildren(); this.drawn.clear();
    for (const s of stations) {
      const r = roomRect(s.grid); const c = new Container(); c.position.set(r.x, r.y);
      const g = new Graphics();
      g.rect(0, 0, r.w, r.h).fill(C.room).stroke({ width: 2, color: s.id === selectedStation ? C.selected : C.border });
      for (let x = 26; x < r.w; x += 26) g.moveTo(x, 34).lineTo(x, r.h).stroke({ width: 1, color: C.grid });
      for (let y = 34; y < r.h; y += 26) g.moveTo(0, y).lineTo(r.w, y).stroke({ width: 1, color: C.grid });
      c.addChild(g);
      const name = new Text({ text: s.name, style: { fontFamily: 'Consolas, monospace', fontSize: 15, fontWeight: '700', fill: C.text } });
      name.position.set(12, 8); c.addChild(name);
      const n = counts.get(s.id) ?? 0;
      const count = new Text({ text: n ? `${n} in room` : 'empty', style: { fontFamily: 'Consolas, monospace', fontSize: 10, fill: C.dim } });
      count.anchor.set(1, 0); count.position.set(r.w - 10, 10); c.addChild(count);
      c.eventMode = 'static'; c.cursor = 'pointer'; c.label = `station:${s.id}`;
      this.addChild(c); this.drawn.set(s.id, c);
    }
  }
}
```

- [ ] **Step 7: Write SpriteLayer.ts (one sprite per occupant, tweened between seats)**

`src/renderer/floor/SpriteLayer.ts`:
```ts
import { Container, Graphics, Text } from 'pixi.js';
import { roomRect, seatPosition } from './layout';
import type { Emote, Occupant, Station } from '../../shared/types';

const EMOTE: Record<Emote, string> = { search: '🔍', read: '📖', edit: '✏️', shell: '⌨', browser: '🌐', skill: '⚑', delegate: '👥', think: '…', other: '⋯' };
const STATUS = { busy: 0xffb454, idle: 0x7dd98f, gone: 0x6b7390 } as const;

class Sprite extends Container {
  target = { x: 0, y: 0 };
  private dot = new Graphics(); private bubble = new Text({ text: '', style: { fontSize: 12 } });
  private tag: Text;
  constructor(readonly sessionId: string, name: string) {
    super();
    const body = new Graphics();
    body.rect(5, -2, 16, 6).fill(0x3a2a1a);                         // hair
    body.rect(6, 0, 14, 12).fill(0xe8c39a).stroke({ width: 1.5, color: 0x1a1208 });   // head
    body.rect(4, 12, 18, 14).fill(0x4a5068).stroke({ width: 1.5, color: 0x10131c });  // body (walk-in tint)
    body.rect(7, 26, 5, 7).fill(0x2a2f42); body.rect(14, 26, 5, 7).fill(0x2a2f42);     // legs
    this.addChild(body);
    this.tag = new Text({ text: name, style: { fontFamily: 'Consolas, monospace', fontSize: 9, fill: 0x9aa3bd } });
    this.tag.anchor.set(0.5, 1); this.tag.position.set(13, -6); this.addChild(this.tag);
    this.dot.position.set(24, -2); this.addChild(this.dot);
    this.bubble.anchor.set(0, 1); this.bubble.position.set(26, -8); this.addChild(this.bubble);
    this.eventMode = 'static'; this.cursor = 'pointer'; this.label = `occupant:${sessionId}`;
  }
  update(o: Occupant, selected: boolean): void {
    this.dot.clear().circle(0, 0, 4).fill(STATUS[o.status]).stroke({ width: 1.5, color: 0x13151d });
    this.bubble.text = o.status === 'busy' && o.emote ? EMOTE[o.emote] : '';
    this.alpha = o.status === 'gone' ? 0.45 : 1;
    this.tag.style.fill = selected ? 0xffb454 : 0x9aa3bd;
  }
  tick(dt: number): void {   // ease toward target seat
    this.position.x += (this.target.x - this.position.x) * Math.min(1, dt * 0.08);
    this.position.y += (this.target.y - this.position.y) * Math.min(1, dt * 0.08);
  }
}

export class SpriteLayer extends Container {
  private sprites = new Map<string, Sprite>();
  render(stations: Station[], occupants: Occupant[], selected: string | null): void {
    const byStation = new Map<string, Occupant[]>();
    for (const o of occupants) (byStation.get(o.stationId) ?? byStation.set(o.stationId, []).get(o.stationId)!).push(o);
    const seen = new Set<string>();
    for (const s of stations) {
      const r = roomRect(s.grid);
      (byStation.get(s.id) ?? []).forEach((o, i) => {
        seen.add(o.sessionId);
        let sp = this.sprites.get(o.sessionId);
        const seat = seatPosition(r, i);
        if (!sp) { sp = new Sprite(o.sessionId, o.name); sp.position.set(seat.x, seat.y); this.sprites.set(o.sessionId, sp); this.addChild(sp); }
        sp.target = seat; sp.update(o, o.sessionId === selected);
      });
    }
    for (const [id, sp] of this.sprites) if (!seen.has(id)) { this.removeChild(sp); sp.destroy(); this.sprites.delete(id); }
  }
  tick(dt: number): void { for (const sp of this.sprites.values()) sp.tick(dt); }
  positionOf(sessionId: string): { x: number; y: number } | null { const sp = this.sprites.get(sessionId); return sp ? { x: sp.position.x, y: sp.position.y } : null; }
}
```

- [ ] **Step 8: Write Floor.tsx (mounts Pixi, wires clicks, follow-cam)**

`src/renderer/floor/Floor.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Application, Container, FederatedPointerEvent } from 'pixi.js';
import { useOffice } from '../store';
import { RoomLayer } from './RoomLayer';
import { SpriteLayer } from './SpriteLayer';

export function Floor() {
  const host = useRef<HTMLDivElement>(null);
  const state = useOffice((u) => u.state); const selected = useOffice((u) => u.selected); const follow = useOffice((u) => u.follow);
  const select = useOffice((u) => u.select);
  const refs = useRef<{ app: Application; world: Container; rooms: RoomLayer; sprites: SpriteLayer } | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const app = new Application();
      await app.init({ background: '#13151d', resizeTo: host.current!, antialias: false, resolution: window.devicePixelRatio });
      if (disposed) { app.destroy(); return; }
      host.current!.appendChild(app.canvas);
      const world = new Container(); const rooms = new RoomLayer(); const sprites = new SpriteLayer();
      world.addChild(rooms, sprites); app.stage.addChild(world);
      app.stage.eventMode = 'static'; app.stage.hitArea = app.screen;
      app.stage.on('pointertap', (e: FederatedPointerEvent) => {
        let t: Container | null = e.target as Container;
        while (t && !t.label?.startsWith('occupant:') && !t.label?.startsWith('station:')) t = t.parent;
        select(t?.label ?? null);
      });
      app.ticker.add((tk) => {
        sprites.tick(tk.deltaTime);
        const u = useOffice.getState();
        if (u.follow && u.selected?.startsWith('occupant:')) {
          const p = sprites.positionOf(u.selected.slice(9));
          if (p) { world.position.x += (app.screen.width / 2 - p.x - world.position.x) * 0.1; world.position.y += (app.screen.height / 2 - p.y - world.position.y) * 0.1; }
        } else { world.position.x += (0 - world.position.x) * 0.1; world.position.y += (0 - world.position.y) * 0.1; }
      });
      refs.current = { app, world, rooms, sprites };
    })();
    return () => { disposed = true; refs.current?.app.destroy(true); refs.current = null; };
  }, [select]);

  useEffect(() => {
    const r = refs.current; if (!r || !state) return;
    const counts = new Map<string, number>();
    for (const o of state.occupants) counts.set(o.stationId, (counts.get(o.stationId) ?? 0) + 1);
    const selStation = selected?.startsWith('station:') ? selected.slice(8) : null;
    const selOcc = selected?.startsWith('occupant:') ? selected.slice(9) : null;
    r.rooms.render(state.stations, counts, selStation);
    r.sprites.render(state.stations, state.occupants, selOcc);
  }, [state, selected, follow]);

  return <div ref={host} style={{ flex: 1, minWidth: 0, minHeight: 0 }} />;
}
```

- [ ] **Step 9: Wire main.tsx to the store and show the floor full-window**

`src/renderer/main.tsx`:
```tsx
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useOffice } from './store';
import { Floor } from './floor/Floor';

function App() {
  const setState = useOffice((u) => u.setState);
  useEffect(() => { const off = window.office.onState(setState); window.office.requestState(); return off; }, [setState]);
  return <div style={{ display: 'flex', height: '100vh' }}><Floor /></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 10: Run it**

Run: `npm run typecheck && npm run lint && npm test` → Expected: exit 0, all tests pass
Run: `npm run dev` → Expected: nine rooms on a 4×3 grid; one sprite per live Claude Code terminal, standing in its station, name tag above, amber/green dot; a busy session shows an emote glyph that changes as it uses tools; clicking a sprite turns its tag amber; clicking a room highlights its border.

- [ ] **Step 11: Commit**

```bash
git add src/renderer test/unit/renderer
git commit -m "feat(renderer): PixiJS floor with rooms, occupant sprites, status and emotes"
```

---

### Task 13: Side panel, activity log, legend, Lobby assignment, follow-cam toggle

**Files:**
- Create: `src/renderer/panels/SidePanel.tsx`, `src/renderer/panels/ActivityLog.tsx`, `src/renderer/panels/Legend.tsx`, `src/renderer/panels/LobbyAssign.tsx`, `src/renderer/panels/panels.css`
- Modify: `src/renderer/main.tsx`, `src/renderer/index.html` (link the css)

**Interfaces:**
- Consumes: `useOffice`, `window.office.assignFolder`
- Behaviour: SidePanel shows the selected occupant (name, title, station, branch, pid, status pill, current tool, tokens in/out/cache-read, cwd, "walk-in — watched, never controlled" note, **Follow** toggle button) or the selected station (path bindings, skills, occupants). ActivityLog lists `state.log` newest-last, auto-scrolled, filtered to the selected occupant when one is selected. LobbyAssign appears inside SidePanel when the selected occupant's `stationId === lobbyId`: a `<select>` of stations + "Assign this folder" → `window.office.assignFolder(o.cwd, id)`.

- [ ] **Step 1: Write panels.css**

`src/renderer/panels/panels.css`:
```css
.side{width:340px;flex-shrink:0;border-left:2px solid #2b3147;background:#1c2029;display:flex;flex-direction:column;min-height:0;font-family:Consolas,monospace;font-size:13px;color:#e9e7dc}
.side-head{padding:14px 16px 10px;border-bottom:1.5px solid #2b3147}
.side-head h2{margin:0;font-size:17px}
.side-sub{color:#6b7390;font-size:11px;margin-top:2px;word-break:break-all}
.side-body{flex:1;overflow-y:auto;min-height:0;padding:12px 16px;display:flex;flex-direction:column;gap:12px}
.kv{display:grid;grid-template-columns:86px 1fr;row-gap:5px;font-size:12px;margin:0}
.kv dt{color:#6b7390}.kv dd{margin:0;word-break:break-all}
.pill{display:inline-block;font-size:10.5px;padding:1px 8px;border-radius:2px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px}
.pill.busy{background:#4a3517;color:#ffb454}.pill.idle{background:#1d3a26;color:#7dd98f}.pill.gone{background:#2b3147;color:#9aa3bd}.pill.walkin{background:#2b3147;color:#9aa3bd}
.note{font-size:11px;color:#6b7390;border-left:2px solid #39415a;padding-left:9px;margin:0}
.btn{font-family:inherit;font-size:12px;color:#e9e7dc;background:#232838;border:1.5px solid #39415a;border-radius:3px;padding:6px 12px;cursor:pointer}
.btn.on{border-color:#ffb454;color:#ffb454}
.btn:focus-visible,select:focus-visible{outline:2px solid #6cb6ff;outline-offset:1px}
.log{background:#13151d;border:1.5px solid #2b3147;border-radius:3px;padding:8px 10px;font-size:11px;line-height:1.7;height:220px;overflow-y:auto;color:#9aa3bd}
.log .who{color:#6cb6ff}.log .at{color:#6b7390}
.legend{display:flex;gap:14px;padding:8px 16px;color:#9aa3bd;font-size:11px;border-bottom:1.5px solid #2b3147;background:#1c2029}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle}
select{width:100%;background:#13151d;border:1.5px solid #39415a;border-radius:3px;color:#e9e7dc;font-family:inherit;font-size:12px;padding:6px 8px}
```

- [ ] **Step 2: Write Legend.tsx**

`src/renderer/panels/Legend.tsx`:
```tsx
export function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: '#ffb454' }} />busy</span>
      <span><i style={{ background: '#7dd98f' }} />idle</span>
      <span><i style={{ background: '#6b7390' }} />gone</span>
      <span><i style={{ background: '#4a5068' }} />walk-in — your terminal, watch only</span>
    </div>
  );
}
```

- [ ] **Step 3: Write ActivityLog.tsx**

`src/renderer/panels/ActivityLog.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useOffice } from '../store';

export function ActivityLog({ sessionId }: { sessionId?: string }) {
  const log = useOffice((u) => u.state?.log ?? []);
  const box = useRef<HTMLDivElement>(null);
  const lines = sessionId ? log.filter((l) => l.sessionId === sessionId) : log;
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines.length]);
  return (
    <div className="log" ref={box}>
      {lines.map((l, i) => (
        <div key={i}><span className="at">{l.at.slice(11, 19)}</span> {!sessionId && <span className="who">{l.name}</span>} {l.text}</div>
      ))}
      {lines.length === 0 && <div>— no activity yet —</div>}
    </div>
  );
}
```

- [ ] **Step 4: Write LobbyAssign.tsx**

`src/renderer/panels/LobbyAssign.tsx`:
```tsx
import { useState } from 'react';
import { useOffice } from '../store';
import type { Occupant } from '../../shared/types';

export function LobbyAssign({ o }: { o: Occupant }) {
  const stations = useOffice((u) => u.state?.stations ?? []); const lobbyId = useOffice((u) => u.state?.lobbyId);
  const choices = stations.filter((s) => s.id !== lobbyId && s.id !== 'your-desk');
  const [pick, setPick] = useState(choices[0]?.id ?? '');
  return (
    <div>
      <p className="note">This folder matches no station. Choose where sessions from <code>{o.cwd}</code> should sit.</p>
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Station">
        {choices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => window.office.assignFolder(o.cwd, pick)}>Assign this folder</button>
    </div>
  );
}
```

- [ ] **Step 5: Write SidePanel.tsx**

`src/renderer/panels/SidePanel.tsx`:
```tsx
import { useOffice } from '../store';
import { ActivityLog } from './ActivityLog';
import { LobbyAssign } from './LobbyAssign';

const fmt = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));

export function SidePanel() {
  const state = useOffice((u) => u.state); const selected = useOffice((u) => u.selected);
  const follow = useOffice((u) => u.follow); const toggleFollow = useOffice((u) => u.toggleFollow);
  if (!state) return <aside className="side"><div className="side-head"><h2>QA Office</h2><div className="side-sub">waiting for state…</div></div></aside>;

  if (selected?.startsWith('occupant:')) {
    const o = state.occupants.find((x) => x.sessionId === selected.slice(9));
    if (o) {
      const station = state.stations.find((s) => s.id === o.stationId);
      return (
        <aside className="side">
          <div className="side-head"><h2>{o.name}</h2><div className="side-sub">{o.title ?? 'untitled session'}</div></div>
          <div className="side-body">
            <div><span className={`pill ${o.status}`}>{o.status}</span><span className="pill walkin">walk-in</span>
              <button className={follow ? 'btn on' : 'btn'} style={{ float: 'right' }} onClick={toggleFollow}>{follow ? '◉ following' : '○ follow'}</button></div>
            <dl className="kv">
              <dt>station</dt><dd>{station?.name ?? o.stationId}</dd>
              <dt>branch</dt><dd>{o.branch ?? '—'}</dd>
              <dt>pid</dt><dd>{o.pid}</dd>
              <dt>doing</dt><dd>{o.currentTool ?? '—'}</dd>
              <dt>tokens</dt><dd>{fmt(o.tokens.output)} out · {fmt(o.tokens.input)} in · {fmt(o.tokens.cacheRead)} cached</dd>
              <dt>cwd</dt><dd>{o.cwd}</dd>
            </dl>
            {o.stationId === state.lobbyId && <LobbyAssign o={o} />}
            <div><div className="side-sub" style={{ marginBottom: 4 }}>ACTIVITY · read-only</div><ActivityLog sessionId={o.sessionId} /></div>
            <p className="note">Walk-ins are watched, never controlled — the app reads the session registry and transcript files and touches nothing.</p>
          </div>
        </aside>
      );
    }
  }
  if (selected?.startsWith('station:')) {
    const s = state.stations.find((x) => x.id === selected.slice(8));
    if (s) {
      const occ = state.occupants.filter((o) => o.stationId === s.id);
      return (
        <aside className="side">
          <div className="side-head"><h2>{s.name}</h2><div className="side-sub">{s.cwds.join(' · ') || 'no folders bound'}</div></div>
          <div className="side-body">
            <dl className="kv"><dt>skills</dt><dd>{s.skills.join(', ') || '—'}</dd><dt>occupants</dt><dd>{occ.length || 'none'}</dd></dl>
            {occ.map((o) => <div key={o.sessionId}><span className={`pill ${o.status}`}>{o.status}</span>{o.name} — {o.currentTool ?? 'idle'}</div>)}
            {occ.length === 0 && <p className="note">Room is empty. An empty room is information — nobody is working this area.</p>}
          </div>
        </aside>
      );
    }
  }
  return (
    <aside className="side">
      <div className="side-head"><h2>Front Desk</h2><div className="side-sub">{state.occupants.length} on the floor · click a room or a worker</div></div>
      <div className="side-body"><div className="side-sub" style={{ marginBottom: 4 }}>ACTIVITY · all</div><ActivityLog /></div>
    </aside>
  );
}
```

- [ ] **Step 6: Compose in main.tsx and link the stylesheet**

`src/renderer/main.tsx`:
```tsx
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useOffice } from './store';
import { Floor } from './floor/Floor';
import { SidePanel } from './panels/SidePanel';
import { Legend } from './panels/Legend';
import './panels/panels.css';

function App() {
  const setState = useOffice((u) => u.setState);
  useEffect(() => { const off = window.office.onState(setState); window.office.requestState(); return off; }, [setState]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Legend />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}><Floor /><SidePanel /></div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 7: Run it**

Run: `npm run typecheck && npm run lint && npm test` → Expected: exit 0
Run: `npm run dev` → Expected: legend on top, floor left, side panel right. Click a sprite → its details and its own activity lines; click **follow** → the floor pans to keep it centred; click a room → its bindings and occupants; nothing selected → the full activity log. Start `claude` in a folder that matches no station (e.g. `C:\careerGrowth\research`) → it appears in the Lobby; select it, assign to a station → it walks there and `office.config.json` now contains that folder.

- [ ] **Step 8: Commit**

```bash
git add src/renderer
git commit -m "feat(renderer): side panel, activity log, legend, lobby assignment, follow-cam"
```

---

### Task 14: Fixture capture script + phase-1 acceptance run

**Files:**
- Create: `scripts/capture-fixtures.mjs`, `README.md`
- Modify: `.gitignore` (add `test/fixtures/captured/`)

**Interfaces:**
- Produces: `npm run fixtures` — copies the current `~/.claude/sessions/*.json` and the last 200 lines of each live session's transcript into `test/fixtures/captured/`, replacing `messagingSocketPath` values with `"<redacted>"` and truncating tool inputs to 120 chars. The captured folder is git-ignored; it exists so a developer can promote real, current shapes into the committed fixtures when Claude Code changes its format.

- [ ] **Step 1: Write the script**

`scripts/capture-fixtures.mjs`:
```js
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
```

- [ ] **Step 2: Add to .gitignore and run once**

Append `test/fixtures/captured/` to `.gitignore`.
Run: `npm run fixtures` → Expected: one line per live session; files appear under `test/fixtures/captured/`; `git status` shows nothing under `test/fixtures/captured`.

- [ ] **Step 3: Write README.md**

```markdown
# QA Office

A pixel-office control tower over live Claude Code sessions, for QA automation work.
Read-only in phase 1: it draws every running Claude Code terminal at its pipeline station,
with live status, current tool, token spend and an activity log. It never writes under
`~/.claude`.

Design: `docs/superpowers/specs/2026-08-25-qa-office-design.md`
Plan:   `docs/superpowers/plans/2026-08-25-qa-office-phase1-observatory.md`

## Run
    npm install
    npm run dev          # opens the office; start `claude` in any terminal to see it appear

## Verify
    npm test             # pure-function tests over fixtures (no Claude, no API key)
    npm run lint         # includes the read-only guard for src/main/observe
    npm run typecheck

## Stations
Edit `office.config.json` to bind folders to rooms, or select a Lobby occupant in the app
and assign its folder from the side panel.
```

- [ ] **Step 4: Phase-1 acceptance (spec §10) — do it, record the result in the commit message**

1. Open terminals in `C:\MaitriAutomation\capture-qa-automation`, `…\capture-qa-automation-react`, `…\CaptureManage\qa-automation-cas`, and `…\CaptureImpDatabase`; run `claude` in each.
2. `npm run dev` → Expected: four sprites; the first three at **Automation Lab** (their default), the DB one at **Data Kitchen**; each name matches `~/.claude/sessions/*.json`.
3. In the CAS terminal, run `/database-explorer` (or any Data Kitchen skill) → Expected: that sprite walks to Data Kitchen within ~2 s and the log shows `⚑ skill database-explorer`.
4. Ask a session to grep something → Expected: 🔍 above its head; side panel `doing: Grep`; token counters rise.
5. Close one terminal → Expected: its dot turns grey and `○ left` is logged **within 5 s**; the sprite disappears about a minute later.
6. `npm run lint` → Expected: exit 0 (observe zone still clean).

- [ ] **Step 5: Commit and push**

```bash
git add scripts/capture-fixtures.mjs README.md .gitignore
git commit -m "chore: fixture capture script, README, phase-1 acceptance verified

Acceptance (spec §10 phase 1): 4 live sessions placed at correct stations;
skill invocation re-places within 2s; terminal close reflected within 5s."
git push
```

---

## Self-review against the spec

- **§4 verified facts** → Task 3 (registry shape), Task 4 (`procStart` = FILETIME), Task 8 (slug rule). Named pipe never read: Task 3 asserts `pipe` is absent from parsed output; Task 3 lint forbids `net`.
- **§5 architecture / §5.1 one-way rule** → Tasks 3–8 live in `src/main/observe`; the only writer (`saveConfig`) lives in `src/main/office`, outside the zone (Task 9). PowerShell probe is outside the zone (Task 4).
- **§6.1 stations, longest-prefix, last-skill, default, Lobby** → Task 9 placement rules and tests; Lobby assignment UI in Task 13.
- **§6.2 occupants: emote, status dot, name tag, follow-cam, walk-in badge** → Tasks 2, 12, 13. Staff origin exists in types but no staff is created in phase 1 (spec §10 phase 2).
- **§6.3 tickets / §6.4 doors / §7 boss** → phase 2–3 by spec; deliberately absent.
- **§8 data flow** → Task 11 composition; warm-start via `readTail` avoids replaying history.
- **§9 errors** → stale files (Task 5 poll + reaper), partial lines (Task 7 carry), unknown record types (Task 6 default branch), absent `~/.claude` (Task 5 `readdir` catch → empty floor). *Gap:* the spec's "banner explaining what was expected" for an unreadable `~/.claude` is not built — SidePanel shows "0 on the floor". Acceptable for a personal tool; noted for phase 2.
- **§10 phase-1 acceptance** → Task 14 step 4.
- **§12 testing** → every parser and the store are fixture-tested with no Electron; PID probe faked (Tasks 4, 5); floor verified by eye (Tasks 12–14).
- **Type consistency:** `SessionRecord`, `ActivityEvent`, `Occupant`, `OfficeState`, `IPC` defined once in Task 2 and imported everywhere; `ProcessProbe.startFileTime` used identically in Tasks 4, 5, 11; `placeOccupant(cwd, lastSkill, cfg)` signature identical in Tasks 9, 10; selection labels `occupant:<id>` / `station:<id>` consistent across Tasks 12–13.
