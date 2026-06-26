import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

const TABS = [
  { key: "stats", label: "Statistics" },
  { key: "generations", label: "Generation report" },
  { key: "models", label: "AI models" },
  { key: "libraries", label: "Icon libraries" },
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
      {tab === "models" && <LlmCatalog />}
      {tab === "libraries" && <IconLibraries />}
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

function fmtPct(part, total) {
  const p = Number(part || 0);
  const t = Number(total || 0);
  if (!t) return "0%";
  return `${Math.round((p / t) * 100)}%`;
}

function iconListTitle(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item?.title) return item?.id;
      const source = [item.provider, item.library].filter(Boolean).join(" / ");
      const size = item.width && item.height ? `${item.width}x${item.height}` : "";
      const meta = [item.id, source, item.styleFamily, size].filter(Boolean).join(", ");
      return meta ? `${item.title} (${meta})` : item.title;
    })
    .filter(Boolean)
    .join("\n");
}

function iconAutoTitle(g) {
  const skipped = g.icon_auto_skipped || {};
  const skippedText = Object.entries(skipped)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key}: ${fmtNum(value)}`)
    .join(", ");
  return [
    `auto applied: ${fmtNum(g.icon_auto_applied_count)}`,
    `auto target: ${fmtNum(g.icon_auto_target)}`,
    `eligible vertices: ${fmtNum(g.icon_auto_eligible)}`,
    `auto candidates: ${fmtNum(g.icon_auto_candidate_count)}`,
    skippedText ? `skipped: ${skippedText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function generationQualityFlags(g) {
  if (g.status === "failed") return ["failed"];

  const vertices = Number(g.visual_vertex_count || 0);
  const styledCoverage = vertices
    ? Number(g.visual_styled_vertex_count || 0) / vertices
    : 0;
  const flags = [];

  if (vertices > 0 && styledCoverage < 0.6) flags.push("low styled coverage");
  if (vertices >= 4 && Number(g.visual_fill_color_count || 0) < 2) {
    flags.push("low color variety");
  }
  if (vertices >= 4 && Number(g.visual_shape_type_count || 0) < 2) {
    flags.push("low shape variety");
  }

  return flags;
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

  const { totals, byModel, byPresetIcons, recent } = data;
  const completed = Number(totals.completed || 0);

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

      <div className="grid">
        <Stat
          label="Icon lookup triggered"
          value={`${fmtNum(totals.icon_candidate_generations)} (${fmtPct(
            totals.icon_candidate_generations,
            completed,
          )})`}
        />
        <Stat
          label="Diagrams with icons"
          value={`${fmtNum(totals.icon_applied_generations)} (${fmtPct(
            totals.icon_applied_generations,
            completed,
          )})`}
        />
        <Stat label="Icons applied" value={fmtNum(totals.icons_applied_total)} />
        <Stat label="Auto-applied icons" value={fmtNum(totals.icons_auto_applied_total)} />
        <Stat
          label="Auto target hit"
          value={`${fmtNum(totals.icons_auto_applied_total)} / ${fmtNum(
            totals.icon_auto_target_total,
          )} (${fmtPct(totals.icons_auto_applied_total, totals.icon_auto_target_total)})`}
        />
        <Stat label="Auto-eligible nodes" value={fmtNum(totals.icon_auto_eligible_total)} />
        <Stat label="Icon misses" value={fmtNum(totals.icons_missing_total)} />
        <Stat
          label="Visual defaults used"
          value={`${fmtNum(totals.visual_default_generations)} (${fmtPct(
            totals.visual_default_generations,
            completed,
          )})`}
        />
        <Stat label="Visual defaults applied" value={fmtNum(totals.visual_defaults_total)} />
        <Stat
          label="Icon coverage"
          value={`${fmtNum(totals.visual_icon_vertices_total)} (${fmtPct(
            totals.visual_icon_vertices_total,
            totals.visual_vertices_total,
          )})`}
        />
        <Stat
          label="Styled coverage"
          value={`${fmtNum(totals.visual_styled_vertices_total)} (${fmtPct(
            totals.visual_styled_vertices_total,
            totals.visual_vertices_total,
          )})`}
        />
        <Stat label="Avg fill colors" value={fmtNum(totals.avg_visual_fill_colors)} />
        <Stat label="Avg shape types" value={fmtNum(totals.avg_visual_shape_types)} />
      </div>

      <div className="card stack">
        <b>By model</b>
        {byModel.length === 0 ? (
          <span className="muted">No data yet.</span>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th style={{ textAlign: "right" }}>Generations</th>
                <th style={{ textAlign: "right" }}>Total tokens</th>
                <th style={{ textAlign: "right" }}>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={`${m.provider}:${m.model}`}>
                  <td>{m.provider}</td>
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
        <b>Icon usage by preset</b>
        {byPresetIcons.length === 0 ? (
          <span className="muted">No completed generations recorded yet.</span>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Preset</th>
                <th style={{ textAlign: "right" }}>Completed</th>
                <th style={{ textAlign: "right" }}>Lookup</th>
                <th style={{ textAlign: "right" }}>With icons</th>
                <th style={{ textAlign: "right" }}>Icons</th>
                <th style={{ textAlign: "right" }}>Auto</th>
                <th style={{ textAlign: "right" }}>Auto target</th>
                <th style={{ textAlign: "right" }}>Styled</th>
                <th style={{ textAlign: "right" }}>Icon coverage</th>
                <th style={{ textAlign: "right" }}>Avg colors</th>
                <th style={{ textAlign: "right" }}>Avg shapes</th>
              </tr>
            </thead>
            <tbody>
              {byPresetIcons.map((p) => (
                <tr key={p.preset}>
                  <td>{p.preset}</td>
                  <td style={{ textAlign: "right" }}>{fmtNum(p.count)}</td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.with_candidates)} ({fmtPct(p.with_candidates, p.count)})
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.with_icons)} ({fmtPct(p.with_icons, p.count)})
                  </td>
                  <td style={{ textAlign: "right" }}>{fmtNum(p.icons_applied)}</td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.icons_auto_applied)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.icons_auto_applied)} / {fmtNum(p.icon_auto_target)} (
                    {fmtPct(p.icons_auto_applied, p.icon_auto_target)})
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.visual_defaults_applied)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtPct(p.visual_icon_vertices, p.visual_vertices)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.avg_visual_fill_colors)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtNum(p.avg_visual_shape_types)}
                  </td>
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
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>In</th>
                  <th style={{ textAlign: "right" }}>Out</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Time</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                  <th style={{ textAlign: "right" }}>Icon lookup</th>
                  <th style={{ textAlign: "right" }}>Icons used</th>
                  <th style={{ textAlign: "right" }}>Icon coverage</th>
                  <th style={{ textAlign: "right" }}>Styled</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((g) => {
                  const qualityFlags = generationQualityFlags(g);
                  return (
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
                    <td>{g.provider || "—"}</td>
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
                    <td
                      style={{ textAlign: "right" }}
                      title={iconListTitle(g.icon_candidates)}
                    >
                      {fmtNum(g.icon_candidate_count)}
                    </td>
                    <td
                      style={{ textAlign: "right" }}
                      title={
                        [
                          iconAutoTitle(g),
                          iconListTitle(g.icons_applied),
                          iconListTitle(g.icons_auto_applied),
                          iconListTitle(g.icons_missing),
                        ]
                          .filter(Boolean)
                          .join("\n\n")
                      }
                    >
                      {fmtNum(g.icon_applied_count)}
                      {g.icon_auto_applied_count > 0 && (
                        <small className="muted"> / {fmtNum(g.icon_auto_applied_count)} auto</small>
                      )}
                      {g.icon_auto_target > 0 && (
                        <small className="muted"> / {fmtNum(g.icon_auto_target)} target</small>
                      )}
                      {g.icon_missing_count > 0 && (
                        <small className="muted"> / {fmtNum(g.icon_missing_count)} miss</small>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtPct(g.visual_icon_vertex_count, g.visual_vertex_count)}
                    </td>
                    <td
                      style={{ textAlign: "right" }}
                      title={`${fmtNum(g.visual_vertex_count)} vertices, ${fmtNum(
                        g.visual_icon_vertex_count,
                      )} icon/image nodes, ${fmtNum(
                        g.visual_styled_vertex_count,
                      )} styled nodes, ${fmtNum(
                        g.visual_fill_color_count,
                      )} fill colors, ${fmtNum(
                        g.visual_shape_type_count,
                      )} shape types, ${fmtNum(g.visual_defaults_applied)} visual defaults`}
                    >
                      {fmtNum(g.visual_defaults_applied)}
                    </td>
                    <td title={qualityFlags.join("\n")}>
                      {qualityFlags.length === 0 ? (
                        <span className="pill">ok</span>
                      ) : (
                        <span
                          className="pill"
                          style={{ color: "var(--danger, #e5484d)" }}
                        >
                          review
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI providers and models ───────────────────────────────────
const EMPTY_PROVIDER = {
  id: null,
  name: "",
  baseUrl: "",
  apiKeyEnv: "",
  enabled: true,
};

const EMPTY_MODEL = {
  id: null,
  providerId: "",
  modelName: "",
  displayName: "",
  minLevel: 1,
  enabled: true,
  isDefault: false,
  maxTokens: 8192,
  temperature: 1,
  topP: 0.95,
};

function LlmCatalog() {
  const [providers, setProviders] = useState(null);
  const [levels, setLevels] = useState([]);
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");

  function load() {
    return api.admin
      .llmCatalog()
      .then((data) => {
        setProviders(data.providers || []);
        setLevels(data.levels || []);
        setModelForm((form) => {
          const providerStillExists = data.providers?.some(
            (provider) => provider.id === form.providerId,
          );
          return {
            ...form,
            providerId: providerStillExists
              ? form.providerId
              : data.providers?.[0]?.id || "",
          };
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function setProviderField(key, value) {
    setProviderForm((form) => ({ ...form, [key]: value }));
  }

  function setModelField(key, value) {
    setModelForm((form) => ({ ...form, [key]: value }));
  }

  async function saveProvider(e) {
    e.preventDefault();
    setError(null);
    setStatus("saving-provider");
    try {
      const payload = {
        name: providerForm.name,
        baseUrl: providerForm.baseUrl,
        apiKeyEnv: providerForm.apiKeyEnv,
        enabled: providerForm.enabled,
      };
      if (providerForm.id) {
        await api.admin.updateLlmProvider(providerForm.id, payload);
      } else {
        await api.admin.createLlmProvider(payload);
      }
      setProviderForm(EMPTY_PROVIDER);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function saveModel(e) {
    e.preventDefault();
    setError(null);
    setStatus("saving-model");
    try {
      const payload = {
        ...modelForm,
        minLevel: Number(modelForm.minLevel),
        maxTokens: Number(modelForm.maxTokens),
        temperature: Number(modelForm.temperature),
        topP: Number(modelForm.topP),
      };
      delete payload.id;
      if (modelForm.id) {
        await api.admin.updateLlmModel(modelForm.id, payload);
      } else {
        await api.admin.createLlmModel(payload);
      }
      setModelForm({
        ...EMPTY_MODEL,
        providerId: providers?.[0]?.id || "",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function removeProvider(provider) {
    if (
      !window.confirm(
        `Delete ${provider.name} and its ${provider.models.length} model configuration(s)?`,
      )
    )
      return;
    setError(null);
    try {
      await api.admin.deleteLlmProvider(provider.id);
      if (providerForm.id === provider.id) setProviderForm(EMPTY_PROVIDER);
      if (modelForm.providerId === provider.id) {
        setModelForm(EMPTY_MODEL);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeModel(model) {
    if (!window.confirm(`Delete ${model.displayName}?`)) return;
    setError(null);
    try {
      await api.admin.deleteLlmModel(model.id);
      if (modelForm.id === model.id) {
        setModelForm({
          ...EMPTY_MODEL,
          providerId: providers?.[0]?.id || "",
        });
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function editModel(model) {
    setModelForm({
      id: model.id,
      providerId: model.providerId,
      modelName: model.modelName,
      displayName: model.displayName,
      minLevel: model.minLevel,
      enabled: model.enabled,
      isDefault: model.isDefault,
      maxTokens: model.maxTokens,
      temperature: model.temperature,
      topP: model.topP,
    });
  }

  if (error && !providers) return <div className="banner error">{error}</div>;
  if (!providers) return <span className="spinner" />;

  return (
    <div className="stack">
      {error && <div className="banner error">{error}</div>}
      <div className="banner info">
        Provider endpoints and model settings are stored in Postgres. API key
        values stay in application environment variables; this page stores only
        each variable&apos;s name.
      </div>

      <form className="card stack" onSubmit={saveProvider}>
        <div className="row spread">
          <b>{providerForm.id ? "Edit provider" : "Add provider"}</b>
          {providerForm.id && (
            <button type="button" onClick={() => setProviderForm(EMPTY_PROVIDER)}>
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid">
          <div>
            <label className="muted">Provider name</label>
            <input
              value={providerForm.name}
              onChange={(e) => setProviderField("name", e.target.value)}
              placeholder="OpenAI"
              style={{ marginTop: 6 }}
              required
            />
          </div>
          <div>
            <label className="muted">OpenAI-compatible base URL</label>
            <input
              value={providerForm.baseUrl}
              onChange={(e) => setProviderField("baseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
              style={{ marginTop: 6 }}
              required
            />
          </div>
          <div>
            <label className="muted">API key environment variable</label>
            <input
              value={providerForm.apiKeyEnv}
              onChange={(e) =>
                setProviderField("apiKeyEnv", e.target.value.toUpperCase())
              }
              placeholder="OPENAI_API_KEY"
              style={{ marginTop: 6 }}
              required
            />
          </div>
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={providerForm.enabled}
            onChange={(e) => setProviderField("enabled", e.target.checked)}
            style={{ width: "auto" }}
          />
          Provider enabled
        </label>
        <button
          type="submit"
          className="primary"
          disabled={status === "saving-provider"}
        >
          {status === "saving-provider"
            ? "Saving…"
            : providerForm.id
              ? "Update provider"
              : "Add provider"}
        </button>
      </form>

      <form className="card stack" onSubmit={saveModel}>
        <div className="row spread">
          <b>{modelForm.id ? "Edit model" : "Add model"}</b>
          {modelForm.id && (
            <button
              type="button"
              onClick={() =>
                setModelForm({
                  ...EMPTY_MODEL,
                  providerId: providers[0]?.id || "",
                })
              }
            >
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid">
          <div>
            <label className="muted">Provider</label>
            <select
              value={modelForm.providerId}
              onChange={(e) => setModelField("providerId", e.target.value)}
              style={{ marginTop: 6 }}
              required
            >
              <option value="">Choose a provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="muted">Model id / name</label>
            <input
              value={modelForm.modelName}
              onChange={(e) => setModelField("modelName", e.target.value)}
              placeholder="gpt-4.1-mini"
              style={{ marginTop: 6 }}
              required
            />
          </div>
          <div>
            <label className="muted">Display name</label>
            <input
              value={modelForm.displayName}
              onChange={(e) => setModelField("displayName", e.target.value)}
              placeholder="GPT-4.1 mini"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Minimum account level</label>
            <select
              value={modelForm.minLevel}
              onChange={(e) => setModelField("minLevel", e.target.value)}
              style={{ marginTop: 6 }}
            >
              {levels.map((level) => (
                <option key={level.level} value={level.level}>
                  Level {level.level} · {level.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="muted">Max output tokens</label>
            <input
              type="number"
              min="256"
              max="32768"
              value={modelForm.maxTokens}
              onChange={(e) => setModelField("maxTokens", e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.01"
              value={modelForm.temperature}
              onChange={(e) => setModelField("temperature", e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Top P</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={modelForm.topP}
              onChange={(e) => setModelField("topP", e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label className="row">
            <input
              type="checkbox"
              checked={modelForm.enabled}
              onChange={(e) => setModelField("enabled", e.target.checked)}
              disabled={Boolean(modelForm.id && modelForm.isDefault)}
              style={{ width: "auto" }}
            />
            Model enabled
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={modelForm.isDefault}
              onChange={(e) => setModelField("isDefault", e.target.checked)}
              disabled={Boolean(modelForm.id && modelForm.isDefault)}
              style={{ width: "auto" }}
            />
            Default model
          </label>
        </div>
        {modelForm.id && modelForm.isDefault && (
          <small className="muted">
            To replace the default, edit another enabled model and mark it as
            default first.
          </small>
        )}
        <button
          type="submit"
          className="primary"
          disabled={status === "saving-model" || providers.length === 0}
        >
          {status === "saving-model"
            ? "Saving…"
            : modelForm.id
              ? "Update model"
              : "Add model"}
        </button>
      </form>

      <div className="card stack">
        <b>Configured providers and level access</b>
        {providers.length === 0 ? (
          <span className="muted">Add a provider, then add its models.</span>
        ) : (
          providers.map((provider) => (
            <div className="llm-provider" key={provider.id}>
              <div className="row spread" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <b>{provider.name}</b>
                    <span className="pill">
                      {provider.enabled ? "enabled" : "disabled"}
                    </span>
                    <span
                      className="pill"
                      style={
                        provider.hasApiKey
                          ? { color: "var(--accent-2)" }
                          : { color: "var(--danger)" }
                      }
                    >
                      {provider.hasApiKey ? "key configured" : "key missing"}
                    </span>
                  </div>
                  <small className="muted">{provider.baseUrl}</small>
                  <small className="muted" style={{ display: "block" }}>
                    Key env: {provider.apiKeyEnv}
                  </small>
                </div>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => setProviderForm({ ...provider })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeProvider(provider)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {provider.models.length === 0 ? (
                <small className="muted">No models configured.</small>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Access</th>
                        <th>Parameters</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.models.map((model) => (
                        <tr key={model.id}>
                          <td>
                            <div>{model.displayName}</div>
                            <small className="muted">{model.modelName}</small>
                          </td>
                          <td>
                            Level {model.minLevel}+
                            {levels.find((l) => l.level === model.minLevel)?.name
                              ? ` · ${
                                  levels.find((l) => l.level === model.minLevel)
                                    .name
                                }`
                              : ""}
                          </td>
                          <td>
                            <small className="muted">
                              {model.maxTokens.toLocaleString()} tokens · T{" "}
                              {model.temperature} · P {model.topP}
                            </small>
                          </td>
                          <td>
                            <div className="row" style={{ flexWrap: "wrap" }}>
                              <span className="pill">
                                {model.enabled ? "enabled" : "disabled"}
                              </span>
                              {model.isDefault && (
                                <span className="pill">default</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div
                              className="row"
                              style={{ justifyContent: "flex-end" }}
                            >
                              <button type="button" onClick={() => editModel(model)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => removeModel(model)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Draw.io icon libraries ────────────────────────────────────
function IconLibraries() {
  const [libraries, setLibraries] = useState(null);
  const [objects, setObjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");
  const [form, setForm] = useState({
    id: "",
    name: "",
    provider: "",
    styleFamily: "",
    version: "",
    sourceUrl: "",
  });
  const [file, setFile] = useState(null);

  function load() {
    api.admin
      .iconLibraries()
      .then((d) => {
        setLibraries(d.libraries);
        if (selected && !d.libraries.some((l) => l.id === selected.id)) {
          setSelected(null);
          setObjects([]);
        }
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function selectLibrary(library) {
    setSelected(library);
    setObjects([]);
    setError(null);
    try {
      const d = await api.admin.iconLibraryObjects(library.id);
      setObjects(d.objects);
    } catch (e) {
      setError(e.message);
    }
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function upload(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a .xml library file first.");
      return;
    }
    setError(null);
    setStatus("uploading");
    try {
      const content = await file.text();
      const d = await api.admin.uploadIconLibrary({
        ...form,
        name: form.name.trim() || file.name.replace(/\.xml$/i, ""),
        sourceType: "admin-upload",
        content,
      });
      const ignored = d.library.duplicatesIgnored || 0;
      const variants = d.library.variantsCreated || 0;
      setStatus(
        `Imported ${d.library.objects} objects` +
          (ignored ? `, ignored ${ignored} duplicate${ignored === 1 ? "" : "s"}` : "") +
          (variants ? `, created ${variants} variant${variants === 1 ? "" : "s"}` : "") +
          ".",
      );
      setForm({
        id: "",
        name: "",
        provider: "",
        styleFamily: "",
        version: "",
        sourceUrl: "",
      });
      setFile(null);
      await api.admin.iconLibraries().then((data) => {
        setLibraries(data.libraries);
        const created = data.libraries.find((l) => l.id === d.library.libraryId);
        if (created) selectLibrary(created);
      });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  async function remove(library) {
    if (
      !window.confirm(
        `Delete ${library.name}? This removes ${library.object_count} indexed objects from generation.`,
      )
    )
      return;
    setError(null);
    try {
      await api.admin.deleteIconLibrary(library.id);
      if (selected?.id === library.id) {
        setSelected(null);
        setObjects([]);
      }
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !libraries) return <div className="banner error">{error}</div>;
  if (!libraries) return <span className="spinner" />;

  return (
    <div className="stack">
      {error && <div className="banner error">{error}</div>}

      <form className="card stack" onSubmit={upload}>
        <b>Upload draw.io custom library</b>
        <div className="grid">
          <div>
            <label className="muted">Library name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Azure General"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Provider</label>
            <input
              value={form.provider}
              onChange={(e) => setField("provider", e.target.value)}
              placeholder="Azure"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Style family</label>
            <input
              value={form.styleFamily}
              onChange={(e) => setField("styleFamily", e.target.value)}
              placeholder="azure-flat"
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
        <div className="grid">
          <div>
            <label className="muted">Stable id</label>
            <input
              value={form.id}
              onChange={(e) => setField("id", e.target.value)}
              placeholder="azure-general"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Version</label>
            <input
              value={form.version}
              onChange={(e) => setField("version", e.target.value)}
              placeholder="2026-06"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <label className="muted">Source URL</label>
            <input
              value={form.sourceUrl}
              onChange={(e) => setField("sourceUrl", e.target.value)}
              placeholder="https://github.com/..."
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
        <div>
          <label className="muted">Library XML file</label>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ marginTop: 6 }}
          />
        </div>
        <div className="row">
          <button type="submit" className="primary" disabled={status === "uploading"}>
            {status === "uploading" ? "Uploading…" : "Upload library"}
          </button>
          {status !== "idle" && status !== "uploading" && (
            <span className="muted">{status}</span>
          )}
        </div>
      </form>

      <div className="card stack">
        <b>Indexed libraries</b>
        {libraries.length === 0 ? (
          <span className="muted">No icon libraries have been uploaded yet.</span>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Style</th>
                  <th style={{ textAlign: "right" }}>Objects</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {libraries.map((library) => (
                  <tr key={library.id}>
                    <td>
                      <button
                        className={`link-button ${selected?.id === library.id ? "active" : ""}`}
                        onClick={() => selectLibrary(library)}
                        type="button"
                      >
                        {library.name}
                      </button>
                      <small className="muted" style={{ display: "block" }}>
                        {library.id}
                      </small>
                    </td>
                    <td>{library.provider || "—"}</td>
                    <td>{library.style_family || "—"}</td>
                    <td style={{ textAlign: "right" }}>{library.object_count}</td>
                    <td>{new Date(library.ingested_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => remove(library)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card stack">
          <div className="row spread">
            <b>{selected.name} objects</b>
            <span className="pill">{objects.length} objects</span>
          </div>
          {objects.length === 0 ? (
            <span className="muted">No objects found for this library.</span>
          ) : (
            <div className="object-list">
              {objects.map((object) => (
                <div key={object.id} className="object-row">
                  <span>{object.title}</span>
                  <small className="muted">{object.id}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
