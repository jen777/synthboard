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
  models: () => request("/api/visualizations/models"),
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

  admin: {
    stats: () => request("/api/admin/stats"),
    generations: () => request("/api/admin/generations"),
    users: () => request("/api/admin/users"),
    setUserAdmin: (id, isAdmin) =>
      request(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin }),
      }),
    setUserLevel: (id, level) =>
      request(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ level }),
      }),
    deleteUser: (id) =>
      request(`/api/admin/users/${id}`, { method: "DELETE" }),
    settings: () => request("/api/admin/settings"),
    saveSettings: (settings) =>
      request("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    iconLibraries: () => request("/api/admin/icon-libraries"),
    iconLibraryObjects: (id) =>
      request(`/api/admin/icon-libraries/${encodeURIComponent(id)}/objects`),
    iconLibraryObjectPreview: (libraryId, objectId) =>
      request(
        `/api/admin/icon-libraries/${encodeURIComponent(libraryId)}/objects/${encodeURIComponent(objectId)}/preview`,
      ),
    uploadIconLibrary: (payload) =>
      request("/api/admin/icon-libraries", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    deleteIconLibrary: (id) =>
      request(`/api/admin/icon-libraries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    llmCatalog: () => request("/api/admin/llm-catalog"),
    createLlmProvider: (payload) =>
      request("/api/admin/llm-providers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateLlmProvider: (id, payload) =>
      request(`/api/admin/llm-providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteLlmProvider: (id) =>
      request(`/api/admin/llm-providers/${id}`, { method: "DELETE" }),
    createLlmModel: (payload) =>
      request("/api/admin/llm-models", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateLlmModel: (id, payload) =>
      request(`/api/admin/llm-models/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteLlmModel: (id) =>
      request(`/api/admin/llm-models/${id}`, { method: "DELETE" }),
  },
};
