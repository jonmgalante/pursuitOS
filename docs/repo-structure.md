# Repo Structure

```text
├── apps
│   ├── extension
│   │   ├── scripts
│   │   │   └── build.mjs
│   │   ├── src
│   │   │   ├── background.ts
│   │   │   ├── chrome.d.ts
│   │   │   ├── content.ts
│   │   │   └── sidepanel.ts
│   │   ├── README.md
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── sidepanel.html
│   │   └── tsconfig.json
│   ├── web
│   │   ├── app
│   │   │   ├── api
│   │   │   │   ├── capture
│   │   │   │   │   └── route.ts
│   │   │   │   ├── demo
│   │   │   │   │   └── seed
│   │   │   │   │       └── route.ts
│   │   │   │   ├── drafts
│   │   │   │   │   └── generate
│   │   │   │   │       └── route.ts
│   │   │   │   ├── encounters
│   │   │   │   │   └── route.ts
│   │   │   │   ├── health
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sync
│   │   │   │   │   ├── gmail
│   │   │   │   │   │   └── draft
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   └── hubspot
│   │   │   │   │       └── task
│   │   │   │   │           └── route.ts
│   │   │   │   └── targets
│   │   │   │       └── route.ts
│   │   │   ├── demo
│   │   │   │   └── grip
│   │   │   │       ├── attendees
│   │   │   │       │   ├── avery-chen
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── page.tsx
│   │   │   │       └── sessions
│   │   │   │           └── page.tsx
│   │   │   ├── workspaces
│   │   │   │   └── [workspaceId]
│   │   │   │       └── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── lib
│   │   │   ├── http.ts
│   │   │   └── store.ts
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── worker
│       ├── src
│       │   ├── jobs
│       │   │   ├── generate-draft.ts
│       │   │   ├── match-people.ts
│       │   │   └── transcribe-voice.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docs
│   ├── build-charter.md
│   ├── database-schema.md
│   ├── first-slice.md
│   └── repo-structure.md
├── packages
│   ├── connectors
│   │   ├── src
│   │   │   ├── gmail.ts
│   │   │   ├── hubspot.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── core
│   │   ├── src
│   │   │   ├── demo-data.ts
│   │   │   ├── drafts.ts
│   │   │   ├── ids.ts
│   │   │   ├── index.ts
│   │   │   ├── matching.ts
│   │   │   ├── ranking.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   │   └── .gitkeep
│   │   │   └── schema.prisma
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── prisma.config.ts
│   │   └── tsconfig.json
│   └── portal-grip
│       ├── src
│       │   ├── extractor.ts
│       │   ├── index.ts
│       │   └── selectors.ts
│       ├── package.json
│       └── tsconfig.json
├── .env.example
├── .gitignore
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Responsibilities

- `apps/web` — Next.js operator workspace and demo portal pages
- `apps/extension` — Chrome extension side panel + on-demand capture injection
- `apps/worker` — background worker scaffold
- `packages/core` — pure domain logic and demo data
- `packages/portal-grip` — Grip DOM extractor adapter
- `packages/connectors` — HubSpot and Gmail connector adapters
- `packages/db` — Prisma/Postgres production schema
- `docs` — charter, schema notes, slice guide, and repo map
