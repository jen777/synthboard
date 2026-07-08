import { useEffect } from "react";
import {
  DiagramThumb,
  InputGraphic,
  LandingFooter,
  StartButton,
} from "./Login.jsx";

const COMPARISON_POINTS = [
  {
    label: "Starting point",
    drawio: "A blank canvas where you build the structure manually.",
    synthboard: "A prompt-first workspace that turns source material into a structured diagram draft.",
  },
  {
    label: "AI generation",
    drawio: "Best when you already know the diagram you want to draw.",
    synthboard: "Built for transcripts, specs, notes, workflows, and concepts that need diagram structure.",
  },
  {
    label: "Output",
    drawio: "Manual diagrams saved in the draw.io ecosystem.",
    synthboard: "Clean, editable draw.io output you can refine, export, and share.",
  },
];

const FITS = [
  {
    key: "transcripts",
    label: "Transcript to draw.io",
    text: "Extract decisions, owners, handoffs, and open questions from meetings into an editable board.",
  },
  {
    key: "notes",
    label: "Spec to architecture",
    text: "Turn product notes, RFCs, or system descriptions into a draw.io architecture draft.",
  },
  {
    key: "workflows",
    label: "Workflow to flowchart",
    text: "Convert process steps into flowcharts, swimlanes, state machines, and operational diagrams.",
  },
  {
    key: "concepts",
    label: "Concept to map",
    text: "Make rough topics easier to understand with mind maps, timelines, and structured visuals.",
  },
];

const OUTPUTS = [
  {
    key: "flow",
    label: "Flowcharts",
    description: "Steps, decisions, branches, and handoffs.",
  },
  {
    key: "architecture",
    label: "Architecture diagrams",
    description: "Services, queues, APIs, databases, and dependencies.",
  },
  {
    key: "swimlane",
    label: "Swimlanes",
    description: "Processes split by team, system, role, or owner.",
  },
  {
    key: "mindmap",
    label: "Mind maps",
    description: "Central ideas expanded into related structure.",
  },
];

const FAQS = [
  {
    question: "Is SynthBoard a draw.io replacement?",
    answer:
      "No. SynthBoard is the AI generation front-end for the work before draw.io editing: paste source text, generate the first draft, then refine the editable draw.io output.",
  },
  {
    question: "Can I edit the result in draw.io?",
    answer:
      "Yes. The output is meant to stay editable, so you can keep shaping the generated diagram after export.",
  },
  {
    question: "What makes it different from a generic AI diagram tool?",
    answer:
      "SynthBoard is focused on practical draw.io-style structures from real source material, not static images or one-off mockups.",
  },
];

const META_TAGS = [
  {
    selector: 'meta[name="description"]',
    attrs: {
      name: "description",
      content:
        "Looking for a draw.io alternative with AI generation? SynthBoard turns transcripts, specs, notes, and workflows into clean, editable draw.io diagrams.",
    },
  },
  {
    selector: 'link[rel="canonical"]',
    attrs: {
      rel: "canonical",
      href: "https://synthboard.click/drawio-alternative",
    },
  },
  {
    selector: 'meta[property="og:title"]',
    attrs: {
      property: "og:title",
      content: "Draw.io Alternative for AI Diagram Generation | SynthBoard",
    },
  },
  {
    selector: 'meta[property="og:description"]',
    attrs: {
      property: "og:description",
      content:
        "Use SynthBoard as the AI front-end for clean, editable draw.io diagram drafts.",
    },
  },
  {
    selector: 'meta[property="og:type"]',
    attrs: { property: "og:type", content: "website" },
  },
  {
    selector: 'meta[property="og:url"]',
    attrs: {
      property: "og:url",
      content: "https://synthboard.click/drawio-alternative",
    },
  },
];

function useLandingMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    const previousTags = META_TAGS.map((tag) => {
      const node = document.head.querySelector(tag.selector);
      return {
        selector: tag.selector,
        node,
        attrs: node
          ? Array.from(node.attributes).map(({ name, value }) => [name, value])
          : null,
      };
    });

    document.title = "Draw.io Alternative for AI Diagram Generation | SynthBoard";
    META_TAGS.forEach((tag) => {
      const element =
        document.head.querySelector(tag.selector) ||
        document.createElement(tag.attrs.rel ? "link" : "meta");
      Object.entries(tag.attrs).forEach(([name, value]) => {
        element.setAttribute(name, value);
      });
      if (!element.parentElement) {
        document.head.appendChild(element);
      }
    });

    return () => {
      document.title = previousTitle;
      previousTags.forEach(({ selector, node, attrs }) => {
        if (!node) {
          const current = document.head.querySelector(selector);
          current?.remove();
          return;
        }
        Array.from(node.attributes).forEach((attr) => {
          node.removeAttribute(attr.name);
        });
        attrs.forEach(([name, value]) => {
          node.setAttribute(name, value);
        });
      });
    };
  }, []);
}

export default function DrawioAlternativeLanding() {
  useLandingMeta();
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  return (
    <main className="landing-page drawio-alt-page">
      <header className="topbar landing-nav">
        <span className="brand">
          Synth<span className="dot">Board</span>
        </span>
        <StartButton compact />
      </header>

      <div className="landing-shell">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="pill">Draw.io alternative for AI generation</span>
            <h1>The AI front-end for clean, editable draw.io diagrams.</h1>
            <p className="landing-lead">
              Draw.io is strong once the diagram structure is clear. SynthBoard
              helps with the part before that: turning transcripts, specs, notes,
              and workflows into editable draw.io drafts.
            </p>
            <div className="intent-terms" aria-label="Draw.io alternative search terms">
              <span>draw.io alternative</span>
              <span>AI draw.io generator</span>
              <span>editable draw.io export</span>
            </div>
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
            <div className="hero-metrics" aria-label="SynthBoard draw.io workflow">
              <span><b>AI</b> first draft</span>
              <span><b>draw.io</b> editable output</span>
              <span><b>1 paste</b> to diagram structure</span>
            </div>
          </div>

          <div className="hero-visual drawio-alt-visual" aria-label="SynthBoard as a front-end for draw.io">
            <img
              src="/landing/drawio-alternative-preview.svg"
              alt="SynthBoard turns raw notes into an editable draw.io diagram draft"
            />
            <div className="hero-visual-footer">
              <span>Paste source</span>
              <span>Generate structure</span>
              <span>Edit in draw.io</span>
            </div>
          </div>
        </section>

        <section className="landing-section drawio-comparison-section">
          <div className="section-heading">
            <span className="section-kicker">Comparison</span>
            <h2>Use draw.io for editing. Use SynthBoard to get the first draft.</h2>
            <p>
              SynthBoard is for people searching for a draw.io alternative
              because they need AI generation, but still want the result to stay
              clean and editable.
            </p>
          </div>
          <div className="comparison-board" aria-label="Draw.io and SynthBoard comparison">
            <div className="comparison-head drawio-head">Draw.io alone</div>
            <div className="comparison-head synth-head">SynthBoard plus draw.io</div>
            {COMPARISON_POINTS.map((item) => (
              <div className="comparison-row" key={item.label}>
                <div className="comparison-cell">
                  <span>{item.label}</span>
                  <p>{item.drawio}</p>
                </div>
                <div className="comparison-cell synth-cell">
                  <span>{item.label}</span>
                  <p>{item.synthboard}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section compact-section good-inputs-section">
          <div className="good-inputs-layout">
            <div className="section-heading">
              <span className="section-kicker">Where it fits</span>
              <h2>Start from messy source material, then keep the draw.io editing path.</h2>
              <p>
                Paste what you already have, choose the structure you need, and
                use the generated board as the editable starting point.
              </p>
            </div>
            <div className="input-orchestration" aria-hidden="true">
              <span>Raw material</span>
              <i />
              <span>AI structure</span>
              <i />
              <span>Draw.io export</span>
            </div>
          </div>
          <div className="use-case-grid">
            {FITS.map((item) => (
              <article className={`feature-card feature-card-${item.key}`} key={item.label}>
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
            <span className="section-kicker">Editable outputs</span>
            <h2>Generate diagram structures that still belong in a draw.io workflow.</h2>
            <p>
              SynthBoard focuses on useful first drafts instead of static images,
              so the output can keep moving through review and refinement.
            </p>
          </div>
          <div className="format-grid" aria-label="Draw.io-compatible output examples">
            {OUTPUTS.map((format) => (
              <article className="format-card" key={format.key}>
                <DiagramThumb type={format.key} />
                <h3>{format.label}</h3>
                <p>{format.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section faq-section">
          <div className="section-heading">
            <span className="section-kicker">Questions</span>
            <h2>For teams that want AI generation without losing editable diagrams.</h2>
          </div>
          <div className="faq-grid">
            {FAQS.map((item) => (
              <article className="faq-card" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <div>
            <span className="section-kicker">Start creating</span>
            <h2>Generate the first draw.io draft from notes, transcripts, specs, or workflows.</h2>
            <p>
              Sign in with Google, paste the source material, and export a
              diagram you can keep editing in the draw.io workflow.
            </p>
          </div>
          <StartButton />
        </section>
      </div>

      <LandingFooter>
        AI-generated first drafts, editable draw.io diagrams after.
      </LandingFooter>
    </main>
  );
}
