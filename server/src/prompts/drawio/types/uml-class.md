# UML class diagram

## Planning

- Create one class/interface/enumeration per source-defined type. Preserve class names, attributes, methods, types, visibility, stereotypes, and multiplicities only when supported.
- Plan three readable compartments: class name, attributes, and methods. Empty compartments may be omitted when the source has no such details.
- Distinguish inheritance, realization, composition, aggregation, association, and dependency. Use source-supported cardinalities such as `1`, `0..1`, `*`, or `1..*`.

## XML generation

- Use a UML class container or a titled swimlane/table-like class box with aligned compartments. Encode `+`, `-`, `#`, and `~` visibility literally and escape structured HTML labels.
- Use straight relationships by default. Use open triangle markers for inheritance/realization, filled diamonds for composition, open diamonds for aggregation, and dashed lines for dependencies.
- Put multiplicity labels at relationship ends only when the source provides them. Keep class boxes aligned and do not turn associations into directional flowchart arrows without evidence.
