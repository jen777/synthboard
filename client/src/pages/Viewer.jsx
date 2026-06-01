import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import DrawioEditor from "../components/DrawioEditor.jsx";

export default function Viewer() {
  const { id } = useParams();
  const [viz, setViz] = useState(null);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  // Latest XML coming out of the editor, plus a debounce timer for autosave.
  const latestXml = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    api
      .get(id)
      .then((d) => setViz(d.visualization))
      .catch((err) => setError(err.message));
  }, [id]);

  // Clean up any pending save timer on unmount.
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function persist(xml) {
    setSaveState("saving");
    api
      .update(id, xml)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }

  // Called by the editor on every edit. Debounce so we don't hammer the API.
  function handleChange(xml) {
    latestXml.current = xml;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(xml), 1200);
  }

  function download() {
    const xml = latestXml.current || viz.drawio_xml;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (viz.title || "diagram").replace(/[^a-z0-9-_]+/gi, "_");
    a.download = `${safe}.drawio`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="container">
        <div className="banner error">{error}</div>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (!viz) {
    return (
      <div className="container">
        <span className="spinner" />
      </div>
    );
  }

  const saveLabel = {
    idle: "All changes saved",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Save failed — retrying on next edit",
  }[saveState];

  return (
    <div className="container wide stack">
      <div className="row spread">
        <div>
          <Link to="/" className="muted">
            ← All visualizations
          </Link>
          <h2 style={{ margin: "6px 0 0" }}>{viz.title}</h2>
          <small className="muted">
            <span className="pill">{viz.preset}</span>{" "}
            {new Date(viz.created_at).toLocaleString()}
          </small>
        </div>
        <div className="row">
          <small
            className="muted"
            style={{ color: saveState === "error" ? "var(--danger)" : undefined }}
          >
            {saveLabel}
          </small>
          <button className="primary" onClick={download}>
            Download .drawio
          </button>
        </div>
      </div>

      <DrawioEditor xml={viz.drawio_xml} title={viz.title} onChange={handleChange} />
      <small className="muted">
        Drag boxes to rearrange, double-click to edit text, use the shape panel
        to add elements. Edits autosave to your account.
      </small>

      {/* Settings + original source that produced this diagram. */}
      <div className="card stack">
        <b>Generation details</b>
        <div className="grid">
          <div>
            <small className="muted">Preset</small>
            <div>{viz.preset}</div>
          </div>
          <div>
            <small className="muted">Title</small>
            <div>{viz.title}</div>
          </div>
          <div>
            <small className="muted">Created</small>
            <div>{new Date(viz.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <small className="muted">Original source</small>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              maxHeight: "40vh",
              overflow: "auto",
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          >
            {viz.source_text}
          </pre>
        </div>
      </div>
    </div>
  );
}
