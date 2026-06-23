import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const {
  applyIconRowsToXml,
  autoIconTargetForXml,
  buildIconPrompt,
  buildIconQueryTerms,
  buildIconSearchText,
  buildIconTsQuery,
  buildObjectAliases,
  explicitIconIdsFromXml,
  extractDrawioLibraryObjects,
  selectPromptIconCandidates,
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

function compressedLibraryObject({ id, title, style, width, height }) {
  const xml = `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="${id}" value="${title}" style="${style}" vertex="1" parent="1"><mxGeometry width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`;
  return {
    title,
    w: width,
    h: height,
    xml: zlib.deflateRawSync(encodeURIComponent(xml)).toString("base64"),
  };
}

function compressedGraphModelObject({ title, width, height, xml }) {
  return {
    title,
    w: width,
    h: height,
    xml: zlib.deflateRawSync(encodeURIComponent(xml)).toString("base64"),
  };
}

function mxlibrary(items) {
  return `<mxlibrary>${JSON.stringify(items)}</mxlibrary>`;
}

test("extracts usable objects from uploaded drawio library XML", () => {
  const result = extractDrawioLibraryObjects({
    id: "Azure General",
    name: "Azure General",
    provider: "Azure",
    styleFamily: "azure-flat",
    content: mxlibrary([
      compressedLibraryObject({
        id: "app",
        title: "App Service",
        style: "shape=mxgraph.azure.app_service;html=1;whiteSpace=wrap;",
        width: 80,
        height: 80,
      }),
    ]),
  });

  assert.equal(result.libraryId, "azure-general");
  assert.equal(result.objects.length, 1);
  assert.equal(result.objects[0].id, "azure-general.app-service");
  assert.equal(result.objects[0].library_id, "azure-general");
  assert.equal(result.objects[0].library_name, "Azure General");
  assert.equal(result.objects[0].style, "shape=mxgraph.azure.app_service;html=1;whiteSpace=wrap;");
  assert.match(result.objects[0].cellXml, /mxGraphModel/);
  assert(result.objects[0].search_text.includes("application"));
  assert(result.objects[0].search_text.includes("web"));
  assert.deepEqual(result.duplicatesIgnored, 0);
  assert.deepEqual(result.variantsCreated, 0);
});

test("extracts the best visual vertex from multi-cell drawio library objects", () => {
  const result = extractDrawioLibraryObjects({
    id: "Azure General",
    name: "Azure General",
    provider: "Azure",
    styleFamily: "azure-flat",
    content: mxlibrary([
      compressedGraphModelObject({
        title: "SQL Database Group",
        width: 120,
        height: 100,
        xml: `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="wrapper" value="SQL Database Group" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry width="120" height="100" as="geometry" /></mxCell><mxCell id="icon" value="SQL Database" style="shape=mxgraph.azure.sql_database;html=1;whiteSpace=wrap;" vertex="1" parent="wrapper"><mxGeometry x="20" y="20" width="80" height="80" as="geometry" /></mxCell></root></mxGraphModel>`,
      }),
    ]),
  });

  assert.equal(result.objects.length, 1);
  assert.equal(
    result.objects[0].style,
    "shape=mxgraph.azure.sql_database;html=1;whiteSpace=wrap;",
  );
});

test("replaces synthIcon placeholders, strips synthIcon keys, and preserves telemetry", () => {
  const xml = `<mxCell id="n1" value="Database" style="rounded=1;synthIcon=lib.database;synthIconWidth=140;fillColor=#fff;strokeColor=#000;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell><mxCell id="n2" value="Missing" style="synthIcon=missing.icon;synthIconSize=hero;fillColor=#fff;" vertex="1" parent="1"><mxGeometry x="180" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);

  assert.match(result.xml, /shape=image/);
  assert.match(result.xml, /width="140" height="100"/);
  assert.match(result.xml, /fontSize=12/);
  assert.match(result.xml, /fontColor=#0f172a/);
  assert.match(result.xml, /spacingTop=6/);
  assert.match(result.xml, /id="n2"[\s\S]*?fillColor=#fff/);
  assert.doesNotMatch(result.xml, /synthIcon/);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.deepEqual(result.missing, ["missing.icon"]);
  assert.deepEqual(result.autoApplied, []);
});

test("accepts spaced and mixed-case synthIcon style entries from model output", () => {
  const xml = `<mxCell id="n1" value="Database" style="rounded=1; synthicon = lib.database ; SynthIconSize = hero ;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);

  assert.deepEqual(explicitIconIdsFromXml(xml), ["lib.database"]);
  assert.match(result.xml, /shape=image/);
  assert.match(result.xml, /width="119" height="85"/);
  assert.doesNotMatch(result.xml, /synthicon/i);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
});

test("handles single-quoted XML attributes without duplicating rewritten attributes", () => {
  const xml = `<mxCell id='n1' value='Database' style='rounded=1;synthIcon=lib.database;synthIconWidth=140;' vertex='1' parent='1'><mxGeometry x='20' y='20' width='80' height='40' as='geometry' /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);
  const cell = result.xml.match(/<mxCell id='n1'[\s\S]*?<\/mxCell>/)?.[0] || "";

  assert.deepEqual(explicitIconIdsFromXml(xml), ["lib.database"]);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.match(cell, /style="[^"]*shape=image/);
  assert.match(cell, /width="140" height="100"/);
  assert.doesNotMatch(cell, /\sstyle='/);
  assert.doesNotMatch(cell, /\swidth='80'/);
  assert.doesNotMatch(cell, /\sheight='40'/);
});

test("handles mixed-case XML attribute names in icon placeholders and geometry", () => {
  const xml = `<mxCell ID='n1' Value='Database' Style='rounded=1;synthIcon=lib.database;synthIconWidth=140;' Vertex='1' Parent='1'><mxGeometry X='20' Y='20' Width='80' Height='40' As='geometry' /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);
  const cell = result.xml.match(/<mxCell ID='n1'[\s\S]*?<\/mxCell>/)?.[0] || "";

  assert.deepEqual(explicitIconIdsFromXml(xml), ["lib.database"]);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.match(cell, /style="[^"]*shape=image/);
  assert.match(cell, /width="140" height="100"/);
  assert.doesNotMatch(cell, /\sStyle=/);
  assert.doesNotMatch(cell, /\sWidth='80'/);
  assert.doesNotMatch(cell, /\sHeight='40'/);
});

test("strips mixed-case style conflicts when applying exact library icons", () => {
  const xml = `<mxCell id="n1" value="Database" style="synthIcon=lib.database;Shape=rhombus;FillColor=#ffffff;StrokeColor=#111111;StrokeWidth=8;GradientColor=#eeeeee;Image=data:image/png;base64,wrong;Opacity=20;Shadow=1;Rotation=90;FlipH=1;ImageWidth=200;ImageHeight=40;ImageBackground=#fff;ImageBorder=#000;Perimeter=ellipsePerimeter;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);
  const cell = result.xml.match(/<mxCell id="n1"[\s\S]*?<\/mxCell>/)?.[0] || "";

  assert.match(cell, /shape=image/);
  assert.match(cell, /image=data:image\/png;base64,database/);
  assert.doesNotMatch(cell, /Shape=rhombus/);
  assert.doesNotMatch(cell, /FillColor=#ffffff/);
  assert.doesNotMatch(cell, /StrokeColor=#111111/);
  assert.doesNotMatch(cell, /StrokeWidth=8/);
  assert.doesNotMatch(cell, /GradientColor=#eeeeee/);
  assert.doesNotMatch(cell, /Opacity=20/);
  assert.doesNotMatch(cell, /Shadow=1/);
  assert.doesNotMatch(cell, /Rotation=90/);
  assert.doesNotMatch(cell, /FlipH=1/);
  assert.doesNotMatch(cell, /ImageWidth=200/);
  assert.doesNotMatch(cell, /ImageHeight=40/);
  assert.doesNotMatch(cell, /ImageBackground=#fff/);
  assert.doesNotMatch(cell, /ImageBorder=#000/);
  assert.doesNotMatch(cell, /Perimeter=ellipsePerimeter/);
  assert.doesNotMatch(cell, /wrong/);
});

test("resolves explicit synthIcon references by normalized title or id", () => {
  const xml = [
    `<mxCell id="titleRef" value="Database" style="synthIcon=Database;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`,
    `<mxCell id="idRef" value="Worker" style="synthIcon=LIB WORKER;" vertex="1" parent="1"><mxGeometry x="160" y="20" width="80" height="40" as="geometry" /></mxCell>`,
    `<mxCell id="missing" value="Missing" style="synthIcon=Not A Real Icon;" vertex="1" parent="1"><mxGeometry x="300" y="20" width="80" height="40" as="geometry" /></mxCell>`,
  ].join("");

  const result = applyIconRowsToXml(xml, ICON_ROWS, {
    candidateIds: ICON_ROWS.map((row) => row.id),
  });

  assert.deepEqual(result.applied, [
    { id: "lib.database", title: "Database" },
    { id: "lib.worker", title: "Worker" },
  ]);
  assert.deepEqual(result.missing, ["Not A Real Icon"]);
  assert.match(result.xml, /id="titleRef"[\s\S]*shape=image/);
  assert.match(result.xml, /id="idRef"[\s\S]*shape=image/);
  assert.doesNotMatch(result.xml, /Not A Real Icon/);
});

test("preserves requested label styling when adding icon label defaults", () => {
  const xml = `<mxCell id="n1" value="Database" style="synthIcon=lib.database;fontSize=16;fontColor=#ff0000;align=left;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);
  const cell = result.xml.match(/<mxCell id="n1"[\s\S]*?<\/mxCell>/)?.[0] || "";

  assert.match(cell, /shape=image/);
  assert.match(cell, /fontSize=16/);
  assert.match(cell, /fontColor=#ff0000/);
  assert.match(cell, /align=left/);
  assert.doesNotMatch(cell, /fontSize=12/);
  assert.doesNotMatch(cell, /fontColor=#0f172a/);
});

test("does not duplicate label defaults when requested style key casing varies", () => {
  const xml = `<mxCell id="n1" value="Database" style="synthIcon=lib.database;FontSize=16;FontColor=#ff0000;Align=left;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`;

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]]);
  const cell = result.xml.match(/<mxCell id="n1"[\s\S]*?<\/mxCell>/)?.[0] || "";

  assert.match(cell, /shape=image/);
  assert.match(cell, /FontSize=16/);
  assert.match(cell, /FontColor=#ff0000/);
  assert.match(cell, /Align=left/);
  assert.doesNotMatch(cell, /fontSize=12/);
  assert.doesNotMatch(cell, /fontColor=#0f172a/);
  assert.doesNotMatch(cell, /align=center/);
});

test("explicit synthIcon placeholders are not counted as auto-eligible", () => {
  const xml = [
    `<mxCell id="explicit" value="Database" style="synthIcon=lib.database;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry" /></mxCell>`,
    `<mxCell id="auto" value="Worker service" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="160" y="20" width="80" height="40" as="geometry" /></mxCell>`,
  ].join("");

  const result = applyIconRowsToXml(xml, ICON_ROWS, {
    candidateIds: ICON_ROWS.map((row) => row.id),
  });

  assert.equal(result.applied.length, 1);
  assert.equal(result.autoApplied.length, 0);
  assert.equal(result.autoEligible, 1);
  assert.equal(result.autoTarget, 0);
  assert.equal(result.autoSkipped.explicit_placeholder, 1);
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
  assert.equal(result.autoEligible, 2);
  assert.equal(result.autoTarget, 6);
  assert.equal(result.autoCandidateCount, 2);
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

test("auto-apply recognizes mixed-case existing library and container styles", () => {
  const xml = [
    `<mxCell id="storage" value="Blob Storage" style="Shape=mxgraph.azure.storage;html=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="80" as="geometry" /></mxCell>`,
    `<mxCell id="lane" value="Application team" style="Shape=swimlane;rounded=1;" vertex="1" parent="1"><mxGeometry x="140" y="20" width="240" height="140" as="geometry" /></mxCell>`,
    `<mxCell id="db" value="Customer DB" style="" vertex="1" parent="1"><mxGeometry x="420" y="20" width="120" height="50" as="geometry" /></mxCell>`,
  ].join("");

  const result = applyIconRowsToXml(xml, [ICON_ROWS[0]], {
    candidateIds: ["lib.database"],
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 1);
  assert.equal(result.autoEligible, 1);
  assert.equal(result.autoSkipped.library_object, 1);
  assert.equal(result.autoSkipped.container_style, 1);
  assert.match(result.xml, /id="storage"[^>]*Shape=mxgraph\.azure\.storage/);
  assert.match(result.xml, /id="lane"[^>]*Shape=swimlane/);
  assert.doesNotMatch(
    result.xml.match(/<mxCell id="storage"[\s\S]*?<\/mxCell>/)?.[0] || "",
    /shape=image/,
  );
  assert.match(result.xml, /id="db"[\s\S]*shape=image/);
});

test("targeted auto-apply preserves container vertices that own child cells", () => {
  const xml = [
    `<mxCell id="group" value="Application team" style="swimlane=1;shape=swimlane;rounded=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="360" height="180" as="geometry" /></mxCell>`,
    `<mxCell id="service" value="Backend service" style="rounded=1;" vertex="1" parent="group"><mxGeometry x="40" y="80" width="120" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="frontend" value="Frontend application" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="420" y="80" width="120" height="50" as="geometry" /></mxCell>`,
  ].join("");
  const rows = [
    {
      id: "lib.application",
      title: "Application",
      search_text: "application app frontend team",
      style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
      width: 80,
      height: 60,
    },
    {
      id: "lib.service",
      title: "Service",
      search_text: "service backend api",
      style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
      width: 64,
      height: 48,
    },
  ];

  assert.equal(autoIconTargetForXml(xml), 0);
  const result = applyIconRowsToXml(xml, rows, {
    candidateIds: rows.map((row) => row.id),
    targetApplied: 2,
  });

  assert.equal(result.autoApplied.length, 2);
  assert.equal(result.autoEligible, 2);
  assert.equal(result.autoSkipped.parent_vertex, 1);
  assert.match(result.xml, /id="group"[^>]*shape=swimlane/);
  assert.doesNotMatch(
    result.xml.match(/<mxCell id="group"[\s\S]*?<\/mxCell>/)?.[0] || "",
    /shape=image/,
  );
  assert.match(result.xml, /id="service"[\s\S]*shape=image/);
  assert.match(result.xml, /id="frontend"[\s\S]*shape=image/);
});

test("explicit synthIcon can still replace a parent container", () => {
  const xml = [
    `<mxCell id="group" value="Application team" style="shape=swimlane;synthIcon=lib.application;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="360" height="180" as="geometry" /></mxCell>`,
    `<mxCell id="service" value="Backend service" style="rounded=1;" vertex="1" parent="group"><mxGeometry x="40" y="80" width="120" height="50" as="geometry" /></mxCell>`,
  ].join("");
  const icon = {
    id: "lib.application",
    title: "Application",
    search_text: "application app frontend team",
    style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
    width: 80,
    height: 60,
  };

  const result = applyIconRowsToXml(xml, [icon], {
    candidateIds: ["lib.application"],
  });

  assert.deepEqual(result.applied, [{ id: "lib.application", title: "Application" }]);
  assert.equal(result.autoApplied.length, 0);
  assert.match(result.xml, /id="group"[\s\S]*shape=image/);
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

test("defaults the automatic icon target to zero for larger diagrams", () => {
  const labels = [
    "Frontend application",
    "Backend service",
    "Customer database",
    "Event queue",
    "File storage",
    "Admin application",
    "API service",
    "Analytics database",
    "Message queue",
    "Document storage",
    "Mobile application",
    "Worker service",
  ];
  const xml = labels
    .map(
      (label, index) =>
        `<mxCell id="n${index}" value="${label}" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="${index * 120}" y="20" width="100" height="50" as="geometry" /></mxCell>`,
    )
    .join("");
  const rows = [
    {
      id: "lib.application",
      title: "Application",
      search_text: "application app frontend mobile",
      style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
      width: 80,
      height: 60,
    },
    {
      id: "lib.service",
      title: "Service",
      search_text: "service backend api worker",
      style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
      width: 64,
      height: 48,
    },
    {
      id: "lib.database",
      title: "Database",
      search_text: "database db sql analytics customer",
      style: "shape=image;image=data:image/png;base64,database;aspect=fixed;",
      width: 70,
      height: 50,
    },
    {
      id: "lib.queue",
      title: "Queue",
      search_text: "queue event message",
      style: "shape=image;image=data:image/png;base64,queue;aspect=fixed;",
      width: 70,
      height: 50,
    },
    {
      id: "lib.storage",
      title: "Storage",
      search_text: "storage file document",
      style: "shape=image;image=data:image/png;base64,storage;aspect=fixed;",
      width: 70,
      height: 50,
    },
  ];

  assert.equal(autoIconTargetForXml(xml), 0);
  const result = applyIconRowsToXml(xml, rows, {
    candidateIds: rows.map((row) => row.id),
    targetApplied: 8,
  });

  assert.equal(result.autoApplied.length, 8);
  assert.equal(result.autoEligible, 12);
  assert.equal(result.autoTarget, 8);
  assert.equal(result.autoCandidateCount, 5);
  assert.equal((result.xml.match(/shape=image/g) || []).length, 8);
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

test("auto-applies icons for common product and cloud vocabulary", () => {
  const xml = [
    `<mxCell id="frontend" value="React frontend" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="120" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="backend" value="Node backend" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="160" y="20" width="120" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="db" value="Postgres" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="300" y="20" width="120" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="files" value="S3 files" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="440" y="20" width="120" height="50" as="geometry" /></mxCell>`,
    `<mxCell id="events" value="Webhook events" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="580" y="20" width="120" height="50" as="geometry" /></mxCell>`,
  ].join("");
  const rows = [
    {
      id: "lib.application",
      title: "Application",
      search_text: "application app web client frontend",
      style: "shape=image;image=data:image/png;base64,application;aspect=fixed;",
      width: 80,
      height: 60,
    },
    {
      id: "lib.service",
      title: "Service",
      search_text: "service server api backend compute",
      style: "shape=image;image=data:image/png;base64,service;aspect=fixed;",
      width: 64,
      height: 48,
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
      id: "lib.storage",
      title: "Storage",
      search_text: "storage bucket file document",
      style: "shape=image;image=data:image/png;base64,storage;aspect=fixed;",
      width: 70,
      height: 50,
    },
    {
      id: "lib.queue",
      title: "Queue",
      search_text: "queue event message messaging",
      style: "shape=image;image=data:image/png;base64,queue;aspect=fixed;",
      width: 70,
      height: 50,
    },
  ];

  const result = applyIconRowsToXml(xml, rows, {
    candidateIds: rows.map((row) => row.id),
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 5);
  assert.deepEqual(
    result.autoApplied.map((item) => item.id),
    [
      "lib.application",
      "lib.service",
      "lib.database",
      "lib.storage",
      "lib.queue",
    ],
  );
});

test("auto-apply prefers specific raw label matches over generic aliases", () => {
  const xml = `<mxCell id="files" value="S3 files" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="120" height="50" as="geometry" /></mxCell>`;
  const rows = [
    {
      id: "lib.storage",
      title: "Storage",
      search_text: "storage bucket file document",
      style: "shape=image;image=data:image/png;base64,storage;aspect=fixed;",
      width: 70,
      height: 50,
    },
    {
      id: "aws.s3-bucket",
      title: "S3 Bucket",
      search_text: "s3 bucket storage file object",
      style: "shape=image;image=data:image/png;base64,s3;aspect=fixed;",
      width: 70,
      height: 50,
    },
  ];

  const result = applyIconRowsToXml(xml, rows, {
    candidateIds: rows.map((row) => row.id),
    targetApplied: 6,
  });

  assert.equal(result.autoApplied.length, 1);
  assert.equal(result.autoApplied[0].id, "aws.s3-bucket");
  assert.match(result.xml, /image=data:image\/png;base64,s3/);
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

test("selects prompt icon candidates with title diversity", () => {
  const rows = [
    {
      id: "azure.service-v1",
      library_id: "azure",
      title: "Service",
      score: 90,
    },
    {
      id: "azure.service-v2",
      library_id: "azure",
      title: "Service",
      score: 89,
    },
    {
      id: "azure.service-v3",
      library_id: "azure",
      title: "Service",
      score: 88,
    },
    {
      id: "azure.database",
      library_id: "azure",
      title: "Database",
      score: 70,
    },
    {
      id: "azure.queue",
      library_id: "azure",
      title: "Queue",
      score: 65,
    },
    {
      id: "aws.service",
      library_id: "aws",
      title: "Service",
      score: 40,
    },
  ];

  const selected = selectPromptIconCandidates(rows, 4);

  assert.deepEqual(
    selected.map((row) => row.id),
    ["azure.service-v1", "azure.service-v2", "azure.database", "azure.queue"],
  );
});

test("expands icon query terms before catalog lookup", () => {
  const terms = buildIconQueryTerms(
    "Auth service writes files to a blob bucket, React frontend, Postgres, S3 files, webhook events, and serverless job",
  );

  assert(terms.includes("auth"));
  assert(terms.includes("identity"));
  assert(terms.includes("bucket"));
  assert(terms.includes("storage"));
  assert(terms.includes("frontend"));
  assert(terms.includes("application"));
  assert(terms.includes("postgres"));
  assert(terms.includes("database"));
  assert(terms.includes("s3"));
  assert(terms.includes("webhook"));
  assert(terms.includes("queue"));
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

test("icon prompt keeps library object usage optional and sparse", () => {
  const prompt = buildIconPrompt([
    {
      id: "azure.storage",
      title: "Blob Storage",
      library_name: "Azure General",
      provider: "Azure",
      style_family: "azure-flat",
      search_text: "Blob Storage Azure General azure-flat storage bucket file document",
      width: 80,
      height: 80,
    },
  ]);

  assert.match(prompt, /Optional draw\.io icon\/object context/);
  assert.match(prompt, /Prefer standard draw\.io shapes first/);
  assert.match(prompt, /Target 0-2 library-decorated vertices/);
  assert.match(prompt, /Do not decorate ordinary services/);
  assert.match(prompt, /image icons or draw\.io object\/stencil styles/);
  assert.match(prompt, /synthIcon=<object id>/);
  assert.match(prompt, /exact library style/);
  assert.match(prompt, /synthIconSize=small\|medium\|large\|hero/);
  assert.match(prompt, /azure\.storage: Blob Storage .*matches bucket\/file\/document/);
});
