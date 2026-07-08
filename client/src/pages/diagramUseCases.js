export const DIAGRAM_USE_CASES = [
  {
    key: "flow",
    slug: "flow-diagram",
    path: "/flow-diagram",
    type: "flow",
    label: "Flow diagram",
    shortLabel: "Flow",
    pageTitle: "Flow Diagram Generator from Text | SynthBoard",
    metaDescription:
      "Turn process notes, workflows, meeting notes, and rough specs into editable flow diagrams for draw.io with SynthBoard.",
    canonical: "https://synthboard.click/flow-diagram",
    pill: "Flow diagram generator",
    h1: "Flow diagram generator for process notes and workflows.",
    lead:
      "Paste plain-language process steps, meeting notes, or rough workflow descriptions. SynthBoard turns them into editable flow diagrams you can refine in draw.io.",
    terms: ["flow diagram generator", "text to flowchart", "process flow diagram"],
    heroFooter: ["Paste steps", "Map decisions", "Edit in draw.io"],
    inputs: [
      {
        graphic: "workflows",
        label: "Process steps",
        text: "Turn a numbered list, SOP, or rough workflow into connected steps and decision points.",
      },
      {
        graphic: "transcripts",
        label: "Meeting notes",
        text: "Extract actions, branches, blockers, and handoffs from notes that are too dense to draw manually.",
      },
      {
        graphic: "notes",
        label: "Product specs",
        text: "Convert feature behavior, approval paths, and exception cases into a practical flow diagram.",
      },
    ],
    outcomes: [
      "Steps and decisions laid out as editable draw.io nodes",
      "Branches, loops, and handoffs visible in the first draft",
      "A flow diagram you can export, share, and keep editing",
    ],
    faqs: [
      {
        question: "Can SynthBoard make a flow diagram from text?",
        answer:
          "Yes. Paste the source process text, choose a flow style, and SynthBoard creates an editable draw.io draft.",
      },
      {
        question: "What source text works best for flow diagrams?",
        answer:
          "Process steps, SOPs, workflow descriptions, meeting notes, and feature specs with decisions or branches work well.",
      },
      {
        question: "Is the flow diagram editable after generation?",
        answer:
          "Yes. The generated diagram is meant to stay editable in the draw.io workflow.",
      },
    ],
  },
  {
    key: "sequence",
    slug: "uml-sequence-diagram",
    path: "/uml-sequence-diagram",
    type: "sequence",
    label: "UML sequence",
    shortLabel: "Sequence",
    pageTitle: "UML Sequence Diagram Generator from Text | SynthBoard",
    metaDescription:
      "Generate editable UML sequence diagrams from specs, API notes, and workflow descriptions, then refine the result in draw.io.",
    canonical: "https://synthboard.click/uml-sequence-diagram",
    pill: "UML sequence diagram generator",
    h1: "UML sequence diagrams from specs, notes, and API flows.",
    lead:
      "Paste the interaction you are trying to document. SynthBoard identifies actors, systems, calls, responses, and timing so you can start from an editable sequence diagram.",
    terms: ["UML sequence diagram", "sequence diagram from text", "API sequence diagram"],
    heroFooter: ["Paste interaction", "Find messages", "Edit lifelines"],
    inputs: [
      {
        graphic: "notes",
        label: "API notes",
        text: "Turn request and response behavior into lifelines, messages, and return paths.",
      },
      {
        graphic: "workflows",
        label: "User flows",
        text: "Map what the user, frontend, backend, and external systems do over time.",
      },
      {
        graphic: "transcripts",
        label: "Design reviews",
        text: "Extract the agreed interaction model from a conversation or implementation discussion.",
      },
    ],
    outcomes: [
      "Actors and systems separated into lifelines",
      "Messages ordered across time instead of scattered through notes",
      "Editable draw.io output for review and documentation",
    ],
    faqs: [
      {
        question: "Can I generate a UML sequence diagram from a spec?",
        answer:
          "Yes. A spec with actors, systems, and interactions is a strong input for a sequence diagram draft.",
      },
      {
        question: "Does the output work for API documentation?",
        answer:
          "Yes. Sequence diagrams are useful for request flows, callbacks, auth exchanges, and service interactions.",
      },
      {
        question: "Can I edit the generated lifelines and messages?",
        answer:
          "Yes. SynthBoard creates an editable diagram draft you can refine in draw.io.",
      },
    ],
  },
  {
    key: "mindmap",
    slug: "mind-map",
    path: "/mind-map",
    type: "mindmap",
    label: "Mind map",
    shortLabel: "Mind map",
    pageTitle: "Mind Map Generator from Text | SynthBoard",
    metaDescription:
      "Turn rough concepts, notes, and transcripts into editable mind maps for learning, planning, and draw.io refinement.",
    canonical: "https://synthboard.click/mind-map",
    pill: "Mind map generator",
    h1: "Mind maps from rough concepts, notes, and transcripts.",
    lead:
      "Paste a topic, research notes, or a messy brainstorm. SynthBoard organizes the main idea, branches, and supporting details into an editable mind map.",
    terms: ["mind map generator", "text to mind map", "AI mind map"],
    heroFooter: ["Paste topic", "Cluster ideas", "Refine map"],
    inputs: [
      {
        graphic: "concepts",
        label: "Learning notes",
        text: "Break a dense concept into a central topic and connected subtopics.",
      },
      {
        graphic: "transcripts",
        label: "Brainstorms",
        text: "Turn a long discussion into themes, clusters, and next areas to explore.",
      },
      {
        graphic: "notes",
        label: "Research snippets",
        text: "Organize scattered source material into a structure that is easier to scan.",
      },
    ],
    outcomes: [
      "A central idea with practical branches and subtopics",
      "Related concepts grouped before you start editing",
      "An editable draw.io map for learning or planning",
    ],
    faqs: [
      {
        question: "Can SynthBoard make a mind map from text?",
        answer:
          "Yes. Paste notes, concepts, or brainstorm material and generate an editable mind map draft.",
      },
      {
        question: "What is a good input for a mind map?",
        answer:
          "Topics you are learning, brainstorm notes, planning notes, and rough research snippets are good inputs.",
      },
      {
        question: "Can I export the mind map to draw.io?",
        answer:
          "Yes. SynthBoard is focused on editable draw.io-style output, not static image-only diagrams.",
      },
    ],
  },
  {
    key: "er",
    slug: "er-diagram",
    path: "/er-diagram",
    type: "er",
    label: "ER diagram",
    shortLabel: "ER",
    pageTitle: "ER Diagram Generator from Text | SynthBoard",
    metaDescription:
      "Generate editable ER diagrams from data model notes, product specs, and database descriptions with SynthBoard.",
    canonical: "https://synthboard.click/er-diagram",
    pill: "ER diagram generator",
    h1: "ER diagrams from data model notes and product specs.",
    lead:
      "Paste a description of your data model, tables, objects, or product entities. SynthBoard creates an editable ER diagram draft with entities and relationships.",
    terms: ["ER diagram generator", "entity relationship diagram", "database diagram from text"],
    heroFooter: ["Paste entities", "Map relationships", "Edit schema"],
    inputs: [
      {
        graphic: "notes",
        label: "Data model notes",
        text: "Turn tables, objects, fields, and relationships into a visual first draft.",
      },
      {
        graphic: "workflows",
        label: "Product specs",
        text: "Extract the entities behind product behavior, ownership, and lifecycle states.",
      },
      {
        graphic: "concepts",
        label: "Domain concepts",
        text: "Map the core nouns, attributes, and links in a business or technical domain.",
      },
    ],
    outcomes: [
      "Entities and relationships visible before schema cleanup",
      "Fields and ownership grouped into editable tables",
      "A draw.io diagram ready for review with engineers or product teams",
    ],
    faqs: [
      {
        question: "Can SynthBoard create an ER diagram from a product spec?",
        answer:
          "Yes. Specs that describe users, accounts, records, events, and relationships can become an ER diagram draft.",
      },
      {
        question: "Does the ER diagram include fields?",
        answer:
          "When the source text includes fields or attributes, SynthBoard can include them in the editable draft.",
      },
      {
        question: "Is this a replacement for database design review?",
        answer:
          "No. It creates a structured starting point that should still be reviewed and refined.",
      },
    ],
  },
  {
    key: "swimlane",
    slug: "swimlane-diagram",
    path: "/swimlane-diagram",
    type: "swimlane",
    label: "Swimlane",
    shortLabel: "Swimlane",
    pageTitle: "Swimlane Diagram Generator from Text | SynthBoard",
    metaDescription:
      "Turn workflow notes and meeting transcripts into editable swimlane diagrams split by team, role, system, or owner.",
    canonical: "https://synthboard.click/swimlane-diagram",
    pill: "Swimlane diagram generator",
    h1: "Swimlane diagrams from workflows, handoffs, and transcripts.",
    lead:
      "Paste a process that crosses teams, roles, or systems. SynthBoard separates the responsibilities into lanes and creates an editable draw.io swimlane draft.",
    terms: ["swimlane diagram generator", "workflow swimlane", "process handoff diagram"],
    heroFooter: ["Paste workflow", "Split lanes", "Review handoffs"],
    inputs: [
      {
        graphic: "workflows",
        label: "Cross-team workflows",
        text: "Turn a process with multiple owners into steps grouped by responsibility.",
      },
      {
        graphic: "transcripts",
        label: "Meeting transcripts",
        text: "Extract owners, approvals, handoffs, and waiting states from a discussion.",
      },
      {
        graphic: "notes",
        label: "Operations notes",
        text: "Map recurring work across support, sales, product, engineering, or external partners.",
      },
    ],
    outcomes: [
      "Teams, roles, or systems shown as distinct lanes",
      "Handoffs and waiting points visible before process review",
      "Editable draw.io output for operations and documentation",
    ],
    faqs: [
      {
        question: "Can SynthBoard make a swimlane diagram from a workflow?",
        answer:
          "Yes. Include the teams, roles, or systems involved and SynthBoard can split the process into lanes.",
      },
      {
        question: "What makes swimlanes different from flow diagrams?",
        answer:
          "Swimlanes show who owns each step. Flow diagrams focus more on the sequence and decision logic.",
      },
      {
        question: "Can I adjust the lanes after generation?",
        answer:
          "Yes. The generated swimlane diagram is editable, so you can rename lanes and move steps.",
      },
    ],
  },
  {
    key: "timeline",
    slug: "timeline-diagram",
    path: "/timeline-diagram",
    type: "timeline",
    label: "Timeline",
    shortLabel: "Timeline",
    pageTitle: "Timeline Diagram Generator from Text | SynthBoard",
    metaDescription:
      "Create editable timeline diagrams from project notes, event histories, launch plans, and meeting transcripts.",
    canonical: "https://synthboard.click/timeline-diagram",
    pill: "Timeline diagram generator",
    h1: "Timeline diagrams from project notes, events, and milestones.",
    lead:
      "Paste a sequence of events, launch plan, project history, or transcript. SynthBoard orders the milestones into an editable timeline diagram.",
    terms: ["timeline diagram generator", "text to timeline", "project timeline diagram"],
    heroFooter: ["Paste events", "Order milestones", "Edit timeline"],
    inputs: [
      {
        graphic: "notes",
        label: "Project notes",
        text: "Turn milestones, phases, dependencies, and deadlines into a timeline.",
      },
      {
        graphic: "transcripts",
        label: "Planning meetings",
        text: "Extract dates, commitments, risks, and follow-ups from a planning conversation.",
      },
      {
        graphic: "concepts",
        label: "Event histories",
        text: "Make a chronological explanation easier to scan and share.",
      },
    ],
    outcomes: [
      "Events and milestones ordered into a visual sequence",
      "Phases and dependencies separated from dense notes",
      "Editable draw.io timeline output for planning or documentation",
    ],
    faqs: [
      {
        question: "Can SynthBoard create a timeline from text?",
        answer:
          "Yes. Paste event notes, project plans, or transcript excerpts and generate an editable timeline draft.",
      },
      {
        question: "Do I need exact dates for a timeline diagram?",
        answer:
          "Exact dates help, but phases, relative order, and milestone names are enough for a useful first draft.",
      },
      {
        question: "Can I use this for project timelines?",
        answer:
          "Yes. Project phases, launch plans, and milestone lists are strong timeline inputs.",
      },
    ],
  },
  {
    key: "org",
    slug: "org-chart",
    path: "/org-chart",
    type: "org",
    label: "Org chart",
    shortLabel: "Org chart",
    pageTitle: "Org Chart Generator from Text | SynthBoard",
    metaDescription:
      "Generate editable org charts from team notes, ownership lists, department structures, and planning docs.",
    canonical: "https://synthboard.click/org-chart",
    pill: "Org chart generator",
    h1: "Org charts from team notes, ownership lists, and planning docs.",
    lead:
      "Paste team structure, reporting lines, roles, or ownership notes. SynthBoard turns the hierarchy into an editable org chart you can refine in draw.io.",
    terms: ["org chart generator", "text to org chart", "team structure diagram"],
    heroFooter: ["Paste roles", "Build hierarchy", "Edit chart"],
    inputs: [
      {
        graphic: "notes",
        label: "Team notes",
        text: "Turn people, roles, departments, and managers into a chartable hierarchy.",
      },
      {
        graphic: "workflows",
        label: "Ownership lists",
        text: "Map responsibility areas, reporting lines, and operational ownership.",
      },
      {
        graphic: "transcripts",
        label: "Planning discussions",
        text: "Extract proposed team structure from a hiring, planning, or reorg conversation.",
      },
    ],
    outcomes: [
      "Roles and reporting lines arranged into a hierarchy",
      "Teams, departments, and ownership areas visible at a glance",
      "Editable draw.io output for review and communication",
    ],
    faqs: [
      {
        question: "Can SynthBoard make an org chart from a list of roles?",
        answer:
          "Yes. A list of people, roles, teams, managers, or ownership areas can become an editable org chart draft.",
      },
      {
        question: "Can I use this for proposed team structures?",
        answer:
          "Yes. Planning notes and draft reporting structures are useful inputs for an org chart.",
      },
      {
        question: "Can I edit names and reporting lines later?",
        answer:
          "Yes. The generated org chart is a starting point you can refine in draw.io.",
      },
    ],
  },
];

export const DIAGRAM_USE_CASE_BY_SLUG = Object.fromEntries(
  DIAGRAM_USE_CASES.map((page) => [page.slug, page])
);

export const DIAGRAM_STYLE_LINKS = Object.fromEntries(
  DIAGRAM_USE_CASES.map((page) => [page.key, page.path])
);
