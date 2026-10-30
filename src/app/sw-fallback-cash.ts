// habilita fallback de navegação
export function setupOfflineFallback() {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then(() => fetch('/offline.html')) // pré-carrega offline
      .catch(() => undefined);
  }
}
