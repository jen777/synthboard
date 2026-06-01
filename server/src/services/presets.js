// Visualization presets. Each preset maps to tailored guidance that is
// appended to the (cacheable) base system prompt before generation.

export const PRESETS = {
  diagram: {
    label: "Flow Diagram",
    description: "Boxes-and-arrows flowchart of steps, decisions, and flow.",
    guidance: `Produce a FLOWCHART.
- Use rounded rectangles for actions/steps, diamonds (rhombus) for decisions, and ellipses for start/end.
- Connect nodes with directed edges; label decision branches (e.g. "Yes"/"No").
- Lay out top-to-bottom or left-to-right with clear, non-overlapping spacing.`,
  },

  uml: {
    label: "UML Class Diagram",
    description: "Classes with attributes, methods, and relationships.",
    guidance: `Produce a UML CLASS DIAGRAM.
- Represent each class as a container with three compartments: name, attributes, methods.
- Use proper UML notation: +/- for visibility, association/inheritance/composition edges with the correct arrowheads.
- Use the mxgraph UML shape styles where appropriate (e.g. swimlane for classes).`,
  },

  sequence: {
    label: "UML Sequence Diagram",
    description: "Actors/objects exchanging messages over time.",
    guidance: `Produce a UML SEQUENCE DIAGRAM.
- Place lifelines (actors/objects) across the top, each with a vertical dashed lifeline.
- Show messages as horizontal arrows between lifelines, ordered top-to-bottom in time.
- Use solid arrows for calls and dashed arrows for returns.`,
  },

  er: {
    label: "Entity-Relationship Diagram",
    description: "Database entities, attributes, and relationships.",
    guidance: `Produce an ENTITY-RELATIONSHIP DIAGRAM.
- Represent each entity as a table-style node listing its key and non-key attributes.
- Connect entities with relationship edges and show cardinality (1:1, 1:N, M:N).`,
  },

  mindmap: {
    label: "Mind Map",
    description: "Central topic radiating into branches and sub-branches.",
    guidance: `Produce a MIND MAP.
- Place the central concept in the middle.
- Radiate primary branches outward, each with sub-branches.
- Use color to distinguish branches; keep labels short.`,
  },

  infographic: {
    label: "Infographic",
    description: "Visually rich summary with stats, icons, and sections.",
    guidance: `Produce an INFOGRAPHIC-style layout.
- Organize the content into visually distinct, titled sections/cards.
- Emphasize key numbers/stats with large text and use color blocks and simple shapes as accents.
- Aim for a clean, modern, presentation-ready look rather than a strict node graph.`,
  },
};

export function isValidPreset(preset) {
  return Object.prototype.hasOwnProperty.call(PRESETS, preset);
}

export function listPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    label: p.label,
    description: p.description,
  }));
}
