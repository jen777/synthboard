# System and network architecture

## Planning

- Identify users/external systems, application components, data stores, queues, networks, and real deployment or ownership boundaries from the source.
- Preserve nested boundaries such as cloud/region/environment/network/subnet/zone/service. Keep external actors outside implementation containers.
- Prefer a source-supported gateway, broker, registry, or bus when it is the real convergence point. Avoid an unreadable all-to-all mesh.
- Use exact catalog visuals for named cloud products, branded services, network equipment, Kubernetes resources, or other standardized domain symbols; use semantic basic shapes for abstract services and inexact matches.

## XML generation

- Use titled nested containers with true parent-child hierarchy and parent-relative child geometry. Put edges between different containers at `parent="1"`.
- Use orthogonal connectors and short protocol/data labels such as HTTPS, gRPC, events, or reads only when supported. Keep external and internal flows visually distinct in one consistent way.
- Use cylinders for stores, hexagons for queues/events, clouds for networks, actors for users, and process/rounded rectangles for generic services. Retrieved visuals must keep the exact plan slot and fallback semantics.
