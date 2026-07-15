# Entity-relationship diagram

## Planning

- Create one table-style entity per source-defined entity. List attributes with data type and PK/FK/UK markers only when supplied or directly derivable from declared keys.
- Plan relationship cardinality and optionality on both ends. Introduce an associative entity for many-to-many relationships only when the source supports it.
- Keep entity names and attribute naming conventions consistent with the source; do not invent columns to make the schema look complete.

## XML generation

- Use table/container entities with a strong header and aligned attribute rows. Keep keys visually clear without excessive colors.
- Use `entityRelationEdgeStyle` and consistent crow's-foot/optionality markers. Relationships normally have no directional process arrow.
- Keep relationship labels short and avoid routing through entity bodies. Preserve every cardinality from the plan exactly.
