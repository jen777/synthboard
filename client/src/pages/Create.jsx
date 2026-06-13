import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll a visualization until generation finishes. Resolves with the completed
// row, throws on failure or if it takes implausibly long.
async function pollUntilDone(id, { intervalMs = 2000, timeoutMs = 360_000 } = {}) {
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
  const { quota, setQuota, refresh } = useAuth();
  const navigate = useNavigate();

  const [presets, setPresets] = useState([]);
  const [preset, setPreset] = useState("diagram");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.presets().then((d) => {
      setPresets(d.presets);
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

  return (
    <div className="container">
      <h2>New visualization</h2>
      {quota && (
        <p className="muted">
          {quota.remaining} of {quota.limit} visualizations remaining.
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
                <b>{p.label}</b>
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
