#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import zlib from "node:zlib";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_verify";
process.env.SESSION_SECRET ||= "verify-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "verify-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "verify-google-client-secret";
process.env.NVIDIA_API_KEY ||= "verify-nvidia-api-key";

const { postProcessDrawioXml } = await import("../src/services/llm.js");
const { extractDrawioLibraryObjects } = await import(
  "../src/services/drawioLibraries.js"
);

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
  <mxCell id="api" value="API Gateway" style="synthIcon=sample-icons.gateway;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="db" value="Customer DB" style="" vertex="1" parent="1"><mxGeometry x="260" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="decision" value="Approval decision" style="" vertex="1" parent="1"><mxGeometry x="480" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="libraryObject" value="Blob Storage" style="shape=mxgraph.azure.storage;html=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="700" y="40" width="80" height="80" as="geometry" /></mxCell>
  <mxCell id="frontend" value="React frontend" style="" vertex="1" parent="1"><mxGeometry x="40" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="events" value="Webhook events" style="" vertex="1" parent="1"><mxGeometry x="260" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="backend" value="Node backend" style="" vertex="1" parent="1"><mxGeometry x="480" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="postgres" value="Postgres" style="" vertex="1" parent="1"><mxGeometry x="700" y="180" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="s3" value="S3 files" style="" vertex="1" parent="1"><mxGeometry x="40" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="worker" value="Worker service" style="" vertex="1" parent="1"><mxGeometry x="260" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="admin" value="Admin application" style="" vertex="1" parent="1"><mxGeometry x="480" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="analytics" value="Analytics database" style="" vertex="1" parent="1"><mxGeometry x="700" y="300" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="docs" value="File storage" style="" vertex="1" parent="1"><mxGeometry x="40" y="420" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="team" value="Application team" style="shape=swimlane;swimlane=1;rounded=1;" vertex="1" parent="1"><mxGeometry x="260" y="420" width="360" height="180" as="geometry" /></mxCell>
  <mxCell id="mobile" value="Mobile application" style="" vertex="1" parent="team"><mxGeometry x="290" y="480" width="160" height="50" as="geometry" /></mxCell>
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

const { objects: iconRows } = extractDrawioLibraryObjects({
  id: "sample-icons",
  name: "Sample Icons",
  provider: "Sample",
  styleFamily: "sample-flat",
  content: libraryContent,
});

const result = await postProcessDrawioXml(sampleXml, {
  iconCandidates: iconRows,
  iconRows,
});

const summary = {
  iconsApplied: result.iconMeta.applied.length,
  iconsAutoApplied: result.iconMeta.autoApplied.length,
  iconsMissing: result.iconMeta.missing.length,
  iconAutoEligible: result.iconMeta.autoEligible,
  iconAutoTarget: result.iconMeta.autoTarget,
  iconAutoCandidateCount: result.iconMeta.autoCandidateCount,
  iconAutoSkipped: result.iconMeta.autoSkipped,
  visualDefaultsApplied: result.visualDefaults.applied,
  visualSummary: result.visualSummary,
};

if (process.env.DRAWIO_VERIFY_OUTPUT) {
  await writeFile(process.env.DRAWIO_VERIFY_OUTPUT, result.xml, "utf8");
  summary.outputPath = process.env.DRAWIO_VERIFY_OUTPUT;
}

const failures = [];
if (iconRows.length !== 6) failures.push("expected 6 extracted library objects");
if (iconRows.some((row) => !row.style || !row.cellXml)) {
  failures.push("expected uploaded library objects to include decoded styles");
}
if (summary.iconsApplied !== 1) failures.push("expected exactly 1 explicit applied icon");
if (summary.iconsAutoApplied !== 0) failures.push("expected auto-applied icons to be disabled by default");
if (summary.iconAutoEligible < 12) failures.push("expected at least 12 auto-eligible vertices");
if (summary.iconAutoTarget !== 0) failures.push("expected default auto target to be 0");
if (summary.iconAutoCandidateCount < 6) failures.push("expected 6 auto icon candidates");
if (summary.iconAutoSkipped.explicit_placeholder !== 1) {
  failures.push("expected explicit synthIcon placeholder to be excluded from auto eligibility");
}
if (summary.visualDefaultsApplied < 1) failures.push("expected visual defaults");
if (!result.xml.includes('x="92" y="37" width="56" height="56"')) {
  failures.push("expected compact centered hero icon sizing");
}
if (!result.xml.includes("shape=rhombus")) {
  failures.push("expected inferred decision shape");
}
if (result.visualSummary.iconVertexCount !== 2) {
  failures.push("expected only explicit and preserved library object icon/image vertices");
}
if (!result.visualSummary.shapeTypes.includes("mxgraph.azure.storage")) {
  failures.push("expected preserved mxgraph library object");
}
const teamCell = result.xml.match(/<mxCell id="team"[\s\S]*?<\/mxCell>/)?.[0] || "";
if (!teamCell.includes("shape=swimlane") || teamCell.includes("shape=image")) {
  failures.push("expected default processing to preserve parent container shape");
}
if (result.visualSummary.styledVertexCount < 4) {
  failures.push("expected library objects to count as styled vertices");
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures, summary }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
