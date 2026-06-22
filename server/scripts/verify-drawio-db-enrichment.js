#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import zlib from "node:zlib";

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        reason: "DATABASE_URL is not set; DB-backed draw.io enrichment verification skipped.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

process.env.SESSION_SECRET ||= "verify-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "verify-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "verify-google-client-secret";
process.env.NVIDIA_API_KEY ||= "verify-nvidia-api-key";

const { initSchema, pool } = await import("../src/db.js");
const { postProcessDrawioXml } = await import("../src/services/llm.js");
const {
  deleteIconLibrary,
  ingestDrawioLibrary,
  searchIconObjects,
} = await import("../src/services/drawioLibraries.js");

const libraryId = "verify-sample-icons";

function compressedLibraryObject({ id, title, style, width, height }) {
  const xml = `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="${id}" value="${title}" style="${style}" vertex="1" parent="1"><mxGeometry width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`;
  return {
    title,
    w: width,
    h: height,
    xml: zlib.deflateRawSync(encodeURIComponent(xml)).toString("base64"),
  };
}

const sampleXml = `<mxfile host="synthboard"><diagram id="d1" name="Page-1"><mxGraphModel><root>
  <mxCell id="0" />
  <mxCell id="1" parent="0" />
  <mxCell id="api" value="API Gateway" style="synthIcon=verify-sample-icons.gateway;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="db" value="Customer DB" style="" vertex="1" parent="1"><mxGeometry x="260" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="frontend" value="React frontend" style="" vertex="1" parent="1"><mxGeometry x="40" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="events" value="Webhook events" style="" vertex="1" parent="1"><mxGeometry x="260" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="backend" value="Node backend" style="" vertex="1" parent="1"><mxGeometry x="480" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="postgres" value="Postgres" style="" vertex="1" parent="1"><mxGeometry x="700" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="s3" value="S3 files" style="" vertex="1" parent="1"><mxGeometry x="40" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="worker" value="Worker service" style="" vertex="1" parent="1"><mxGeometry x="260" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="e1" edge="1" parent="1" source="api" target="db"><mxGeometry relative="1" as="geometry" /></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const libraryContent = `<mxlibrary>${JSON.stringify([
  compressedLibraryObject({
    id: "gateway",
    title: "Gateway",
    style: "shape=image;image=data:image/png;base64,gateway;aspect=fixed;",
    width: 64,
    height: 64,
  }),
  compressedLibraryObject({
    id: "database",
    title: "Database",
    style: "shape=image;image=data:image/png;base64,database;aspect=fixed;",
    width: 70,
    height: 50,
  }),
  compressedLibraryObject({
    id: "application",
    title: "Application",
    style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
    width: 80,
    height: 60,
  }),
  compressedLibraryObject({
    id: "queue",
    title: "Queue",
    style: "shape=image;image=data:image/png;base64,queue;aspect=fixed;",
    width: 70,
    height: 50,
  }),
  compressedLibraryObject({
    id: "service",
    title: "Service",
    style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
    width: 64,
    height: 48,
  }),
  compressedLibraryObject({
    id: "storage",
    title: "Storage",
    style: "shape=image;image=data:image/png;base64,storage;aspect=fixed;",
    width: 70,
    height: 50,
  }),
])}</mxlibrary>`;

const failures = [];
let summary = null;

try {
  await initSchema();
  await deleteIconLibrary(libraryId);
  const ingest = await ingestDrawioLibrary({
    id: libraryId,
    name: "Verify Sample Icons",
    provider: "Verify",
    styleFamily: "verify-flat",
    sourceType: "verification",
    content: libraryContent,
    metadata: { verification: true },
  });
  if (ingest.objects !== 6) failures.push("expected 6 ingested library objects");

  const candidates = await searchIconObjects(
    "architecture API gateway React frontend Node backend Postgres S3 files webhook events worker service customer database storage queue application",
    { limit: 12 },
  );
  if (candidates.length < 6) failures.push("expected at least 6 searched icon candidates");

  const result = await postProcessDrawioXml(sampleXml, { iconCandidates: candidates });
  summary = {
    candidates: candidates.map((candidate) => candidate.id),
    iconsApplied: result.iconMeta.applied.length,
    iconsAutoApplied: result.iconMeta.autoApplied.length,
    iconsMissing: result.iconMeta.missing.length,
    iconAutoEligible: result.iconMeta.autoEligible,
    iconAutoTarget: result.iconMeta.autoTarget,
    iconAutoCandidateCount: result.iconMeta.autoCandidateCount,
    visualSummary: result.visualSummary,
  };
  if (process.env.DRAWIO_VERIFY_OUTPUT) {
    await writeFile(process.env.DRAWIO_VERIFY_OUTPUT, result.xml, "utf8");
    summary.outputPath = process.env.DRAWIO_VERIFY_OUTPUT;
  }

  if (summary.iconsApplied < 6) failures.push("expected at least 6 DB-backed applied icons");
  if (summary.iconsAutoApplied < 5) {
    failures.push("expected at least 5 DB-backed auto-applied icons");
  }
  if (summary.iconsMissing !== 0) failures.push("expected no missing DB-backed icons");
  if (summary.iconAutoCandidateCount < 6) {
    failures.push("expected at least 6 DB-backed auto icon candidates");
  }
  if (summary.visualSummary.iconVertexCount < 6) {
    failures.push("expected at least 6 icon/image vertices after DB-backed enrichment");
  }
} catch (err) {
  failures.push(err?.message || String(err));
} finally {
  await deleteIconLibrary(libraryId).catch(() => {});
  await pool.end().catch(() => {});
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures, summary }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
