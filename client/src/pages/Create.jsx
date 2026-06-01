import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

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
      const data = await api.create({ sourceText, preset, title });
      if (data.quota) setQuota(data.quota);
      await refresh();
      navigate(`/v/${data.visualization.id}`);
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
          />
        </div>

        <div>
          <label className="muted">Notes / transcript / source text</label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste meeting notes, a transcript, a spec, or any text to visualize…"
            style={{ marginTop: 8 }}
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
