// habilita fallback de navegação
export function setupOfflineFallback() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      fetch('/offline.html'); // pré-carrega offline
    });
  }
}
