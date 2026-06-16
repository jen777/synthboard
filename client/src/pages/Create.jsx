import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fallback source-char cap used until the live value loads from the server. The
// authoritative limit is the signed-in user's level cap (admin-editable
// `level_N_chars` setting), returned by /me; source text beyond it is truncated
// server-side.
const DEFAULT_MAX_SOURCE_CHARS = 7000;

function DiagramTypeIcon({ type }) {
  const common = {
    className: "preset-icon",
    viewBox: "0 0 96 64",
    "aria-hidden": "true",
    focusable: "false",
  };

  switch (type) {
    case "uml":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="12" y="10" width="34" height="44" rx="5" />
          <path className="icon-line" d="M18 23h22M18 34h16M18 44h18" />
          <rect className="icon-panel icon-panel-alt" x="54" y="14" width="30" height="36" rx="5" />
          <path className="icon-line" d="M60 27h18M60 38h13M46 31h8" />
          <path className="icon-arrow" d="M50 31l-5-4v8z" />
        </svg>
      );
    case "sequence":
      return (
        <svg {...common}>
          <rect className="icon-node icon-teal" x="10" y="8" width="18" height="12" rx="4" />
          <rect className="icon-node icon-purple" x="39" y="8" width="18" height="12" rx="4" />
          <rect className="icon-node icon-warm" x="68" y="8" width="18" height="12" rx="4" />
          <path className="icon-line icon-dash" d="M19 22v34M48 22v34M77 22v34" />
          <path className="icon-line" d="M22 29h48M74 39H50M51 49h24" />
          <path className="icon-arrow" d="M70 29l-5-4v8zM50 39l5-4v8zM75 49l-5-4v8z" />
        </svg>
      );
    case "er":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="9" y="12" width="28" height="38" rx="4" />
          <rect className="icon-panel icon-panel-alt" x="59" y="12" width="28" height="38" rx="4" />
          <path className="icon-line" d="M15 25h16M15 34h13M15 42h17M65 25h16M65 34h13M65 42h17M37 31h22" />
          <circle className="icon-dot" cx="45" cy="31" r="3" />
          <circle className="icon-dot icon-dot-alt" cx="52" cy="31" r="3" />
        </svg>
      );
    case "mindmap":
      return (
        <svg {...common}>
          <circle className="icon-node icon-purple" cx="48" cy="32" r="11" />
          <path className="icon-line" d="M39 28L20 18M40 37L22 48M57 28l20-10M58 36l18 13" />
          <circle className="icon-node icon-teal" cx="18" cy="17" r="7" />
          <circle className="icon-node icon-warm" cx="20" cy="49" r="7" />
          <circle className="icon-node icon-blue" cx="79" cy="17" r="7" />
          <circle className="icon-node icon-pink" cx="78" cy="50" r="7" />
        </svg>
      );
    case "infographic":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="11" y="10" width="74" height="44" rx="8" />
          <path className="icon-bar icon-teal" d="M22 42V28M35 42V21M48 42V33" />
          <circle className="icon-node icon-warm" cx="67" cy="27" r="10" />
          <path className="icon-line" d="M62 43h16M23 48h28" />
        </svg>
      );
    case "orgchart":
      return (
        <svg {...common}>
          <rect className="icon-node icon-purple" x="37" y="8" width="22" height="14" rx="4" />
          <path className="icon-line" d="M48 22v12M23 34h50M23 34v8M48 34v8M73 34v8" />
          <rect className="icon-node icon-teal" x="12" y="42" width="22" height="14" rx="4" />
          <rect className="icon-node icon-blue" x="37" y="42" width="22" height="14" rx="4" />
          <rect className="icon-node icon-warm" x="62" y="42" width="22" height="14" rx="4" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <path className="icon-line icon-heavy" d="M14 34h68" />
          <circle className="icon-dot icon-teal" cx="22" cy="34" r="5" />
          <circle className="icon-dot icon-purple" cx="44" cy="34" r="5" />
          <circle className="icon-dot icon-warm" cx="68" cy="34" r="5" />
          <path className="icon-line" d="M22 21v8M44 39v9M68 20v9M16 21h18M36 50h20M60 20h18" />
        </svg>
      );
    case "swimlane":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="9" y="10" width="78" height="44" rx="6" />
          <path className="icon-line icon-soft" d="M9 25h78M9 39h78M27 10v44" />
          <rect className="icon-node icon-teal" x="35" y="14" width="18" height="8" rx="3" />
          <rect className="icon-node icon-purple" x="56" y="29" width="18" height="8" rx="3" />
          <rect className="icon-node icon-warm" x="36" y="43" width="18" height="8" rx="3" />
          <path className="icon-line" d="M53 18l7 11M65 37L52 43" />
        </svg>
      );
    case "architecture":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="10" y="14" width="76" height="38" rx="8" />
          <rect className="icon-node icon-purple" x="18" y="24" width="18" height="14" rx="4" />
          <rect className="icon-node icon-teal" x="43" y="18" width="18" height="14" rx="4" />
          <path className="icon-cylinder" d="M70 28c7 0 12 2 12 5v13c0 3-5 5-12 5s-12-2-12-5V33c0-3 5-5 12-5z" />
          <path className="icon-line" d="M36 31h7M61 26l8 5M61 34l8 8" />
        </svg>
      );
    case "state":
      return (
        <svg {...common}>
          <circle className="icon-dot icon-purple" cx="14" cy="32" r="5" />
          <rect className="icon-node icon-teal" x="28" y="20" width="22" height="24" rx="9" />
          <rect className="icon-node icon-warm" x="60" y="20" width="22" height="24" rx="9" />
          <circle className="icon-ring" cx="88" cy="32" r="6" />
          <path className="icon-line" d="M19 32h9M50 32h10M82 32h2" />
          <path className="icon-arrow" d="M28 32l-5-4v8zM60 32l-5-4v8zM84 32l-5-4v8z" />
        </svg>
      );
    case "venn":
      return (
        <svg {...common}>
          <circle className="icon-venn icon-teal" cx="39" cy="32" r="21" />
          <circle className="icon-venn icon-purple" cx="57" cy="32" r="21" />
          <circle className="icon-dot icon-warm" cx="48" cy="32" r="4" />
        </svg>
      );
    case "fishbone":
      return (
        <svg {...common}>
          <path className="icon-line icon-heavy" d="M13 34h65" />
          <path className="icon-arrow" d="M82 34l-8-6v12z" />
          <path className="icon-line" d="M26 34l-12-12M38 34L25 48M50 34L38 21M62 34L50 48" />
          <rect className="icon-node icon-warm" x="70" y="23" width="18" height="22" rx="4" />
        </svg>
      );
    case "kanban":
      return (
        <svg {...common}>
          <rect className="icon-panel" x="10" y="10" width="76" height="44" rx="7" />
          <path className="icon-line icon-soft" d="M35 10v44M61 10v44" />
          <rect className="icon-node icon-teal" x="16" y="20" width="14" height="9" rx="3" />
          <rect className="icon-node icon-purple" x="41" y="18" width="14" height="9" rx="3" />
          <rect className="icon-node icon-blue" x="41" y="32" width="14" height="9" rx="3" />
          <rect className="icon-node icon-warm" x="67" y="27" width="14" height="9" rx="3" />
        </svg>
      );
    case "diagram":
    default:
      return (
        <svg {...common}>
          <rect className="icon-node icon-teal" x="10" y="12" width="24" height="14" rx="5" />
          <path className="icon-decision" d="M51 12l15 12-15 12-15-12z" />
          <rect className="icon-node icon-purple" x="61" y="42" width="25" height="14" rx="5" />
          <path className="icon-line" d="M34 19h9M58 32l8 10" />
          <path className="icon-arrow" d="M44 19l-5-4v8zM66 42l-6-2 3-5z" />
        </svg>
      );
  }
}

// Poll a visualization until generation finishes. Resolves with the completed
// row, throws on failure or if it takes implausibly long.
async function pollUntilDone(id, { intervalMs = 5000, timeoutMs = 600_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { visualization } = await api.get(id);
    if (visualization.status === "completed") return visualization;
    if (visualization.status === "failed") {
      throw new Error(visualization.error || "Generation failed. Please try again.");
    }
    await sleep(intervalMs);
  }
  throw new Error(
    "This is taking longer than expected. It may still finish — check your dashboard in a moment.",
  );
}

export default function Create() {
  const { user, quota, setQuota, refresh } = useAuth();
  const navigate = useNavigate();

  const [presets, setPresets] = useState([]);
  const [presetMaxChars, setPresetMaxChars] = useState(DEFAULT_MAX_SOURCE_CHARS);
  // The signed-in user's level cap is authoritative (it's what the server
  // enforces); fall back to the presets endpoint value until /me has loaded.
  const maxSourceChars = user?.maxSourceChars || presetMaxChars;
  const [preset, setPreset] = useState("diagram");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.presets().then((d) => {
      setPresets(d.presets);
      if (d.maxSourceChars) setPresetMaxChars(d.maxSourceChars);
      if (d.presets[0]) setPreset(d.presets[0].key);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Generation now runs in the background: create() returns as soon as the
      // pending row exists, then we poll for the final status. This keeps every
      // request short so a slow model can't trip the proxy/Cloudflare 524.
      const data = await api.create({ sourceText, preset, title });
      if (data.quota) setQuota(data.quota);
      const viz = await pollUntilDone(data.visualization.id);
      await refresh();
      navigate(`/v/${viz.id}`);
    } catch (err) {
      setError(err.message);
      if (err.data?.quota) setQuota(err.data.quota);
    } finally {
      setSubmitting(false);
    }
  }

  const atLimit = quota && quota.remaining <= 0;
  const overCharLimit = sourceText.length > maxSourceChars;

  return (
    <div className="container">
      <h2>New visualization</h2>
      {quota && (
        <p className="muted">
          {user?.levelName && (
            <>
              <b>
                Level {user.level} · {user.levelName}
              </b>{" "}
              —{" "}
            </>
          )}
          {quota.remaining} of {quota.limit} visualizations remaining
          {" · "}up to {maxSourceChars.toLocaleString()} input characters.
        </p>
      )}
      {error && <div className="banner error">{error}</div>}

      <form className="stack" onSubmit={handleSubmit}>
        <div>
          <label className="muted">Diagram type</label>
          <div className="preset-grid" style={{ marginTop: 8 }}>
            {presets.map((p) => (
              <button
                type="button"
                key={p.key}
                className={`preset ${preset === p.key ? "selected" : ""}`}
                onClick={() => setPreset(p.key)}
                disabled={submitting}
              >
                <DiagramTypeIcon type={p.key} />
                <span className="preset-title">{p.label}</span>
                <small>{p.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="muted">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Planning Sync"
            style={{ marginTop: 8 }}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="muted">Notes / transcript / source text</label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste meeting notes, a transcript, a spec, or any text to visualize…"
            style={{ marginTop: 8 }}
            disabled={submitting}
            required
          />
          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 4 }}
          >
            <small
              style={overCharLimit ? { color: "var(--danger)" } : undefined}
              className={overCharLimit ? undefined : "muted"}
            >
              {sourceText.length.toLocaleString()} /{" "}
              {maxSourceChars.toLocaleString()} characters
            </small>
          </div>
          {overCharLimit && (
            <small style={{ color: "var(--danger)" }}>
              Over the {maxSourceChars.toLocaleString()} character limit — only
              the first {maxSourceChars.toLocaleString()} characters will be
              sent to the model; the rest will be truncated.
            </small>
          )}
        </div>

        <div className="row">
          <button
            type="submit"
            className="primary"
            disabled={submitting || atLimit || !sourceText.trim()}
          >
            {submitting ? (
              <span className="row">
                <span className="spinner" /> Generating…
              </span>
            ) : (
              "Generate diagram"
            )}
          </button>
          {submitting && (
            <span className="muted">
              This can take up to a minute for complex diagrams.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
