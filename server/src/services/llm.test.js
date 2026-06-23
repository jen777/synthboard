import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const {
  applyVisualDefaults,
  buildGenerationPrompt,
  postProcessDrawioXml,
  summarizeDrawioVisuals,
  summarizeIconCandidate,
} = await import("./llm.js");

test("generation prompt includes shape-first visual design requirements", () => {
  const prompt = buildGenerationPrompt({
    presetDef: {
      label: "System Architecture",
      guidance: "Produce a SYSTEM / NETWORK ARCHITECTURE DIAGRAM.",
    },
    iconPrompt: "Icon ids:\n- azure.database: Database",
    title: "Checkout architecture",
    sourceText: "Frontend calls API, API writes to database.",
  });

  assert.match(prompt, /Visual design requirements:/);
  assert.match(prompt, /3-5 complementary colors/);
  assert.match(prompt, /standard draw\.io shapes/);
  assert.match(prompt, /cylinders for data stores/);
  assert.match(prompt, /diamonds for decisions/);
  assert.match(prompt, /Do not use custom image icons/);
  assert.match(prompt, /Icon ids:\n- azure\.database: Database/);
  assert.match(prompt, /Return only the draw\.io <mxfile> XML\./);
});

test("visual defaults polish unstyled non-icon vertices", () => {
  const xml = `<mxCell id="n1" value="Plain" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry" /></mxCell><mxCell id="e1" edge="1" source="n1" target="n2" parent="1" />`;

  const result = applyVisualDefaults(xml);

  assert.equal(result.applied, 2);
  assert.match(result.xml, /fillColor=#eaf2ff/);
  assert.match(result.xml, /strokeColor=#5b7cfa/);
  assert.match(result.xml, /whiteSpace=wrap/);
  assert.doesNotMatch(result.xml, /<mxCell id="e1"[^>]*fillColor=/);
  assert.match(result.xml, /<mxCell id="e1"[^>]*edgeStyle=orthogonalEdgeStyle/);
  assert.match(result.xml, /<mxCell id="e1"[^>]*strokeColor=#64748b/);
  assert.match(result.xml, /<mxCell id="e1"[^>]*strokeWidth=2/);
});

test("visual defaults preserve existing connector styles", () => {
  const xml = `<mxCell id="e1" style="edgeStyle=elbowEdgeStyle;strokeColor=#ff0000;endArrow=none;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry" /></mxCell>`;

  const result = applyVisualDefaults(xml);
  const edge = result.xml.match(/<mxCell id="e1"[\s\S]*?(?:>|\/>)/)?.[0] || "";

  assert.equal(result.applied, 1);
  assert.match(edge, /edgeStyle=elbowEdgeStyle/);
  assert.match(edge, /strokeColor=#ff0000/);
  assert.match(edge, /endArrow=none/);
  assert.match(edge, /strokeWidth=2/);
  assert.match(edge, /html=1/);
});

test("visual defaults handle single-quoted XML attributes without duplicates", () => {
  const xml = `<mxCell id='n1' value='Plain' style='' vertex='1' parent='1'><mxGeometry x='0' y='0' width='120' height='60' as='geometry' /></mxCell><mxCell id='icon' value='Icon' style='shape=image;image=data:image/png;base64,abc;' vertex='1' parent='1' />`;

  const result = applyVisualDefaults(xml);
  const plainCell =
    result.xml.match(/<mxCell id='n1'[\s\S]*?<\/mxCell>/)?.[0] || "";
  const iconCell =
    result.xml.match(/<mxCell id='icon'[\s\S]*?(?:\/>|<\/mxCell>)/)?.[0] || "";
  const summary = summarizeDrawioVisuals(result.xml);

  assert.equal(result.applied, 1);
  assert.match(plainCell, /style="[^"]*fillColor=#eaf2ff/);
  assert.doesNotMatch(plainCell, /\sstyle='/);
  assert.doesNotMatch(iconCell, /fillColor=/);
  assert.equal(summary.vertexCount, 2);
  assert.equal(summary.iconVertexCount, 1);
});

test("visual defaults handle mixed-case XML attribute names", () => {
  const xml = `<mxCell ID='n1' Value='Approval decision' Style='' Vertex='1' Parent='1'><mxGeometry X='0' Y='0' Width='120' Height='60' As='geometry' /></mxCell><mxCell ID='icon' Value='Icon' Style='Shape=Image;Image=data:image/png;base64,abc;' Vertex='1' Parent='1' /><mxCell ID='edge' Edge='1' Source='n1' Target='icon' Parent='1' />`;

  const result = applyVisualDefaults(xml);
  const plainCell =
    result.xml.match(/<mxCell ID='n1'[\s\S]*?<\/mxCell>/)?.[0] || "";
  const iconCell =
    result.xml.match(/<mxCell ID='icon'[\s\S]*?(?:\/>|<\/mxCell>)/)?.[0] || "";
  const summary = summarizeDrawioVisuals(result.xml);

  assert.equal(result.applied, 2);
  assert.match(plainCell, /style="[^"]*shape=rhombus/);
  assert.doesNotMatch(plainCell, /\sStyle=/);
  assert.doesNotMatch(iconCell, /fillColor=/);
  assert.equal(summary.vertexCount, 2);
  assert.equal(summary.edgeCount, 1);
  assert.equal(summary.iconVertexCount, 1);
  assert(summary.shapeTypes.includes("image"));
  assert(summary.shapeTypes.includes("rhombus"));
});

test("visual defaults infer richer shapes for common non-icon labels", () => {
  const xml = [
    `<mxCell id="db" value="Customer DB" style="" vertex="1" parent="1" />`,
    `<mxCell id="decision" value="Approval decision" style="" vertex="1" parent="1" />`,
    `<mxCell id="doc" value="Signed document" style="" vertex="1" parent="1" />`,
    `<mxCell id="queue" value="Event queue" style="" vertex="1" parent="1" />`,
    `<mxCell id="cloud" value="Cloud network" style="" vertex="1" parent="1" />`,
    `<mxCell id="user" value="Customer user" style="" vertex="1" parent="1" />`,
    `<mxCell id="team" value="Operations team" style="" vertex="1" parent="1" />`,
    `<mxCell id="service" value="API service" style="" vertex="1" parent="1" />`,
  ].join("");

  const result = applyVisualDefaults(xml);

  assert.match(result.xml, /id="db"[^>]*shape=cylinder/);
  assert.match(result.xml, /id="decision"[^>]*shape=rhombus/);
  assert.match(result.xml, /id="doc"[^>]*shape=document/);
  assert.match(result.xml, /id="queue"[^>]*shape=hexagon/);
  assert.match(result.xml, /id="cloud"[^>]*shape=cloud/);
  assert.match(result.xml, /id="user"[^>]*shape=umlActor/);
  assert.match(result.xml, /id="team"[^>]*shape=ellipse/);
  assert.match(result.xml, /id="service"[^>]*shape=process/);
});

test("visual defaults preserve existing styles and skip icon image vertices", () => {
  const xml = `<mxCell id="n1" value="Styled" style="shape=process;fillColor=#ffffff;strokeColor=#111111;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry" /></mxCell><mxCell id="icon" value="Icon" style="shape=image;image=data:image/png;base64,abc;" vertex="1" parent="1"><mxGeometry x="140" y="0" width="80" height="80" as="geometry" /></mxCell>`;

  const result = applyVisualDefaults(xml);

  assert.equal(result.applied, 1);
  assert.match(result.xml, /shape=process;fillColor=#ffffff;strokeColor=#111111;rounded=1/);
  assert.doesNotMatch(result.xml, /shape=image;image=data:image\/png;base64,abc;[^"]*fillColor=/);
});

test("visual defaults preserve non-image drawio library object styles", () => {
  const xml = `<mxCell id="azure" value="Storage" style="shape=mxgraph.azure.storage;html=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="80" as="geometry" /></mxCell>`;

  const result = applyVisualDefaults(xml);
  const summary = summarizeDrawioVisuals(result.xml);

  assert.equal(result.applied, 0);
  assert.doesNotMatch(result.xml, /fillColor=/);
  assert.doesNotMatch(result.xml, /strokeColor=/);
  assert.equal(summary.iconVertexCount, 1);
  assert.equal(summary.styledVertexCount, 1);
  assert(summary.shapeTypes.includes("mxgraph.azure.storage"));
});

test("visual defaults and summary recognize mixed-case style keys", () => {
  const xml = [
    `<mxCell id="icon" value="Icon" style="Shape=Image;Image=data:image/png;base64,abc;" vertex="1" parent="1" />`,
    `<mxCell id="library" value="Storage" style="Shape=mxgraph.azure.storage;Html=1;WhiteSpace=wrap;" vertex="1" parent="1" />`,
    `<mxCell id="styled" value="Styled" style="Rounded=1;FillColor=#EAF2FF;StrokeColor=#5B7CFA;FontColor=#0F172A;" vertex="1" parent="1" />`,
    `<mxCell id="decision" value="Approval decision" style="Shape=process;" vertex="1" parent="1" />`,
  ].join("");

  const result = applyVisualDefaults(xml);
  const summary = summarizeDrawioVisuals(result.xml);
  const decisionCell =
    result.xml.match(/<mxCell id="decision"[\s\S]*?(?:\/>|<\/mxCell>)/)?.[0] || "";

  assert.equal(summary.iconVertexCount, 2);
  assert.equal(summary.styledVertexCount, 4);
  assert.equal(summary.fillColorCount, 2);
  assert.equal(summary.strokeColorCount, 2);
  assert(summary.shapeTypes.includes("image"));
  assert(summary.shapeTypes.includes("mxgraph.azure.storage"));
  assert(summary.shapeTypes.includes("process"));
  assert.doesNotMatch(decisionCell, /shape=rhombus/);
  assert.doesNotMatch(
    result.xml.match(/<mxCell id="icon"[\s\S]*?(?:\/>|<\/mxCell>)/)?.[0] || "",
    /fillColor=/,
  );
});

test("visual summary counts icons, styling, colors, and shape diversity", () => {
  const xml = `<mxCell id="n1" value="App" style="rounded=1;fillColor=#eaf2ff;strokeColor=#5b7cfa;fontColor=#0f172a;" vertex="1" parent="1" /><mxCell id="n2" value="Decision" style="shape=rhombus;fillColor=#fff7e6;strokeColor=#f59e0b;" vertex="1" parent="1" /><mxCell id="icon" value="Database" style="shape=image;image=data:image/png;base64,abc;" vertex="1" parent="1" /><mxCell id="e1" edge="1" source="n1" target="n2" parent="1" />`;

  const summary = summarizeDrawioVisuals(xml);

  assert.equal(summary.vertexCount, 3);
  assert.equal(summary.edgeCount, 1);
  assert.equal(summary.iconVertexCount, 1);
  assert.equal(summary.styledVertexCount, 3);
  assert.equal(summary.fillColorCount, 2);
  assert.equal(summary.strokeColorCount, 2);
  assert.equal(summary.shapeTypeCount, 3);
  assert.deepEqual(summary.shapeTypes, ["image", "rhombus", "rounded"]);
});

test("icon candidate telemetry keeps admin-readable library details", () => {
  assert.deepEqual(
    summarizeIconCandidate({
      id: "azure-general.database",
      title: "SQL Database",
      library_name: "Azure General",
      provider: "Azure",
      style_family: "azure-flat",
      width: 70,
      height: 50,
    }),
    {
      id: "azure-general.database",
      title: "SQL Database",
      library: "Azure General",
      provider: "Azure",
      styleFamily: "azure-flat",
      width: 70,
      height: 50,
    },
  );
});

test("local post-processing pipeline defaults to shape-rich styled XML", async () => {
  const modelXml = [
    `<mxCell id="api" value="API Gateway" style="synthIcon=lib.gateway;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="160" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="db" value="Customer DB" style="" vertex="1" parent="1"><mxGeometry x="240" y="20" width="160" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="decision" value="Approval decision" style="" vertex="1" parent="1"><mxGeometry x="460" y="20" width="160" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="e1" edge="1" parent="1" source="api" target="db" />`,
  ].join("");
  const iconRows = [
    {
      id: "lib.gateway",
      title: "Gateway",
      search_text: "gateway api ingress proxy",
      style: "shape=image;image=data:image/png;base64,gateway;aspect=fixed;",
      width: 64,
      height: 64,
    },
    {
      id: "lib.database",
      title: "Database",
      search_text: "database db sql storage",
      style: "shape=image;image=data:image/png;base64,database;aspect=fixed;",
      width: 70,
      height: 50,
    },
  ];

  const result = await postProcessDrawioXml(modelXml, {
    iconCandidates: iconRows,
    iconRows,
  });
  const summary = result.visualSummary;

  assert.equal(result.iconMeta.applied.length, 1);
  assert.equal(result.iconMeta.autoApplied.length, 0);
  assert.equal(result.iconMeta.autoEligible, 2);
  assert.equal(result.iconMeta.autoTarget, 0);
  assert.equal(result.iconMeta.autoCandidateCount, 2);
  assert.match(result.xml, /id="api"[\s\S]*?width="109" height="109"/);
  assert.match(result.xml, /id="db"[^>]*shape=cylinder/);
  assert.match(result.xml, /id="decision"[^>]*shape=rhombus/);
  assert.equal(summary.vertexCount, 3);
  assert.equal(summary.iconVertexCount, 1);
  assert(summary.fillColorCount >= 2);
  assert(summary.shapeTypes.includes("cylinder"));
  assert(summary.shapeTypes.includes("image"));
  assert(summary.shapeTypes.includes("rhombus"));
});
