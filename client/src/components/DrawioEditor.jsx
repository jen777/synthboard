import { useEffect, useRef } from "react";

// Full draw.io editor embedded via the JSON postMessage protocol described in
// https://github.com/jgraph/drawio/discussions/5612
//
// Embed mode runs only on embed.diagrams.net and talks to us over postMessage:
//   - editor sends {event:"init"}        → we reply with {action:"load", ...}
//   - editor sends {event:"autosave"}    → on every edit (we persist, debounced)
//   - editor sends {event:"save"}        → on explicit Save click
//   - editor sends {event:"exit"}        → user hit the (hidden) exit affordance
//
// URL params:
//   embed=1      activate embed mode
//   proto=json   exchange messages as JSON strings
//   spin=1       loading spinner until we send `load`
//   libraries=1  show the shape libraries panel
//   noExitBtn=1  hide Exit (we're embedded inline, nowhere to exit to)
//   configure=0  no separate configure round-trip
const EDITOR_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&configure=0";

export default function DrawioEditor({ xml, title, onChange }) {
  const iframeRef = useRef(null);
  // Keep latest props in refs so the message handler (bound once) always reads
  // current values without re-subscribing.
  const xmlRef = useRef(xml);
  const titleRef = useRef(title);
  const onChangeRef = useRef(onChange);
  xmlRef.current = xml;
  titleRef.current = title;
  onChangeRef.current = onChange;

  useEffect(() => {
    function handleMessage(evt) {
      const frame = iframeRef.current;
      if (!frame || evt.source !== frame.contentWindow) return;
      if (typeof evt.data !== "string" || !evt.data.startsWith("{")) return;

      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      const post = (payload) =>
        frame.contentWindow.postMessage(JSON.stringify(payload), "*");

      switch (msg.event) {
        case "init":
          // Editor ready — load the diagram. dark/fit/title per the discussion.
          post({
            action: "load",
            xml: xmlRef.current || "",
            title: titleRef.current || "Diagram",
            autosave: 1,
            dark: true,
            modified: "unsavedChanges",
          });
          break;
        case "autosave":
        case "save":
          if (msg.xml && onChangeRef.current) onChangeRef.current(msg.xml);
          // Clear the "unsaved changes" indicator in the editor's status bar.
          post({ action: "status", modified: false, messageKey: "allChangesSaved" });
          break;
        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      className="viewer-frame"
      title="Diagram editor"
      src={EDITOR_URL}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
    />
  );
}
