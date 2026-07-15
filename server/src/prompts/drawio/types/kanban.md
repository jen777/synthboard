# Kanban board

## Planning

- Use source-defined workflow stages in their real left-to-right order. Create one card per source task/item and assign it to exactly one current stage.
- Preserve owner, priority, ticket, or category metadata only when supplied. Do not invent tasks, WIP limits, owners, or progress.
- Plan card color only for a meaningful source category or priority and use it consistently.

## XML generation

- Implement equal-width vertical stage containers with clear headers and concise rounded task cards stacked inside using parent-relative geometry.
- Keep card styling consistent; show optional metadata as short secondary lines inside the card rather than extra nodes or edge labels.
- Do not connect cards by default. Add a connector only when the source explicitly describes a dependency or transition, and keep such semantics visually distinct from column membership.
