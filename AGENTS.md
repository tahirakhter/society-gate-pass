# Society Gate Pass Agent Guide

This repository is now maintained with Codex-oriented instructions at the repo root.

## Project Layout

- `backend/`: NestJS API, Prisma, PostgreSQL integration
- `frontend/`: Next.js app router frontend
- `openspec/`: feature specs and phased task breakdowns
- `society_gate_pass_requirement.md`: top-level product requirements

## Current Product State

- Phase 1 is the active foundation:
  - authentication
  - role-based access control
  - house-owner mapping
- Later phases for visitors, QR tokens, validation, and entry logs are not complete yet.

## Working Conventions

- Prefer fixing the real implementation instead of only updating spec/task files.
- Keep backend and frontend aligned with `society_gate_pass_requirement.md` and the relevant `openspec` change docs.
- Do not read `.env` or other environment files unless the user explicitly asks for it.
- Do not reintroduce Claude-specific workflow files or instructions.
- If a legacy Claude note is encountered, treat it as historical context only unless the repo still depends on it technically.

## Backend Notes

- Backend default port is `3001`.
- Frontend default port is `3000`.
- Use Prisma 7 conventions in this repo:
  - schema: `backend/prisma/schema.prisma`
  - config: `backend/prisma.config.ts`
- Before assuming Prisma types are broken, run client generation:

```bash
cd backend
npx prisma generate
```

- Useful backend checks:

```bash
cd backend
npm run lint
npm run build
npm run test -- --runInBand
```

## Frontend Notes

- Frontend talks to the backend through `NEXT_PUBLIC_API_URL`.
- Default local backend URL should be `http://localhost:3001`.
- There is also a frontend-local `AGENTS.md` with a Next.js-specific warning; keep following it for files under `frontend/`.

- Useful frontend checks:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

## Implementation Preferences

- Preserve strict DTO validation and typed auth flows.
- Keep RBAC explicit:
  - `ADMIN`
  - `OWNER`
  - `SECURITY`
- Avoid placeholder starter content once a feature area is being worked on.
- Prefer small, verifiable increments and run the relevant checks after changes.

## When Adding New Features

- Update Prisma schema only when the feature actually needs persistence.
- Add or update API/UI together when the feature spans both sides.
- Check whether the feature belongs to:
  - Phase 1: auth/setup
  - Phase 2: visitor registration and QR generation
  - Phase 3: QR verification and gate entry
  - Phase 4: logs, deactivation, audit/reporting

## Documentation Cleanup

- Prefer `AGENTS.md` over `CLAUDE.md` for ongoing agent guidance.
- If more legacy Claude-only docs are found later, migrate the useful parts here or into narrower module-level `AGENTS.md` files.
