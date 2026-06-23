# Context Canvas Architecture

## Pipeline (non-negotiable)

React Flow is a **renderer adapter only**, not the application core.

```
ContextDocument → Command/Event → Compiler → Storage → Renderer Adapter → React Flow
```

| Layer | Location | Responsibility |
| --- | --- | --- |
| ContextDocument | `src/shared/domain.ts` | Schema types (v1 nodes, v2 `qa_block`), invariants |
| Command/Event | `src/core/commands.ts`, `src/core/reducer.ts` | User intent, state transitions |
| Compiler | `src/shared/compiler.ts` | AI context assembly from document |
| Storage | `src/storage/markdown/` | Markdown + YAML projection, sidecars |
| Renderer Adapter | `src/adapters/react-flow.ts` | Map domain → React Flow nodes/edges |
| React Flow | `src/web/` | Pan/zoom, drag handles, presentation |

Domain and placement logic (`src/core/magnetic-layout.ts`) must **not** import React Flow.

## Cognitive load

Shift from muscle-memory (2D node alignment) toward **visual context**: combined Q&A blocks, upward stacking, bottom-fixed input. Users should **intuitively track and correct** which context the AI answered from via block selection and visible block hierarchy.

## Observability (Markdown/YAML + Obsidian)

- Project hierarchy as **markdown + YAML frontmatter** and **JSON sidecars**.
- External-tool friendly (especially Obsidian): one file per block, group `index.md`, minimal canvas sidecar.
- **Canvas sidecar (recommended)**: `{ id, title, schemaVersion, viewport? }` — viewport optional.
- Long-term goal: higher AI answer quality via **context compression** from structured, human-readable artifacts.

## Schema v2 (issue #39)

- `schemaVersion: 2` with `qa_block` entities (clean break from v1 prompt/answer pairs).
- Magnetic placement rules live in `src/core/magnetic-layout.ts` (framework-agnostic).
- UI skeleton: `QABlockNode`, `BottomComposer` — wired in a follow-up PR.

## Dev agent (local)

`npm run dev` runs `scripts/dev.mjs`, which loads `.env.local` / `.env` via `scripts/load-env.mjs` without overriding shell env.

| Variable | Dev default | Purpose |
| --- | --- | --- |
| `CONTEXT_CANVAS_PROVIDER` | `deepseek` | Agent provider |
| `CONTEXT_CANVAS_MODEL` | `deepseek-v4-flash` | Agent model |
| `DEEPSEEK_API_KEY` | — | Required for DeepSeek; copy `.env.example` → `.env.local` |

Startup logs `DEEPSEEK_API_KEY: loaded|not set` (never the value) and `Agent provider/model: …`. The API server logs `Agent model: …` on listen.
