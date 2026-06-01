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

  return (
    <div className="container">
      <div className="row spread" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Your visualizations</h2>
        <button
          className="primary"
          disabled={atLimit}
          onClick={() => navigate("/create")}
          title={atLimit ? "Account limit reached" : ""}
        >
          + New visualization
        </button>
      </div>

      {atLimit && (
        <div className="banner info">
          You've used all {quota.limit} visualizations on this account.
        </div>
      )}

      {loading ? (
        <span className="spinner" />
      ) : items.length === 0 ? (
        <div className="card muted">
          Nothing here yet. Create your first visualization from a note or
          transcript.
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
                  {new Date(v.created_at).toLocaleString()}
                </small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
