/**
 * Re-fill fields that render after the first pass.
 *
 * Many ATS forms (Workday, LinkedIn Easy Apply, any React/Vue SPA) mount inputs
 * asynchronously or in multi-step flows. After an initial fill we watch the DOM
 * for added nodes and re-run for a bounded window, debounced so our own
 * value-setting doesn't cause churn (already-filled fields are skipped).
 */
export function observeAndRefill(run: () => void, durationMs = 8000): () => void {
  let timer: number | undefined;

  const observer = new MutationObserver((mutations) => {
    const addedNodes = mutations.some((m) => m.type === 'childList' && m.addedNodes.length > 0);
    if (!addedNodes) return;
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(run, 250);
  });

  observer.observe(document.documentElement ?? document, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), durationMs);

  return () => observer.disconnect();
}
