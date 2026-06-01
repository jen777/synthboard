// Thin fetch wrapper. All calls are same-origin and include the session cookie.
async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request("/api/user/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  presets: () => request("/api/visualizations/presets"),
  list: () => request("/api/visualizations"),
  get: (id) => request(`/api/visualizations/${id}`),
  create: (payload) =>
    request("/api/visualizations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, drawioXml) =>
    request(`/api/visualizations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ drawioXml }),
    }),
};
