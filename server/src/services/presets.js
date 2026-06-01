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

  orgchart: {
    label: "Org Chart",
    description: "Hierarchy of people, roles, or teams.",
    guidance: `Produce an ORGANIZATIONAL CHART.
- Place the top role/person at the top and branch reports downward in a tree.
- Use one labeled box per person/role (name + title where available).
- Connect each manager to their direct reports with vertical/elbow edges; keep siblings aligned.`,
  },

  timeline: {
    label: "Timeline",
    description: "Chronological sequence of events or milestones.",
    guidance: `Produce a TIMELINE.
- Draw a single horizontal (or vertical) axis with events placed in chronological order.
- Mark each event with a node/marker and a short dated label.
- Alternate labels above/below the axis if needed to avoid overlap; keep spacing proportional where possible.`,
  },

  swimlane: {
    label: "Swimlane Diagram",
    description: "Cross-functional process split by role or department.",
    guidance: `Produce a CROSS-FUNCTIONAL (SWIMLANE) FLOWCHART.
- Create one horizontal lane per actor/role/department using mxgraph swimlane shapes.
- Place each step inside the lane of the responsible party and connect steps with directed edges across lanes.
- Use diamonds for decisions and label branches.`,
  },

  architecture: {
    label: "System Architecture",
    description: "Components, services, and how they connect.",
    guidance: `Produce a SYSTEM / NETWORK ARCHITECTURE DIAGRAM.
- Represent services, datastores, queues, and external systems as labeled boxes (use distinct shapes/colors per type: e.g. cylinders for databases).
- Group related components inside container/boundary boxes (e.g. "Frontend", "Backend", "Cloud").
- Connect components with directed edges labeled with the protocol/data where relevant (HTTP, gRPC, events).`,
  },

  state: {
    label: "State Machine",
    description: "States and the transitions between them.",
    guidance: `Produce a UML STATE MACHINE DIAGRAM.
- Use rounded rectangles for states; a filled circle for the initial state and a filled circle with a ring for the final state.
- Connect states with directed transition edges labeled by the triggering event/condition.
- Keep the layout readable with minimal edge crossings.`,
  },

  venn: {
    label: "Venn Diagram",
    description: "Overlapping sets showing shared and unique items.",
    guidance: `Produce a VENN DIAGRAM.
- Use 2 or 3 large semi-transparent overlapping ellipses, each a labeled set.
- Place items unique to a set in its non-overlapping region and shared items in the overlap regions.
- Choose distinct fill colors with transparency so overlaps blend visibly.`,
  },

  fishbone: {
    label: "Fishbone (Cause & Effect)",
    description: "Ishikawa diagram of causes leading to an effect.",
    guidance: `Produce a FISHBONE (ISHIKAWA) DIAGRAM.
- Draw a horizontal spine pointing to the effect/problem box on the right.
- Add diagonal branches off the spine for major cause categories, with sub-causes as smaller branches off each.
- Label every branch concisely.`,
  },

  kanban: {
    label: "Kanban Board",
    description: "Tasks organized into status columns.",
    guidance: `Produce a KANBAN BOARD.
- Create vertical columns for the workflow stages (e.g. "To Do", "In Progress", "Done", adapting to the source).
- Use a swimlane/container per column with task cards (small rounded rectangles) stacked inside.
- Keep cards concise; color-code by category/priority if the source implies it.`,
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
