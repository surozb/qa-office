# QA Office — Design

- **Date:** 2026-08-25
- **Status:** Approved design (brainstorming complete) — ready for implementation plan
- **Author:** Suraj Maharjan (with Claude)
- **Scope:** Personal tool, single machine (Windows 11). Not a team product.
- **Related:** `C:\MaitriAutomation\capture-qa-automation\Evaire\CLAUDE.md` §2 "Pipeline & skill routing" (the pipeline this office renders)

## 1. Summary

A desktop app that draws the QA automation pipeline as a **pixel-art office floor**.
Rooms are pipeline stations, Jira tickets travel between them as physical objects, and
the workers at each station are the **existing Claude Code agents and skills** in
`C:\MaitriAutomation`. Real terminal Claude Code sessions appear at their desks
automatically; app-spawned sessions can be assigned work and report back.

The office is a **control tower over work that already exists**, not a simulation.
Nothing on the floor spends a token to look alive: walk-in workers are alive because
real sessions are alive, and staff workers exist only while a task does.

It is a **personal QA productivity tool**, not production software.

## 2. Problem

Today the QA automation work runs across four or more Claude Code terminal sessions,
one per git worktree / feature (`capture-qa-automation`, `capture-qa-automation-react`,
`CaptureManage/qa-automation-cas`, `newunique-tool/capture-qa-automation`) plus
non-repo workspaces (`CaptureImpDatabase`). Costs of that setup:

- **No overview.** Which session is busy, idle, or stuck is only visible by alt-tabbing.
- **Context is re-explained.** A cross-cutting question means summarising one session's
  findings and pasting them into another.
- **Pipeline state is invisible.** Where a ticket sits (test design? awaiting scope
  approval? build red?) lives in one's head, not on a screen.
- **The multi-agent tooling already built** (`from-jira` fan-out, `avengers-assemble`
  contract-based build fleet, ~29 QA skills, 3 fetch agents) has no face — it is driven
  by typing skill names into terminals.

## 3. Prior art and what is taken from it

Two open-source "AI agent office" projects were reviewed. Neither is built for QA.

| | harishkotra/agent-office | longyangxi/OpenOffice |
|---|---|---|
| Nature | Simulation — LLM characters on a 15 s perceive-think-act loop | Orchestrator — spawns real AI CLIs (Claude Code supported) |
| Renderer | Phaser.js | PixiJS v8 |
| Worktrees | no | yes, auto commit/merge/undo |
| Sees pre-existing terminal sessions | no | no |
| Windows | browser-based | macOS-only desktop |
| Licence | **none published — code not reusable** | MIT |

**Taken as ideas only** (agent-office is unlicensed; no code or assets copied): emote
bubbles above sprites, click-to-follow camera, task-board overlay, system activity log.

**Taken as patterns, MIT code permitted** (OpenOffice): PixiJS v8 as renderer;
leader/worker delivery shape; worktree auto-management as a later-phase idea.

**Original to this design:** the ticket as the moving object; approval gates rendered as
doors; observation of pre-existing sessions via the Claude Code session registry; the QA
station map; coverage-as-lighting; the flaky-test infirmary.

## 4. Key facts the design relies on (verified 2026-08-25)

Claude Code maintains a **live session registry** on disk. Each running session writes
`~/.claude/sessions/<pid>.json`:

```json
{ "pid": 18232, "sessionId": "c51ac6bf-…", "cwd": "C:\\MaitriAutomation\\CaptureManage",
  "name": "capturemanage-b3", "status": "idle", "kind": "interactive",
  "procStart": "134320287348532402", "peerFeatures": ["notify_idle"],
  "messagingSocketPath": "\\\\.\\pipe\\LOCAL\\cc-msg-…" }
```

- `cwd` is the room. `status` is live-updated (`busy` / `idle`). `name` matches what
  `ListAgents` prints. `pid` + `procStart` together identify a live process (guards
  against PID reuse).
- Transcripts are appended live to `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`.
  The slug set already includes every worktree and `CaptureImpDatabase`.
- `messagingSocketPath` is an undocumented internal protocol. **Out of scope** — never
  opened, never written.
- Cross-session messaging between *top-level* sessions works (verified against three live
  sessions). Subagents cannot message each other; a top-level session can spawn subagents,
  a subagent cannot. These two constraints shape the org chart in §7.
- `@anthropic-ai/claude-agent-sdk` is Claude Code as a Node library: `query(prompt,
  options)` with `cwd`, built-in tools, skills, subagents, permission hooks, streaming.
  This is the only mechanism by which the app *acts*.

## 5. Architecture

```
┌─ Electron main process ────────────────────────────────────────────────┐
│  RegistryWatcher    ~/.claude/sessions/*.json           read-only       │
│  TranscriptTailer   ~/.claude/projects/**/*.jsonl       read-only       │
│  StaffHost          @anthropic-ai/claude-agent-sdk      acts            │
│  OfficeStore        office.config.json + in-memory state                │
│  ActivityLog        append-only event stream (drives UI + retro)        │
└────────────────────────────── IPC (typed events) ──────────────────────┘
┌─ Renderer ─────────────────────────────────────────────────────────────┐
│  PixiJS v8 floor  — rooms, sprites, tickets, doors, walls               │
│  React overlays   — side panel, task board, dialogs, activity log       │
└────────────────────────────────────────────────────────────────────────┘
```

**Stack.** Electron + TypeScript. Node in-process is required for the Agent SDK and for
`~/.claude` file watching; Electron is the shortest path to both plus a UI. PixiJS v8
renders the floor (WebGL, smooth sprite animation, proven for this use by OpenOffice).
React renders everything that is a form, list, or panel. Zustand for renderer state.

**Repository.** `C:\careerGrowth\projects\qa-office`, its own git repo. It is a tool *about*
the automation repos, not part of any of them.

**Three sources of truth, kept separate on purpose:** the registry says *who exists and
where*; transcripts say *what they are doing and what it costs*; StaffHost is the only
module that can *do* anything. A bug in observation can never mutate a session.

### 5.1 The one-way rule

`RegistryWatcher` and `TranscriptTailer` open files read-only, never write under
`~/.claude`, and never touch `messagingSocketPath`. This is enforced structurally: those
two modules receive no handle to StaffHost or to any writable API, and a lint rule
forbids `fs.write*` / `net` imports inside them. Walk-in sessions are observed, never
poked — you may be typing in one.

## 6. The floor

### 6.1 Stations

A **station** is a room bound to a working directory and the skills that belong there.
The initial map is the Evaire `CLAUDE.md` pipeline:

| Station | Bound `cwd` (initial) | Workers stationed | A ticket arrives when |
|---|---|---|---|
| Intake | any automation worktree | `jira-fetcher`, `from-jira` | a Jira key is dropped on the floor |
| Test Design | automation worktree | `write-test-case`, `qase-fetcher`, `code-walker` | intake brief exists |
| Automation Lab | automation worktree | `write-automation-test`, `dom-locator-automation`, generator skills | **Gate 2 door opened** |
| Data Kitchen | `CaptureImpDatabase` | `add-test-data-generator`, `database-explorer` | a spec needs a new data shape |
| CI Watchtower | automation worktree | `jenkins-build-investigator` | spec pushed, build running |
| Triage & Repair | automation worktree | `heal-automation-test`, `triage-bug` | a build is red |
| Records Office | automation worktree | `qase-integration`, `check-automation-coverage`, `audit-qase-data` | a run finished |
| Your Desk | — | you; later the boss | Gate 1 / Gate 2 hand-offs |
| Lobby | — | — | a session's `cwd` matches no station |

Stations, their `cwd` bindings, grid positions, and sprites live in `office.config.json`.
Sessions are placed by matching `cwd` against station bindings (longest prefix wins). A
`cwd` matching nothing goes to the Lobby, and the side panel offers "assign this folder
to a station". Rooms persist when empty — an empty Triage room is information.

Several stations may bind the same worktree (Test Design, Automation Lab, CI Watchtower
all work in `capture-qa-automation`). A walk-in in that `cwd` is placed by the **skill
it last invoked** if the transcript shows one mapped to a station; otherwise it sits at
the worktree's default station (configurable, default Automation Lab).

### 6.2 Occupants

| | Walk-in | Staff |
|---|---|---|
| Origin | a session you started in a terminal | a session StaffHost spawned |
| Visible, status, feed, spend | yes | yes |
| Assignable / interruptible / dismissable | **no** | yes |
| Sprite | grey tint, "walk-in" badge | blue tint |

Both come from the same registry scan, so a staff session is rendered by exactly the
same code path as a walk-in; the only difference is that OfficeStore knows it owns it.

Each occupant shows an **emote bubble** for its current tool (derived from the latest
transcript tool-use block: search, read, edit, shell, browser, skill), a **status dot**
(amber busy · green idle · purple reported · grey dead), and a name tag. Clicking opens
the side panel; a second click enables **follow-cam**.

### 6.3 Tickets

A **ticket** is a Jira key rendered as an object on the floor. It has exactly one
location (a station, a door, or Your Desk) and a history. In v1 tickets move because
*you* drag them or because a staff task bound to that ticket completes. Automatic
pipeline movement is phase 3.

### 6.4 Doors (gates)

Evaire `CLAUDE.md` defines two hard gates: **Gate 1** Qase dedup (reuse or create case
IDs) and **Gate 2** scope confirmation ("automate these N cases?"). Each is a **door**
on the floor. A ticket waits at the door; only you open it, from the side panel, with the
same information the gate needs today (candidate cases, proposed scope). No staff worker
can open a door. This makes the pipeline's most important property — nothing is automated
without sign-off — visible architecture rather than a rule in a markdown file.

## 7. Org chart and dispatch

```
YOU                     the app user; above everything; opens doors
 └─ BOSS (per domain)   a staff top-level session pinned to Your Desk
     └─ WORKERS         its subagents, spawned into stations, report up
```

- **Workers** cannot talk to each other. They report to their boss (the SDK returns the
  subagent's result to the parent session). This is a platform constraint, not a design
  choice, and the UI never draws a worker-to-worker line.
- **Bosses** coordinate only through the app (cross-session messaging via the app as
  relay). v1 ships with a single boss; multiple bosses are a phase-3 option.
- **Dispatch (phase 2):** you pick a task, an agent, and a station → StaffHost spawns an
  SDK session with that station's `cwd`, the agent definition, and the task → it appears
  in the registry and on the floor like anyone else → its final message is filed as a
  **report** on Your Desk.
- **Boss mode (phase 3):** you give a goal; the boss proposes station assignments; you
  approve/edit; it dispatches workers and collects reports. This is `avengers-assemble`
  with a face — same contract-first, disjoint-file-ownership rule for parallel workers.

### 7.1 Permissions

Staff sessions run with the SDK's permission hook wired to the UI: a tool call that would
prompt in a terminal raises a prompt in the app (side panel, with the tool and arguments).
Denials are recorded in the ActivityLog. Walk-in prompts are *not* surfaced — the app
cannot answer them and must not appear to.

## 8. Data flow

**Observation loop**

1. `RegistryWatcher` watches `~/.claude/sessions/`. On change it parses each file,
   verifies `pid` is alive *and* its process start time matches `procStart`, and emits
   `session.upsert` / `session.gone`.
2. `OfficeStore` places each live session at a station (§6.1) and emits `occupant.*`.
3. `TranscriptTailer` tails `~/.claude/projects/<slug>/<sessionId>.jsonl` for every live
   session, parsing appended lines into: current tool, last user/assistant text (for the
   feed), cumulative token usage. It emits `activity.*`.
4. Renderer updates sprites, bubbles, side panel, and the activity log.

**Dispatch loop (phase 2)** — as in §7. The spawned session's registry file appears
within a second; the observation loop takes over from there. StaffHost additionally
streams SDK events so a staff feed does not depend on the transcript file lag.

## 9. Error handling

- **Stale session files are the normal case.** A killed terminal leaves its JSON behind.
  Every scan reaps entries whose PID is dead or whose `procStart` mismatches.
- **Half-written JSONL lines** (read mid-append) are skipped, remembered by byte offset,
  and re-read on the next change. Never fatal.
- **Unknown transcript record shapes** are ignored with a debug log — the format is
  Claude Code's, not ours, and will change.
- **A staff session that dies** stays on the floor greyed with its exit reason until
  dismissed. Its partial report, if any, is filed.
- **`~/.claude` absent or unreadable** → the floor renders with all rooms empty and a
  banner explaining what was expected where.
- **SDK auth missing** → dispatch disabled with a clear banner; observation still works.

## 10. Phases

Each ships alone and is useful alone; nothing in an earlier phase is discarded.

1. **Observatory.** RegistryWatcher, TranscriptTailer, station floor from config, walk-ins
   with emotes/status/feed/spend, side panel, follow-cam, activity log, Lobby assignment.
   Read-only. *Done when:* the four current worktree sessions appear at correct stations
   with live status, and killing a terminal removes its sprite within 5 s.
2. **Staff & tickets.** StaffHost + SDK dispatch, permission prompts in-app, task board,
   ticket objects with drag-to-station, Gate 1 / Gate 2 doors (manual open), reports on
   Your Desk. *Done when:* a `database-explorer` task dispatched to Data Kitchen runs to
   completion and its report is readable without opening a terminal.
3. **Boss & the walls.** Boss mode (goal → plan → approve → dispatch → reports); CI
   Watchtower **build wall** (last N Jenkins runs as tiles, red spawns a triage task);
   **coverage lighting** (features with no tests render as dark rooms, from
   `test-coverage-analyzer`); **flaky infirmary** (fail-then-pass tests get a bed;
   3+ visits flags for investigation instead of another heal); **end-of-day retro**
   generated from the ActivityLog; optional multiple bosses; layout editor.

## 11. Deliberately out of scope

- Multi-user, any server, sync, auth (personal tool).
- Reading or writing `messagingSocketPath`; writing anything under `~/.claude`.
- Agents that idle on a token loop to appear alive.
- Colyseus, SQLite memory, embeddings, personality traits (agent-office concepts).
- Any code or asset from harishkotra/agent-office (no licence).
- Auto-merging worktrees (OpenOffice feature) — the Evaire "no commits before the
  approval gate" rule stands.

## 12. Testing

- `RegistryWatcher` parsing and reaping, `TranscriptTailer` line parsing and offset
  handling, and `OfficeStore` station placement are **pure functions over fixtures** —
  real `sessions/*.json` and JSONL excerpts captured from the author's own sessions,
  scrubbed. They run with no Claude Code, no API key, no Electron.
- PID liveness and process start time are behind an interface faked in tests.
- StaffHost is tested against a stub SDK that emits a scripted event stream.
- The floor is verified by eye; PixiJS scenes are not unit-tested.
- Phase acceptance criteria in §10 are the manual test plan.

## 13. Open questions (answered by living with phase 1)

- Whether walk-in observation alone removes enough alt-tabbing that terminals stay the
  primary interface, or whether staff dispatch becomes the daily driver. Phase 2 priority
  follows the answer.
- Whether one boss per domain is worth its token cost versus one boss for everything.
