import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

const TABS = [
  { key: "stats", label: "Statistics" },
  { key: "generations", label: "Generation report" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
];

export default function Admin() {
  const [tab, setTab] = useState("stats");

  return (
    <div className="container wide stack">
      <div className="row spread">
        <div>
          <Link to="/" className="muted">
            ← Back to app
          </Link>
          <h2 style={{ margin: "6px 0 0" }}>Admin panel</h2>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <Stats />}
      {tab === "generations" && <Generations />}
      {tab === "users" && <Users />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

// ── Statistics ────────────────────────────────────────────────
function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.admin
      .stats()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner error">{error}</div>;
  if (!data) return <span className="spinner" />;

  const { totals, byPreset, daily, topUsers } = data;
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div className="stack">
      <div className="grid">
        <Stat label="Users" value={totals.users} />
        <Stat label="Admins" value={totals.admins} />
        <Stat label="Visualizations" value={totals.visualizations} />
        <Stat label="Last 7 days" value={totals.last7days} />
      </div>

      <div className="card stack">
        <b>Visualizations by type</b>
        {byPreset.length === 0 ? (
          <span className="muted">No data yet.</span>
        ) : (
          byPreset.map((p) => (
            <div key={p.preset} className="row spread">
              <span>{p.preset}</span>
              <span className="pill">{p.count}</span>
            </div>
          ))
        )}
      </div>

      <div className="card stack">
        <b>Activity (last 14 days)</b>
        {daily.length === 0 ? (
          <span className="muted">No activity yet.</span>
        ) : (
          <div className="bars">
            {daily.map((d) => (
              <div key={d.day} className="bar-col" title={`${d.day}: ${d.count}`}>
                <div
                  className="bar"
                  style={{ height: `${(d.count / maxDaily) * 100}%` }}
                />
                <small className="muted">{d.day.slice(5)}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <b>Top users</b>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th style={{ textAlign: "right" }}>Diagrams</th>
            </tr>
          </thead>
          <tbody>
            {topUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.name || u.email}</td>
                <td style={{ textAlign: "right" }}>{u.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div>
      <small className="muted">{label}</small>
    </div>
  );
}

// ── Generation report ─────────────────────────────────────────
function fmtNum(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function fmtMs(ms) {
  if (ms === null || ms === undefined) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function fmtBytes(b) {
  if (b === null || b === undefined) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function Generations() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.admin
      .generations()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner error">{error}</div>;
  if (!data) return <span className="spinner" />;

  const { totals, byModel, recent } = data;

  return (
    <div className="stack">
      <div className="grid">
        <Stat label="Generations" value={fmtNum(totals.total)} />
        <Stat label="Completed" value={fmtNum(totals.completed)} />
        <Stat label="Failed" value={fmtNum(totals.failed)} />
        <Stat label="Total tokens" value={fmtNum(totals.total_tokens)} />
      </div>

      <div className="grid">
        <Stat label="Input tokens" value={fmtNum(totals.input_tokens)} />
        <Stat label="Output tokens" value={fmtNum(totals.output_tokens)} />
        <Stat label="Avg tokens / diagram" value={fmtNum(totals.avg_total_tokens)} />
        <Stat label="Avg generation time" value={fmtMs(totals.avg_generation_ms)} />
      </div>

      <div className="grid">
        <Stat label="Avg time to first token" value={fmtMs(totals.avg_first_token_ms)} />
        <Stat label="Avg diagram size" value={fmtBytes(totals.avg_diagram_bytes)} />
        <Stat label="Total diagram size" value={fmtBytes(totals.total_diagram_bytes)} />
      </div>

      <div className="card stack">
        <b>By model</b>
        {byModel.length === 0 ? (
          <span className="muted">No data yet.</span>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th style={{ textAlign: "right" }}>Generations</th>
                <th style={{ textAlign: "right" }}>Total tokens</th>
                <th style={{ textAlign: "right" }}>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={m.model}>
                  <td>{m.model}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(m.count)}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(m.total_tokens)}</td>
                  <td style={{ textAlign: "right" }}>{fmtMs(m.avg_generation_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card stack">
        <b>Recent generations (last 100)</b>
        {recent.length === 0 ? (
          <span className="muted">No generations recorded yet.</span>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Diagram</th>
                  <th>User</th>
                  <th>Preset</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>In</th>
                  <th style={{ textAlign: "right" }}>Out</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Time</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((g) => (
                  <tr key={g.id}>
                    <td title={new Date(g.created_at).toLocaleString()}>
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>
                    <td>{g.viz_title || "—"}</td>
                    <td>
                      <small className="muted">
                        {g.user_name || g.user_email || "—"}
                      </small>
                    </td>
                    <td>{g.preset || "—"}</td>
                    <td>
                      <small className="muted">{g.model || "—"}</small>
                    </td>
                    <td>
                      {g.status === "failed" ? (
                        <span
                          className="pill"
                          style={{ color: "var(--danger, #e5484d)" }}
                          title={g.error || ""}
                        >
                          failed
                        </span>
                      ) : (
                        <span className="pill">ok</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtNum(g.prompt_tokens)}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(g.completion_tokens)}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtNum(g.total_tokens)}</td>
                    <td style={{ textAlign: "right" }}>{fmtMs(g.generation_ms)}</td>
                    <td style={{ textAlign: "right" }}>{fmtBytes(g.diagram_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────
function Users() {
  const { user: me, refresh } = useAuth();
  const [users, setUsers] = useState(null);
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  function load() {
    api.admin
      .users()
      .then((d) => {
        setUsers(d.users);
        setLevels(d.levels || []);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function toggleAdmin(u) {
    setError(null);
    setBusy(u.id);
    try {
      await api.admin.setUserAdmin(u.id, !u.is_admin);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function changeLevel(u, level) {
    setError(null);
    setBusy(u.id);
    try {
      await api.admin.setUserLevel(u.id, level);
      load();
      // Reflect the change immediately in the top bar if I changed my own level.
      if (String(u.id) === String(me.id)) refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(u) {
    if (
      !window.confirm(
        `Delete ${u.email}? This permanently removes the user and all their visualizations.`,
      )
    )
      return;
    setError(null);
    setBusy(u.id);
    try {
      await api.admin.deleteUser(u.id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !users) return <div className="banner error">{error}</div>;
  if (!users) return <span className="spinner" />;

  return (
    <div className="card stack">
      {error && <div className="banner error">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Level</th>
            <th style={{ textAlign: "right" }}>Diagrams</th>
            <th>Joined</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = String(u.id) === String(me.id);
            return (
              <tr key={u.id}>
                <td>
                  <div>{u.name || "—"}</div>
                  <small className="muted">{u.email}</small>
                </td>
                <td>
                  {u.is_admin ? (
                    <span className="pill" style={{ color: "var(--accent-2)" }}>
                      admin
                    </span>
                  ) : (
                    <span className="pill">user</span>
                  )}
                </td>
                <td>
                  <select
                    value={u.level}
                    disabled={busy === u.id || levels.length === 0}
                    onChange={(e) => changeLevel(u, Number(e.target.value))}
                    title="Membership level"
                  >
                    {levels.map((l) => (
                      <option key={l.level} value={l.level}>
                        L{l.level} · {l.name} ({l.limit} viz / {l.maxChars} ch)
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "right" }}>{u.viz_count}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: "right" }}>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button
                      disabled={busy === u.id}
                      onClick={() => toggleAdmin(u)}
                    >
                      {u.is_admin ? "Revoke admin" : "Make admin"}
                    </button>
                    <button
                      className="danger"
                      disabled={busy === u.id || isSelf}
                      title={isSelf ? "You can't delete yourself" : undefined}
                      onClick={() => remove(u)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────
const GROUP_LABELS = {
  model: "Model & generation",
  limits: "Limits",
  levels: "Account levels",
};

function Settings() {
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | saved

  useEffect(() => {
    api.admin
      .settings()
      .then((d) => {
        setSchema(d.schema);
        setValues(d.settings);
      })
      .catch((e) => setError(e.message));
  }, []);

  function set(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const d = await api.admin.saveSettings(values);
      setValues(d.settings);
      setStatus("saved");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (error && !schema) return <div className="banner error">{error}</div>;
  if (!schema) return <span className="spinner" />;

  // Group keys by their schema group.
  const groups = {};
  for (const [key, def] of Object.entries(schema)) {
    (groups[def.group] = groups[def.group] || []).push([key, def]);
  }

  return (
    <form className="stack" onSubmit={save}>
      {error && <div className="banner error">{error}</div>}
      {Object.entries(groups).map(([group, fields]) => (
        <div key={group} className="card stack">
          <b>{GROUP_LABELS[group] || group}</b>
          {fields.map(([key, def]) => (
            <div key={key}>
              <label className="muted">{def.label}</label>
              <input
                type={def.type === "string" ? "text" : "number"}
                step={def.type === "float" ? "0.01" : "1"}
                min={def.min}
                max={def.max}
                value={values[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                style={{ marginTop: 6 }}
              />
              {def.help && (
                <small className="muted" style={{ display: "block", marginTop: 4 }}>
                  {def.help}
                </small>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="row">
        <button type="submit" className="primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && <span className="muted">Saved.</span>}
      </div>
    </form>
  );
}
