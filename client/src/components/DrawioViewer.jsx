import { useMemo } from "react";

// Renders draw.io XML using the hosted diagrams.net viewer in an iframe.
// The `#R<urlencoded-xml>` fragment loads raw (uncompressed) diagram XML.
export default function DrawioViewer({ xml }) {
  const src = useMemo(() => {
    if (!xml) return null;
    const encoded = encodeURIComponent(xml);
    return `https://viewer.diagrams.net/?lightbox=1&highlight=0000ff&nav=1&toolbar=zoom%20layers#R${encoded}`;
  }, [xml]);

  if (!src) return null;

  return (
    <iframe
      className="viewer-frame"
      title="Diagram preview"
      src={src}
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}
