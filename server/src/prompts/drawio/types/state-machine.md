# State machine

## Planning

- Model stable states, not actions, and include one initial state plus terminal states only when supported.
- Express transitions as `event [guard] / action` using only the portions present in the source. Preserve direction and self-transitions.
- Plan compound states, choice, fork, and join nodes only when the source explicitly needs hierarchy or concurrency.

## XML generation

- Use UML state shapes or rounded rectangles, `startState` for the initial marker, and `endState` for final markers.
- Use consistent directed connectors with concise transition labels. Keep labels clear of state boundaries and do not convert guards into decision diamonds unless the plan calls for a choice node.
- Structurally contain nested states within their compound state and use root-level edges for transitions crossing state-container boundaries.
