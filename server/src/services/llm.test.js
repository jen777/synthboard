import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const {
  applyPlannedGeometry,
  applyVisualDefaults,
  buildFallbackDrawioXml,
  buildDiagramLayout,
  buildPlanningPrompt,
  buildGenerationPrompt,
  combineUsage,
  generateDrawio,
  normalizeDrawioXml,
  parseDiagramPlan,
  postProcessDrawioXml,
  summarizeDrawioVisuals,
  summarizeIconCandidate,
  validateDrawioXml,
} = await import("./llm.js");

test("generation prompt includes plan-driven visual design requirements", () => {
  const prompt = buildGenerationPrompt({
    preset: "architecture",
    presetDef: {
      label: "System Architecture",
      guidance: "Produce a SYSTEM / NETWORK ARCHITECTURE DIAGRAM.",
    },
    diagramPlan: {
      title: "Checkout architecture",
      layout: "left-to-right",
      objects: [
        {
          key: "api",
          label: "API",
          visual: "icon",
          fallbackShape: "process",
          size: "large",
          width: 160,
          height: 70,
        },
      ],
      connectors: [],
    },
    iconPrompt: "Icon ids:\n- azure.database: Database",
    title: "Checkout architecture",
    sourceText: "Frontend calls API, API writes to database.",
  });

  assert.match(prompt, /Visual design requirements:/);
  assert.match(prompt, /Shared draw\.io xml guide:/);
  assert.match(prompt, /Use titled nested containers/);
  assert.match(prompt, /adaptiveColors="auto"/);
  assert.match(prompt, /Every connected edge needs valid source and target ids/);
  assert.match(prompt, /3-5 complementary colors/);
  assert.match(prompt, /standard draw\.io shapes/);
  assert.match(prompt, /cylinders for data stores/);
  assert.match(prompt, /diamonds for decisions/);
  assert.match(prompt, /Do not use custom image icons/);
  assert.match(prompt, /Icon ids:\n- azure\.database: Database/);
  assert.match(prompt, /Approved diagram plan from step 1:/);
  assert.match(prompt, /"fallbackShape": "process"/);
  assert.match(prompt, /synthIconSize/);
  assert.match(prompt, /Do not emit synthIconWidth, synthIconHeight, or synthIconScale/);
  assert.match(prompt, /keeps its center fixed/);
  assert.match(prompt, /exact plan key as its mxCell id/);
  assert.match(prompt, /x\/y\/width\/height in the plan as an exact absolute page slot/);
  assert.match(prompt, /single diagram-wide design system/);
  assert.match(prompt, /Return only the draw\.io <mxfile> XML\./);
});

test("planning prompt and parser produce a bounded object/connector plan", () => {
  const planningPrompt = buildPlanningPrompt({
    preset: "architecture",
    presetDef: {
      label: "System Architecture",
      guidance: "Produce a SYSTEM / NETWORK ARCHITECTURE DIAGRAM.",
    },
    title: "Checkout",
    sourceText: "React sends orders to the API and Postgres.",
  });
  assert.match(planningPrompt, /Source material to analyze:/);
  assert.match(planningPrompt, /Shared draw\.io planning guide:/);
  assert.match(planningPrompt, /Prefer a source-supported gateway/);
  assert.doesNotMatch(planningPrompt, /Every connected edge needs valid source/);
  assert.match(planningPrompt, /Return only the structured JSON diagram plan/);

  const plan = parseDiagramPlan(`Here is the plan:\n\`\`\`json
{
  "title": "Checkout",
  "summary": "Order flow",
  "layout": "left-to-right",
  "objects": [
    {"key":"React UI","label":"React UI","role":"frontend","visual":"logo","fallbackShape":"process","size":"large","width":180,"height":80,"searchTerms":["React","frontend"]},
    {"key":"Database","label":"Postgres","role":"database","visual":"icon","fallbackShape":"cylinder","size":"medium","width":160,"height":70,"searchTerms":["PostgreSQL","database"]}
  ],
  "connectors": [{"from":"React UI","to":"Database","label":"writes","direction":"forward"}]
}
\`\`\``);

  assert.equal(plan.title, "Checkout");
  assert.equal(plan.layout, "left-to-right");
  assert.deepEqual(
    plan.objects.map((object) => [object.key, object.visual, object.size]),
    [
      ["react-ui", "logo", "large"],
      ["database", "icon", "medium"],
    ],
  );
  assert.deepEqual(plan.connectors, [
    {
      from: "react-ui",
      to: "database",
      label: "writes",
      direction: "forward",
    },
  ]);
  assert.equal(plan.layoutSource, "deterministic-fallback");
  assert.equal(plan.canvas.gridSize, 10);
  assert(plan.canvas.width > 0);
  assert(plan.canvas.height > 0);
  assert(plan.objects.every((object) => object.x >= 60 && object.y >= 60));
});

test("layout blueprint creates aligned, content-aware, non-overlapping layers", () => {
  const plan = buildDiagramLayout({
    title: "Order flow",
    layout: "left-to-right",
    objects: [
      { key: "start", label: "Start", fallbackShape: "ellipse", size: "small", width: 120, height: 50, x: null, y: null },
      { key: "validate", label: "Validate the complete incoming order payload", fallbackShape: "process", size: "medium", width: 230, height: 70, x: null, y: null },
      { key: "approve", label: "Approval decision", fallbackShape: "rhombus", size: "medium", width: 160, height: 90, x: null, y: null },
      { key: "store", label: "Order database", fallbackShape: "cylinder", size: "medium", width: 160, height: 80, x: null, y: null },
    ],
    connectors: [
      { from: "start", to: "validate" },
      { from: "validate", to: "approve" },
      { from: "approve", to: "store" },
    ],
  });

  assert.equal(plan.layoutSource, "deterministic-fallback");
  const verticalCenters = plan.objects.map(
    (object) => object.y + object.height / 2,
  );
  assert(Math.max(...verticalCenters) - Math.min(...verticalCenters) <= 5);
  for (let index = 1; index < plan.objects.length; index++) {
    const previous = plan.objects[index - 1];
    const current = plan.objects[index];
    assert(current.x - (previous.x + previous.width) >= 90);
  }
  assert.equal(plan.canvas.width % 10, 0);
  assert.equal(plan.canvas.height % 10, 0);
});

test("layered layout orders connected peers to reduce edge crossings", () => {
  const plan = buildDiagramLayout({
    preset: "architecture",
    layout: "left-to-right",
    objects: [
      { key: "source-a", label: "Source A", fallbackShape: "process", size: "medium", width: 180, height: 80, x: null, y: null },
      { key: "source-b", label: "Source B", fallbackShape: "process", size: "medium", width: 180, height: 80, x: null, y: null },
      { key: "target-b", label: "Target B", fallbackShape: "process", size: "medium", width: 180, height: 80, x: null, y: null },
      { key: "target-a", label: "Target A", fallbackShape: "process", size: "medium", width: 180, height: 80, x: null, y: null },
    ],
    connectors: [
      { from: "source-a", to: "target-a" },
      { from: "source-b", to: "target-b" },
    ],
  });
  const byKey = new Map(plan.objects.map((object) => [object.key, object]));

  assert(byKey.get("source-a").y < byKey.get("source-b").y);
  assert(byKey.get("target-a").y < byKey.get("target-b").y);
});

test("layout blueprint repairs generic overlaps but preserves Venn composition", () => {
  const overlapping = [
    { key: "a", label: "A", fallbackShape: "process", width: 160, height: 70, x: 60, y: 60 },
    { key: "b", label: "B", fallbackShape: "process", width: 160, height: 70, x: 100, y: 80 },
  ];
  const repaired = buildDiagramLayout({
    layout: "left-to-right",
    objects: overlapping,
    connectors: [{ from: "a", to: "b" }],
  });
  const venn = buildDiagramLayout({
    layout: "radial",
    objects: overlapping.map((object) => ({
      ...object,
      fallbackShape: "ellipse",
      width: 240,
      height: 240,
    })),
    connectors: [],
  });

  assert.equal(repaired.layoutSource, "deterministic-fallback");
  assert(repaired.objects[1].x > repaired.objects[0].x + repaired.objects[0].width);
  assert.equal(venn.layoutSource, "planned");
  assert.equal(venn.plannedOverlapCount, 0);
});

test("planned geometry enforces slots, canvas, and child-relative coordinates", () => {
  const diagramPlan = buildDiagramLayout({
    layout: "grid",
    objects: [
      { key: "platform", label: "Platform", fallbackShape: "group", group: "", x: 100, y: 80, width: 420, height: 240 },
      { key: "api", label: "API", fallbackShape: "process", group: "platform", x: 160, y: 150, width: 180, height: 70 },
    ],
    connectors: [],
  });
  const xml = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="group-cell" value="Platform" style="shape=swimlane;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="100" height="100" as="geometry"/></mxCell><mxCell id="node-cell" value="API" style="shape=process;" vertex="1" parent="1"><mxGeometry x="5" y="5" width="80" height="30" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;

  const result = applyPlannedGeometry(xml, diagramPlan);

  assert.equal(result.applied, 2);
  assert.deepEqual(result.missing, []);
  assert.match(result.xml, /id="group-cell"[\s\S]*?x="100" y="80" width="420" height="240"/);
  assert.match(result.xml, /id="node-cell"[^>]*parent="group-cell"[\s\S]*?x="60" y="70" width="180" height="70"/);
  assert.match(result.xml, new RegExp(`pageWidth="${diagramPlan.canvas.width}"`));
  assert.match(result.xml, new RegExp(`pageHeight="${diagramPlan.canvas.height}"`));
});

test("canvas expands to include unplanned structural vertices", () => {
  const diagramPlan = buildDiagramLayout({
    layout: "grid",
    objects: [
      { key: "api", label: "API", fallbackShape: "process", x: 60, y: 60, width: 180, height: 80 },
    ],
    connectors: [],
  });
  const xml = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="api" value="API" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="10" height="10" as="geometry"/></mxCell><mxCell id="sequence-lifeline" value="" style="" vertex="1" parent="1"><mxGeometry x="620" y="200" width="10" height="500" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;

  const result = applyPlannedGeometry(xml, diagramPlan);

  assert.equal(result.unplannedVertexCount, 1);
  assert.equal(result.canvas.width, 690);
  assert.equal(result.canvas.height, 760);
  assert.match(result.xml, /pageWidth="690"/);
  assert.match(result.xml, /pageHeight="760"/);
});

test("production presets normalize sizes and override model-dependent coordinates", () => {
  const plan = parseDiagramPlan(
    JSON.stringify({
      layout: "left-to-right",
      objects: [
        { key: "api", label: "API service", fallbackShape: "process", size: "medium", x: 500, y: 400, width: 80, height: 30 },
        { key: "worker", label: "Background worker", fallbackShape: "process", size: "medium", x: 900, y: 700, width: 500, height: 300 },
      ],
      connectors: [{ from: "api", to: "worker" }],
    }),
    { preset: "architecture" },
  );

  assert.equal(plan.layoutSource, "preset-deterministic");
  assert.deepEqual(
    plan.objects.map((object) => [object.width, object.height]),
    [
      [190, 80],
      [190, 80],
    ],
  );
  assert.deepEqual(
    plan.objects.map((object) => [object.x, object.y]),
    [
      [60, 60],
      [370, 60],
    ],
  );
});

test("grouped preset layout sizes containers around aligned children", () => {
  const plan = buildDiagramLayout({
    preset: "architecture",
    layout: "left-to-right",
    objects: [
      { key: "platform", label: "Platform", fallbackShape: "group", size: "large", group: "", width: 320, height: 180, x: null, y: null },
      { key: "api", label: "API", fallbackShape: "process", size: "medium", group: "platform", width: 180, height: 80, x: null, y: null },
      { key: "worker", label: "Worker", fallbackShape: "process", size: "medium", group: "platform", width: 180, height: 80, x: null, y: null },
      { key: "db", label: "Database", fallbackShape: "cylinder", size: "medium", group: "", width: 180, height: 80, x: null, y: null },
    ],
    connectors: [
      { from: "api", to: "worker" },
      { from: "worker", to: "db" },
    ],
  });
  const byKey = new Map(plan.objects.map((object) => [object.key, object]));
  const platform = byKey.get("platform");
  const api = byKey.get("api");
  const worker = byKey.get("worker");
  const db = byKey.get("db");

  assert.equal(platform.width, 560);
  assert.equal(platform.height, 180);
  assert.equal(api.x - platform.x, 40);
  assert.equal(api.y - platform.y, 60);
  assert.equal(worker.x - (api.x + api.width), 120);
  assert.equal(platform.x + platform.width + 120, db.x);
});

test("two-step generation makes a planning call before the XML call", async () => {
  const calls = [];
  const planJson = JSON.stringify({
    title: "Checkout flow",
    summary: "Frontend to database",
    layout: "left-to-right",
    objects: [
      {
        key: "frontend",
        label: "React frontend",
        role: "web application",
        visual: "logo",
        fallbackShape: "process",
        size: "large",
        width: 180,
        height: 80,
        searchTerms: ["React", "frontend"],
      },
      {
        key: "database",
        label: "Postgres",
        role: "database",
        visual: "icon",
        fallbackShape: "cylinder",
        size: "medium",
        width: 150,
        height: 70,
        searchTerms: ["PostgreSQL", "database"],
      },
    ],
    connectors: [
      { from: "frontend", to: "database", label: "writes", direction: "forward" },
    ],
  });
  const diagramXml = `<mxfile host="synthboard"><diagram id="d1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="frontend" value="React frontend" style="shape=process;" vertex="1" parent="1"><mxGeometry x="20" y="40" width="180" height="80" as="geometry"/></mxCell><mxCell id="database" value="Postgres" style="shape=cylinder;" vertex="1" parent="1"><mxGeometry x="280" y="40" width="150" height="70" as="geometry"/></mxCell><mxCell id="edge" edge="1" parent="1" source="frontend" target="database"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
  const outputs = [
    {
      text: planJson,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
    {
      text: diagramXml,
      usage: { prompt_tokens: 40, completion_tokens: 50, total_tokens: 90 },
    },
  ];

  const createCompletion = async (request) => {
    const output = outputs[calls.length];
    calls.push(request);
    return {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: output.text } }] };
        yield {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: output.usage,
        };
      },
    };
  };

  const result = await generateDrawio(
    {
      preset: "architecture",
      sourceText: "React sends data to Postgres.",
      title: "Checkout flow",
      maxSourceChars: 7000,
      modelConfig: {
        id: 7,
        modelName: "test-model",
        maxTokens: 4096,
        provider: {
          id: 3,
          name: "Test provider",
          apiKey: "test-key",
        },
      },
    },
    {
      createCompletion,
      buildIconContext: async () => ({
        prompt: "No exact catalog match was found; use planned fallback shapes.",
        candidates: [],
        matches: [],
        searchedObjects: 2,
        matchedObjects: 0,
        lookupErrors: 0,
      }),
    },
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0].messages[0].content, /planning stage/);
  assert.match(calls[0].messages[1].content, /structured JSON diagram plan/);
  assert.match(calls[1].messages[0].content, /OUTPUT CONTRACT/);
  assert.match(calls[1].messages[1].content, /Approved diagram plan from step 1/);
  assert.match(calls[1].messages[1].content, /"label": "React frontend"/);
  assert.match(calls[1].messages[1].content, /No exact catalog match was found/);
  assert.deepEqual(result.usage, {
    prompt_tokens: 50,
    completion_tokens: 70,
    total_tokens: 120,
  });
  assert.equal(result.meta.llmCalls, 2);
  assert.equal(result.meta.planObjectCount, 2);
  assert.equal(result.meta.planConnectorCount, 1);
  assert.equal(result.meta.plannedLibraryVisualCount, 2);
  assert.equal(result.meta.iconSearchedObjectCount, 2);
  assert.equal(result.meta.layoutSlotsApplied, 2);
  assert.deepEqual(result.meta.layoutSlotsMissing, []);
  assert.equal(result.meta.layoutSource, "preset-deterministic");
  assert.equal(result.meta.diagramCanvas.gridSize, 10);
  assert.match(result.xml, /<mxfile/);
});

test("normalizes repairable draw.io XML and rejects structural corruption", () => {
  const repairable = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="team" value="<b>R&D</b>" vertex="1" parent="1"/></root>`;
  const normalized = normalizeDrawioXml(repairable);

  assert.equal(normalized.repaired, true);
  assert.equal(normalized.needsModelRepair, false);
  assert.match(normalized.xml, /value="&lt;b>R&amp;D&lt;\/b>"/);
  assert.deepEqual(validateDrawioXml(normalized.xml), { valid: true, errors: [] });

  const corrupt = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="node"/><mxCell id="node"/><mxCell id="edge" edge="1" source="node" target="missing"/></root></mxGraphModel></diagram></mxfile>`;
  const validation = validateDrawioXml(corrupt);
  assert.equal(validation.valid, false);
  assert(validation.errors.some((error) => error.includes("Duplicate mxCell id node")));
  assert(validation.errors.some((error) => error.includes("Missing edge endpoint missing")));
});

test("repairs invalid model XML with one dedicated model pass", async () => {
  const calls = [];
  const plan = JSON.stringify({
    title: "Service flow",
    layout: "left-to-right",
    objects: [
      {
        key: "service",
        label: "API & worker",
        role: "service",
        visual: "shape",
        fallbackShape: "process",
        size: "medium",
      },
    ],
    connectors: [],
  });
  const repairedXml = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="service" value="API &amp; worker" style="shape=process;" vertex="1" parent="1"><mxGeometry x="60" y="60" width="190" height="80" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
  const outputs = [plan, "I could not produce the XML.", repairedXml];
  const createCompletion = async (request) => {
    const text = outputs[calls.length];
    calls.push(request);
    return {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: text } }] };
        yield {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        };
      },
    };
  };

  const result = await generateDrawio(
    {
      preset: "architecture",
      sourceText: "An API and worker service.",
      title: "Service flow",
      maxSourceChars: 7000,
      modelConfig: {
        id: 7,
        modelName: "test-model",
        maxTokens: 4096,
        provider: { id: 3, name: "Test provider", apiKey: "test-key" },
      },
    },
    {
      createCompletion,
      buildIconContext: async () => ({ prompt: "", candidates: [], matches: [] }),
    },
  );

  assert.equal(calls.length, 3);
  assert.match(calls[2].messages[0].content, /repair malformed draw\.io XML/i);
  assert.equal(result.meta.llmCalls, 3);
  assert.equal(result.meta.xmlRepairMethod, "model");
  assert.equal(result.meta.xmlRepairModelAttempted, true);
  assert.equal(result.meta.xmlRepairFallbackUsed, false);
  assert.equal(validateDrawioXml(result.xml).valid, true);
  assert.match(result.xml, /value="API &amp; worker"/);
});

test("builds a valid plan-based diagram when model XML repair also fails", async () => {
  const calls = [];
  const outputs = [
    JSON.stringify({
      title: "Fallback",
      layout: "left-to-right",
      objects: [
        {
          key: "database",
          label: "Orders database",
          role: "storage",
          visual: "shape",
          fallbackShape: "cylinder",
          size: "medium",
        },
      ],
      connectors: [],
    }),
    "not XML",
    "still not XML",
  ];
  const createCompletion = async (request) => {
    const text = outputs[calls.length];
    calls.push(request);
    return {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: text } }] };
        yield { choices: [{ delta: {}, finish_reason: "stop" }] };
      },
    };
  };

  const result = await generateDrawio(
    {
      preset: "architecture",
      sourceText: "Orders are stored in a database.",
      title: "Fallback",
      maxSourceChars: 7000,
      modelConfig: {
        id: 7,
        modelName: "test-model",
        maxTokens: 4096,
        provider: { id: 3, name: "Test provider", apiKey: "test-key" },
      },
    },
    {
      createCompletion,
      buildIconContext: async () => ({ prompt: "", candidates: [], matches: [] }),
    },
  );

  assert.equal(calls.length, 3);
  assert.equal(result.meta.xmlRepairMethod, "deterministic-fallback");
  assert.equal(result.meta.xmlRepairFallbackUsed, true);
  assert.equal(validateDrawioXml(result.xml).valid, true);
  assert.match(result.xml, /id="database"/);
  assert.match(result.xml, /shape=cylinder/);

  const directFallback = buildFallbackDrawioXml({
    objects: [
      { key: "team", label: "R&D", fallbackShape: "process", x: 60, y: 60, width: 180, height: 80 },
    ],
    connectors: [],
  });
  assert.equal(validateDrawioXml(directFallback).valid, true);
  assert.match(directFallback, /value="R&amp;D"/);
});

test("usage aggregation sums both LLM calls", () => {
  assert.deepEqual(
    combineUsage(
      { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
      { prompt_tokens: 11, completion_tokens: 13, total_tokens: 24 },
    ),
    { prompt_tokens: 16, completion_tokens: 20, total_tokens: 36 },
  );
  assert.equal(combineUsage(undefined, null), undefined);
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

test("visual defaults match connector routing to the diagram preset", () => {
  const edgeXml = `<mxCell id="e1" style="" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry" /></mxCell>`;
  const timeline = applyVisualDefaults(edgeXml, {
    diagramPlan: { preset: "timeline", objects: [] },
  }).xml;
  const mindmap = applyVisualDefaults(edgeXml, {
    diagramPlan: { preset: "mindmap", objects: [] },
  }).xml;
  const architecture = applyVisualDefaults(edgeXml, {
    diagramPlan: { preset: "architecture", objects: [] },
  }).xml;

  assert.match(timeline, /edgeStyle=none/);
  assert.match(timeline, /strokeWidth=3/);
  assert.match(timeline, /endArrow=none/);
  assert.match(mindmap, /edgeStyle=none/);
  assert.match(mindmap, /curved=1/);
  assert.match(mindmap, /endArrow=none/);
  assert.match(architecture, /edgeStyle=orthogonalEdgeStyle/);
  assert.match(architecture, /endArrow=block/);
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
  assert.match(result.xml, /id="decision"[^>]*perimeter=rhombusPerimeter/);
  assert.match(result.xml, /id="doc"[^>]*shape=document/);
  assert.match(result.xml, /id="queue"[^>]*shape=hexagon/);
  assert.match(result.xml, /id="queue"[^>]*perimeter=hexagonPerimeter2/);
  assert.match(result.xml, /id="cloud"[^>]*shape=cloud/);
  assert.match(result.xml, /id="user"[^>]*shape=umlActor/);
  assert.match(result.xml, /id="team"[^>]*shape=ellipse/);
  assert.match(result.xml, /id="team"[^>]*perimeter=ellipsePerimeter/);
  assert.match(result.xml, /id="service"[^>]*shape=rectangle/);
});

test("planned objects in the same group receive a coherent default treatment", () => {
  const xml = [
    `<mxCell id="api" value="API" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="160" height="70" as="geometry" /></mxCell>`,
    `<mxCell id="worker" value="Worker" style="" vertex="1" parent="1"><mxGeometry x="240" y="0" width="160" height="70" as="geometry" /></mxCell>`,
  ].join("");
  const diagramPlan = {
    objects: [
      { key: "api", label: "API", fallbackShape: "process", group: "backend", size: "medium" },
      { key: "worker", label: "Worker", fallbackShape: "process", group: "backend", size: "medium" },
    ],
  };

  const result = applyVisualDefaults(xml, { diagramPlan });
  const fills = [...result.xml.matchAll(/fillColor=(#[0-9a-f]{6})/gi)].map(
    (match) => match[1],
  );
  const strokes = [...result.xml.matchAll(/strokeColor=(#[0-9a-f]{6})/gi)].map(
    (match) => match[1],
  );

  assert.deepEqual(fills, [fills[0], fills[0]]);
  assert.deepEqual(strokes, [strokes[0], strokes[0]]);
  assert.equal((result.xml.match(/fontSize=14/g) || []).length, 2);
  assert.equal((result.xml.match(/strokeWidth=2/g) || []).length, 2);
});

test("planned styling corrects conflicting model shapes and text sizes", () => {
  const xml = `<mxCell id="db" value="Orders database" style="shape=process;fillColor=#ff0000;strokeColor=#000000;strokeWidth=1;fontSize=8;fontFamily=Comic Sans MS;" vertex="1" parent="1"><mxGeometry x="60" y="60" width="100" height="40" as="geometry" /></mxCell>`;
  const diagramPlan = {
    objects: [
      {
        key: "db",
        label: "Orders database",
        fallbackShape: "cylinder",
        group: "data",
        size: "large",
      },
    ],
  };

  const result = applyVisualDefaults(xml, { diagramPlan });
  const cell = result.xml.match(/<mxCell[^>]+/)?.[0] || "";

  assert.match(cell, /shape=cylinder/);
  assert.doesNotMatch(cell, /shape=process/);
  assert.doesNotMatch(cell, /fillColor=#ff0000/);
  assert.match(cell, /strokeWidth=2/);
  assert.match(cell, /fontSize=16/);
  assert.match(cell, /fontFamily=Helvetica/);
  assert.doesNotMatch(cell, /Comic Sans/);
});

test("planned styling preserves unplanned diagram-specific structural vertices", () => {
  const xml = `<mxCell id="lifeline" value="" style="shape=line;dashed=1;strokeColor=#94a3b8;" vertex="1" parent="1"><mxGeometry x="100" y="120" width="1" height="500" as="geometry" /></mxCell>`;
  const result = applyVisualDefaults(xml, {
    diagramPlan: { preset: "sequence", objects: [], connectors: [] },
  });
  const cell = result.xml.match(/<mxCell[^>]+/)?.[0] || "";

  assert.match(cell, /shape=line/);
  assert.match(cell, /dashed=1/);
  assert.match(cell, /strokeColor=#94a3b8/);
  assert.doesNotMatch(cell, /fillColor=/);
  assert.doesNotMatch(cell, /rounded=/);
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
  assert.match(
    result.xml,
    /id="api"[\s\S]*?x="72" y="17" width="56" height="56"/,
  );
  assert.match(result.xml, /id="db"[^>]*shape=cylinder/);
  assert.match(result.xml, /id="decision"[^>]*shape=rhombus/);
  assert.equal(summary.vertexCount, 3);
  assert.equal(summary.iconVertexCount, 1);
  assert(summary.fillColorCount >= 2);
  assert(summary.shapeTypes.includes("cylinder"));
  assert(summary.shapeTypes.includes("image"));
  assert(summary.shapeTypes.includes("rhombus"));
});

test("post-processing lays out a slot before fitting an icon around its center", async () => {
  const modelXml = `<mxCell id="api" value="API Gateway" style="synthIcon=lib.gateway;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="100" height="40" as="geometry" /></mxCell>`;
  const diagramPlan = {
    objects: [
      { key: "api", label: "API Gateway", x: 300, y: 200, width: 210, height: 90 },
    ],
    canvas: { width: 700, height: 500, gridSize: 10 },
    layoutSource: "planned",
    plannedOverlapCount: 0,
  };
  const iconRows = [
    {
      id: "lib.gateway",
      title: "Gateway",
      search_text: "gateway api",
      style: "shape=image;image=data:image/png;base64,gateway;aspect=fixed;",
      width: 64,
      height: 64,
    },
  ];

  const result = await postProcessDrawioXml(modelXml, {
    iconCandidates: iconRows,
    iconRows,
    diagramPlan,
  });

  assert.equal(result.layout.applied, 1);
  assert.match(result.xml, /x="354\.5" y="194\.5" width="101" height="101"/);
});
