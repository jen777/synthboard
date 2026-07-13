import { DIAGRAM_STYLE_LINKS } from "./diagramUseCases.js";

const USE_CASES = [
  {
    key: "transcripts",
    label: "Meeting transcripts",
    text: "Extract the decisions, owners, dependencies, and follow-ups from a long discussion into a diagram visualization people can act on.",
  },
  {
    key: "concepts",
    label: "Rough concepts",
    text: "Turn a topic you are learning into a mind map, timeline, flow, or architecture visualization that makes the structure visible.",
  },
  {
    key: "notes",
    label: "Product and tech notes",
    text: "Paste specs, RFCs, feature notes, or system descriptions and get a clean draw.io diagram visualization to refine with your team.",
  },
  {
    key: "workflows",
    label: "Processes and workflows",
    text: "Convert plain-language steps into flowcharts, swimlanes, state machines, Kanban boards, and operational diagram visualizations.",
  },
];

export const FORMATS = [
  {
    key: "flow",
    label: "Flow diagram",
    description: "Steps, decisions, and branches from a process.",
    href: DIAGRAM_STYLE_LINKS.flow,
  },
  {
    key: "sequence",
    label: "UML sequence",
    description: "Actors and systems exchanging messages over time.",
    href: DIAGRAM_STYLE_LINKS.sequence,
  },
  {
    key: "architecture",
    label: "System architecture",
    description: "Services, APIs, queues, databases, and external systems.",
  },
  {
    key: "mindmap",
    label: "Mind map",
    description: "A central concept expanded into related ideas.",
    href: DIAGRAM_STYLE_LINKS.mindmap,
  },
  {
    key: "er",
    label: "ER diagram",
    description: "Data entities, fields, and relationships.",
    href: DIAGRAM_STYLE_LINKS.er,
  },
  {
    key: "swimlane",
    label: "Swimlane diagram",
    description: "A workflow split by teams, roles, or departments.",
    href: DIAGRAM_STYLE_LINKS.swimlane,
  },
  {
    key: "timeline",
    label: "Timeline diagram",
    description: "Events, phases, and milestones in order.",
    href: DIAGRAM_STYLE_LINKS.timeline,
  },
  {
    key: "org",
    label: "Org chart",
    description: "Hierarchies of people, roles, teams, or ownership.",
    href: DIAGRAM_STYLE_LINKS.org,
  },
];

const EXAMPLES = [
  {
    key: "transcript",
    source: "Transcript",
    title: "Discovery call",
    result: "Swimlane diagram visualization with customer, sales, and implementation handoffs",
  },
  {
    key: "concept",
    source: "Concept",
    title: "OAuth 2.0",
    result: "Learning-map visualization with actors, tokens, grants, and flows",
  },
  {
    key: "spec",
    source: "Spec",
    title: "Notification service",
    result: "Editable architecture diagram visualization with queues, workers, and APIs",
  },
];

export function DiagramThumb({ type }) {
  const common = (
    <>
      <rect className="thumb-bg" x="0" y="0" width="180" height="120" rx="18" />
      <path className="thumb-grid" d="M28 20v80M68 20v80M108 20v80M148 20v80M18 38h144M18 78h144" />
    </>
  );

  if (type === "sequence") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <rect className="thumb-node accent" x="22" y="20" width="42" height="20" rx="8" />
        <rect className="thumb-node teal" x="118" y="20" width="42" height="20" rx="8" />
        <path className="thumb-line dash" d="M43 42v58M139 42v58" />
        <path className="thumb-line" d="M48 58h82" />
        <path className="thumb-line" d="M134 80H52" />
      </svg>
    );
  }

  if (type === "architecture") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <rect className="thumb-node accent" x="18" y="46" width="44" height="28" rx="8" />
        <rect className="thumb-node teal" x="70" y="20" width="42" height="28" rx="8" />
        <rect className="thumb-node warm" x="70" y="76" width="42" height="28" rx="8" />
        <ellipse className="thumb-node violet" cx="142" cy="60" rx="24" ry="18" />
        <path className="thumb-line" d="M62 60h20M112 34c20 0 20 17 10 22M112 90c20 0 20-17 10-22" />
      </svg>
    );
  }

  if (type === "mindmap") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <ellipse className="thumb-node accent" cx="90" cy="60" rx="28" ry="18" />
        <ellipse className="thumb-node teal" cx="38" cy="32" rx="22" ry="13" />
        <ellipse className="thumb-node warm" cx="144" cy="34" rx="24" ry="13" />
        <ellipse className="thumb-node violet" cx="42" cy="91" rx="24" ry="13" />
        <ellipse className="thumb-node teal" cx="143" cy="88" rx="22" ry="13" />
        <path className="thumb-line" d="M67 51 56 39M114 50l12-9M67 69 58 84M114 69l11 12" />
      </svg>
    );
  }

  if (type === "er") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <rect className="thumb-table" x="20" y="28" width="52" height="62" rx="8" />
        <rect className="thumb-table" x="108" y="28" width="52" height="62" rx="8" />
        <path className="thumb-line" d="M72 59h36" />
        <path className="thumb-table-line" d="M30 46h32M30 60h24M30 74h28M118 46h32M118 60h24M118 74h28" />
      </svg>
    );
  }

  if (type === "swimlane") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <rect className="lane" x="18" y="20" width="144" height="80" rx="12" />
        <path className="lane-line" d="M18 47h144M18 74h144M54 20v80" />
        <rect className="thumb-node teal" x="66" y="27" width="30" height="14" rx="5" />
        <rect className="thumb-node accent" x="110" y="54" width="30" height="14" rx="5" />
        <rect className="thumb-node warm" x="72" y="81" width="30" height="14" rx="5" />
        <path className="thumb-line" d="M96 34c26 0 10 27 14 27M110 61c-26 0-8 27-8 27" />
      </svg>
    );
  }

  if (type === "timeline") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <path className="thumb-line heavy" d="M24 62h132" />
        <circle className="thumb-dot accent" cx="40" cy="62" r="8" />
        <circle className="thumb-dot teal" cx="80" cy="62" r="8" />
        <circle className="thumb-dot warm" cx="120" cy="62" r="8" />
        <circle className="thumb-dot violet" cx="150" cy="62" r="8" />
        <path className="thumb-table-line" d="M32 38h28M72 86h28M112 38h30M138 86h24" />
      </svg>
    );
  }

  if (type === "org") {
    return (
      <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
        {common}
        <rect className="thumb-node accent" x="65" y="18" width="50" height="22" rx="8" />
        <rect className="thumb-node teal" x="24" y="74" width="42" height="22" rx="8" />
        <rect className="thumb-node warm" x="70" y="74" width="42" height="22" rx="8" />
        <rect className="thumb-node violet" x="116" y="74" width="42" height="22" rx="8" />
        <path className="thumb-line" d="M90 40v18M45 58h90M45 58v16M91 58v16M137 58v16" />
      </svg>
    );
  }

  return (
    <svg className="diagram-thumb" viewBox="0 0 180 120" aria-hidden="true">
      {common}
      <rect className="thumb-node teal" x="26" y="22" width="52" height="24" rx="10" />
      <path className="thumb-line" d="M52 46v16" />
      <path className="thumb-decision" d="M90 62 120 80 90 98 60 80Z" />
      <path className="thumb-line" d="M120 80h24" />
      <rect className="thumb-node violet" x="124" y="68" width="36" height="24" rx="10" />
    </svg>
  );
}

export function ExampleVisual({ type }) {
  return (
    <div className={`example-visual ${type}`} aria-hidden="true">
      <div className="source-lines">
        <i />
        <i />
        <i />
      </div>
      <span className="visual-arrow" />
      <DiagramThumb
        type={
          type === "transcript"
            ? "swimlane"
            : type === "concept"
              ? "mindmap"
              : "architecture"
        }
      />
    </div>
  );
}

export function InputGraphic({ type }) {
  return (
    <div className={`input-graphic ${type}`} aria-hidden="true">
      <div className="input-doc">
        <span />
        <i />
        <i />
        <i />
      </div>
      <div className="input-signal">
        <b />
        <b />
        <b />
      </div>
      <div className="input-board">
        <em />
        <strong />
        <small />
      </div>
    </div>
  );
}

export function StartButton({ compact = false }) {
  return (
    <a className="landing-start" href="/auth/google">
      <span className="google-mark" aria-hidden="true">
        G
      </span>
      {compact ? "Start with Google" : "Start using SynthBoard with Google"}
    </a>
  );
}

export function LandingFooter({ children }) {
  return (
    <footer className="landing-footer muted">
      <span className="brand">
        Synth<span className="dot">Board</span>
      </span>
      <span>{children}</span>
      <nav className="landing-footer-links" aria-label="Footer">
        <a href="/faq">FAQ</a>
      </nav>
    </footer>
  );
}

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  return (
    <main className="landing-page">
      <header className="topbar landing-nav">
        <span className="brand">
          Synth<span className="dot">Board</span>
        </span>
        <StartButton compact />
      </header>

      <div className="landing-shell">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="pill">Text to editable draw.io diagrams</span>
            <h1>Turn raw notes into a diagram workspace.</h1>
            <p className="landing-lead">
              SynthBoard converts transcripts, specs, concepts, and workflows into
              structured draw.io visualizations you can edit, export, and share.
            </p>
            {error && (
              <div className="banner error landing-error">
                Sign-in failed. Please try again with your Google account.
              </div>
            )}
            <div className="landing-actions">
              <StartButton />
              <span className="muted">
                Google sign-in is the only supported login method right now.
              </span>
            </div>
            <div className="hero-metrics" aria-label="SynthBoard capabilities">
              <span><b>{FORMATS.length}</b> diagram styles</span>
              <span><b>draw.io</b> native editing</span>
              <span><b>1 paste</b> to first draft</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="SynthBoard diagram preview">
            <img
              src="/landing/synthboard-diagram-preview.svg"
              alt="Preview of source text becoming an editable draw.io diagram"
            />
            <div className="hero-visual-footer">
              <span>Structured output</span>
              <span>Editable XML</span>
              <span>Export ready</span>
            </div>
          </div>
        </section>

        <section className="landing-section compact-section good-inputs-section">
          <div className="good-inputs-layout">
            <div className="section-heading">
              <span className="section-kicker">Good inputs</span>
              <h2>Use it when the idea is there but the structure is not.</h2>
              <p>
                Paste source material, choose a diagram style, then refine the
                generated board in draw.io.
              </p>
            </div>
            <div className="input-orchestration" aria-hidden="true">
              <span>Source</span>
              <i />
              <span>Model pass</span>
              <i />
              <span>Editable board</span>
            </div>
          </div>
          <div className="use-case-grid">
            {USE_CASES.map((item) => (
              <article
                className={`feature-card feature-card-${item.key}`}
                key={item.label}
              >
                <InputGraphic type={item.key} />
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

      <section className="landing-section compact-section">
        <div className="section-heading">
          <span className="section-kicker">Output styles</span>
          <h2>Pick the structure that fits the material.</h2>
          <p>
            Generate practical diagram visualizations for learning, planning,
            architecture, operations, and documentation.
          </p>
        </div>
        <div
          className="format-grid"
          aria-label="Supported diagram and visualization styles"
        >
          {FORMATS.map((format) => (
            format.href ? (
              <a
                className="format-card format-link-card"
                href={format.href}
                key={format.key}
              >
                <DiagramThumb type={format.key} />
                <h3>{format.label}</h3>
                <p>{format.description}</p>
                <span className="format-card-link">View use case</span>
              </a>
            ) : (
              <article className="format-card" key={format.key}>
                <DiagramThumb type={format.key} />
                <h3>{format.label}</h3>
                <p>{format.description}</p>
              </article>
            )
          ))}
        </div>
      </section>

      <section className="landing-section examples-section">
        <div className="section-heading">
          <span className="section-kicker">Examples</span>
          <h2>Fast starts from common source material.</h2>
        </div>
        <div className="example-grid">
          {EXAMPLES.map((example) => (
            <article className="example-card" key={example.title}>
              <ExampleVisual type={example.key} />
              <span>{example.source}</span>
              <h3>{example.title}</h3>
              <p>{example.result}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <div>
          <span className="section-kicker">Start creating</span>
          <h2>Sign in with Google and make your first editable diagram visualization.</h2>
          <p>
            Start with a transcript, a concept, a workflow, or a rough note.
            SynthBoard will give you a draw.io diagram you can improve from
            there.
          </p>
        </div>
        <StartButton />
      </section>
      </div>

      <LandingFooter>
        Notes in, editable draw.io diagram visualizations out.
      </LandingFooter>
    </main>
  );
}
