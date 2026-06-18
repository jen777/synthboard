# SynthBoard

Turn notes, meeting transcripts, and documents into **draw.io (diagrams.net)**
visualizations — flowcharts, UML, ER diagrams, mind maps, and infographics —
powered by an LLM (NVIDIA-hosted `minimaxai/minimax-m2.7` via the
OpenAI-compatible API).

- **Google sign-in** (OAuth 2.0)
- **Tiered account levels** — Sketcher (5 visualizations / 7k input chars),
  Creator (20 / 8.5k), Architect (50 / 10k), Visionary (150 / 15k); new users
  start as Sketcher. Each level's visualization quota and input-size limit, plus
  a user's level, are editable from the admin panel.
- **Embedded draw.io viewer** + one-click `.drawio` export
- **Optional draw.io icon library catalog** for richer generated architecture
  diagrams using indexed custom shape libraries
- **Node.js + Express + Postgres + React**, fully Dockerized

---

## Architecture

```
┌──────────┐     /api, /auth     ┌──────────┐        ┌────────────┐
│  client  │ ──────proxy───────▶ │  server  │ ─────▶ │  Postgres  │
│ (nginx + │                     │ (Express │        │            │
│  React)  │ ◀───── SPA ──────── │  + pg)   │        └────────────┘
└──────────┘                     └────┬─────┘
   :8080                              │ NVIDIA LLM API
                                      ▼
                              draw.io XML generation
```

- The **client** container (nginx) serves the built React SPA and reverse-proxies
  `/api/*` and `/auth/*` to the server — so session cookies stay same-origin.
- The **server** handles Google OAuth, sessions (stored in Postgres), quota
  enforcement, and diagram generation via the OpenAI SDK (NVIDIA endpoint).
- Diagrams render in the browser using the hosted diagrams.net viewer.

## Prerequisites

1. **Google OAuth credentials** — create an OAuth client at
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   Set the authorized redirect URI to `http://localhost:8080/auth/google/callback`
   (match your `APP_URL`).
2. **NVIDIA API key** — from [build.nvidia.com](https://build.nvidia.com).

## Quick start (Docker)

```bash
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NVIDIA_API_KEY,
# and a strong SESSION_SECRET (openssl rand -hex 32).

docker compose up --build
```

Open **http://localhost:8080**.

## Configuration

All configuration is via environment variables — see [`.env.example`](./.env.example).
Notable ones:

| Variable | Description |
| --- | --- |
| `APP_URL` | Public URL (drives OAuth callback + CORS). |
| `LLM_MODEL` | Model for generation. Defaults to `minimaxai/minimax-m2.7`. |
| `LLM_BASE_URL` | OpenAI-compatible endpoint. Defaults to NVIDIA's. |
| `MAX_VISUALIZATIONS_PER_ACCOUNT` | Seeds the **Level 1 (Sketcher)** quota. Defaults to `5`. Higher tiers and live retuning are managed in the admin panel. |

## Local development (without Docker)

Run Postgres (e.g. `docker compose up db`), then:

```bash
# Terminal 1 — API
cd server && npm install && \
  DATABASE_URL=postgres://synthboard:change-me-in-production@localhost:5432/synthboard \
  APP_URL=http://localhost:5173 \
  SESSION_SECRET=dev GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… NVIDIA_API_KEY=… \
  npm run dev

# Terminal 2 — client (Vite proxies /api + /auth to :3000)
cd client && npm install && npm run dev
```

For local dev, set the Google redirect URI to
`http://localhost:5173/auth/google/callback` and `APP_URL=http://localhost:5173`.

## Data model

- `users` — Google account (`google_id`, email, name, avatar, `is_admin`, `level`).
- `visualizations` — `title`, `preset`, `source_text`, generated `drawio_xml`.
- `session` — session store (managed by `connect-pg-simple`).

## How generation works

The source text is sent to the LLM with a system prompt that defines the
draw.io XML output contract, plus preset-specific guidance (flowchart, UML,
sequence, ER, mind map, infographic). The response is parsed to a valid
`<mxfile>` document, stored, and rendered.

### Draw.io icon libraries

SynthBoard can index public or local draw.io custom libraries (`<mxlibrary>`
XML files) and use them during generation without putting the full icon payloads
into the model prompt.

Admins can upload libraries from **Admin panel → Icon libraries**. The screen
shows each indexed library, object counts, and object names.

For scripted ingestion:

1. Review the source library's license before production use.
2. Add sources to a manifest, using
   `server/drawio-libraries/sources.example.json` as the template.
3. Run the ingestion command from `server/` with normal app database env vars:

```bash
npm run ingest:drawio-libraries -- --manifest ./drawio-libraries/sources.example.json
```

The ingester stores compact searchable metadata plus the exact draw.io object
styles in Postgres. During generation, the server retrieves a small candidate
set, asks the LLM to add `synthIcon=<icon id>` to matching vertex styles, then
post-processes the final XML and replaces those placeholders with the exact
draw.io image styles. If no catalog exists or no match is found, generation
falls back to ordinary draw.io shapes.

Admins can also use the API directly: `GET /api/admin/icon-libraries`,
`GET /api/admin/icon-libraries/:id/objects`,
`POST /api/admin/icon-libraries`, `DELETE /api/admin/icon-libraries/:id`, and
`GET /api/admin/icon-libraries/search?q=azure storage`.

## Notes

- The quota is enforced atomically (per-user row lock) so concurrent requests
  can't exceed the limit.
- Diagram preview uses `https://viewer.diagrams.net` — diagram XML is passed in
  the URL fragment and is not uploaded anywhere; export is fully local.
