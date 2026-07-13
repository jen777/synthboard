import { useEffect } from "react";
import { DiagramThumb, LandingFooter, StartButton } from "./Login.jsx";

const FAQ_ITEMS = [
  {
    id: "transcript-to-diagram",
    question: "How do I turn a transcript into a diagram?",
    answer:
      "Paste the transcript into SynthBoard, choose a diagram style, and generate a first draft. SynthBoard turns the discussion into editable draw.io structure such as steps, owners, decisions, and dependencies.",
  },
  {
    id: "meeting-notes-to-flowchart",
    question: "Can I convert meeting notes to a flowchart?",
    answer:
      "Yes. Paste the meeting notes, select a flowchart or swimlane format, and SynthBoard converts the notes into an editable diagram draft.",
  },
  {
    id: "text-to-drawio",
    question: "What is the fastest way to create a draw.io diagram from text?",
    answer:
      "The fastest way is to paste the source text, pick a diagram style, and let SynthBoard create a draw.io diagram you can edit immediately.",
  },
  {
    id: "best-inputs",
    question: "What kinds of notes work best for AI diagram generation?",
    answer:
      "SynthBoard works well with transcripts, meeting notes, product specs, technical notes, process descriptions, workflows, and concepts you are trying to learn.",
  },
  {
    id: "editable-output",
    question: "Does SynthBoard create editable draw.io diagrams?",
    answer:
      "Yes. SynthBoard is designed for editable draw.io output, so the generated diagram can be refined, exported, and shared after the first draft.",
  },
  {
    id: "diagram-types",
    question: "What diagram type should I choose for my notes?",
    answer:
      "Use a flowchart for steps and decisions, a swimlane for handoffs, an architecture diagram for systems, a mind map for concepts, and a timeline for events.",
  },
  {
    id: "prepare-notes",
    question: "Do I need to clean up my notes before generating a diagram?",
    answer:
      "No. Rough notes can work, but concrete details help: include the goal, actors, steps, decisions, owners, dependencies, and open questions.",
  },
  {
    id: "workflow-to-swimlane",
    question: "Can I turn a workflow description into a swimlane diagram?",
    answer:
      "Yes. Paste the workflow, name the teams or roles when possible, and choose a swimlane format. SynthBoard maps the work into lanes you can edit.",
  },
  {
    id: "why-synthboard",
    question: "When should I use SynthBoard instead of drawing manually?",
    answer:
      "Use SynthBoard when the structure is hidden inside text. It creates the first diagram draft so you can refine the visual instead of starting from a blank canvas.",
  },
];

const META_TAGS = [
  {
    selector: 'meta[name="description"]',
    attrs: {
      name: "description",
      content:
        "Clear answers about turning transcripts, meeting notes, specs, workflows, and text into editable draw.io diagrams with SynthBoard.",
    },
  },
  {
    selector: 'link[rel="canonical"]',
    attrs: {
      rel: "canonical",
      href: "https://synthboard.click/faq",
    },
  },
  {
    selector: 'meta[property="og:title"]',
    attrs: {
      property: "og:title",
      content: "Transcript to Diagram FAQ | SynthBoard",
    },
  },
  {
    selector: 'meta[property="og:description"]',
    attrs: {
      property: "og:description",
      content:
        "Concise answers about converting transcripts, notes, and text into editable draw.io diagrams.",
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
      content: "https://synthboard.click/faq",
    },
  },
];

const FAQ_SCHEMA_ID = "synthboard-faq-schema";

function useFaqMeta() {
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
    const previousSchema = document.getElementById(FAQ_SCHEMA_ID);
    const previousSchemaText = previousSchema?.textContent || "";

    document.title = "Transcript to Diagram FAQ | SynthBoard";
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

    const schema = previousSchema || document.createElement("script");
    schema.id = FAQ_SCHEMA_ID;
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
    if (!schema.parentElement) {
      document.head.appendChild(schema);
    }

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

      if (previousSchema) {
        previousSchema.textContent = previousSchemaText;
        return;
      }
      document.getElementById(FAQ_SCHEMA_ID)?.remove();
    };
  }, []);
}

export default function Faq() {
  useFaqMeta();

  return (
    <main className="landing-page faq-page">
      <header className="topbar landing-nav">
        <span className="brand">
          Synth<span className="dot">Board</span>
        </span>
        <StartButton compact />
      </header>

      <div className="landing-shell">
        <section className="landing-hero faq-hero">
          <div className="landing-copy">
            <span className="pill">Diagram answers</span>
            <h1>FAQ for turning text, transcripts, and notes into diagrams.</h1>
            <p className="landing-lead">
              Short answers about using SynthBoard to create editable draw.io
              diagrams from transcripts, meeting notes, specs, workflows, and
              rough concepts.
            </p>
            <div className="intent-terms" aria-label="FAQ topics">
              <span>transcript to diagram</span>
              <span>meeting notes to flowchart</span>
              <span>text to draw.io diagram</span>
            </div>
            <div className="landing-actions">
              <StartButton />
              <span className="muted">
                Google sign-in is the only supported login method right now.
              </span>
            </div>
          </div>

          <div className="hero-visual faq-hero-visual" aria-label="Notes becoming an editable diagram">
            <div className="faq-visual-flow">
              <div className="faq-source-preview">
                <span>Meeting notes</span>
                <i />
                <i />
                <i />
              </div>
              <span className="visual-arrow" />
              <DiagramThumb type="flow" />
            </div>
            <div className="hero-visual-footer">
              <span>Paste source</span>
              <span>Choose structure</span>
              <span>Edit in draw.io</span>
            </div>
          </div>
        </section>

        <section className="landing-section faq-answer-section">
          <div className="section-heading">
            <span className="section-kicker">Quick answers</span>
            <h2>Common questions about transcript and notes to diagram workflows.</h2>
          </div>
          <div className="faq-answer-list">
            {FAQ_ITEMS.map((item) => (
              <article className="faq-answer-card" id={item.id} key={item.id}>
                <h2>{item.question}</h2>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <div>
            <span className="section-kicker">Start creating</span>
            <h2>Turn the source text you already have into an editable diagram.</h2>
            <p>
              Paste a transcript, meeting note, workflow, spec, or concept and
              generate a draw.io diagram you can keep refining.
            </p>
          </div>
          <StartButton />
        </section>
      </div>

      <LandingFooter>
        Clear answers for text, transcripts, notes, and editable draw.io diagrams.
      </LandingFooter>
    </main>
  );
}
