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

Status colours: amber busy · green idle · blue waiting for you · grey gone.
