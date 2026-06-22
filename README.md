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
shows each indexed library, object counts, and object names. Uploads accept
draw.io library XML files up to 10 MiB. The Node JSON body parser and bundled
nginx config both allow 20 MiB request bodies to leave room for JSON escaping
around the XML payload; any external proxy in front of the app must allow at
least that much request body size.

For scripted ingestion:

1. Review the source library's license before production use.
2. Add sources to a manifest, using
   `server/drawio-libraries/sources.example.json` as the template.
3. Run the ingestion command from `server/` with normal app database env vars:

```bash
npm run ingest:drawio-libraries -- --manifest ./drawio-libraries/sources.example.json
```

The ingester stores compact searchable metadata plus the exact draw.io object
styles in Postgres. During generation, the server retrieves a candidate set for
the requested preset, title, and source text, asks the LLM to add
`synthIcon=<icon id>` to matching vertex styles, then post-processes the final
XML and replaces those placeholders with the exact draw.io image styles. The LLM
can also request size changes with `synthIconSize=small|medium|large|hero`,
`synthIconScale=0.5-2.5`, or explicit `synthIconWidth=<px>` and
`synthIconHeight=<px>` style keys. Width-only and height-only requests preserve
the object's native aspect ratio. When an icon is selected without a size
request, the post-processor applies the object's native medium geometry so the
library visual is not stretched into a generic model-generated rectangle.
The style parser tolerates model output with whitespace or casing variations
around these keys, such as `synthIcon = azure.database` or `synthicon=...`.
Replaced icons receive readable label defaults (wrapped HTML labels below the
object, centered text, small spacing, and high-contrast font color) unless the
model or library style already provided those label properties.
Conflicting model-generated visual keys such as shape/image/fill/stroke,
opacity, rotation, shadow, and image sizing/border options are stripped
case-insensitively before the exact library object style is applied.

The search query also expands common user wording such as "API", "DB", "web
app", "React frontend", "Node backend", "Postgres", "S3 files", "auth",
"serverless job", "webhook events", and "blob bucket" so existing catalogs are
easier to match. Reingest libraries after changing alias/search logic so stored
object metadata gets refreshed as well.
Catalog lookup uses broad OR-style full-text matching and then ranks the
resulting candidates against the expanded terms, so a long prompt can still
retrieve useful partial matches without requiring every concept to appear in one
library object. If a term cannot safely participate in full-text syntax, the
lookup still falls back to substring matching for the same candidate search.
Prompt candidates are also lightly de-duplicated by object title so repeated
variants from one library do not crowd out distinct concepts like databases,
queues, storage, users, or services.
The generation prompt describes candidates as icon/object library entries,
including image icons and draw.io stencil/object styles, and tells the model to
use `synthIcon=<object id>` so the server can apply the exact stored style.
Exact object IDs are preferred, but the post-processor can resolve explicit
placeholders against the fetched candidate set by normalized object ID or title
when the model emits a minor punctuation/case variant.

If the model underuses the available catalog, the post-processor makes a bounded
best-effort pass over non-image vertices and auto-applies matching candidate
icons by label. The automatic target scales with the number of eligible
vertices, up to 10 library-decorated nodes, so larger diagrams are not capped at
a small fixed icon count. Automatic replacement skips existing library objects
and parent/container vertices, preserving swimlanes, groups, and layout
boundaries while decorating concrete leaf nodes. If no catalog exists or no
match is found, generation falls back to ordinary draw.io shapes. A second
visual-default pass adds missing fill, stroke, text, and rounded-corner styles to
plain non-icon vertices so sparse model output still renders as a colored,
presentation-ready diagram. It also
infers common draw.io shapes for unmatched non-icon labels, such as cylinders
for databases/storage, rhombuses for decisions, document shapes for files, and
hexagons for queues/events, actor shapes for users/people, and ellipses for
teams/groups.

Generation runs these enrichment stages as one server-side post-processing
pipeline: explicit icon replacement, automatic icon fallback, visual defaults,
shape inference, and final visual-summary telemetry.
Exact library object styles such as `shape=mxgraph...` are preserved without
generic fill/stroke defaults and counted as library visual objects in summary
metrics. They also count toward styled coverage, because the library style is
the presentation styling for those nodes.
Automatic icon fallback also skips existing library object styles so it does
not replace a model-selected stencil with a different image icon.
Malformed icon placeholders on non-vertex cells are stripped instead of being
applied, so an accidental `synthIcon` on an edge cannot turn the connector into
an image object. Missing or malformed placeholders keep the cell's ordinary
styling while removing only `synthIcon*` keys.

To verify that pipeline locally without LLM or database credentials, run:

```bash
npm run verify:drawio-enrichment
```

The command builds sample uploaded-library-format `<mxlibrary>` XML, extracts the
compressed draw.io object styles, processes sample draw.io XML with those
objects, and fails if explicit icon replacement, semantic auto-apply, icon
sizing, fallback shapes, or visual summary telemetry regress.
Set `DRAWIO_VERIFY_OUTPUT=/tmp/synthboard-enriched.drawio` to also write the
enriched draw.io XML for visual inspection in diagrams.net.

To verify the same flow through the real Postgres icon catalog, set
`DATABASE_URL` for an app database and run:

```bash
npm run verify:drawio-db-enrichment
```

That command creates the icon catalog schema if needed, ingests a temporary
verification library, searches the catalog, runs DB-backed post-processing, and
then removes the temporary library. If `DATABASE_URL` is not set it reports a
clean skip.

Admins can inspect generation behavior in **Admin panel → Generation report**.
The icon metrics show when catalog lookup happened, how many icons were applied
from explicit model placeholders, how many were auto-applied by the server, and
which placeholders missed. Auto-target metrics show how many vertices were
eligible for automatic library decoration, how many candidate objects were
available, and how close the server got to the target. Explicit `synthIcon`
placeholders are tracked separately and do not consume the automatic target.
Candidate hover details include the offered object title, provider/library,
style family, and native size. The visual-default metrics show when the server
had to style otherwise plain nodes after generation. The visual summary metrics
count final vertices, icon/image nodes, styled nodes, distinct fill colors, and
distinct shape types.
Icon coverage and styled coverage are the fastest effectiveness checks: they
show whether the final rendered XML is actually using library visuals and
presentation styling, not just producing valid XML.
Recent generations also show a Quality flag when the final XML has low icon
coverage despite candidates, low styled-node coverage, low color variety, or low
shape variety.

Admins can also use the API directly: `GET /api/admin/icon-libraries`,
`GET /api/admin/icon-libraries/:id/objects`,
`POST /api/admin/icon-libraries`, `DELETE /api/admin/icon-libraries/:id`, and
`GET /api/admin/icon-libraries/search?q=azure storage`.

## Notes

- The quota is enforced atomically (per-user row lock) so concurrent requests
  can't exceed the limit.
- Diagram preview uses `https://viewer.diagrams.net` — diagram XML is passed in
  the URL fragment and is not uploaded anywhere; export is fully local.
