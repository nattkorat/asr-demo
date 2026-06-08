import { useRef, useCallback } from "react";
import { WS_URL } from "../services/api";

/**
 * useWebSocket — manages the ASR WebSocket lifecycle.
 *
 * Returns { openWS, closeWS }
 * Callbacks: onPartial(text), onFinal(text), onStatus(state, msg), onClose()
 */
export function useWebSocket({ onPartial, onFinal, onStatus, onClose }) {
  const wsRef = useRef(null);

  const openWS = useCallback(() => {
    const ws = new WebSocket(WS_URL());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen  = () => onStatus("connected", "connected — recording…");
    ws.onerror = () => onStatus("", "websocket error");
    ws.onclose = () => onClose?.();

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "final" || msg.transcript) {
          onFinal((msg.transcript || msg.text || "").trim());
        } else if (msg.type === "partial" || msg.partial) {
          onPartial(msg.partial || msg.text || "");
        } else if (msg.type === "error") {
          onStatus("", "error: " + msg.message);
        }
      } catch {
        onFinal(String(e.data).trim());
      }
    };

    return ws;
  }, [onPartial, onFinal, onStatus, onClose]);

  const closeWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
  }, []);

  const sendBinary = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { openWS, closeWS, sendBinary };
}
