import { readFileSync } from "node:fs";

const GUIDE_ROOT = new URL("../prompts/drawio/", import.meta.url);
const guideCache = new Map();

const PRESET_GUIDE_FILES = {
  diagram: "flowchart.md",
  uml: "uml-class.md",
  sequence: "uml-sequence.md",
  er: "entity-relationship.md",
  mindmap: "mind-map.md",
  infographic: "infographic.md",
  orgchart: "org-chart.md",
  timeline: "timeline.md",
  swimlane: "swimlane.md",
  architecture: "architecture.md",
  state: "state-machine.md",
  venn: "venn.md",
  fishbone: "fishbone.md",
  kanban: "kanban.md",
};

const PRESET_BY_LABEL = {
  "Flow Diagram": "diagram",
  "UML Class Diagram": "uml",
  "UML Sequence Diagram": "sequence",
  "Entity-Relationship Diagram": "er",
  "Mind Map": "mindmap",
  Infographic: "infographic",
  "Org Chart": "orgchart",
  Timeline: "timeline",
  "Swimlane Diagram": "swimlane",
  "System Architecture": "architecture",
  "State Machine": "state",
  "Venn Diagram": "venn",
  "Fishbone (Cause & Effect)": "fishbone",
  "Kanban Board": "kanban",
};

const STAGE_HEADINGS = {
  planning: "Planning",
  xml: "XML generation",
};

function readGuide(relativePath) {
  if (!guideCache.has(relativePath)) {
    guideCache.set(
      relativePath,
      readFileSync(new URL(relativePath, GUIDE_ROOT), "utf8").trim(),
    );
  }
  return guideCache.get(relativePath);
}

function sectionFromGuide(markdown, heading) {
  const lines = String(markdown || "").split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase(),
  );
  if (start < 0) return "";
  const section = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    section.push(line);
  }
  return section.join("\n").trim();
}

export function resolveDiagramGuidePreset({ preset, presetDef } = {}) {
  if (preset && PRESET_GUIDE_FILES[preset]) return preset;
  return PRESET_BY_LABEL[presetDef?.label] || "diagram";
}

export function buildDiagramPromptGuide({ preset, presetDef, stage }) {
  const heading = STAGE_HEADINGS[stage];
  if (!heading) throw new Error(`Unknown diagram prompt guide stage: ${stage}`);

  const resolvedPreset = resolveDiagramGuidePreset({ preset, presetDef });
  const common = readGuide(`common-${stage}.md`);
  const typeGuide = readGuide(`types/${PRESET_GUIDE_FILES[resolvedPreset]}`);
  const typeSection = sectionFromGuide(typeGuide, heading);
  if (!typeSection) {
    throw new Error(`Missing ${heading} section for diagram preset ${resolvedPreset}`);
  }

  return `Shared draw.io ${stage} guide:\n${common}\n\n${presetDef?.label || resolvedPreset} guide:\n${typeSection}`;
}

export const DIAGRAM_GUIDE_PRESETS = Object.freeze(
  Object.keys(PRESET_GUIDE_FILES),
);
