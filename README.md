# Coach Me

A mobile-first PWA for football academy coaches in Tunisia. Describe your squad and what went wrong last week and get a **timed session** built from drills; watch every drill as an **animation**; describe a drill in chat to get a new one; keep a **personal library** (works offline); **share** a drill by link.

French, Arabic (full RTL), English and German. Everything generated is a draft the coach can edit, save or discard, and unreviewed content is never shown as reviewed.

## Layout

```
apps/web            Next.js 16 (App Router) app, Tailwind 4 (logical properties only), next-intl, Serwist PWA
packages/schemas    Zod schemas + cross-field checks (client and server)
packages/animation  pure animation core (timeline, stateAt, validateSpec) + <PracticePlayer>
data/templates      34 practice templates, one JSON file each (source of truth)
prompts             system prompts for the model (markdown)
scripts             template validation, preview, bundling, icon generation
supabase            SQL migrations (RLS on every table) and pgTAP tests
reference           the brief, the prototype and the seed practices
```

## Setup

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then edit
pnpm dev                                        # bundles templates, then starts Next on :3000
```

### Run without any external service (mock mode)

Put `MOCK_BACKEND=1` in `apps/web/.env.local`. You get an in-memory database, "sign in with any email" and a deterministic stand-in for the model. This is what the end-to-end tests use. It is **refused in production builds** unless `MOCK_BACKEND_ALLOW_PRODUCTION=1` is also set (only the e2e config does that).

### Run for real with MongoDB

Set `MONGODB_URI` (for example a free MongoDB Atlas cluster), `AUTH_SECRET` (a long random string) and `LLM_API_KEY`, then `pnpm build && pnpm --filter @mourabbi/web start`. There are no accounts or emails: opening a feature gives the visitor a guest identity in a signed cookie, and everything they save belongs to that cookie. Data access control lives in code (every query filters on the owner); collections and indexes are created on first use. Run the store tests against a real database with `MONGODB_URI_TEST=mongodb://... pnpm test`.

### Run for real with Supabase (alternative)

1. Create a Supabase project (email magic-link auth only). Run `supabase/migrations/0001_init.sql` (e.g. `supabase db push`). In Auth settings, add your site URL and `<site>/auth/callback` as a redirect URL.
2. Set the environment variables below.
3. `pnpm build && pnpm --filter @mourabbi/web start`.

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET` | MongoDB backend and the guest cookie signature (used instead of Supabase when `MONGODB_URI` is set) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | server only: public share reads, generation log, reports |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` | model provider: `gemini` (Google generateContent, default model `gemini-2.5-flash`) or `anthropic` (Messages API, default `claude-sonnet-5-5`). The provider is guessed from the key when `LLM_PROVIDER` is empty |
| `FREE_LIBRARY_LIMIT` (20), `DAILY_GENERATION_LIMIT` (20), `DAILY_SHARE_LIMIT` (30) | limits per user |
| `NEXT_PUBLIC_SITE_URL` | optional public origin for magic links |
| `ALLOW_PENDING_TEMPLATES` (1) | see "Open items": set `0` to build sessions only from reviewed templates |
| `MOCK_BACKEND`, `MOCK_BACKEND_ALLOW_PRODUCTION` | mock mode (see above) |

The key and the prompts never reach the client: all model code lives in `apps/web/lib/llm` and `apps/web/lib/server` (server-only).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` | bundle templates and prompts, then run/build the app (`build` also builds the service worker) |
| `pnpm lint` / `pnpm typecheck` | ESLint, `tsc` for every package (and the service worker) |
| `pnpm test` | Vitest: schemas, animation, validation, mocked-LLM integration, share, library, i18n, logical CSS |
| `pnpm test:e2e` | Playwright smoke tests at 360 px against a production build (`PW_CHANNEL=chrome` uses an installed Chrome) |
| `pnpm templates:validate` | schema + animation rules + 4 languages + ranges + brief table + review guard (add `--partial` while authoring) |
| `pnpm templates:preview` | contact sheet in `out/preview/` (start and end of each animation) |
| `pnpm templates:bundle` | regenerate `apps/web/lib/generated/*` from `data/templates` and `prompts` (a test fails if they are stale) |
| `pnpm icons` | regenerate the PWA icons without any image library |

CI (`.github/workflows/ci.yml`) runs validate, lint, typecheck, unit tests, build and the e2e tests.

Database tests: `supabase/tests/rls.test.sql` (pgTAP) proves that one user cannot read, change or delete another user's rows, that users cannot write the generation log, and that anonymous callers get nothing. Run with `supabase test db` (needs the Supabase CLI and Docker).

## Authoring and reviewing templates

1. Edit or add `data/templates/<id>.json` (fr, en, ar and de text, 2 to 8 steps, an animation that passes `validateSpec`). New templates must be in the brief's table (`scripts/lib/expected.ts`).
2. `pnpm templates:validate` until it passes; `pnpm templates:preview` to look at them; `pnpm templates:bundle` to publish them to the app.
3. Every template starts as `review.status: "pending"`. **Only a human marks one reviewed**, by editing the file: `"status": "reviewed"`, `"reviewedBy": "<name>"`, `"reviewedAt": "YYYY-MM-DD"`. A test fails the build if any file says `reviewed` without both, and the schema refuses AI content marked reviewed.
4. The UI shows "Reviewed by <name>" only for such files. Pending templates show "Pending coach review"; AI drafts show "AI draft, not reviewed" on the card, in the player and on the public page.

The `difficulty` level (1 easy, 2 medium, 3 hard) of every template was set by the assistant and, like the rest, needs a coach's review. The movement of the 28 new templates was written by the assistant using an authoring helper that follows the carry convention; the French and Arabic texts are drafts that need a native-speaking coach.

## How the pieces fit

- **Session generation** (`/api/generate`): practices are filtered on the server (age, players, area with rotation, equipment, review policy, owner) before the prompt; the model only returns ids and minutes; the result is parsed strictly and validated (durations, ids, fit, order); one retry with the errors appended; then a fixed fallback built in code, flagged `source: "fallback"`. Model errors `NO_SUITABLE_DRILLS`, `CONSTRAINTS_CONFLICT`, `OUT_OF_SCOPE` come back in the coach's language.
- **Practice chat** (`/api/practices/generate`, streamed as NDJSON): scope check, constraint parsing, template search; Mode A rewrites a template's text (its animation is untouched), Mode B writes a new practice that must pass `validateSpec`; one retry; otherwise the closest template is returned and labelled as such. Refinements create new versions (last 10 kept in the browser).
- **Trust**: the server decides `source`, `review` and `id` of anything the model writes; saving a chat result can only ever produce an AI draft.
- **Sharing**: a snapshot built through the strict Practice schema (no notes, owner or session context), read through a server route with the service role (there is no anonymous RLS policy). Unknown and revoked ids give the same 404 page.
- **Offline**: the service worker caches build assets and one `/offline` page only; navigations, API calls and generation responses are never cached. Saved practices and the last viewed practice live in IndexedDB (wiped on sign-out) and are shown by the offline page.

## Decisions taken where the brief was open

- The model is called with `fetch` against the Anthropic Messages API (no SDK dependency). The newest model families reject forced tool choice and non-default sampling, so the model is asked for JSON in the prompt and the reply is validated strictly; `temperature: 0.2` is sent only to models that accept it.
- "Reviewed or owner-saved practices only" would leave no drills at launch (all templates are pending), so by default pending templates **are** used and every session shows a review warning. Set `ALLOW_PENDING_TEMPLATES=0` to require reviewed templates.
- Additive changes to the data model: `practices.notes`, `shared_practices.practice_id`, optional `note` on session phases, optional `source` on sessions, and the `include` request field ("Use in a session" pins a template).
- Extra routes: `/api/sessions/[id]`, `/api/library/[id]` (+ `/duplicate`), `/offline`, `/auth/callback`, `/api/auth/logout`, `/api/share/[id]/report`.
- Dependencies beyond the brief's list: `tsx` (scripts), `@serwist/cli` and `esbuild` (Serwist's service-worker build step), `@playwright/test` also at the repo root. TypeScript is pinned to 6 because typescript-eslint does not support 7 yet.

## Open items

- **Content review**: all 34 templates are `pending`; French, Arabic and German text and the 28 new animations need a native, qualified coach. The German text was written by the assistant. Nothing is marked reviewed.
- **Not run in this environment**: the MongoDB store against a real database (the contract test runs only with `MONGODB_URI_TEST`),  the pgTAP RLS test (Docker was not running), a real Supabase project (magic link and RLS were only exercised through the in-memory store), a real model call (the Anthropic client is covered with a fake `fetch`; the pipeline with scripted models), and the Lighthouse PWA audit (manifest, icons, service worker and offline behaviour are covered by the e2e tests instead).
- Editing a saved practice in the library changes the set-up text and title in the current UI language only; the other languages keep their text.
- The offline page uses the language that was active when the service worker installed.
- Report throttling is per server process; generation and share limits use database counts per UTC day.
- The health/diet refusal is a keyword check plus the model's own refusal; it is not exhaustive. Privacy and terms pages are drafts for a lawyer.
- `scripts/export-videos.ts` (social-video export, run with `pnpm videos:export`) was added to the repository by someone else during this build; it is not covered by the tests here.
