import zlib from "node:zlib";

import { query, pool } from "../db.js";

const MAX_PROMPT_OBJECTS = 24;
const MAX_SEARCH_ROWS = 5000;
const MAX_PLANNED_OBJECT_SEARCHES = 24;
const MAX_CANDIDATES_PER_PLANNED_OBJECT = 3;
const PLANNED_SEARCH_BATCH_SIZE = 4;
const ICON_SIZE_PRESETS = {
  small: { width: 72, height: 56 },
  medium: { width: 104, height: 76 },
  large: { width: 144, height: 104 },
  hero: { width: 188, height: 136 },
};
const MAX_ICON_BOUNDS = { width: 240, height: 180 };
const ICON_SLOT_COVERAGE = {
  small: 0.9,
  medium: 1,
  large: 1.05,
  hero: 1.12,
};
const AUTO_ICON_DEFAULT_TARGET = 0;
const AUTO_ICON_MIN_SCORE = 12;
const AUTO_ICON_MAX_REUSE = 3;
const MAX_PROMPT_OBJECTS_PER_TITLE = 2;
const GENERAL_ICON_TERMS = [
  "actor",
  "application",
  "database",
  "document",
  "event",
  "gateway",
  "group",
  "milestone",
  "process",
  "queue",
  "service",
  "storage",
  "system",
  "team",
  "user",
];
const PRESET_ICON_TERMS = {
  diagram: ["start", "process", "decision", "document", "user", "system", "task"],
  uml: ["class", "interface", "object", "package", "component"],
  sequence: ["actor", "user", "service", "system", "database", "message", "api"],
  er: ["database", "entity", "table", "relationship", "key", "storage"],
  mindmap: ["idea", "topic", "concept", "goal", "user", "team", "document"],
  infographic: ["chart", "metric", "dashboard", "document", "user", "team", "goal"],
  orgchart: ["person", "user", "team", "group", "manager", "organization"],
  timeline: ["calendar", "clock", "milestone", "event", "flag", "document"],
  swimlane: ["user", "team", "process", "task", "document", "system", "decision"],
  architecture: [
    "api",
    "application",
    "cache",
    "cloud",
    "database",
    "gateway",
    "queue",
    "server",
    "service",
    "storage",
  ],
  state: ["state", "start", "stop", "event", "process", "system"],
  venn: ["group", "set", "team", "user", "overlap", "concept"],
  fishbone: ["problem", "cause", "process", "team", "tool", "document"],
  kanban: ["task", "card", "board", "user", "team", "ticket", "flag"],
};
const LABEL_ICON_ALIASES = {
  api: ["gateway", "service"],
  app: ["application", "service"],
  apps: ["application", "service"],
  auth: ["identity", "user"],
  backend: ["service", "server", "api"],
  bucket: ["storage"],
  client: ["user", "application"],
  customer: ["user", "actor"],
  db: ["database", "storage"],
  docker: ["container", "compute", "service"],
  event: ["queue", "message"],
  events: ["queue", "message"],
  file: ["document", "storage"],
  files: ["document", "storage"],
  frontend: ["application", "web", "client"],
  job: ["worker", "process"],
  k8s: ["kubernetes", "cluster"],
  lambda: ["function", "serverless", "compute"],
  login: ["user", "identity"],
  message: ["queue", "event"],
  messaging: ["queue", "event"],
  mobile: ["application", "client"],
  person: ["user", "actor"],
  postgres: ["database", "db", "sql"],
  proxy: ["gateway", "api"],
  react: ["application", "frontend", "web"],
  repo: ["repository", "storage"],
  s3: ["storage", "bucket", "file"],
  server: ["service", "compute"],
  serverless: ["function", "job", "compute"],
  svc: ["service"],
  vm: ["virtual", "machine", "compute"],
  web: ["application", "service"],
  webhook: ["event", "message", "api"],
  website: ["application", "web"],
  worker: ["process", "service"],
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function words(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 40);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function xmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripHtml(value) {
  return decodeXmlEntities(String(value || "").replace(/<[^>]+>/g, " "));
}

function parseAttributes(tag) {
  const attrs = {};
  const re = /\s([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3]);
  }
  return attrs;
}

function attrValue(attrs, name) {
  const normalized = name.toLowerCase();
  const entry = Object.entries(attrs).find(([key]) => key.toLowerCase() === normalized);
  return entry?.[1] || "";
}

function replaceAttribute(tag, name, value) {
  const attr = `${name}="${xmlAttr(value)}"`;
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${attr}`);
  return tag.replace(/\s*\/?>$/, (end) => ` ${attr}${end.trim()}`);
}

function styleEntries(style) {
  return String(style || "")
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index < 0) return null;
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    })
    .filter(Boolean)
    .filter(([key]) => Boolean(key));
}

function styleValue(style, key) {
  return styleEntries(style).find(([k]) => k === key)?.[1] || null;
}

function styleValueCaseInsensitive(style, key) {
  const normalized = key.toLowerCase();
  return (
    styleEntries(style).find(([k]) => k.toLowerCase() === normalized)?.[1] || null
  );
}

function hasStyleKey(style, key) {
  return styleEntries(style).some(([k]) => k === key);
}

function hasStyleKeyCaseInsensitive(style, key) {
  const normalized = key.toLowerCase();
  return styleEntries(style).some(([k]) => k.toLowerCase() === normalized);
}

function isSynthIconStyleKey(key) {
  return String(key || "").trim().toLowerCase().startsWith("synthicon");
}

function boundedNumber(value, { min, max }) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function parseMxlibraryXml(content) {
  const match = String(content).match(/<mxlibrary\b[^>]*>([\s\S]*?)<\/mxlibrary>/i);
  if (!match) {
    throw new Error("Expected a <mxlibrary> document.");
  }
  return JSON.parse(match[1]);
}

function decodeLibraryGraphModel(xmlCompressed) {
  const inflated = zlib
    .inflateRawSync(Buffer.from(xmlCompressed, "base64"))
    .toString("utf8");
  try {
    return decodeURIComponent(inflated);
  } catch {
    return inflated;
  }
}

function extractFirstVertexCell(cellXml) {
  const tags = cellXml.match(/<mxCell\b[^>]*>/gi) || [];
  const vertices = tags
    .filter((tag) => /\bvertex\s*=\s*(?:"1"|'1')/i.test(tag))
    .map((tag, index) => ({ tag, index, score: vertexStyleScore(tag) }));
  return (
    vertices.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.tag || null
  );
}

function vertexStyleScore(tag) {
  const style = attrValue(parseAttributes(tag), "style");
  if (!style) return 0;
  if (isExistingLibraryObjectStyle(style)) return 100;
  if (hasStyleKeyCaseInsensitive(style, "shape")) return 80;
  if (
    hasStyleKeyCaseInsensitive(style, "fillColor") ||
    hasStyleKeyCaseInsensitive(style, "strokeColor")
  ) {
    return 50;
  }
  return 10;
}

function extractObjectDetails(item) {
  let cellXml = null;
  let style = null;
  try {
    cellXml = decodeLibraryGraphModel(item.xml);
    const vertex = extractFirstVertexCell(cellXml);
    if (vertex) {
      style = attrValue(parseAttributes(vertex), "style") || null;
    }
  } catch (err) {
    console.warn("[drawio-libraries] could not decode object", {
      title: item.title,
      message: err?.message,
    });
  }

  return {
    title: String(item.title || "Untitled object").trim(),
    width: Number.isFinite(Number(item.w)) ? Number(item.w) : null,
    height: Number.isFinite(Number(item.h)) ? Number(item.h) : null,
    aspect: item.aspect || null,
    style,
    cellXml,
    xmlCompressed: item.xml,
  };
}

function baseObjectId(libraryId, title, index) {
  return `${libraryId}.${slugify(title) || `object-${index + 1}`}`;
}

function objectDataFingerprint(obj) {
  return JSON.stringify({
    width: obj.width,
    height: obj.height,
    aspect: obj.aspect,
    xmlCompressed: obj.xmlCompressed,
  });
}

function resolveObjectIdCollisions(objects) {
  const groups = new Map();
  for (const obj of objects) {
    const group = groups.get(obj.baseId) || [];
    group.push(obj);
    groups.set(obj.baseId, group);
  }

  const resolved = [];
  let duplicatesIgnored = 0;
  let variantsCreated = 0;

  for (const [baseId, group] of groups.entries()) {
    const distinct = [];
    const seen = new Set();
    for (const obj of group) {
      const fingerprint = objectDataFingerprint(obj);
      if (seen.has(fingerprint)) {
        duplicatesIgnored++;
        continue;
      }
      seen.add(fingerprint);
      distinct.push(obj);
    }

    if (distinct.length === 1) {
      const [{ baseId: _baseId, ...obj }] = distinct;
      resolved.push({ ...obj, id: baseId });
      continue;
    }

    distinct.forEach(({ baseId: _baseId, ...obj }, index) => {
      variantsCreated++;
      resolved.push({ ...obj, id: `${baseId}-v${index + 1}` });
    });
  }

  return { objects: resolved, duplicatesIgnored, variantsCreated };
}

export function buildObjectAliases({ title, provider }) {
  const base = words(title);
  const aliases = [...base];
  if (provider) aliases.push(...words(provider));
  if (base.includes("active") && base.includes("directory")) {
    aliases.push("identity", "auth", "login", "user");
  }
  if (base.includes("application")) aliases.push("app", "web", "service");
  if (base.includes("actor") || base.includes("person")) aliases.push("user");
  if (base.includes("api")) aliases.push("gateway", "service", "endpoint");
  if (base.includes("app") && base.includes("service")) {
    aliases.push("application", "web", "server");
  }
  if (base.includes("blob")) aliases.push("storage", "bucket", "file");
  if (base.includes("bus")) aliases.push("queue", "messaging", "event");
  if (base.includes("cache")) aliases.push("redis", "memory");
  if (base.includes("calendar")) aliases.push("date", "event", "milestone");
  if (base.includes("cdn")) aliases.push("edge", "cache", "network");
  if (base.includes("container")) aliases.push("docker", "compute", "service");
  if (base.includes("cosmos")) aliases.push("database", "db", "nosql");
  if (base.includes("database")) aliases.push("db", "sql");
  if (base.includes("document")) aliases.push("file", "note", "page");
  if (base.includes("dns")) aliases.push("domain", "network");
  if (base.includes("event")) aliases.push("queue", "message", "messaging");
  if (base.includes("function")) aliases.push("serverless", "job", "compute");
  if (base.includes("gateway")) aliases.push("api", "ingress", "proxy");
  if (base.includes("hub")) aliases.push("event", "messaging", "queue");
  if (base.includes("identity")) aliases.push("auth", "login", "user");
  if (base.includes("key") && base.includes("vault")) {
    aliases.push("secret", "security", "certificate");
  }
  if (base.includes("load") && base.includes("balancer")) {
    aliases.push("gateway", "traffic", "network");
  }
  if (base.includes("monitor")) aliases.push("observability", "metrics", "logs");
  if (base.includes("network")) aliases.push("vnet", "subnet");
  if (base.includes("server")) aliases.push("service", "compute");
  if (base.includes("sql")) aliases.push("database", "db");
  if (base.includes("storage")) aliases.push("blob", "bucket", "file");
  if (base.includes("queue")) aliases.push("messaging", "event");
  if (base.includes("kubernetes")) aliases.push("k8s", "cluster");
  if (base.includes("virtual") && base.includes("machine")) aliases.push("vm");
  if (base.includes("virtual") && base.includes("network")) {
    aliases.push("vnet", "subnet", "network");
  }
  return unique(aliases);
}

export function extractDrawioLibraryObjects({
  id,
  name,
  provider,
  styleFamily,
  content,
}) {
  const libraryId = slugify(id || name);
  if (!libraryId) throw new Error("Library id or name is required.");

  const items = parseMxlibraryXml(content);
  if (!Array.isArray(items)) {
    throw new Error("Expected <mxlibrary> to contain a JSON array.");
  }

  const rawObjects = items
    .filter((item) => item?.xml)
    .map((item, index) => {
      const details = extractObjectDetails(item);
      const aliases = buildObjectAliases({ title: details.title, provider });
      const searchText = unique([
        details.title,
        name,
        provider,
        styleFamily,
        ...aliases,
      ]).join(" ");
      return {
        baseId: baseObjectId(libraryId, details.title, index),
        libraryId,
        library_id: libraryId,
        library_name: name || libraryId,
        provider: provider || null,
        style_family: styleFamily || null,
        aliases,
        searchText,
        search_text: searchText,
        ...details,
      };
    });

  const { objects, duplicatesIgnored, variantsCreated } =
    resolveObjectIdCollisions(rawObjects);
  return { libraryId, objects, duplicatesIgnored, variantsCreated };
}

export async function ingestDrawioLibrary({
  id,
  name,
  provider,
  styleFamily,
  sourceUrl,
  sourceType,
  version,
  content,
  metadata,
}) {
  const { libraryId, objects, duplicatesIgnored, variantsCreated } =
    extractDrawioLibraryObjects({
      id,
      name,
      provider,
      styleFamily,
      content,
    });
  if (duplicatesIgnored > 0 || variantsCreated > 0) {
    console.log("[drawio-libraries] resolved duplicate object names", {
      libraryId,
      duplicatesIgnored,
      variantsCreated,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO drawio_icon_libraries
         (id, name, provider, style_family, source_url, source_type, version,
          object_count, metadata, ingested_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          provider = EXCLUDED.provider,
          style_family = EXCLUDED.style_family,
          source_url = EXCLUDED.source_url,
          source_type = EXCLUDED.source_type,
          version = EXCLUDED.version,
          object_count = EXCLUDED.object_count,
          metadata = EXCLUDED.metadata,
          ingested_at = now()`,
      [
        libraryId,
        name || libraryId,
        provider || null,
        styleFamily || null,
        sourceUrl || null,
        sourceType || null,
        version || null,
        objects.length,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    await client.query("DELETE FROM drawio_icon_objects WHERE library_id = $1", [
      libraryId,
    ]);

    for (const obj of objects) {
      await client.query(
        `INSERT INTO drawio_icon_objects
           (id, library_id, title, search_text, aliases, width, height, aspect,
            style, cell_xml, xml_compressed, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          obj.id,
          obj.libraryId,
          obj.title,
          obj.searchText,
          obj.aliases,
          obj.width,
          obj.height,
          obj.aspect,
          obj.style,
          obj.cellXml,
          obj.xmlCompressed,
          JSON.stringify({ aliases: obj.aliases }),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return { libraryId, objects: objects.length, duplicatesIgnored, variantsCreated };
}

export async function listIconLibraries() {
  const { rows } = await query(
    `SELECT id, name, provider, style_family, source_url, source_type, version,
            object_count, ingested_at
       FROM drawio_icon_libraries
      ORDER BY provider NULLS LAST, name`,
  );
  return rows;
}

export async function listIconObjects(libraryId) {
  const { rows } = await query(
    `SELECT id, title, aliases, width, height, aspect, created_at,
            (cell_xml IS NOT NULL OR style IS NOT NULL) AS has_preview
       FROM drawio_icon_objects
      WHERE library_id = $1
      ORDER BY title`,
    [libraryId],
  );
  return rows;
}

export function buildIconPreviewXml({ id, title, width, height, style, cellXml }) {
  const source = String(cellXml || "").trim();
  if (/<mxfile\b/i.test(source)) return source;
  if (/<mxGraphModel\b/i.test(source)) {
    return `<mxfile host="synthboard"><diagram id="preview" name="Preview">${source}</diagram></mxfile>`;
  }
  if (!style) return null;

  const previewWidth = boundedNumber(width, { min: 16, max: 320 }) || 80;
  const previewHeight = boundedNumber(height, { min: 16, max: 240 }) || 80;
  return `<mxfile host="synthboard"><diagram id="preview" name="Preview"><mxGraphModel page="0" background="none"><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="${xmlAttr(id || "preview-object")}" value="${xmlAttr(title || "")}" style="${xmlAttr(style)}" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${previewWidth}" height="${previewHeight}" as="geometry" /></mxCell></root></mxGraphModel></diagram></mxfile>`;
}

export async function getIconObjectPreview(libraryId, objectId) {
  const { rows } = await query(
    `SELECT id, title, width, height, style, cell_xml
       FROM drawio_icon_objects
      WHERE library_id = $1 AND id = $2`,
    [libraryId, objectId],
  );
  const object = rows[0];
  if (!object) return null;
  return {
    id: object.id,
    title: object.title,
    previewXml: buildIconPreviewXml({
      id: object.id,
      title: object.title,
      width: object.width,
      height: object.height,
      style: object.style,
      cellXml: object.cell_xml,
    }),
  };
}

export async function deleteIconLibrary(libraryId) {
  const { rowCount } = await query(
    "DELETE FROM drawio_icon_libraries WHERE id = $1",
    [libraryId],
  );
  return rowCount > 0;
}

function scoreObject(row, terms) {
  const haystack = `${row.id} ${row.title} ${row.search_text} ${row.library_name} ${row.provider || ""}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (row.id.toLowerCase().includes(term)) score += 8;
    if (row.title.toLowerCase() === term) score += 20;
    if (row.title.toLowerCase().includes(term)) score += 10;
    if (haystack.includes(term)) score += 3;
  }
  if (row.style_family) score += 1;
  return score;
}

function chooseDominantLibrary(rows) {
  const totals = new Map();
  for (const row of rows) {
    totals.set(row.library_id, (totals.get(row.library_id) || 0) + row.score);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function candidateTitleKey(row) {
  return slugify(row.title || row.id);
}

export function selectPromptIconCandidates(rankedRows, limit = MAX_PROMPT_OBJECTS) {
  const dominantLibraryId = chooseDominantLibrary(rankedRows);
  const ordered = [
    ...rankedRows.filter((row) => row.library_id === dominantLibraryId),
    ...rankedRows.filter((row) => row.library_id !== dominantLibraryId),
  ];
  const selected = [];
  const deferred = [];
  const titleCounts = new Map();

  for (const row of ordered) {
    const key = candidateTitleKey(row);
    const count = titleCounts.get(key) || 0;
    if (count < MAX_PROMPT_OBJECTS_PER_TITLE) {
      selected.push(row);
      titleCounts.set(key, count + 1);
    } else {
      deferred.push(row);
    }
    if (selected.length >= limit) return selected;
  }

  return [...selected, ...deferred].slice(0, limit);
}

export function buildIconQueryTerms(searchText, { limit = 90 } = {}) {
  return expandLabelTerms(unique(words(searchText)).slice(0, 60)).slice(0, limit);
}

export function buildIconTsQuery(terms) {
  return unique(terms)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .join(" | ");
}

export async function searchIconObjects(searchText, { limit = MAX_PROMPT_OBJECTS } = {}) {
  const terms = buildIconQueryTerms(searchText);
  if (terms.length === 0) return [];

  const tsQuery = buildIconTsQuery(terms) || null;
  const likeTerms = terms.map((term) => `%${term}%`);
  const { rows } = await query(
    `SELECT o.id, o.library_id, o.title, o.search_text, o.width, o.height,
            l.name AS library_name, l.provider, l.style_family
       FROM drawio_icon_objects o
       JOIN drawio_icon_libraries l ON l.id = o.library_id
      WHERE (
              $1::text IS NOT NULL
              AND to_tsvector('simple', o.search_text) @@ to_tsquery('simple', $1)
            )
         OR o.search_text ILIKE ANY($2)
         OR o.id ILIKE ANY($2)
      LIMIT $3`,
    [tsQuery, likeTerms, MAX_SEARCH_ROWS],
  );

  const ranked = rows
    .map((row) => ({ ...row, score: scoreObject(row, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return selectPromptIconCandidates(ranked, limit);
}

export function buildIconSearchText({ preset, sourceText, title }) {
  return unique([
    title,
    preset,
    ...(PRESET_ICON_TERMS[preset] || []),
    ...GENERAL_ICON_TERMS,
    sourceText,
  ]).join(" ");
}

function iconPromptKeywords(candidate, { limit = 8 } = {}) {
  const blocked = new Set(
    words(
      [
        candidate.id,
        candidate.title,
        candidate.library_name,
        candidate.provider,
        candidate.style_family,
      ].join(" "),
    ),
  );
  return unique(words(candidate.search_text || ""))
    .filter((term) => !blocked.has(term))
    .slice(0, limit)
    .join("/");
}

export function buildIconPrompt(candidates) {
  if (!candidates?.length) return "";

  const lines = candidates.map((c) => {
    const size =
      c.width && c.height ? `, native ${Math.round(c.width)}x${Math.round(c.height)}` : "";
    const keywordText = iconPromptKeywords(c);
    const keywords = keywordText ? `, matches ${keywordText}` : "";
    return `- ${c.id}: ${c.title} (${c.provider || c.library_name}, ${c.style_family || "same set"}${size}${keywords})`;
  });

  return `Retrieved draw.io icon/logo/object context:
Use a listed library object when it is an exact semantic match for a concrete planned object. Use the planned standard draw.io fallback shape when no listed object is exact; never substitute a merely related logo or icon.
Listed objects can be image icons or draw.io object/stencil styles. To use one, add synthIcon=<object id> to that vertex's style; the server will replace it with the exact library style. Keep the node label in value. Do not invent object ids.
Set synthIconSize=small|medium|large|hero so the server makes the object clearly visible, scales it to the planned layout slot, preserves its native aspect ratio, and keeps the original geometry center fixed. Prefer medium; use large or hero only for a genuinely primary visual. Do not emit explicit width, height, or scale controls during normal generation.
Object ids:
${lines.join("\n")}`;
}

function plannedObjectSearchText(object) {
  return unique([
    object.label,
    object.role,
    object.fallbackShape,
    ...(Array.isArray(object.searchTerms) ? object.searchTerms : []),
  ]).join(" ");
}

function plannedCandidateLine(candidate) {
  const size =
    candidate.width && candidate.height
      ? `, native ${Math.round(candidate.width)}x${Math.round(candidate.height)}`
      : "";
  const keywordText = iconPromptKeywords(candidate);
  const keywords = keywordText ? `, matches ${keywordText}` : "";
  return `    - ${candidate.id}: ${candidate.title} (${candidate.provider || candidate.library_name}, ${candidate.style_family || "library object"}${size}${keywords})`;
}

export function buildPlannedIconPrompt(matches) {
  const usable = (matches || []).filter(
    (match) => match.visual !== "shape" && match.candidates?.length > 0,
  );
  if (usable.length === 0) return "";

  const groups = usable.map((match) => {
    const size = match.size || "medium";
    return [
      `- ${match.key} — ${match.label} (planned visual: ${match.visual}, planned size: ${size}, fallback shape: ${match.fallbackShape || "rounded rectangle"})`,
      ...match.candidates.map(plannedCandidateLine),
    ].join("\n");
  });

  return `Retrieved draw.io library matches, grouped by planned object:
Use icons, logos, or library images only from the candidate group for that planned object. Choose a candidate only when it is an exact semantic match. Otherwise use the object's planned fallback shape. Never invent, alter, or borrow an object id from another group.
For every chosen library object, add synthIcon=<exact object id> and synthIconSize=<planned size> to the vertex style. Do not add synthIconWidth, synthIconHeight, or synthIconScale. The server applies the exact stored library style, scales it prominently within the planned layout slot, preserves native aspect ratio, and recenters it on the original vertex geometry. Keep a readable text label below the visual and leave enough whitespace for it.
${groups.join("\n")}`;
}

function selectPlannedCandidates(matches, limit = MAX_PROMPT_OBJECTS) {
  const selected = [];
  const selectedIds = new Set();
  const usable = matches.filter((match) => match.visual !== "shape");

  for (let rank = 0; rank < MAX_CANDIDATES_PER_PLANNED_OBJECT; rank++) {
    for (const match of usable) {
      const candidate = match.candidates?.[rank];
      if (!candidate || selectedIds.has(candidate.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      if (selected.length >= limit) return { selected, selectedIds };
    }
  }

  return { selected, selectedIds };
}

/**
 * Search the catalog after the LLM has identified the diagram's concrete
 * objects. Matches remain grouped by planned object so the diagram call cannot
 * confuse a related icon with the object it was retrieved for.
 */
export async function buildPlannedIconPromptContext({ plan }, dependencies = {}) {
  const objects = (plan?.objects || []).slice(0, MAX_PLANNED_OBJECT_SEARCHES);
  const searchObjects = dependencies.searchIconObjects || searchIconObjects;
  const matches = [];
  let lookupErrors = 0;

  for (let index = 0; index < objects.length; index += PLANNED_SEARCH_BATCH_SIZE) {
    const batch = objects.slice(index, index + PLANNED_SEARCH_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (object) => {
        const searchText = plannedObjectSearchText(object);
        if (!searchText) return { object, candidates: [] };
        try {
          return {
            object,
            candidates: await searchObjects(searchText, {
              limit: MAX_CANDIDATES_PER_PLANNED_OBJECT,
            }),
          };
        } catch {
          lookupErrors++;
          return { object, candidates: [] };
        }
      }),
    );

    for (const { object, candidates } of results) {
      matches.push({
        key: object.key,
        label: object.label,
        visual: object.visual,
        size: object.size,
        fallbackShape: object.fallbackShape,
        candidates,
      });
    }
  }

  const { selected, selectedIds } = selectPlannedCandidates(matches);
  const promptMatches = matches.map((match) => ({
    ...match,
    candidates: match.candidates.filter((candidate) => selectedIds.has(candidate.id)),
  }));

  return {
    candidates: selected,
    matches: promptMatches,
    prompt: buildPlannedIconPrompt(promptMatches),
    searchedObjects: objects.length,
    matchedObjects: promptMatches.filter(
      (match) => match.visual !== "shape" && match.candidates.length > 0,
    ).length,
    lookupErrors,
  };
}

function cleanRequestedIconStyle(style) {
  const blockedKeys = new Set([
    "aspect",
    "fillcolor",
    "flip",
    "fliph",
    "flipv",
    "gradientcolor",
    "image",
    "imageaspect",
    "imagebackground",
    "imageborder",
    "imageheight",
    "imagewidth",
    "opacity",
    "perimeter",
    "rounded",
    "rotation",
    "shadow",
    "shape",
    "strokecolor",
    "strokewidth",
  ]);
  return String(style || "")
    .split(";")
    .filter((part) => {
      if (!part) return false;
      if (!part.includes("=")) return false;
      const key = part.split("=")[0]?.trim();
      return (
        key &&
        !isSynthIconStyleKey(key) &&
        !blockedKeys.has(key.toLowerCase())
      );
    })
    .join(";");
}

function stripSynthIconStyleKeys(style) {
  return String(style || "")
    .split(";")
    .filter((part) => {
      if (!part) return false;
      const key = part.split("=")[0]?.trim();
      return key && !isSynthIconStyleKey(key);
    })
    .join(";");
}

function requestedIconSize(requestedStyle, icon, slot = null) {
  const rawWidth = Number(icon.width);
  const rawHeight = Number(icon.height);
  const nativeWidth = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 64;
  const nativeHeight = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 64;
  const aspect = Math.min(6, Math.max(1 / 6, nativeWidth / nativeHeight || 1));

  const preset = styleValueCaseInsensitive(requestedStyle, "synthIconSize")?.toLowerCase();
  let presetBounds = ICON_SIZE_PRESETS[preset] || null;
  if (presetBounds && slot?.width > 0 && slot?.height > 0) {
    const coverage = ICON_SLOT_COVERAGE[preset] || ICON_SLOT_COVERAGE.medium;
    presetBounds = {
      width: Math.min(presetBounds.width, slot.width * coverage),
      height: Math.min(presetBounds.height, slot.height * coverage),
    };
  }
  const explicitScale = boundedNumber(styleValueCaseInsensitive(requestedStyle, "synthIconScale"), {
    min: 0.35,
    max: 3,
  });

  const width = boundedNumber(styleValueCaseInsensitive(requestedStyle, "synthIconWidth"), {
    min: 16,
    max: MAX_ICON_BOUNDS.width,
  });
  const height = boundedNumber(styleValueCaseInsensitive(requestedStyle, "synthIconHeight"), {
    min: 16,
    max: MAX_ICON_BOUNDS.height,
  });

  let bounds;
  if (width || height) {
    bounds = {
      width: width || MAX_ICON_BOUNDS.width,
      height: height || MAX_ICON_BOUNDS.height,
    };
  } else if (explicitScale) {
    bounds = {
      width: Math.min(
        MAX_ICON_BOUNDS.width,
        ICON_SIZE_PRESETS.medium.width * explicitScale,
      ),
      height: Math.min(
        MAX_ICON_BOUNDS.height,
        ICON_SIZE_PRESETS.medium.height * explicitScale,
      ),
    };
  } else if (presetBounds) {
    bounds = presetBounds;
  } else {
    return null;
  }

  let fittedWidth = bounds.width;
  let fittedHeight = fittedWidth / aspect;
  if (fittedHeight > bounds.height) {
    fittedHeight = bounds.height;
    fittedWidth = fittedHeight * aspect;
  }

  return {
    width: Math.max(4, Math.round(fittedWidth)),
    height: Math.max(4, Math.round(fittedHeight)),
  };
}

function geometryNumber(attrs, name) {
  const value = attrValue(attrs, name);
  if (value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function geometryBounds(cellXml) {
  const geometryTag = String(cellXml).match(/<mxGeometry\b[^>]*\/?>/i)?.[0];
  if (!geometryTag) return null;
  const attrs = parseAttributes(geometryTag);
  const width = geometryNumber(attrs, "width");
  const height = geometryNumber(attrs, "height");
  return width > 0 && height > 0 ? { width, height } : null;
}

function formatGeometryNumber(value) {
  return String(Math.round(value * 10) / 10);
}

function applyGeometrySize(cellXml, size) {
  if (!size) return cellXml;
  const withGeometry = String(cellXml).replace(/<mxGeometry\b[^>]*\/?>/i, (tag) => {
    const attrs = parseAttributes(tag);
    const originalWidth = geometryNumber(attrs, "width");
    const originalHeight = geometryNumber(attrs, "height");
    const originalX = geometryNumber(attrs, "x");
    const originalY = geometryNumber(attrs, "y");
    let nextTag = replaceAttribute(tag, "width", size.width);
    nextTag = replaceAttribute(nextTag, "height", size.height);

    if (
      attrValue(attrs, "relative") !== "1" &&
      originalWidth !== null &&
      originalHeight !== null &&
      originalX !== null &&
      originalY !== null
    ) {
      const centerX = originalX + originalWidth / 2;
      const centerY = originalY + originalHeight / 2;
      const nextX = Math.max(0, centerX - size.width / 2);
      const nextY = Math.max(0, centerY - size.height / 2);
      nextTag = replaceAttribute(nextTag, "x", formatGeometryNumber(nextX));
      nextTag = replaceAttribute(nextTag, "y", formatGeometryNumber(nextY));
    }
    return nextTag;
  });
  if (withGeometry !== cellXml) return withGeometry;

  const geometry = `<mxGeometry width="${size.width}" height="${size.height}" as="geometry" />`;
  if (/^<mxCell\b[^>]*\/>$/i.test(cellXml.trim())) {
    return cellXml.replace(/\s*\/>$/i, `>\n  ${geometry}\n</mxCell>`);
  }
  return cellXml.replace(/<\/mxCell>$/i, `\n  ${geometry}\n</mxCell>`);
}

function styleDefaults(style, defaults) {
  return Object.entries(defaults)
    .filter(([key]) => !hasStyleKeyCaseInsensitive(style, key))
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}

function mergedIconStyle(iconStyle, requestedStyle) {
  const cleanRequested = cleanRequestedIconStyle(requestedStyle);
  const baseStyle = `${iconStyle || ""};${cleanRequested || ""}`;
  const labelDefaults = styleDefaults(baseStyle, {
    whiteSpace: "wrap",
    html: "1",
    verticalLabelPosition: "bottom",
    verticalAlign: "top",
    align: "center",
    spacingTop: "6",
    fontSize: "12",
    fontColor: "#0f172a",
  });
  return `${iconStyle || ""};${labelDefaults}${cleanRequested ? `;${cleanRequested}` : ""}`
    .replace(/;{2,}/g, ";")
    .replace(/^;+|;+$/g, "");
}

function isExistingLibraryObjectStyle(style) {
  const shape = styleValueCaseInsensitive(style, "shape") || "";
  return (
    shape.toLowerCase() === "image" ||
    hasStyleKeyCaseInsensitive(style, "image") ||
    shape.toLowerCase().startsWith("mxgraph.") ||
    shape.toLowerCase().startsWith("stencil(")
  );
}

function isContainerLikeStyle(style) {
  const shape = (styleValueCaseInsensitive(style, "shape") || "").toLowerCase();
  return shape === "swimlane" || shape === "group" || shape === "table";
}

export async function applyIconPlaceholders(xml) {
  return applyIconEnhancements(xml);
}

export function explicitIconIdsFromXml(xml) {
  const ids = [];
  String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const iconId = styleValueCaseInsensitive(
      attrValue(parseAttributes(tag), "style"),
      "synthIcon",
    );
    if (iconId) ids.push(iconId);
    return tag;
  });
  return unique(ids);
}

export async function applyIconEnhancements(
  xml,
  { candidateIds = [], fitToGeometry = false } = {},
) {
  const placeholderIds = explicitIconIdsFromXml(xml);
  const ids = unique([...placeholderIds, ...candidateIds]);
  if (ids.length === 0) return { xml, applied: [], missing: [], autoApplied: [] };

  const { rows } = await query(
    `SELECT id, title, search_text, style, width, height
       FROM drawio_icon_objects
      WHERE id = ANY($1)`,
    [ids],
  );
  return applyIconRowsToXml(xml, rows, {
    candidateIds,
    fitToGeometry,
  });
}

function scoreIconForLabel(icon, label) {
  const rawLabelTerms = unique(words(label));
  const labelTerms = expandLabelTerms(rawLabelTerms);
  if (labelTerms.length === 0) return 0;

  const title = String(icon.title || "").toLowerCase();
  const id = String(icon.id || "").toLowerCase();
  const searchText = String(icon.search_text || icon.title || "").toLowerCase();
  const titleTerms = unique(words(icon.title));
  const idTerms = unique(words(icon.id));
  const searchTerms = unique(words(searchText));
  let score = 0;

  if (title && stripHtml(label).toLowerCase().includes(title)) score += 30;
  if (titleTerms.length > 0 && titleTerms.every((term) => labelTerms.includes(term))) {
    score += 24;
  }

  for (const term of rawLabelTerms) {
    if (titleTerms.includes(term)) score += 22;
    else if (title.includes(term)) score += 16;
    if (idTerms.includes(term)) score += 18;
    else if (id.includes(term)) score += 12;
    if (searchTerms.includes(term)) score += 10;
  }

  for (const term of labelTerms) {
    if (titleTerms.includes(term)) score += 10;
    else if (title.includes(term)) score += 7;
    else if (searchTerms.includes(term)) score += 12;
    else if (searchText.includes(term)) score += 4;
  }

  return score;
}

function expandLabelTerms(labelTerms) {
  const expanded = [];
  for (const term of labelTerms) {
    expanded.push(term);
    expanded.push(...(LABEL_ICON_ALIASES[term] || []));
  }
  return unique(expanded);
}

function candidateRows(rows, candidateIds) {
  if (!candidateIds?.length) return [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return candidateIds.map((id) => byId.get(id)).filter(Boolean);
}

function iconReferenceKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function resolveIconReference(reference, rows) {
  const key = iconReferenceKey(reference);
  if (!key) return null;
  return (
    rows.find((row) => iconReferenceKey(row.id) === key) ||
    rows.find((row) => iconReferenceKey(row.title) === key) ||
    rows.find((row) => iconReferenceKey(row.id).endsWith(key)) ||
    null
  );
}

function collectParentCellIds(xml) {
  const parentIds = new Set();
  String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const parent = attrValue(parseAttributes(tag), "parent");
    if (parent) parentIds.add(parent);
    return tag;
  });
  return parentIds;
}

function isAutoIconEligible(attrs, parentIds) {
  const style = attrValue(attrs, "style");
  if (attrValue(attrs, "vertex") !== "1") return false;
  if (hasStyleKeyCaseInsensitive(style, "synthIcon")) return false;
  if (parentIds.has(attrValue(attrs, "id"))) return false;
  if (isExistingLibraryObjectStyle(style)) return false;
  if (isContainerLikeStyle(style)) return false;
  return Boolean(stripHtml(attrValue(attrs, "value")).trim());
}

function autoIconEligibilityReason(attrs, parentIds) {
  const style = attrValue(attrs, "style");
  if (attrValue(attrs, "vertex") !== "1") return "not_vertex";
  if (!stripHtml(attrValue(attrs, "value")).trim()) return "empty_label";
  if (hasStyleKeyCaseInsensitive(style, "synthIcon")) return "explicit_placeholder";
  if (parentIds.has(attrValue(attrs, "id"))) return "parent_vertex";
  if (isExistingLibraryObjectStyle(style)) return "library_object";
  if (isContainerLikeStyle(style)) return "container_style";
  return "eligible";
}

function chooseAutoIcon({ attrs, rows, iconUseCounts, parentIds }) {
  if (!isAutoIconEligible(attrs, parentIds)) return null;
  const label = stripHtml(attrValue(attrs, "value"));

  const [best] = rows
    .filter((row) => row.style && (iconUseCounts.get(row.id) || 0) < AUTO_ICON_MAX_REUSE)
    .map((row) => ({ row, score: scoreIconForLabel(row, label) }))
    .filter(({ score }) => score >= AUTO_ICON_MIN_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (iconUseCounts.get(a.row.id) || 0) - (iconUseCounts.get(b.row.id) || 0) ||
        a.row.title.localeCompare(b.row.title),
    );

  return best?.row || null;
}

function countAutoIconEligibleVertices(xml) {
  let count = 0;
  const parentIds = collectParentCellIds(xml);
  String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const attrs = parseAttributes(tag);
    if (isAutoIconEligible(attrs, parentIds)) count++;
    return tag;
  });
  return count;
}

export function autoIconTargetForXml(xml) {
  const eligible = countAutoIconEligibleVertices(xml);
  if (eligible === 0) return 0;
  return AUTO_ICON_DEFAULT_TARGET;
}

function summarizeAutoIconEligibility(xml) {
  const parentIds = collectParentCellIds(xml);
  const skipped = {};
  let eligible = 0;
  String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const attrs = parseAttributes(tag);
    const reason = autoIconEligibilityReason(attrs, parentIds);
    if (reason === "eligible") {
      eligible++;
    } else if (attrValue(attrs, "vertex") === "1") {
      skipped[reason] = (skipped[reason] || 0) + 1;
    }
    return tag;
  });
  return { eligible, skipped, parentIds };
}

export function applyIconRowsToXml(
  xml,
  rows,
  { candidateIds = [], targetApplied = null, fitToGeometry = false } = {},
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const autoCandidates = candidateRows(rows, candidateIds);
  const eligibility = summarizeAutoIconEligibility(xml);
  const parentIds = eligibility.parentIds;
  const autoTarget =
    targetApplied === null || targetApplied === undefined
      ? autoIconTargetForXml(xml)
      : targetApplied;
  const iconUseCounts = new Map();
  const applied = [];
  const autoApplied = [];
  const missing = [];

  const nextXml = String(xml).replace(
    /<mxCell\b[^>]*?(?:\/>|>[\s\S]*?<\/mxCell>)/g,
    (cellXml) => {
      const openTag = cellXml.match(/^<mxCell\b[^>]*?(?:\/>|>)/i)?.[0];
      if (!openTag) return cellXml;

      const attrs = parseAttributes(openTag);
      const requestedStyle = attrValue(attrs, "style");
      const iconId = styleValueCaseInsensitive(requestedStyle, "synthIcon");
      let icon = null;
      let auto = false;

      if (iconId) {
        if (attrValue(attrs, "vertex") !== "1") {
          const cleanedTag = replaceAttribute(
            openTag,
            "style",
            stripSynthIconStyleKeys(requestedStyle),
          );
          return cellXml.replace(openTag, cleanedTag);
        }

        icon = byId.get(iconId) || resolveIconReference(iconId, rows);
        if (!icon?.style) {
          missing.push(iconId);
          const cleanedTag = replaceAttribute(
            openTag,
            "style",
            stripSynthIconStyleKeys(requestedStyle),
          );
          return cellXml.replace(openTag, cleanedTag);
        }
      } else if (autoApplied.length < autoTarget && autoCandidates.length > 0) {
        icon = chooseAutoIcon({
          attrs,
          rows: autoCandidates,
          iconUseCounts,
          parentIds,
        });
        auto = Boolean(icon);
      }

      if (!icon?.style) return cellXml;

      applied.push({ id: icon.id, title: icon.title });
      iconUseCounts.set(icon.id, (iconUseCounts.get(icon.id) || 0) + 1);
      if (auto) {
        autoApplied.push({
          id: icon.id,
          title: icon.title,
          label: stripHtml(attrValue(attrs, "value")),
        });
      }

      const style = mergedIconStyle(icon.style, requestedStyle);
      const slot = fitToGeometry ? geometryBounds(cellXml) : null;
      const size =
        requestedIconSize(requestedStyle, icon, slot) ||
        requestedIconSize("synthIconSize=medium", icon, slot);
      const sizedCell = applyGeometrySize(cellXml, size);
      const nextOpenTag =
        sizedCell.match(/^<mxCell\b[^>]*?(?:\/>|>)/i)?.[0] || openTag;
      const styledTag = replaceAttribute(nextOpenTag, "style", style);
      return sizedCell.replace(nextOpenTag, styledTag);
    },
  );

  return {
    xml: nextXml,
    applied,
    missing: unique(missing),
    autoApplied,
    autoEligible: eligibility.eligible,
    autoTarget,
    autoCandidateCount: autoCandidates.length,
    autoSkipped: eligibility.skipped,
  };
}
