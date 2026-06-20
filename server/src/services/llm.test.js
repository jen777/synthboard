import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const { applyVisualDefaults, buildGenerationPrompt } = await import("./llm.js");

test("generation prompt includes visual design and icon sizing requirements", () => {
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
  assert.match(prompt, /containers\/boundaries for groups/);
  assert.match(prompt, /synthIconSize/);
  assert.match(prompt, /synthIconWidth/);
  assert.match(prompt, /Icon ids:\n- azure\.database: Database/);
  assert.match(prompt, /Return only the draw\.io <mxfile> XML\./);
});

test("visual defaults polish unstyled non-icon vertices", () => {
  const xml = `<mxCell id="n1" value="Plain" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry" /></mxCell><mxCell id="e1" edge="1" source="n1" target="n2" parent="1" />`;

  const result = applyVisualDefaults(xml);

  assert.equal(result.applied, 1);
  assert.match(result.xml, /fillColor=#eaf2ff/);
  assert.match(result.xml, /strokeColor=#5b7cfa/);
  assert.match(result.xml, /whiteSpace=wrap/);
  assert.doesNotMatch(result.xml, /<mxCell id="e1"[^>]*fillColor=/);
});

test("visual defaults preserve existing styles and skip icon image vertices", () => {
  const xml = `<mxCell id="n1" value="Styled" style="fillColor=#ffffff;strokeColor=#111111;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry" /></mxCell><mxCell id="icon" value="Icon" style="shape=image;image=data:image/png;base64,abc;" vertex="1" parent="1"><mxGeometry x="140" y="0" width="80" height="80" as="geometry" /></mxCell>`;

  const result = applyVisualDefaults(xml);

  assert.equal(result.applied, 1);
  assert.match(result.xml, /fillColor=#ffffff;strokeColor=#111111;rounded=1/);
  assert.doesNotMatch(result.xml, /shape=image;image=data:image\/png;base64,abc;[^"]*fillColor=/);
});
