import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api } from "./api.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import DrawioAlternativeLanding from "./pages/DrawioAlternativeLanding.jsx";
import TextToDrawioLanding from "./pages/TextToDrawioLanding.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Create from "./pages/Create.jsx";
import Viewer from "./pages/Viewer.jsx";
import Admin from "./pages/Admin.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setQuota(data.quota || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, quota, setQuota, refresh }}>
      {!user ? (
        <Routes>
          <Route path="/drawio-alternative" element={<DrawioAlternativeLanding />} />
          <Route path="/text-to-drawio-diagram" element={<TextToDrawioLanding />} />
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<Create />} />
            <Route path="/v/:id" element={<Viewer />} />
            {user.isAdmin && <Route path="/admin" element={<Admin />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </AuthContext.Provider>
  );
}
