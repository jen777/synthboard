# Cross-functional swimlane diagram

## Planning

- Use one flat lane per actor, role, system, or department and assign every step to exactly one responsible lane.
- If the source explicitly has both actors and named phases, plan an actor-by-phase grid; otherwise keep the simpler one-dimensional swimlane layout.
- Order steps in the primary process direction. Use decision nodes and short branch labels, and do not duplicate a step merely because several actors interact with it.

## XML generation

- Implement lanes as same-sized root-level swimlane containers with a consistent header area. Children belong to their lane and use parent-relative geometry.
- Cross-lane edges must use `parent="1"`; do not clip them inside either lane. Use orthogonal flow connectors without manual waypoints.
- For a true actor-by-phase plan, use `shape=table;childLayout=tableLayout` with `tableRow` children and cells; do not nest swimlanes inside table rows.
