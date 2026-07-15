# Venn diagram

## Planning

- Use two or three source-defined sets. Plan labels for each unique region and only the intersections that the source actually describes.
- Do not invent shared items to fill empty overlap regions. Keep region labels short and assign each item to its exact set combination.
- Treat the set ellipses as the only intentionally overlapping primary objects; Venn diagrams do not need relationship connectors.

## XML generation

- Use large fixed-aspect ellipses with distinct fills and `fillOpacity` low enough that intersections remain visible. Keep borders and set labels legible.
- Place item labels in the correct unique or overlap region. Use text vertices when needed, but do not add arrows between sets.
- Keep all ellipse sizes and stroke treatments coherent and preserve the approved overlap geometry exactly.
