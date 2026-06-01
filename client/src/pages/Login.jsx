export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  return (
    <div className="center">
      <div className="card stack" style={{ maxWidth: 420, textAlign: "center" }}>
        <div className="brand" style={{ fontSize: 26 }}>
          Synth<span className="dot">Board</span>
        </div>
        <p className="muted">
          Turn notes, meeting transcripts, and docs into draw.io diagrams,
          UML, infographics, and more.
        </p>
        {error && (
          <div className="banner error">Sign-in failed. Please try again.</div>
        )}
        <a href="/auth/google">
          <button className="primary" style={{ width: "100%" }}>
            Continue with Google
          </button>
        </a>
        <small className="muted">Free accounts include 5 visualizations.</small>
      </div>
    </div>
  );
}
