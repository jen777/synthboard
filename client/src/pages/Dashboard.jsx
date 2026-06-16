import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

export default function Dashboard() {
  const { quota } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .list()
      .then((d) => setItems(d.visualizations))
      .finally(() => setLoading(false));
  }, []);

  const atLimit = quota && quota.remaining <= 0;
  const completed = items.filter(
    (v) => v.status === "completed" || !v.status
  ).length;
  const inProgress = items.filter(
    (v) => v.status && v.status !== "completed" && v.status !== "failed"
  ).length;

  return (
    <div className="container dashboard-home">
      <section className="dashboard-hero">
        <div>
          <span className="pill">Workspace</span>
          <h2>Your visualizations</h2>
          <p className="muted">
            Create, reopen, and refine generated draw.io boards from one compact
            home.
          </p>
        </div>
        <div className="dashboard-actions">
          <div className="dashboard-stats" aria-label="Visualization status">
            <span><b>{items.length}</b> total</span>
            <span><b>{completed}</b> ready</span>
            <span><b>{inProgress}</b> running</span>
          </div>
          <button
            className="primary"
            disabled={atLimit}
            onClick={() => navigate("/create")}
            title={atLimit ? "Account limit reached" : ""}
          >
            + New visualization
          </button>
        </div>
      </section>

      {atLimit && (
        <div className="banner info">
          You've used all {quota.limit} visualizations on this account.
        </div>
      )}

      {loading ? (
        <span className="spinner" />
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <b>No boards yet</b>
          <span className="muted">
            Create your first visualization from a note or transcript.
          </span>
        </div>
      ) : (
        <div className="grid">
          {items.map((v) => (
            <Link key={v.id} to={`/v/${v.id}`} style={{ color: "inherit" }}>
              <div className="card viz-card stack">
                <div className="row spread">
                  <b>{v.title}</b>
                  <span className="pill">{v.preset}</span>
                </div>
                <small className="muted">
                  {v.status === "failed" ? (
                    <span style={{ color: "var(--danger)" }}>Generation failed</span>
                  ) : v.status && v.status !== "completed" ? (
                    <span className="row" style={{ gap: 6 }}>
                      <span className="spinner" /> Generating…
                    </span>
                  ) : (
                    new Date(v.created_at).toLocaleString()
                  )}
                </small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
