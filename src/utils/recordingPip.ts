export type PipController = {
  close: () => void;
  updateTimer: (text: string, paused: boolean) => void;
};

type PipCallbacks = {
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: () => boolean;
};

export async function openRecordingPip(
  callbacks: PipCallbacks,
): Promise<PipController | null> {
  if (!("documentPictureInPicture" in window)) return null;

  try {
    const pip = await (
      window as Window & {
        documentPictureInPicture: {
          requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture.requestWindow({
      width: 300,
      height: 148,
    });

    pip.document.body.style.cssText =
      "margin:0;font-family:system-ui,sans-serif;background:#0B0F19;color:#fff;";
    pip.document.body.innerHTML = `
      <div style="padding:14px;display:flex;flex-direction:column;gap:10px;height:100%;box-sizing:border-box;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="rec-dot" style="width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;"></span>
          <span id="rec-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#fca5a5;">RECORDING</span>
        </div>
        <div id="rec-timer" style="font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;">00:00</div>
        <p style="margin:0;font-size:10px;line-height:1.4;color:#9ca3af;">Keep this window open. Share <b>Entire Screen</b> or the <b>target tab</b> — not this recorder tab.</p>
        <div style="display:flex;gap:8px;margin-top:auto;">
          <button id="rec-pause" type="button" style="flex:1;padding:8px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;font-size:12px;cursor:pointer;">Pause</button>
          <button id="rec-stop" type="button" style="flex:1;padding:8px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Stop</button>
        </div>
      </div>
    `;

    const timerEl = pip.document.getElementById("rec-timer");
    const labelEl = pip.document.getElementById("rec-label");
    const dotEl = pip.document.getElementById("rec-dot");
    const pauseBtn = pip.document.getElementById("rec-pause") as HTMLButtonElement;
    const stopBtn = pip.document.getElementById("rec-stop") as HTMLButtonElement;

    pauseBtn?.addEventListener("click", () => {
      if (callbacks.isPaused()) {
        callbacks.onResume();
        if (pauseBtn) pauseBtn.textContent = "Pause";
      } else {
        callbacks.onPause();
        if (pauseBtn) pauseBtn.textContent = "Resume";
      }
    });

    stopBtn?.addEventListener("click", () => callbacks.onStop());

    pip.addEventListener("pagehide", () => callbacks.onStop());

    return {
      close: () => {
        try {
          pip.close();
        } catch {
          /* already closed */
        }
      },
      updateTimer: (text: string, paused: boolean) => {
        if (timerEl) timerEl.textContent = text;
        if (labelEl) labelEl.textContent = paused ? "PAUSED" : "RECORDING";
        if (dotEl) {
          dotEl.style.background = paused ? "#f59e0b" : "#ef4444";
          dotEl.style.boxShadow = paused
            ? "0 0 8px #f59e0b"
            : "0 0 8px #ef4444";
        }
        if (pauseBtn) pauseBtn.textContent = paused ? "Resume" : "Pause";
      },
    };
  } catch {
    return null;
  }
}

export async function requestScreenWakeLock(): Promise<(() => void) | null> {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return () => void lock?.release();
  } catch {
    return null;
  }
}
