# SynthBoard draw.io prompt guides

These guides are assembled into the two-stage diagram prompt at runtime:

- `common-planning.md` guides source interpretation and the structured plan.
- `common-xml.md` guides native draw.io XML generation.
- `types/*.md` contains a planning section and an XML-generation section for each SynthBoard preset.

The guidance is adapted from the Apache-2.0-licensed `jgraph/drawio-mcp` repository, especially `shared/xml-reference.md`, `shared/style-reference.md`, and the diagram conventions in `shared/mermaid-reference.md`, reviewed at upstream commit `d9dc69efea84e760e3e4a4855a0962a7b283ca0a` (2026-07-15).

SynthBoard deliberately adapts two upstream assumptions. It always emits native XML, and its server owns final deterministic geometry. The planning stage therefore chooses logical structure and layout intent, while the XML stage uses the exact approved plan slots and does not attempt ELK layout, libavoid routing, manual waypoints, or connection-port overrides.

Keep shared rules in the common files. Put only conventions unique to one diagram family in its type file. The loader injects only the section needed by the current stage.
