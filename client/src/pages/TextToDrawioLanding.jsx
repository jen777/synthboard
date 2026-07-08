import { useEffect } from "react";
import {
  DiagramThumb,
  ExampleVisual,
  FORMATS,
  InputGraphic,
  LandingFooter,
  StartButton,
} from "./Login.jsx";

const USE_CASES = [
  {
    key: "transcripts",
    label: "Transcript to diagram",
    text: "Paste a meeting transcript and turn decisions, owners, dependencies, and follow-ups into an editable draw.io board.",
  },
  {
    key: "concepts",
    label: "Plain text to draw.io",
    text: "Turn rough paragraphs, notes, or copied text into flowcharts, mind maps, timelines, and other diagram drafts.",
  },
  {
    key: "notes",
    label: "Spec text to architecture",
    text: "Paste product specs, RFCs, or system notes and get a draw.io architecture diagram you can refine with your team.",
  },
  {
    key: "workflows",
    label: "Workflow text to flowchart",
    text: "Convert plain-language process steps into flowcharts, swimlanes, state machines, and operational diagrams.",
  },
];

const EXAMPLES = [
  {
    key: "transcript",
    source: "Transcript",
    title: "Customer discovery call",
    result: "Transcript to swimlane diagram with customer, sales, and implementation handoffs",
  },
  {
    key: "concept",
    source: "Plain text",
    title: "OAuth 2.0 notes",
    result: "Text to draw.io mind map with actors, tokens, grants, and flows",
  },
  {
    key: "spec",
    source: "Spec text",
    title: "Notification service",
    result: "Editable draw.io architecture diagram with queues, workers, and APIs",
  },
];

const FAQS = [
  {
    question: "Can SynthBoard turn a transcript into a diagram?",
    answer:
      "Yes. Paste a meeting transcript and SynthBoard extracts the useful structure into a draw.io diagram draft.",
  },
  {
    question: "Is this a text to draw.io diagram tool?",
    answer:
      "Yes. It is built around pasted text inputs and editable draw.io outputs, so you can keep refining the diagram after generation.",
  },
  {
    question: "What text works best?",
    answer:
      "Meeting transcripts, process notes, product specs, technical notes, and rough workflow descriptions are the strongest starting points.",
  },
];

const META_TAGS = [
  {
    selector: 'meta[name="description"]',
    attrs: {
      name: "description",
      content:
        "Turn plain text, meeting transcripts, specs, and workflow notes into editable draw.io diagrams with SynthBoard.",
    },
  },
  {
    selector: 'link[rel="canonical"]',
    attrs: {
      rel: "canonical",
      href: "https://synthboard.click/text-to-drawio-diagram",
    },
  },
  {
    selector: 'meta[property="og:title"]',
    attrs: {
      property: "og:title",
      content: "Text to Draw.io Diagram | SynthBoard",
    },
  },
  {
    selector: 'meta[property="og:description"]',
    attrs: {
      property: "og:description",
      content: "Paste text or a transcript and generate an editable draw.io diagram draft.",
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
      content: "https://synthboard.click/text-to-drawio-diagram",
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

    document.title = "Text to Draw.io Diagram | Transcript to Diagram | SynthBoard";
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

export default function TextToDrawioLanding() {
  useLandingMeta();
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
            <span className="pill">Text to draw.io diagram generator</span>
            <h1>Text to draw.io diagram, built for transcripts and notes.</h1>
            <p className="landing-lead">
              Paste plain text, meeting transcripts, specs, or workflow notes.
              SynthBoard turns them into structured draw.io diagrams you can
              edit, export, and share.
            </p>
            <div className="intent-terms" aria-label="Focused diagram generation use cases">
              <span>text to draw.io diagram</span>
              <span>transcript to diagram</span>
              <span>meeting transcript to flowchart</span>
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
            <div className="hero-metrics" aria-label="SynthBoard capabilities">
              <span><b>{FORMATS.length}</b> text-based diagram styles</span>
              <span><b>draw.io</b> editable output</span>
              <span><b>1 paste</b> from transcript to draft</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="SynthBoard diagram preview">
            <img
              src="/landing/text-to-drawio-diagram-preview.svg"
              alt="Preview of source text becoming an editable draw.io diagram"
            />
            <div className="hero-visual-footer">
              <span>Paste text</span>
              <span>Generate draw.io</span>
              <span>Edit in diagrams.net</span>
            </div>
          </div>
        </section>

        <section className="landing-section compact-section good-inputs-section">
          <div className="good-inputs-layout">
            <div className="section-heading">
              <span className="section-kicker">Text inputs</span>
              <h2>Use it when the source is text and the output needs to be a diagram.</h2>
              <p>
                Paste source material, choose a diagram style, then refine the
                generated draw.io board instead of rebuilding the structure by hand.
              </p>
            </div>
            <div className="input-orchestration" aria-hidden="true">
              <span>Text or transcript</span>
              <i />
              <span>Model pass</span>
              <i />
              <span>Draw.io board</span>
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
            <span className="section-kicker">Diagram outputs</span>
            <h2>Pick the draw.io structure that fits the text.</h2>
            <p>
              Generate practical draw.io diagrams for learning, planning,
              architecture, operations, and documentation from the same pasted text.
            </p>
          </div>
          <div
            className="format-grid"
            aria-label="Supported diagram and visualization styles"
          >
            {FORMATS.map((format) => (
              <article className="format-card" key={format.key}>
                <DiagramThumb type={format.key} />
                <h3>{format.label}</h3>
                <p>{format.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section examples-section">
          <div className="section-heading">
            <span className="section-kicker">Examples</span>
            <h2>Fast starts for transcript to diagram and text to draw.io work.</h2>
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

        <section className="landing-section faq-section">
          <div className="section-heading">
            <span className="section-kicker">Focused use case</span>
            <h2>Designed for people searching for a specific converter, not a blank canvas.</h2>
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
            <h2>Sign in with Google and turn your first text or transcript into a draw.io diagram.</h2>
            <p>
              Start with a meeting transcript, a process description, a product
              spec, or a rough note. SynthBoard will give you an editable draw.io
              diagram you can improve from there.
            </p>
          </div>
          <StartButton />
        </section>
      </div>

      <LandingFooter>
        Text and transcripts in, editable draw.io diagrams out.
      </LandingFooter>
    </main>
  );
}
