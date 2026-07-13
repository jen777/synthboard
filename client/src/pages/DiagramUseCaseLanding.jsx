import { useEffect } from "react";
import {
  DIAGRAM_USE_CASE_BY_SLUG,
  DIAGRAM_USE_CASES,
} from "./diagramUseCases.js";
import {
  DiagramThumb,
  InputGraphic,
  LandingFooter,
  StartButton,
} from "./Login.jsx";

const SCHEMA_ID = "synthboard-diagram-use-case-schema";

function upsertHeadTag(tag) {
  const element =
    document.head.querySelector(tag.selector) ||
    document.createElement(tag.attrs.rel ? "link" : "meta");

  Object.entries(tag.attrs).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  if (!element.parentElement) {
    document.head.appendChild(element);
  }
}

function useDiagramMeta(page) {
  useEffect(() => {
    const metaTags = [
      {
        selector: 'meta[name="description"]',
        attrs: {
          name: "description",
          content: page.metaDescription,
        },
      },
      {
        selector: 'link[rel="canonical"]',
        attrs: {
          rel: "canonical",
          href: page.canonical,
        },
      },
      {
        selector: 'meta[property="og:title"]',
        attrs: {
          property: "og:title",
          content: page.pageTitle,
        },
      },
      {
        selector: 'meta[property="og:description"]',
        attrs: {
          property: "og:description",
          content: page.metaDescription,
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
          content: page.canonical,
        },
      },
    ];
    const previousTitle = document.title;
    const previousTags = metaTags.map((tag) => {
      const node = document.head.querySelector(tag.selector);
      return {
        selector: tag.selector,
        node,
        attrs: node
          ? Array.from(node.attributes).map(({ name, value }) => [name, value])
          : null,
      };
    });
    const previousSchema = document.getElementById(SCHEMA_ID);
    const previousSchemaText = previousSchema?.textContent || "";

    document.title = page.pageTitle;
    metaTags.forEach(upsertHeadTag);

    const schema = previousSchema || document.createElement("script");
    schema.id = SCHEMA_ID;
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((item) => ({
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
      document.getElementById(SCHEMA_ID)?.remove();
    };
  }, [page]);
}

function RelatedStyleCard({ page }) {
  return (
    <a
      className="format-card format-link-card related-style-card"
      href={page.path}
      aria-label={`${page.label} use-case page`}
    >
      <DiagramThumb type={page.type} />
      <h3>{page.label}</h3>
      <p>{page.metaDescription}</p>
      <span className="format-card-link">View use case</span>
    </a>
  );
}

export default function DiagramUseCaseLanding({ slug }) {
  const page = DIAGRAM_USE_CASE_BY_SLUG[slug] || DIAGRAM_USE_CASES[0];
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const relatedPages = DIAGRAM_USE_CASES.filter((item) => item.slug !== page.slug);

  useDiagramMeta(page);

  return (
    <main className={`landing-page diagram-use-case-page diagram-use-case-${page.key}`}>
      <header className="topbar landing-nav">
        <a className="brand" href="/">
          Synth<span className="dot">Board</span>
        </a>
        <StartButton compact />
      </header>

      <div className="landing-shell">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="pill">{page.pill}</span>
            <h1>{page.h1}</h1>
            <p className="landing-lead">{page.lead}</p>
            <div className="intent-terms" aria-label={`${page.label} search terms`}>
              {page.terms.map((term) => (
                <span key={term}>{term}</span>
              ))}
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
            <div className="hero-metrics" aria-label={`${page.label} generation workflow`}>
              <span><b>Text</b> source material</span>
              <span><b>{page.shortLabel}</b> first draft</span>
              <span><b>draw.io</b> editable output</span>
            </div>
          </div>

          <div className="hero-visual diagram-style-visual" aria-label={`${page.label} preview`}>
            <div className="diagram-style-preview">
              <div className="diagram-style-source" aria-hidden="true">
                <span>{page.shortLabel} input</span>
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="visual-arrow" aria-hidden="true" />
              <DiagramThumb type={page.type} />
            </div>
            <div className="hero-visual-footer">
              {page.heroFooter.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section compact-section good-inputs-section">
          <div className="good-inputs-layout">
            <div className="section-heading">
              <span className="section-kicker">Best inputs</span>
              <h2>Start from the source material you already have.</h2>
              <p>
                Paste the rough text, choose {page.label.toLowerCase()} as the
                structure, then use the generated draw.io board as the editable
                starting point.
              </p>
            </div>
            <div className="input-orchestration" aria-hidden="true">
              <span>Source text</span>
              <i />
              <span>{page.shortLabel} draft</span>
              <i />
              <span>Draw.io edit</span>
            </div>
          </div>
          <div className="use-case-grid diagram-input-grid">
            {page.inputs.map((item) => (
              <article className="feature-card" key={item.label}>
                <InputGraphic type={item.graphic} />
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
            <span className="section-kicker">Generated output</span>
            <h2>Get a structured draft instead of a blank canvas.</h2>
            <p>
              SynthBoard turns unstructured notes into a practical diagram
              shape that remains editable in the draw.io workflow.
            </p>
          </div>
          <div className="outcome-grid" aria-label={`${page.label} generated output`}>
            {page.outcomes.map((outcome) => (
              <article className="outcome-card" key={outcome}>
                <DiagramThumb type={page.type} />
                <p>{outcome}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section faq-section">
          <div className="section-heading">
            <span className="section-kicker">Questions</span>
            <h2>Common questions about {page.label.toLowerCase()} generation.</h2>
          </div>
          <div className="faq-grid">
            {page.faqs.map((item) => (
              <article className="faq-card" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section compact-section">
          <div className="section-heading">
            <span className="section-kicker">Related diagram styles</span>
            <h2>Choose the structure that fits the material.</h2>
            <p>
              Flow, sequence, mind map, ER, swimlane, timeline, and org chart
              pages are separate so each use case has its own focused route.
            </p>
          </div>
          <div className="format-grid related-style-grid" aria-label="Related diagram style pages">
            {relatedPages.map((item) => (
              <RelatedStyleCard page={item} key={item.slug} />
            ))}
          </div>
        </section>

        <section className="landing-final">
          <div>
            <span className="section-kicker">Start creating</span>
            <h2>Sign in with Google and generate your first editable {page.label.toLowerCase()}.</h2>
            <p>
              Paste the source material, choose the diagram style, and keep
              refining the generated draw.io output from there.
            </p>
          </div>
          <StartButton />
        </section>
      </div>

      <LandingFooter>
        Focused diagram use cases, editable draw.io output.
      </LandingFooter>
    </main>
  );
}
