import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_test";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.NVIDIA_API_KEY ||= "test-nvidia-api-key";

const { applyIconRowsToXml, buildIconSearchText } = await import(
  "./drawioLibraries.js"
);

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
  assert.doesNotMatch(result.xml, /synthIcon/);
  assert.deepEqual(result.applied, [{ id: "lib.database", title: "Database" }]);
  assert.deepEqual(result.missing, ["missing.icon"]);
  assert.deepEqual(result.autoApplied, []);
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
