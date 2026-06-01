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
          {quota && (
            <span className="pill">
              {quota.remaining} / {quota.limit} left
            </span>
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
