# Twin vNext Product Line (Official)

This repository is now the **official Twin-centered vNext product line**.

The product center is the Twin core, with two interfaces over the same operational truth:

- **Human UI** (cockpit paths)
- **Agent-facing API** (capability façade)

## Product invariants

These are non-negotiable in this repo:

- One canonical workflow only: `start → capture → review/correct → save local → sync → retrieve → ask/reason → decide`.
- Retrieval before reasoning is required.
- UI remains thin; business logic stays in controller/service layers.
- Twin core remains source of truth.

## Where the active vNext product lives

Primary implementation and product docs are under:

- `next-version/`
  - `vnext_twin_core/`
  - `vnext_api/`
  - `vnext_ui/`
  - `tests/`
  - architecture/adoption/merge docs

Start with `next-version/README.md` for run and validation commands.

## Repository positioning

Legacy/auxiliary code (e.g. the `risksim` package and related tests) remains in-repo for now, but it is **not** the forward product line.
It is intentionally left untouched in this promotion step to keep diffs small and reversible.

## Manual GitHub rename step (outside Codex)

Codex cannot rename the GitHub repository itself. If desired, perform these manually:

1. GitHub repository rename
2. Repository description/topics update
3. Default branch/release policy alignment
4. CI/workflow naming alignment
