import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";
import { api } from "../api.js";

export default function Layout({ children }) {
  const { user, quota, refresh } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout();
    await refresh();
    navigate("/");
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Synth<span className="dot">Board</span>
        </Link>
        <div className="row">
          {user.levelName && (
            <span
              className="level-badge"
              title={`Level ${user.level} · ${user.levelName}`}
            >
              <span className="level-badge-tier">Lvl {user.level}</span>
              <span className="level-badge-name">{user.levelName}</span>
            </span>
          )}
          {quota && (
            <span
              className="pill"
              title={`${quota.remaining} of ${quota.limit} visualizations available (${quota.used} used)`}
            >
              {quota.remaining} / {quota.limit} visualizations left
            </span>
          )}
          {user.isAdmin && (
            <Link to="/admin" className="muted">
              Admin
            </Link>
          )}
          <span className="muted">{user.name || user.email}</span>
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: "50%" }}
            />
          )}
          <button onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      {children}
    </>
  );
}
