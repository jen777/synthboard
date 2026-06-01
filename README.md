# SynthBoard

Turn notes, meeting transcripts, and documents into **draw.io (diagrams.net)**
visualizations — flowcharts, UML, ER diagrams, mind maps, and infographics —
powered by an LLM (NVIDIA-hosted `minimaxai/minimax-m2.7` via the
OpenAI-compatible API).

- **Google sign-in** (OAuth 2.0)
- **5 visualizations per account** (configurable quota)
- **Embedded draw.io viewer** + one-click `.drawio` export
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
| `MAX_VISUALIZATIONS_PER_ACCOUNT` | Per-account quota. Defaults to `5`. |

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

- `users` — Google account (`google_id`, email, name, avatar).
- `visualizations` — `title`, `preset`, `source_text`, generated `drawio_xml`.
- `session` — session store (managed by `connect-pg-simple`).

## How generation works

The source text is sent to the LLM with a system prompt that defines the
draw.io XML output contract, plus preset-specific guidance (flowchart, UML,
sequence, ER, mind map, infographic). The response is parsed to a valid
`<mxfile>` document, stored, and rendered.

## Notes

- The quota is enforced atomically (per-user row lock) so concurrent requests
  can't exceed the limit.
- Diagram preview uses `https://viewer.diagrams.net` — diagram XML is passed in
  the URL fragment and is not uploaded anywhere; export is fully local.
