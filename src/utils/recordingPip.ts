export async function requestScreenWakeLock(): Promise<(() => void) | null> {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return () => void lock?.release();
  } catch {
    return null;
  }
}
