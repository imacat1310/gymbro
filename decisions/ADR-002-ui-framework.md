# ADR-002: UI Framework & Dev Tooling

- **Date:** 2026-10-08
- **Status:** Accepted (chosen by user)
- **Roadmap item:** Phase 0: choose UI framework, scaffold PWA

## Context
ADR-001 chose a PWA. We need a UI framework that works well with camera access, MediaPipe in the browser, IndexedDB, Supabase and a possible Capacitor wrap later.

## Options

### Option A: React + TypeScript + Vite
- **Pros:** Largest ecosystem; the most examples for MediaPipe web, Supabase, Dexie and Capacitor; easy to get help with.
- **Cons:** More boilerplate; larger bundle than Svelte; libraries for state and routing must be chosen separately.
- **Works without app store:** ✅
- **Effort / cost:** S, free

### Option B: Svelte 5 / SvelteKit
- **Pros:** Smallest and fastest output; less code; built-in reactivity.
- **Cons:** Smaller ecosystem; fewer UI kits and ML/camera examples.
- **Works without app store:** ✅
- **Effort / cost:** S, free

### Option C: Vue 3 + Vite
- **Pros:** Gentle learning curve; good docs and PWA tooling.
- **Cons:** Smaller ecosystem than React for ML and camera work.
- **Works without app store:** ✅
- **Effort / cost:** S, free

## Decision
**React + TypeScript + Vite**, with `vite-plugin-pwa` (Workbox `generateSW`, auto-update). The deciding reason is the depth of the ecosystem for the riskiest parts (MediaPipe, camera, Capacitor). Most of the work on the phone is pose detection, not rendering the UI, so the framework's speed matters less.

Related small choices (made per the CLAUDE.md rule, easily reversible):
- Node.js installed via Homebrew (Node 26). Option: fnm, if a pinned Node version is ever needed.
- App code lives in `gymbro/app/`; the planning docs stay at the top level.
- Icons generated from `public/logo.svg` with `@vite-pwa/assets-generator` (minimal-2023 preset).
- Linter: oxlint (Vite template default).

## Consequences
- State management, routing and the UI component approach are still open. They will be decided when first needed (Phase 1).
- Revisit only if bundle size or rendering becomes a measured problem on target phones.
