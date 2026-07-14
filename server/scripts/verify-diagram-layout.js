#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/synthboard_verify";
process.env.SESSION_SECRET ||= "verify-session-secret";
process.env.GOOGLE_CLIENT_ID ||= "verify-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "verify-google-client-secret";
process.env.NVIDIA_API_KEY ||= "verify-nvidia-api-key";

const { parseDiagramPlan, postProcessDrawioXml } = await import(
  "../src/services/llm.js"
);

const CASES = [
  {
    preset: "architecture",
    layout: "left-to-right",
    objects: [
      ["cloud", "Application platform", "group", "large", ""],
      ["web", "Web application", "process", "medium", "cloud"],
      ["backend", "Backend services", "group", "large", "cloud"],
      ["api", "API service", "process", "medium", "backend"],
      ["worker", "Background worker", "process", "medium", "backend"],
      ["db", "Orders database", "cylinder", "medium", ""],
    ],
    connectors: [
      ["web", "api", "HTTPS"],
      ["api", "worker", "Jobs"],
      ["worker", "db", "Writes"],
    ],
  },
  {
    preset: "diagram",
    layout: "top-to-bottom",
    objects: [
      ["start", "Request received", "ellipse", "small", ""],
      ["validate", "Validate request", "process", "medium", ""],
      ["decision", "Request valid?", "rhombus", "medium", ""],
      ["process", "Process request", "process", "medium", ""],
      ["reject", "Return validation error", "process", "medium", ""],
      ["end", "Complete", "ellipse", "small", ""],
    ],
    connectors: [
      ["start", "validate", ""],
      ["validate", "decision", ""],
      ["decision", "process", "Yes"],
      ["decision", "reject", "No"],
      ["process", "end", ""],
    ],
  },
  {
    preset: "orgchart",
    layout: "top-to-bottom",
    objects: [
      ["ceo", "Chief Executive Officer", "process", "large", ""],
      ["product", "VP Product", "process", "medium", ""],
      ["engineering", "VP Engineering", "process", "medium", ""],
      ["operations", "VP Operations", "process", "medium", ""],
      ["design", "Design Director", "process", "small", ""],
      ["platform", "Platform Director", "process", "small", ""],
    ],
    connectors: [
      ["ceo", "product", ""],
      ["ceo", "engineering", ""],
      ["ceo", "operations", ""],
      ["product", "design", ""],
      ["engineering", "platform", ""],
    ],
  },
  {
    preset: "timeline",
    layout: "left-to-right",
    objects: [
      ["discover", "Q1 · Discovery", "ellipse", "medium", ""],
      ["prototype", "Q2 · Prototype", "ellipse", "medium", ""],
      ["pilot", "Q3 · Pilot", "ellipse", "medium", ""],
      ["launch", "Q4 · Launch", "ellipse", "medium", ""],
    ],
    connectors: [
      ["discover", "prototype", ""],
      ["prototype", "pilot", ""],
      ["pilot", "launch", ""],
    ],
  },
  {
    preset: "mindmap",
    layout: "radial",
    objects: [
      ["center", "Customer experience", "ellipse", "hero", ""],
      ["research", "Research", "process", "medium", ""],
      ["design", "Design", "process", "medium", ""],
      ["delivery", "Delivery", "process", "medium", ""],
      ["support", "Support", "process", "medium", ""],
      ["measure", "Measurement", "process", "medium", ""],
    ],
    connectors: [
      ["center", "research", ""],
      ["center", "design", ""],
      ["center", "delivery", ""],
      ["center", "support", ""],
      ["center", "measure", ""],
    ],
  },
  {
    preset: "swimlane",
    layout: "swimlane",
    objects: [
      ["customer", "Customer", "swimlane", "large", ""],
      ["submit", "Submit request", "process", "medium", "customer"],
      ["confirm", "Review confirmation", "process", "medium", "customer"],
      ["operations", "Operations", "swimlane", "large", ""],
      ["review", "Review request", "process", "medium", "operations"],
      ["approve", "Approve request", "rhombus", "medium", "operations"],
    ],
    connectors: [
      ["submit", "review", ""],
      ["review", "approve", ""],
      ["approve", "confirm", "Approved"],
    ],
  },
  {
    preset: "sequence",
    layout: "left-to-right",
    objects: [
      ["user", "User", "actor", "medium", ""],
      ["web", "Web app", "process", "medium", ""],
      ["api", "API", "process", "medium", ""],
      ["db", "Database", "cylinder", "medium", ""],
    ],
    connectors: [
      ["user", "web", "Submit"],
      ["web", "api", "POST /orders"],
      ["api", "db", "INSERT"],
      ["db", "api", "Order id"],
    ],
  },
  {
    preset: "uml",
    layout: "grid",
    objects: [
      ["order", "Order<br>+ id: UUID<br>+ total: Money<br>+ submit(): void", "swimlane", "medium", ""],
      ["customer", "Customer<br>+ id: UUID<br>+ email: string<br>+ placeOrder(): Order", "swimlane", "medium", ""],
      ["payment", "Payment<br>+ id: UUID<br>+ status: string<br>+ capture(): void", "swimlane", "medium", ""],
    ],
    connectors: [
      ["customer", "order", "places"],
      ["order", "payment", "paid by"],
    ],
  },
  {
    preset: "er",
    layout: "grid",
    objects: [
      ["users", "users<br>PK id<br>email<br>created_at", "swimlane", "medium", ""],
      ["orders", "orders<br>PK id<br>FK user_id<br>total", "swimlane", "medium", ""],
      ["items", "order_items<br>PK id<br>FK order_id<br>quantity", "swimlane", "medium", ""],
    ],
    connectors: [
      ["users", "orders", "1:N"],
      ["orders", "items", "1:N"],
    ],
  },
  {
    preset: "infographic",
    layout: "grid",
    objects: [
      ["headline", "Customer outcomes", "process", "hero", ""],
      ["adoption", "82% adoption", "ellipse", "large", ""],
      ["speed", "2.4× faster", "ellipse", "large", ""],
      ["quality", "35% fewer errors", "ellipse", "large", ""],
      ["summary", "Standardized workflows improve speed and quality", "document", "medium", ""],
    ],
    connectors: [],
  },
  {
    preset: "state",
    layout: "left-to-right",
    objects: [
      ["initial", "Initial", "ellipse", "small", ""],
      ["draft", "Draft", "process", "medium", ""],
      ["review", "In review", "process", "medium", ""],
      ["approved", "Approved", "process", "medium", ""],
      ["final", "Final", "ellipse", "small", ""],
    ],
    connectors: [
      ["initial", "draft", "create"],
      ["draft", "review", "submit"],
      ["review", "approved", "approve"],
      ["approved", "final", "publish"],
    ],
  },
  {
    preset: "fishbone",
    layout: "left-to-right",
    objects: [
      ["people", "People", "process", "medium", ""],
      ["process", "Process", "process", "medium", ""],
      ["tools", "Tools", "process", "medium", ""],
      ["data", "Data", "process", "medium", ""],
      ["effect", "Delayed delivery", "rhombus", "large", ""],
    ],
    connectors: [
      ["people", "effect", ""],
      ["process", "effect", ""],
      ["tools", "effect", ""],
      ["data", "effect", ""],
    ],
  },
  {
    preset: "kanban",
    layout: "grid",
    objects: [
      ["todo", "To do", "swimlane", "large", ""],
      ["task-a", "Clarify requirements", "process", "small", "todo"],
      ["task-b", "Prepare data", "process", "small", "todo"],
      ["doing", "In progress", "swimlane", "large", ""],
      ["task-c", "Build prototype", "process", "small", "doing"],
      ["done", "Done", "swimlane", "large", ""],
      ["task-d", "Approve scope", "process", "small", "done"],
    ],
    connectors: [],
  },
  {
    preset: "venn",
    layout: "radial",
    objects: [
      ["people", "People", "ellipse", "hero", "", 100, 100, 300, 300],
      ["process", "Process", "ellipse", "hero", "", 300, 100, 300, 300],
      ["technology", "Technology", "ellipse", "hero", "", 200, 270, 300, 300],
    ],
    connectors: [],
  },
];

function casePlan(definition) {
  return {
    title: `${definition.preset} layout verification`,
    summary: "Representative deterministic layout fixture",
    layout: definition.layout,
    objects: definition.objects.map(
      ([key, label, fallbackShape, size, group, x, y, width, height]) => ({
        key,
        label,
        role: fallbackShape,
        visual: "shape",
        fallbackShape,
        size,
        group,
        x,
        y,
        width: width || (size === "hero" ? 280 : size === "large" ? 220 : size === "small" ? 140 : 180),
        height: height || (size === "hero" ? 130 : size === "large" ? 100 : size === "small" ? 60 : 80),
        searchTerms: [label],
      }),
    ),
    connectors: definition.connectors.map(([from, to, label]) => ({
      from,
      to,
      label,
      direction: "forward",
    })),
  };
}

function xmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rawXml(plan) {
  const vertices = plan.objects
    .map(
      (object) =>
        `<mxCell id="${xmlAttr(object.key)}" value="${xmlAttr(object.label)}" style="" vertex="1" parent="${xmlAttr(object.group || "1")}"><mxGeometry x="0" y="0" width="40" height="30" as="geometry" /></mxCell>`,
    )
    .join("");
  const edges = plan.connectors
    .map(
      (connector, index) =>
        `<mxCell id="edge-${index + 1}" value="${xmlAttr(connector.label)}" style="" edge="1" parent="1" source="${xmlAttr(connector.from)}" target="${xmlAttr(connector.to)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    )
    .join("");
  return `<mxfile host="synthboard"><diagram id="${xmlAttr(plan.preset)}" name="${xmlAttr(plan.preset)}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${vertices}${edges}</root></mxGraphModel></diagram></mxfile>`;
}

function isContainer(object, groupKeys) {
  return ["group", "swimlane"].some((value) =>
    object.fallbackShape.toLowerCase().includes(value),
  ) || groupKeys.has(object.key);
}

function isAncestor(ancestor, object, byKey, groupKeys) {
  const seen = new Set();
  let parentKey = object.group;
  while (parentKey && !seen.has(parentKey)) {
    seen.add(parentKey);
    const parent = byKey.get(parentKey);
    if (!parent) return false;
    if (parent.key === ancestor.key && isContainer(parent, groupKeys)) return true;
    parentKey = parent.group;
  }
  return false;
}

function auditPlan(plan) {
  const failures = [];
  const byKey = new Map(plan.objects.map((object) => [object.key, object]));
  const groupKeys = new Set(plan.objects.map((object) => object.group).filter(Boolean));
  const allowOverlap = plan.preset === "venn";

  for (const object of plan.objects) {
    if (![object.x, object.y, object.width, object.height].every(Number.isFinite)) {
      failures.push(`${object.key}: incomplete geometry`);
      continue;
    }
    if ([object.x, object.y, object.width, object.height].some((value) => value % 10 !== 0)) {
      failures.push(`${object.key}: geometry is not on the 10px grid`);
    }
    if (object.x < 60 || object.y < 60) failures.push(`${object.key}: outside margin`);
    if (object.x + object.width > plan.canvas.width - 60) {
      failures.push(`${object.key}: exceeds canvas width`);
    }
    if (object.y + object.height > plan.canvas.height - 60) {
      failures.push(`${object.key}: exceeds canvas height`);
    }
    const parent = byKey.get(object.group);
    if (parent) {
      const contained =
        object.x >= parent.x + 40 &&
        object.y >= parent.y + 60 &&
        object.x + object.width <= parent.x + parent.width - 40 &&
        object.y + object.height <= parent.y + parent.height - 40;
      if (!contained) failures.push(`${object.key}: not padded inside ${parent.key}`);
    }
  }

  for (let index = 0; index < plan.objects.length; index++) {
    const a = plan.objects[index];
    for (let otherIndex = index + 1; otherIndex < plan.objects.length; otherIndex++) {
      const b = plan.objects[otherIndex];
      if (
        isAncestor(a, b, byKey, groupKeys) ||
        isAncestor(b, a, byKey, groupKeys)
      ) {
        continue;
      }
      const overlaps =
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      if (overlaps && !allowOverlap) failures.push(`${a.key}/${b.key}: overlap`);
      if (!allowOverlap && !overlaps) {
        const horizontalOverlap =
          a.x < b.x + b.width && a.x + a.width > b.x;
        const verticalOverlap =
          a.y < b.y + b.height && a.y + a.height > b.y;
        const horizontalGap = Math.max(
          b.x - (a.x + a.width),
          a.x - (b.x + b.width),
        );
        const verticalGap = Math.max(
          b.y - (a.y + a.height),
          a.y - (b.y + b.height),
        );
        if (verticalOverlap && horizontalGap < 70) {
          failures.push(`${a.key}/${b.key}: horizontal gap ${horizontalGap}px`);
        } else if (horizontalOverlap && verticalGap < 70) {
          failures.push(`${a.key}/${b.key}: vertical gap ${verticalGap}px`);
        }
      }
    }
  }

  const sizeFamilies = new Map();
  for (const object of plan.objects) {
    if (isContainer(object, groupKeys) || ["venn", "infographic"].includes(plan.preset)) {
      continue;
    }
    const family = `${object.size}:${object.fallbackShape}`;
    const geometry = `${object.width}x${object.height}`;
    if (sizeFamilies.has(family) && sizeFamilies.get(family) !== geometry) {
      failures.push(`${family}: inconsistent ${sizeFamilies.get(family)} vs ${geometry}`);
    }
    sizeFamilies.set(family, geometry);
  }
  return failures;
}

const outputDir = process.env.DRAWIO_LAYOUT_OUTPUT_DIR || "";
if (outputDir) await mkdir(outputDir, { recursive: true });

const summaries = [];
const failures = [];
for (const definition of CASES) {
  const inputPlan = casePlan(definition);
  const plan = parseDiagramPlan(JSON.stringify(inputPlan), {
    preset: definition.preset,
  });
  const planFailures = auditPlan(plan);
  const processed = await postProcessDrawioXml(rawXml(plan), { diagramPlan: plan });
  if (processed.layout.applied !== plan.objects.length) {
    planFailures.push(
      `geometry applied to ${processed.layout.applied}/${plan.objects.length} objects`,
    );
  }
  if (processed.visualSummary.vertexCount !== plan.objects.length) {
    planFailures.push(
      `visual summary found ${processed.visualSummary.vertexCount}/${plan.objects.length} objects`,
    );
  }
  if (outputDir) {
    await writeFile(
      path.join(outputDir, `${definition.preset}.drawio`),
      processed.xml,
      "utf8",
    );
  }
  summaries.push({
    preset: definition.preset,
    layoutSource: plan.layoutSource,
    objects: plan.objects.length,
    connectors: plan.connectors.length,
    canvas: plan.canvas,
    failures: planFailures,
  });
  failures.push(...planFailures.map((failure) => `${definition.preset}: ${failure}`));
}

console.log(JSON.stringify({ ok: failures.length === 0, summaries, failures }, null, 2));
if (failures.length > 0) process.exit(1);
