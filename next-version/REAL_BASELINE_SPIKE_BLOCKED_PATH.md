# REAL_BASELINE_SPIKE_BLOCKED_PATH

## 1) Local repo path confirmation
Requested path: `C:\Users\Atilio\projects\agents\7_farm_visit`

Observed from this environment:
- Current workspace root: `/workspace/Codex-Test`
- `/mnt/c/Users/Atilio/projects/agents/7_farm_visit` not present
- `C:/Users/Atilio/projects/agents/7_farm_visit` not present
- `/workspace` contains only `Codex-Test`

Conclusion: the requested baseline checkout path is not mounted/accessible in this execution environment.

## 2) Isolated branch/worktree creation
Blocked because baseline repository path is unavailable, so no branch/worktree can be created here.

## 3) Intended tiny-spike file touch list (once path is available)
- `apps/web/src/App.tsx` (or route registry equivalent): add single cockpit entry route
- `apps/web/src/views/CockpitSliceA.*`: thin cockpit container
- `apps/web/src/lib/cockpitAdapter.*`: thin adapter bridge
- Minimal run-note update in baseline README/docs for the spike route only

## 4) Intended validation commands (once path is available)
- `pnpm install` (if needed and not already installed)
- `pnpm --filter @farm-visit/web run dev` (or baseline-equivalent web dev command)
- `pnpm --filter @farm-visit/web run build`
- `pnpm --filter @farm-visit/web run type-check` (if present)
- Existing repo tests/lint command(s)
- Spike-specific route/action checks for:
  - canonical flow reachability
  - retrieval-before-reasoning failure path
  - sync status visibility
  - clear error surfacing

## 5) Rollback triggers to watch
- Any route exposes parallel workflow paths
- Ask/reason succeeds before retrieval context
- UI components accumulate transition/validation business logic
- Spike requires unexpected backend/model integration changes
- Scope grows beyond route + adapter + thin view container

## Why implementation stopped
Per constraints, implementing the real baseline spike requires editing the real baseline repo only. Since that repo path is unavailable here, proceeding in `Codex-Test` would violate scope and produce non-actionable changes.

## Smallest corrective action required
Mount or provide access to the local baseline checkout at `C:\Users\Atilio\projects\agents\7_farm_visit` (or provide the accessible in-container path), then I can execute the tiny spike exactly as requested.
