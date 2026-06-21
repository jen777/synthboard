#!/usr/bin/env node

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_verify";
process.env.SESSION_SECRET ||= "verify-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "verify-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "verify-google-client-secret";
process.env.NVIDIA_API_KEY ||= "verify-nvidia-api-key";

const { postProcessDrawioXml } = await import("../src/services/llm.js");

const sampleXml = `<mxfile host="synthboard"><diagram id="d1" name="Page-1"><mxGraphModel><root>
  <mxCell id="0" />
  <mxCell id="1" parent="0" />
  <mxCell id="api" value="API Gateway" style="synthIcon=sample.gateway;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="db" value="Customer DB" style="" vertex="1" parent="1"><mxGeometry x="260" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="decision" value="Approval decision" style="" vertex="1" parent="1"><mxGeometry x="480" y="40" width="160" height="50" as="geometry" /></mxCell>
  <mxCell id="libraryObject" value="Blob Storage" style="shape=mxgraph.azure.storage;html=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="700" y="40" width="80" height="80" as="geometry" /></mxCell>
  <mxCell id="e1" edge="1" parent="1" source="api" target="db"><mxGeometry relative="1" as="geometry" /></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const iconRows = [
  {
    id: "sample.gateway",
    title: "Gateway",
    search_text: "gateway api ingress proxy",
    style: "shape=image;image=data:image/png;base64,gateway;aspect=fixed;",
    width: 64,
    height: 64,
  },
  {
    id: "sample.database",
    title: "Database",
    search_text: "database db sql storage",
    style: "shape=image;image=data:image/png;base64,database;aspect=fixed;",
    width: 70,
    height: 50,
  },
];

const result = await postProcessDrawioXml(sampleXml, {
  iconCandidates: iconRows,
  iconRows,
});

const summary = {
  iconsApplied: result.iconMeta.applied.length,
  iconsAutoApplied: result.iconMeta.autoApplied.length,
  iconsMissing: result.iconMeta.missing.length,
  visualDefaultsApplied: result.visualDefaults.applied,
  visualSummary: result.visualSummary,
};

const failures = [];
if (summary.iconsApplied < 2) failures.push("expected at least 2 applied icons");
if (summary.iconsAutoApplied < 1) failures.push("expected at least 1 auto-applied icon");
if (summary.visualDefaultsApplied < 1) failures.push("expected visual defaults");
if (!result.xml.includes('width="109" height="109"')) {
  failures.push("expected hero icon sizing");
}
if (!result.xml.includes("shape=rhombus")) {
  failures.push("expected inferred decision shape");
}
if (result.visualSummary.iconVertexCount < 2) {
  failures.push("expected at least 2 icon/image vertices");
}
if (!result.visualSummary.shapeTypes.includes("mxgraph.azure.storage")) {
  failures.push("expected preserved mxgraph library object");
}
if (result.visualSummary.styledVertexCount < 4) {
  failures.push("expected library objects to count as styled vertices");
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures, summary }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
