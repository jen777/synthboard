import OpenAI from "openai";
import { config } from "../config.js";
import { getSetting } from "./settings.js";
import { PRESETS } from "./presets.js";
import {
  applyIconPlaceholders,
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

// OpenAI-compatible client. The base URL is admin-configurable at runtime, so we
// lazily (re)build the client whenever it changes. The API key stays in env.
let client = null;
let clientBaseUrl = null;
function getClient() {
  const baseURL = getSetting("llm_base_url") || config.llm.baseUrl;
  if (!client || clientBaseUrl !== baseURL) {
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL,
      timeout: config.llm.timeoutMs,
      maxRetries: config.llm.maxRetries,
    });
    clientBaseUrl = baseURL;
    log("client (re)created", {
      baseURL,
      timeoutMs: config.llm.timeoutMs,
      maxRetries: config.llm.maxRetries,
    });
  }
  return client;
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

/**
 * Generate draw.io XML from source text for a given preset.
 * @returns {Promise<{ xml: string, usage: object, meta: object }>}
 *   `meta` carries generation telemetry (model, timings, sampling params,
 *   finish reason) so callers can persist it for the admin report.
 */
export async function generateDrawio({ preset, sourceText, title, maxSourceChars }) {
  const presetDef = PRESETS[preset];

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

  const userPrompt = `Diagram type: ${presetDef.label}
${presetDef.guidance}
${iconContext.prompt ? `\n${iconContext.prompt}\n` : ""}

${title ? `Suggested title: ${title}\n` : ""}Source material to visualize:
"""
${trimmedSource}
"""

Return only the draw.io <mxfile> XML.`;

  const model = getSetting("llm_model") || config.llm.model;
  const maxTokens = getSetting("llm_max_tokens") || config.llm.maxTokens;
  const temperature = getSetting("llm_temperature") ?? 1;
  const topP = getSetting("llm_top_p") ?? 0.95;

  log("request →", {
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
    const stream = await getClient().chat.completions.create({
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

  let xml = extractedXml;
  let iconMeta = { applied: [], missing: [] };
  try {
    const processed = await applyIconPlaceholders(extractedXml);
    xml = processed.xml;
    iconMeta = { applied: processed.applied, missing: processed.missing };
    if (processed.applied.length > 0 || processed.missing.length > 0) {
      log("icon placeholders processed", {
        applied: processed.applied.length,
        missing: processed.missing.length,
      });
    }
  } catch (err) {
    log("icon postprocess skipped", { message: err?.message });
  }

  log("✓ extracted XML", { xmlChars: xml.length });

  const meta = {
    model,
    temperature,
    topP,
    maxTokens,
    elapsedMs,
    firstTokenMs,
    finishReason,
    chunks,
    diagramBytes: Buffer.byteLength(xml, "utf8"),
    iconCandidates: iconContext.candidates.map((c) => c.id),
    iconsApplied: iconMeta.applied,
    iconsMissing: iconMeta.missing,
  };

  return { xml, usage, meta };
}
