import zlib from "node:zlib";

import { query, pool } from "../db.js";

const MAX_PROMPT_OBJECTS = 18;
const MAX_SEARCH_ROWS = 5000;
const ARCHITECTURE_TERMS = new Set([
  "api",
  "app",
  "application",
  "architecture",
  "azure",
  "aws",
  "cache",
  "cloud",
  "cluster",
  "database",
  "db",
  "event",
  "gcp",
  "kubernetes",
  "lambda",
  "network",
  "queue",
  "redis",
  "service",
  "storage",
  "topic",
  "worker",
]);

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

function parseAttributes(tag) {
  const attrs = {};
  const re = /\s([:\w.-]+)="([^"]*)"/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
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
  return tags.find((tag) => /\bvertex="1"/i.test(tag)) || null;
}

function extractObjectDetails(item) {
  let cellXml = null;
  let style = null;
  try {
    cellXml = decodeLibraryGraphModel(item.xml);
    const vertex = extractFirstVertexCell(cellXml);
    if (vertex) {
      style = parseAttributes(vertex).style || null;
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

function objectAliases({ title, provider }) {
  const base = words(title);
  const aliases = [...base];
  if (provider) aliases.push(...words(provider));
  if (base.includes("database")) aliases.push("db", "sql");
  if (base.includes("storage")) aliases.push("blob", "bucket", "file");
  if (base.includes("queue")) aliases.push("messaging", "event");
  if (base.includes("kubernetes")) aliases.push("k8s", "cluster");
  if (base.includes("virtual") && base.includes("machine")) aliases.push("vm");
  return unique(aliases);
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
      const aliases = objectAliases({ title: details.title, provider });
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
        aliases,
        searchText,
        ...details,
      };
    });
  const { objects, duplicatesIgnored, variantsCreated } =
    resolveObjectIdCollisions(rawObjects);
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
    `SELECT id, title, aliases, width, height, aspect, created_at
       FROM drawio_icon_objects
      WHERE library_id = $1
      ORDER BY title`,
    [libraryId],
  );
  return rows;
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

export async function searchIconObjects(searchText, { limit = MAX_PROMPT_OBJECTS } = {}) {
  const terms = unique(words(searchText)).slice(0, 60);
  if (terms.length === 0) return [];

  const tsQuery = terms.join(" ");
  const likeTerms = terms.map((term) => `%${term}%`);
  const { rows } = await query(
    `SELECT o.id, o.library_id, o.title, o.search_text, o.width, o.height,
            l.name AS library_name, l.provider, l.style_family
       FROM drawio_icon_objects o
       JOIN drawio_icon_libraries l ON l.id = o.library_id
      WHERE to_tsvector('simple', o.search_text) @@ plainto_tsquery('simple', $1)
         OR o.search_text ILIKE ANY($2)
         OR o.id ILIKE ANY($2)
      LIMIT $3`,
    [tsQuery, likeTerms, MAX_SEARCH_ROWS],
  );

  const ranked = rows
    .map((row) => ({ ...row, score: scoreObject(row, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const dominantLibraryId = chooseDominantLibrary(ranked);
  const sameLibrary = ranked.filter((row) => row.library_id === dominantLibraryId);
  const fallback = ranked.filter((row) => row.library_id !== dominantLibraryId);
  return [...sameLibrary, ...fallback].slice(0, limit);
}

export function shouldUseIconCatalog({ preset, sourceText, title }) {
  if (preset === "architecture" || preset === "infographic") return true;
  const terms = words(`${title || ""} ${sourceText || ""}`);
  return terms.some((term) => ARCHITECTURE_TERMS.has(term));
}

export async function buildIconPromptContext({ preset, sourceText, title }) {
  if (!shouldUseIconCatalog({ preset, sourceText, title })) {
    return { prompt: "", candidates: [] };
  }

  const candidates = await searchIconObjects(`${title || ""} ${preset} ${sourceText}`);
  if (candidates.length === 0) return { prompt: "", candidates: [] };

  const dominant = candidates[0];
  const lines = candidates.map(
    (c) =>
      `- ${c.id}: ${c.title} (${c.provider || c.library_name}, ${c.style_family || "same set"})`,
  );

  return {
    candidates,
    prompt: `Available draw.io icon set context:
Prefer one visual set per diagram. Use "${dominant.library_name}" first and only mix sets if a required object is missing.
When a listed icon fits a node, add synthIcon=<icon id> to that vertex's style. Keep the node label in value. Do not invent icon ids.
Icon ids:
${lines.join("\n")}`,
  };
}

function cleanRequestedIconStyle(style) {
  const blockedKeys = new Set([
    "aspect",
    "fillColor",
    "gradientColor",
    "image",
    "imageAspect",
    "rounded",
    "shape",
    "strokeColor",
  ]);
  return String(style || "")
    .split(";")
    .filter((part) => {
      if (!part) return false;
      const key = part.split("=")[0]?.trim();
      return key && key !== "synthIcon" && !blockedKeys.has(key);
    })
    .join(";");
}

function mergedIconStyle(iconStyle, requestedStyle) {
  const cleanRequested = cleanRequestedIconStyle(requestedStyle);
  const labelDefaults = "whiteSpace=wrap;html=1;verticalLabelPosition=bottom;verticalAlign=top;";
  return `${iconStyle || ""};${labelDefaults}${cleanRequested ? `;${cleanRequested}` : ""}`
    .replace(/;{2,}/g, ";")
    .replace(/^;+|;+$/g, "");
}

export async function applyIconPlaceholders(xml) {
  const ids = unique(
    [...String(xml || "").matchAll(/synthIcon=([^;"&<\s]+)/g)].map((m) => m[1]),
  );
  if (ids.length === 0) return { xml, applied: [], missing: [] };

  const { rows } = await query(
    `SELECT id, title, style, width, height
       FROM drawio_icon_objects
      WHERE id = ANY($1)`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const applied = [];
  const missing = [];

  const nextXml = String(xml).replace(/<mxCell\b[^>]*>/g, (tag) => {
    const attrs = parseAttributes(tag);
    const match = String(attrs.style || "").match(/(?:^|;)synthIcon=([^;]+)/);
    if (!match) return tag;

    const iconId = match[1];
    const icon = byId.get(iconId);
    if (!icon?.style) {
      missing.push(iconId);
      return tag.replace(
        /style="[^"]*"/,
        `style="${xmlAttr(cleanRequestedIconStyle(attrs.style))}"`,
      );
    }

    applied.push({ id: icon.id, title: icon.title });
    const style = mergedIconStyle(icon.style, attrs.style);
    if (/\sstyle="[^"]*"/.test(tag)) {
      return tag.replace(/\sstyle="[^"]*"/, ` style="${xmlAttr(style)}"`);
    }
    return tag.replace(/>$/, ` style="${xmlAttr(style)}">`);
  });

  return { xml: nextXml, applied, missing: unique(missing) };
}
