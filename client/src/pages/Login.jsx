// Public landing page (the app's entry point for signed-out visitors). Keeps
// "Continue with Google" as the single call to action while explaining what
// SynthBoard does, the visualization types it can produce, and the membership
// levels. The marketing copy below intentionally mirrors the server-side source
// of truth (server/src/services/presets.js and levels.js) — keep them in sync.

const VISUALIZATIONS = [
  { icon: "🔀", label: "Flow Diagram", description: "Boxes-and-arrows flowchart of steps, decisions, and flow." },
  { icon: "🏛️", label: "UML Class Diagram", description: "Classes with attributes, methods, and relationships." },
  { icon: "⏱️", label: "UML Sequence Diagram", description: "Actors and objects exchanging messages over time." },
  { icon: "🗄️", label: "Entity-Relationship", description: "Database entities, attributes, and relationships." },
  { icon: "🧠", label: "Mind Map", description: "Central topic radiating into branches and sub-branches." },
  { icon: "📊", label: "Infographic", description: "Visually rich summary with stats, icons, and sections." },
  { icon: "🏢", label: "Org Chart", description: "Hierarchy of people, roles, or teams." },
  { icon: "📅", label: "Timeline", description: "Chronological sequence of events or milestones." },
  { icon: "🏊", label: "Swimlane Diagram", description: "Cross-functional process split by role or department." },
  { icon: "🛠️", label: "System Architecture", description: "Components, services, and how they connect." },
  { icon: "🔁", label: "State Machine", description: "States and the transitions between them." },
  { icon: "🟢", label: "Venn Diagram", description: "Overlapping sets showing shared and unique items." },
  { icon: "🐟", label: "Fishbone", description: "Ishikawa cause-and-effect diagram." },
  { icon: "🗂️", label: "Kanban Board", description: "Tasks organized into status columns." },
];

const STEPS = [
  {
    icon: "📝",
    title: "Paste your text",
    body: "Drop in meeting notes, a transcript, a spec, or any rough text. No formatting required.",
  },
  {
    icon: "🎯",
    title: "Pick a visualization",
    body: "Choose from 14 diagram types — flowcharts, UML, mind maps, infographics, and more.",
  },
  {
    icon: "✨",
    title: "Get an editable diagram",
    body: "SynthBoard generates a polished draw.io diagram you can refine, export, and share.",
  },
];

const LEVELS = [
  { level: 1, name: "Sketcher", visualizations: 5, chars: "7,000" },
  { level: 2, name: "Creator", visualizations: 20, chars: "8,500" },
  { level: 3, name: "Architect", visualizations: 50, chars: "10,000" },
  { level: 4, name: "Visionary", visualizations: 150, chars: "15,000" },
];

function GoogleButton({ block }) {
  return (
    <a href="/auth/google" style={block ? { display: "block" } : undefined}>
      <button className="primary" style={block ? { width: "100%" } : undefined}>
        Continue with Google
      </button>
    </a>
  );
}

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  return (
    <div className="landing">
      <header className="topbar">
        <span className="brand" style={{ fontSize: 19 }}>
          Synth<span className="dot">Board</span>
        </span>
        <GoogleButton />
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <span className="pill">AI-powered diagramming</span>
        <h1 className="landing-title">
          Turn raw text into
          <br />
          <span className="landing-gradient">beautiful diagrams</span>
        </h1>
        <p className="landing-lead">
          SynthBoard reads your notes, meeting transcripts, specs, and docs and
          generates editable draw.io diagrams, UML, infographics, and more — in
          seconds.
        </p>
        {error && (
          <div className="banner error" style={{ maxWidth: 420, margin: "0 auto" }}>
            Sign-in failed. Please try again.
          </div>
        )}
        <div className="landing-cta">
          <GoogleButton />
        </div>
        <small className="muted">
          Free accounts include 5 visualizations. No credit card required.
        </small>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <h2 className="landing-h2">How it works</h2>
        <p className="landing-sub">From a wall of text to a clear diagram in three steps.</p>
        <div className="landing-steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card landing-step">
              <div className="landing-step-num">{i + 1}</div>
              <div className="landing-step-icon">{s.icon}</div>
              <b>{s.title}</b>
              <span className="muted">{s.body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Visualization types */}
      <section className="landing-section">
        <h2 className="landing-h2">14 visualization types</h2>
        <p className="landing-sub">
          One source text, many ways to see it. Pick the diagram that fits your story.
        </p>
        <div className="landing-viz-grid">
          {VISUALIZATIONS.map((v) => (
            <div key={v.label} className="card landing-viz">
              <span className="landing-viz-icon">{v.icon}</span>
              <div>
                <b>{v.label}</b>
                <span className="muted">{v.description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Usage levels */}
      <section className="landing-section">
        <h2 className="landing-h2">Membership levels</h2>
        <p className="landing-sub">
          Higher levels unlock more visualizations and larger inputs.
        </p>
        <div className="landing-levels">
          {LEVELS.map((l) => (
            <div key={l.level} className="card landing-level">
              <div className="landing-level-head">
                <span className="level-badge-tier">Lvl {l.level}</span>
                <b className="landing-level-name">{l.name}</b>
              </div>
              <div className="landing-level-stat">
                <span className="landing-level-num">{l.visualizations}</span>
                <span className="muted">visualizations</span>
              </div>
              <div className="landing-level-stat">
                <span className="landing-level-num">{l.chars}</span>
                <span className="muted">input characters</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="landing-section landing-final">
        <div className="card landing-final-card">
          <h2 className="landing-h2" style={{ marginTop: 0 }}>
            Ready to visualize your ideas?
          </h2>
          <p className="landing-sub">
            Sign in with Google and create your first diagram for free.
          </p>
          <div className="landing-cta">
            <GoogleButton />
          </div>
        </div>
      </section>

      <footer className="landing-footer muted">
        <span className="brand" style={{ fontSize: 15 }}>
          Synth<span className="dot">Board</span>
        </span>
        <span>© {new Date().getFullYear()} SynthBoard. Notes in, diagrams out.</span>
      </footer>
    </div>
  );
}
