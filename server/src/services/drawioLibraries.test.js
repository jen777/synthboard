import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const {
  applyIconRowsToXml,
  buildIconPrompt,
  buildIconQueryTerms,
  buildIconSearchText,
  buildIconTsQuery,
  buildObjectAliases,
} = await import("./drawioLibraries.js");

const ICON_ROWS = [
  {
    id: "lib.database",
    title: "Database",
    search_text: "database db sql storage",
    style: "shape=image;image=data:image/png;base64,database;aspect=fixed;",
    width: 70,
    height: 50,
  },
  {
    id: "lib.worker",
    title: "Worker",
    search_text: "worker service job process",
    style: "shape=image;image=data:image/png;base64,worker;aspect=fixed;",
    width: 50,
    height: 40,
  },
];

test("replaces synthIcon placeholders, strips synthIcon keys, and preserves telemetry", () => {
  const xml = `<mxCell id="n1" value="Database" style="rounded=1;synthIcon=lib.database;synthIconWidth=140;fillColor=#fff;strokeColor=#000;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell><mxCell id="n2" value="Missing" style="synthIcon=missing.icon;synthIconSize=hero;fillColor=#fff;" vertex="1" parent="1"><mxGeometry x="180" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);

  assert.match(result.xml, /shape=image/);
  assert.match(result.xml, /width="140" height="100"/);
  assert.match(result.xml, /id="n2"[\s\S]*?fillColor=#fff/);
  assert.doesNotMatch(result.xml, /synthIcon/);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.deepEqual(result.missing, ["missing.icon"]);
  assert.deepEqual(result.autoApplied, []);
});

test("uses native medium geometry for explicit icons without size requests", () => {
  const xml = `<mxCell id="n1" value="Database" style="rounded=1;synthIcon=lib.database;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="180" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);

  assert.match(result.xml, /shape=image/);
  assert.match(result.xml, /width="70" height="50"/);
  assert.doesNotMatch(result.xml, /width="180" height="40"/);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.deepEqual(result.autoApplied, []);
});

test("strips synthIcon keys from non-vertex cells without applying image styles", () => {
  const xml = `<mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;strokeColor=#3355ff;synthIcon=lib.database;synthIconSize=hero;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, ICON_ROWS);

  assert.match(result.xml, /edgeStyle=orthogonalEdgeStyle/);
  assert.match(result.xml, /strokeColor=#3355ff/);
  assert.doesNotMatch(result.xml, /shape=image/);
  assert.doesNotMatch(result.xml, /synthIcon/);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.autoApplied, []);
});

test("supports height-only icon sizing while preserving aspect ratio", () => {
  const xml = `<mxCell id="n1" value="Worker" style="synthIcon=lib.worker;synthIconHeight=100;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, ICON_ROWS);

  assert.match(result.xml, /width="125" height="100"/);
  assert.doesNotMatch(result.xml, /synthIconHeight/);
});

test("supports icon size presets and explicit scale controls", () => {
  const xml = [
    `<mxCell id="hero" value="Database" style="synthIcon=lib.database;synthIconSize=hero;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`,
    `<mxCell id="scaled" value="Worker" style="synthIcon=lib.worker;synthIconScale=2;" vertex="1" parent="1"><mxGeometry x="180" y="20" width="80" height="40" as="geometry" /></mxCell>`,
  ].join("");

  const result = applyIconRowsToXml(xml, ICON_ROWS);

  assert.match(result.xml, /id="hero"[\s\S]*?width="119" height="85"/);
  assert.match(result.xml, /id="scaled"[\s\S]*?width="100" height="80"/);
  assert.doesNotMatch(result.xml, /synthIconSize|synthIconScale/);
});

test("auto-applies candidate icons to matching vertex labels with native sizing", () => {
  const xml = `<mxCell id="n1" value="Database" style="rounded=1;fillColor=#fff;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell><mxCell id="n2" value="Worker service" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="180" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, ICON_ROWS, {
    candidateIds: ["lib.database", "lib.worker"],
    targetApplied: 6,
  });

  assert.equal(result.applied.length, 2);
  assert.equal(result.autoApplied.length, 2);
  assert.match(result.xml, /width="70" height="50"/);
  assert.match(result.xml, /width="50" height="40"/);
  assert.doesNotMatch(result.xml, /fillColor=#fff/);
});

test("auto-apply preserves existing non-image library object styles", () => {
  const xml = `<mxCell id="storage" value="Blob Storage" style="shape=mxgraph.azure.storage;html=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="80" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]], {
    candidateIds: ["lib.database"],
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 0);
  assert.match(result.xml, /shape=mxgraph\.azure\.storage/);
  assert.doesNotMatch(result.xml, /shape=image/);
});

test("bounds automatic reuse of the same icon for repeated matching labels", () => {
  const repeatedServices = Array.from(
    { length: 4 },
    (_, index) =>
      `<mxCell id="n${index}" value="Service ${index + 1}" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="${index * 100}" y="20" width="80" height="40" as="geometry" /></mxCell>`,
  ).join("");
  const serviceIcon = {
    id: "lib.service",
    title: "Service",
    search_text: "service app api worker",
    style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
    width: 60,
    height: 44,
  };

  const result = applyIconRowsToXml(repeatedServices, [serviceIcon], {
    candidateIds: ["lib.service"],
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 3);
  assert.equal((result.xml.match(/shape=image/g) || []).length, 3);
});

test("uses the requested target even when there are fewer unique candidates", () => {
  const repeatedServices = Array.from(
    { length: 3 },
    (_, index) =>
      `<mxCell id="svc${index}" value="Service ${index + 1}" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="${index * 100}" y="20" width="80" height="40" as="geometry" /></mxCell>`,
  ).join("");
  const serviceIcon = {
    id: "lib.service",
    title: "Service",
    search_text: "service app api worker",
    style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
    width: 60,
    height: 44,
  };

  const result = applyIconRowsToXml(repeatedServices, [serviceIcon], {
    candidateIds: ["lib.service"],
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 3);
});

test("auto-applies icons for short architecture labels and aliases", () => {
  const xml = [
    `<mxCell id="api" value="API" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="100" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="db" value="DB" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="160" y="20" width="100" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="web" value="Web app" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="300" y="20" width="100" height="50" as="geometry" /></mxCell>`,
  ].join("");
  const rows = [
    {
      id: "lib.gateway",
      title: "Gateway",
      search_text: "gateway api proxy ingress",
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
    {
      id: "lib.application",
      title: "Application",
      search_text: "application app web service",
      style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
      width: 80,
      height: 60,
    },
  ];

  const result = applyIconRowsToXml(xml, rows, {
    candidateIds: rows.map((row) => row.id),
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 3);
  assert.deepEqual(
    result.autoApplied.map((item) => item.id),
    ["lib.gateway", "lib.database", "lib.application"],
  );
});

test("prioritizes preset and general icon terms before long source text", () => {
  const longSource = Array.from({ length: 100 }, (_, index) => `sourceword${index}`).join(
    " ",
  );

  const searchText = buildIconSearchText({
    preset: "timeline",
    title: "Launch plan",
    sourceText: longSource,
  });
  const terms = searchText.split(/\s+/);

  assert(terms.indexOf("calendar") > -1);
  assert(terms.indexOf("milestone") > -1);
  assert(terms.indexOf("calendar") < terms.indexOf("sourceword0"));
  assert(terms.indexOf("milestone") < 60);
});

test("expands icon query terms before catalog lookup", () => {
  const terms = buildIconQueryTerms(
    "Auth service writes files to a blob bucket and runs a serverless job",
  );

  assert(terms.includes("auth"));
  assert(terms.includes("identity"));
  assert(terms.includes("bucket"));
  assert(terms.includes("storage"));
  assert(terms.includes("serverless"));
  assert(terms.includes("function"));
  assert(terms.includes("compute"));
});

test("builds broad OR tsquery for catalog lookup", () => {
  assert.equal(
    buildIconTsQuery(["api", "db", "c#/.net", "api"]),
    "api | db | cnet",
  );
  assert.equal(buildIconTsQuery(["++", "..", "##"]), "");
});

test("builds searchable aliases for common cloud library object names", () => {
  assert.deepEqual(
    ["application", "web", "server"].every((term) =>
      buildObjectAliases({ title: "App Service", provider: "Azure" }).includes(term),
    ),
    true,
  );
  assert.deepEqual(
    ["identity", "auth", "login"].every((term) =>
      buildObjectAliases({ title: "Active Directory", provider: "Azure" }).includes(term),
    ),
    true,
  );
  assert.deepEqual(
    ["serverless", "job", "compute"].every((term) =>
      buildObjectAliases({ title: "Function App", provider: "Azure" }).includes(term),
    ),
    true,
  );
  assert.deepEqual(
    ["queue", "message", "messaging"].every((term) =>
      buildObjectAliases({ title: "Event Hub", provider: "Azure" }).includes(term),
    ),
    true,
  );
});

test("icon prompt describes image and drawio object usage", () => {
  const prompt = buildIconPrompt([
    {
      id: "azure.storage",
      title: "Blob Storage",
      library_name: "Azure General",
      provider: "Azure",
      style_family: "azure-flat",
      width: 80,
      height: 80,
    },
  ]);

  assert.match(prompt, /icon\/object set context/);
  assert.match(prompt, /image icons or draw\.io object\/stencil styles/);
  assert.match(prompt, /synthIcon=<object id>/);
  assert.match(prompt, /exact library style/);
  assert.match(prompt, /synthIconSize=small\|medium\|large\|hero/);
  assert.match(prompt, /azure\.storage: Blob Storage/);
});
