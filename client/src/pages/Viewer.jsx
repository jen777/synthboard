import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import DrawioViewer from "../components/DrawioViewer.jsx";

export default function Viewer() {
  const { id } = useParams();
  const [viz, setViz] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(id)
      .then((d) => setViz(d.visualization))
      .catch((err) => setError(err.message));
  }, [id]);

  function download() {
    const blob = new Blob([viz.drawio_xml], { type: "application/xml" });
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
        <button className="primary" onClick={download}>
          Download .drawio
        </button>
      </div>

      <DrawioViewer xml={viz.drawio_xml} />
    </div>
  );
}
