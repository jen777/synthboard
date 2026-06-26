import OpenAI from "openai";
import { config } from "../config.js";
import { PRESETS } from "./presets.js";
import {
  applyIconEnhancements,
  applyIconRowsToXml,
  buildIconPromptContext,
} from "./drawioLibraries.js";

// Tagged logger so generation logs are easy to grep in production.
function log(msg, extra) {
  if (extra !== undefined) {
    console.log(`[llm] ${msg}`, extra);
  } else {
    console.log(`[llm] ${msg}`);
  }
}

// OpenAI-compatible clients are cached per provider configuration. API key
// values come from environment variables resolved by the catalog service.
const clients = new Map();
function getClient(modelConfig) {
  const provider = modelConfig.provider;
  const cacheKey = [
    provider.id,
    provider.baseUrl,
    provider.apiKeyEnv,
    config.llm.timeoutMs,
    config.llm.maxRetries,
  ].join(":");
  if (!clients.has(cacheKey)) {
    clients.set(
      cacheKey,
      new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
        timeout: config.llm.timeoutMs,
        maxRetries: config.llm.maxRetries,
      }),
    );
    log("provider client created", {
      provider: provider.name,
      baseURL: provider.baseUrl,
      timeout: config.llm.timeoutMs,
      maxRetries: config.llm.maxRetries,
    });
  }
  return clients.get(cacheKey);
}

// Instructions on how to emit draw.io XML. Kept stable across requests.
const BASE_SYSTEM = `You are SynthBoard, an expert at turning unstructured notes, meeting transcripts, and documents into clear draw.io (diagrams.net) diagrams.

OUTPUT CONTRACT — follow exactly:
- Respond with a SINGLE, complete, valid draw.io document and nothing else.
- The document MUST be a well-formed <mxfile> element containing one <diagram> with an embedded <mxGraphModel>.
- Do NOT wrap the XML in markdown code fences. Do NOT add explanations before or after.
- Every cell must have a unique id. Vertices use vertex="1"; edges use edge="1" with valid source/target ids. The two root cells (id "0" and "1") must be present.
- Provide explicit geometry (mxGeometry x/y/width/height) for every vertex so the diagram renders without auto-layout. Avoid overlapping shapes; leave generous spacing.
- Use readable labels derived from the user's content. Never invent facts that aren't supported by the input; if the input is sparse, produce a faithful, minimal diagram.
- Use tasteful styling (fill colors, rounded corners, font sizes) appropriate to the diagram type.
- Make diagrams presentation-ready with meaningful colors, varied standard draw.io shapes, containers, and visual hierarchy. Prefer built-in draw.io shapes and basic objects over custom icon/image libraries.

Example skeleton (structure only — adapt content, styles, and geometry):
<mxfile host="synthboard">
  <diagram id="d1" name="Page-1">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="n1" value="Start" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="320" y="40" width="160" height="50" as="geometry" />
        </mxCell>
        <mxCell id="n2" value="Next step" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="320" y="160" width="160" height="50" as="geometry" />
        </mxCell>
        <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="n1" target="n2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const VISUAL_DESIGN_GUIDANCE = `Visual design requirements:
- Build a polished diagram, not a plain wireframe. Use a restrained but visible palette with 3-5 complementary colors, consistent stroke colors, and high text contrast.
- Use diagram-appropriate standard draw.io shapes and basic objects: rounded/process rectangles for work or services, cylinders for data stores, diamonds for decisions, document shapes for files, clouds for networks, actor shapes for users, hexagons for queues/events, swimlanes for responsibility, and containers/boundaries for groups.
- Make hierarchy obvious with larger primary nodes, smaller supporting nodes, section headers, whitespace, and aligned rows/columns. Avoid overlapping text, shapes, or connectors.
- Do not use custom image icons, pasted image data, or third-party stencil libraries unless an explicit icon context is provided. When in doubt, use a standard shape with a clear label.`;
const VISUAL_PALETTE = [
  { fillColor: "#eaf2ff", strokeColor: "#5b7cfa" },
  { fillColor: "#e8fbf8", strokeColor: "#14b8a6" },
  { fillColor: "#fff7e6", strokeColor: "#f59e0b" },
  { fillColor: "#f5edff", strokeColor: "#8b5cf6" },
  { fillColor: "#eef9ff", strokeColor: "#0ea5e9" },
];

// Pull the <mxfile>…</mxfile> (or bare <mxGraphModel>) out of the model output,
// tolerating accidental code fences or surrounding prose.
function extractDrawioXml(text) {
  if (!text) return null;
  let t = text.trim();

  // Strip a single fenced block if present.
  const fence = t.match(/```(?:xml)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  const mxfile = t.match(/<mxfile[\s\S]*<\/mxfile>/i);
  if (mxfile) return mxfile[0];

  const model = t.match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/i);
  if (model) {
    // Wrap a bare model so the client always gets a valid .drawio file.
    return `<mxfile host="synthboard"><diagram id="d1" name="Page-1">${model[0]}</diagram></mxfile>`;
  }
  return null;
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

function parseXmlAttributes(tag) {
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

function withStyleDefaults(style, defaults) {
  const entries = styleEntries(style);
  const nextEntries = [...entries];
  let added = 0;
  for (const [key, value] of Object.entries(defaults)) {
    if (!hasStyleKeyCaseInsensitive(style, key)) {
      nextEntries.push([key, value]);
      added++;
    }
  }
  return {
    style: nextEntries.map(([key, value]) => `${key}=${value}`).join(";"),
    added,
  };
}

function replaceStyleAttribute(tag, style) {
  const attr = `style="${xmlAttr(style)}"`;
  const re = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/i;
  if (re.test(tag)) return tag.replace(re, ` ${attr}`);
  return tag.replace(/\s*\/?>$/, (end) => ` ${attr}${end.trim()}`);
}

function isIconStyle(style) {
  return (
    (styleValueCaseInsensitive(style, "shape") || "").toLowerCase() === "image" ||
    hasStyleKeyCaseInsensitive(style, "image")
  );
}

function isLibraryObjectStyle(style) {
  const shape = (styleValueCaseInsensitive(style, "shape") || "").toLowerCase();
  return (
    isIconStyle(style) ||
    shape.startsWith("mxgraph.") ||
    shape.startsWith("stencil(")
  );
}

function textTerms(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function inferVertexShape(label) {
  const terms = new Set(textTerms(decodeXmlEntities(label)));
  const hasAny = (...values) => values.some((value) => terms.has(value));

  if (hasAny("database", "db", "sql", "storage", "cache", "warehouse")) {
    return "cylinder";
  }
  if (hasAny("decision", "condition", "choice", "if", "branch")) {
    return "rhombus";
  }
  if (hasAny("actor", "person", "user", "customer", "admin", "manager")) {
    return "umlActor";
  }
  if (hasAny("team", "group", "organization", "org", "department")) {
    return "ellipse";
  }
  if (hasAny("document", "file", "report", "note", "page", "spec", "contract")) {
    return "document";
  }
  if (hasAny("queue", "message", "event", "bus", "stream", "topic")) {
    return "hexagon";
  }
  if (hasAny("cloud", "cdn", "network", "vnet", "dns", "internet")) {
    return "cloud";
  }
  if (
    hasAny(
      "api",
      "app",
      "application",
      "backend",
      "frontend",
      "gateway",
      "job",
      "process",
      "service",
      "step",
      "system",
      "task",
      "worker",
    )
  ) {
    return "process";
  }
  return null;
}

export function applyVisualDefaults(xml) {
  let vertexIndex = 0;
  let applied = 0;
  const nextXml = String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const attrs = parseXmlAttributes(tag);
    if (attrValue(attrs, "edge") === "1") {
      const result = withStyleDefaults(attrValue(attrs, "style"), {
        edgeStyle: "orthogonalEdgeStyle",
        rounded: "0",
        html: "1",
        strokeColor: "#64748b",
        strokeWidth: "2",
        endArrow: "block",
        endFill: "1",
        fontColor: "#334155",
      });
      if (result.added === 0) return tag;
      applied++;
      return replaceStyleAttribute(tag, result.style);
    }

    if (attrValue(attrs, "vertex") !== "1") return tag;

    const style = attrValue(attrs, "style");
    if (isLibraryObjectStyle(style)) return tag;

    const palette = VISUAL_PALETTE[vertexIndex % VISUAL_PALETTE.length];
    vertexIndex++;
    const shape = hasStyleKeyCaseInsensitive(style, "shape")
      ? null
      : inferVertexShape(attrValue(attrs, "value"));
    const result = withStyleDefaults(style, {
      ...(shape ? { shape } : {}),
      rounded: "1",
      whiteSpace: "wrap",
      html: "1",
      fillColor: palette.fillColor,
      strokeColor: palette.strokeColor,
      fontColor: "#0f172a",
    });
    if (result.added === 0) return tag;
    applied++;
    return replaceStyleAttribute(tag, result.style);
  });

  return { xml: nextXml, applied };
}

export function summarizeDrawioVisuals(xml) {
  let vertexCount = 0;
  let edgeCount = 0;
  let iconVertexCount = 0;
  let styledVertexCount = 0;
  const fillColors = new Set();
  const strokeColors = new Set();
  const shapeTypes = new Set();

  String(xml || "").replace(/<mxCell\b[^>]*?(?:\/>|>)/g, (tag) => {
    const attrs = parseXmlAttributes(tag);
    const style = attrValue(attrs, "style");

    if (attrValue(attrs, "edge") === "1") {
      edgeCount++;
      return tag;
    }
    if (attrValue(attrs, "vertex") !== "1") return tag;

    vertexCount++;
    const isLibraryObject = isLibraryObjectStyle(style);
    if (isLibraryObject) iconVertexCount++;

    const fillColor = styleValueCaseInsensitive(style, "fillColor");
    const strokeColor = styleValueCaseInsensitive(style, "strokeColor");
    if (fillColor && fillColor !== "none") fillColors.add(fillColor.toLowerCase());
    if (strokeColor && strokeColor !== "none") {
      strokeColors.add(strokeColor.toLowerCase());
    }
    if (
      isLibraryObject ||
      fillColor ||
      strokeColor ||
      styleValueCaseInsensitive(style, "fontColor")
    ) {
      styledVertexCount++;
    }

    const shape = styleValueCaseInsensitive(style, "shape");
    if (shape) shapeTypes.add(shape.toLowerCase());
    else if (styleValueCaseInsensitive(style, "rounded") === "1") {
      shapeTypes.add("rounded");
    } else shapeTypes.add("rectangle");

    return tag;
  });

  return {
    vertexCount,
    edgeCount,
    iconVertexCount,
    styledVertexCount,
    fillColorCount: fillColors.size,
    strokeColorCount: strokeColors.size,
    shapeTypeCount: shapeTypes.size,
    fillColors: [...fillColors].sort(),
    strokeColors: [...strokeColors].sort(),
    shapeTypes: [...shapeTypes].sort(),
  };
}

export function summarizeIconCandidate(candidate) {
  return {
    id: candidate.id,
    title: candidate.title,
    library: candidate.library_name,
    provider: candidate.provider,
    styleFamily: candidate.style_family,
    width: candidate.width ?? null,
    height: candidate.height ?? null,
  };
}

export async function postProcessDrawioXml(
  xml,
  { iconCandidates = [], iconRows = null } = {},
) {
  let nextXml = xml;
  let iconMeta = {
    applied: [],
    missing: [],
    autoApplied: [],
    autoEligible: 0,
    autoTarget: 0,
    autoCandidateCount: 0,
    autoSkipped: {},
  };
  try {
    const candidateIds = iconCandidates.map((c) => c.id);
    let processed;
    if (iconRows) {
      processed = applyIconRowsToXml(xml, iconRows, { candidateIds });
    } else if (candidateIds.length > 0) {
      processed = await applyIconEnhancements(xml, { candidateIds });
    } else {
      processed = applyIconRowsToXml(xml, [], { targetApplied: 0 });
    }
    nextXml = processed.xml;
    iconMeta = {
      applied: processed.applied,
      missing: processed.missing,
      autoApplied: processed.autoApplied || [],
      autoEligible: processed.autoEligible || 0,
      autoTarget: processed.autoTarget || 0,
      autoCandidateCount: processed.autoCandidateCount || 0,
      autoSkipped: processed.autoSkipped || {},
    };
  } catch (err) {
    log("icon postprocess skipped", { message: err?.message });
  }

  const visualDefaults = applyVisualDefaults(nextXml);
  nextXml = visualDefaults.xml;
  const visualSummary = summarizeDrawioVisuals(nextXml);

  return {
    xml: nextXml,
    visualDefaults,
    visualSummary,
    iconMeta,
  };
}

export function buildGenerationPrompt({ presetDef, iconPrompt, title, sourceText }) {
  return `Diagram type: ${presetDef.label}
${presetDef.guidance}

${VISUAL_DESIGN_GUIDANCE}
${iconPrompt ? `\n${iconPrompt}\n` : ""}

${title ? `Suggested title: ${title}\n` : ""}Source material to visualize:
"""
${sourceText}
"""

Return only the draw.io <mxfile> XML.`;
}

/**
 * Generate draw.io XML from source text for a given preset.
 * @returns {Promise<{ xml: string, usage: object, meta: object }>}
 *   `meta` carries generation telemetry (model, timings, sampling params,
 *   finish reason) so callers can persist it for the admin report.
 */
export async function generateDrawio({
  preset,
  sourceText,
  title,
  maxSourceChars,
  modelConfig,
}) {
  const presetDef = PRESETS[preset];
  if (!modelConfig?.provider?.apiKey) {
    throw new Error("A configured AI model is required for generation.");
  }

  // Truncate to the caller's per-level character cap so we never overspend input
  // tokens on an oversized payload. The UI warns about this, but enforce it here
  // too since the API can be called directly. Falls back to the env default when
  // no cap is passed.
  const cap = maxSourceChars || config.llm.maxSourceChars;
  const trimmedSource =
    sourceText.length > cap ? sourceText.slice(0, cap) : sourceText;
  if (trimmedSource.length < sourceText.length) {
    log("source truncated", {
      originalChars: sourceText.length,
      truncatedChars: trimmedSource.length,
    });
  }

  let iconContext = { prompt: "", candidates: [] };
  try {
    iconContext = await buildIconPromptContext({
      preset,
      sourceText: trimmedSource,
      title,
    });
    if (iconContext.candidates.length > 0) {
      log("icon candidates selected", {
        count: iconContext.candidates.length,
        first: iconContext.candidates[0]?.id,
      });
    }
  } catch (err) {
    log("icon catalog lookup skipped", { message: err?.message });
  }

  const userPrompt = buildGenerationPrompt({
    presetDef,
    iconPrompt: iconContext.prompt,
    title,
    sourceText: trimmedSource,
  });

  const model = modelConfig.modelName;
  const maxTokens = modelConfig.maxTokens;
  const temperature = modelConfig.temperature;
  const topP = modelConfig.topP;

  log("request →", {
    provider: modelConfig.provider.name,
    model,
    preset,
    maxTokens,
    promptChars: userPrompt.length,
    sourceChars: trimmedSource.length,
  });

  const startedAt = Date.now();
  let text = "";
  let finishReason;
  let usage;
  let chunks = 0;
  let firstTokenMs = null;
  try {
    // Stream the completion. Continuous data flow means a slow-but-progressing
    // generation isn't killed by an idle timeout, and we get visibility into
    // time-to-first-token vs. total generation time.
    const stream = await getClient(modelConfig).chat.completions.create({
      model,
      messages: [
        { role: "system", content: BASE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content || "";
      if (delta) {
        if (firstTokenMs === null) {
          firstTokenMs = Date.now() - startedAt;
          log("first token", { firstTokenMs });
        }
        text += delta;
        chunks++;
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) usage = chunk.usage;
    }
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    // Surface the cause clearly: timeout/abort vs. upstream HTTP status.
    log("request ✗ failed", {
      elapsedMs,
      firstTokenMs,
      chunks,
      contentChars: text.length,
      name: err?.name,
      status: err?.status,
      code: err?.code,
      message: err?.message,
    });
    throw err;
  }

  const elapsedMs = Date.now() - startedAt;

  log("response ←", {
    elapsedMs,
    firstTokenMs,
    chunks,
    finishReason,
    contentChars: text.length,
    usage,
  });

  if (finishReason === "length") {
    log("⚠ response truncated (hit max_tokens) — consider raising Max tokens");
  }

  const extractedXml = extractDrawioXml(text);
  if (!extractedXml) {
    log("✗ could not extract draw.io XML from response", {
      preview: text.slice(0, 300),
    });
    throw new Error("Model did not return valid draw.io XML.");
  }

  const processedXml = await postProcessDrawioXml(extractedXml, {
    iconCandidates: iconContext.candidates,
  });
  const { xml, visualDefaults, visualSummary, iconMeta } = processedXml;

  if (
    iconMeta.applied.length > 0 ||
    iconMeta.missing.length > 0 ||
    iconMeta.autoApplied.length > 0
  ) {
    log("icon placeholders processed", {
      applied: iconMeta.applied.length,
      autoApplied: iconMeta.autoApplied.length,
      missing: iconMeta.missing.length,
      autoEligible: iconMeta.autoEligible,
      autoTarget: iconMeta.autoTarget,
      autoCandidateCount: iconMeta.autoCandidateCount,
    });
  }

  log("✓ extracted XML", { xmlChars: xml.length, visualSummary });

  const meta = {
    provider: modelConfig.provider.name,
    providerId: modelConfig.provider.id,
    modelConfigId: modelConfig.id,
    model,
    temperature,
    topP,
    maxTokens,
    elapsedMs,
    firstTokenMs,
    finishReason,
    chunks,
    diagramBytes: Buffer.byteLength(xml, "utf8"),
    visualDefaultsApplied: visualDefaults.applied,
    iconCandidates: iconContext.candidates.map(summarizeIconCandidate),
    iconsApplied: iconMeta.applied,
    iconsAutoApplied: iconMeta.autoApplied,
    iconsMissing: iconMeta.missing,
    iconAutoEligible: iconMeta.autoEligible,
    iconAutoTarget: iconMeta.autoTarget,
    iconAutoCandidateCount: iconMeta.autoCandidateCount,
    iconAutoSkipped: iconMeta.autoSkipped,
    visualSummary,
  };

  return { xml, usage, meta };
}
