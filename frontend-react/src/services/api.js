// All API calls in one place — swap base URL here if needed
const BASE = "";

export const api = {
  health:     ()     => fetch(`${BASE}/api/health`).then(r => r.json()),
  transcribe: (form) => fetch(`${BASE}/api/transcribe`,  { method: "POST", body: form }),
  diarize:    (form) => fetch(`${BASE}/api/diarize`,     { method: "POST", body: form }),
  summarize:  (body) => fetch(`${BASE}/api/summarize`,   { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  report:     (body) => fetch(`${BASE}/api/report`,      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  uploadLogo: (form) => fetch(`${BASE}/api/upload-logo`, { method: "POST", body: form }),
};

export const WS_URL = () =>
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/asr`;
