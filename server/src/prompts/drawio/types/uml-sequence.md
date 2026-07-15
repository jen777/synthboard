# UML sequence diagram

## Planning

- Place actors and participants left-to-right across the top, then order every supported message top-to-bottom in time.
- Distinguish calls, asynchronous messages, responses, self-calls, and destruction only when supported. Include activation spans and alt/else, opt, loop, parallel, or critical frames only when the source expresses them.
- Keep message labels concise and faithful; do not infer return messages that are not present.

## XML generation

- Use actor or participant headers with UML lifeline shapes or vertical dashed lifeline vertices. Keep lifelines aligned and equally spaced.
- Use straight horizontal message edges with small arrowheads. Calls are solid, returns are dashed, and asynchronous messages use a consistent async/open marker.
- Preserve chronological y-order exactly. Frames and notes are containers/annotations, not additional participants, and must not obscure lifelines.
