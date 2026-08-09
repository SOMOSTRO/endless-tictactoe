export function initPWA(): void {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // Resolve against the served document so installs work at the domain
      // root as well as when the Vite dist directory is hosted under a path.
      const swUrl = new URL('sw.js', document.baseURI);
      const scopeUrl = new URL('./', swUrl);

      void navigator.serviceWorker
        .register(swUrl.href, { scope: scopeUrl.pathname })
        .then((reg) => {
          console.info('SW registered for production:', reg.scope);
        })
        .catch((err: unknown) => {
          console.error('SW registration failed:', err);
        });
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
        console.info('Dev Mode: Unregistered existing Service Worker');
      }
    });
    if ('caches' in window) {
      void caches.keys().then((names) => {
        for (const name of names) {
          if (name.startsWith('endless-ttt-')) {
            void caches.delete(name);
          }
        }
      });
    }
  }
}
