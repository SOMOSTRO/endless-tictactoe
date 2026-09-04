export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Checks if the web app is running in standalone or window-controls-overlay display mode,
 * or as an installed iOS PWA home-screen app.
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const isWcoMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: window-controls-overlay)').matches;

  const isIosStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return Boolean(isStandaloneMatch || isWcoMatch || isIosStandalone);
}

/**
 * Returns contextual instructions for manual installation or unsupported browser environments.
 */
export function getManualInstallInstruction(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'To install, tap your browser menu and select "Add to Home Screen".';
  }

  // Check if browser lacks Service Worker or Cache API capabilities
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasCaches = 'caches' in window;
  if (!hasServiceWorker || !hasCaches) {
    return 'This browser does not support web app installation or offline play.';
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return 'To install on iOS, tap the Share button in Safari and select "Add to Home Screen".';
  }

  if (isAndroid) {
    return 'To install on Android, tap the browser menu (⋮) and select "Add to Home screen" or "Install App".';
  }

  return 'To install, tap your browser menu and select "Add to Home Screen" or "Install App".';
}

export interface PwaInstallerController {
  getDeferredPrompt: () => BeforeInstallPromptEvent | null;
  triggerInstall: () => Promise<boolean>;
  destroy: () => void;
}

/**
 * Initializes intelligent PWA installation logic with 3 visual states:
 * 1. Installable: shows install button, clears status text.
 * 2. Already Installed: hides button, shows "App installed."
 * 3. Unsupported / Prompt Dismissed: hides button, displays contextual manual install instructions.
 */
export function initPwaInstaller(
  btnId: string = 'seo-pwa-install-btn',
  statusId: string = 'pwa-status-text'
): PwaInstallerController {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const button = document.getElementById(btnId) as HTMLButtonElement | null;
  const statusEl = document.getElementById(statusId);

  const setInstalledState = (): void => {
    if (button) {
      button.hidden = true;
      button.setAttribute('hidden', '');
    }
    if (statusEl) {
      statusEl.textContent = 'App installed.';
    }
  };

  const setInstallableState = (): void => {
    if (isRunningStandalone()) return;
    if (button) {
      button.hidden = false;
      button.removeAttribute('hidden');
    }
    if (statusEl) {
      statusEl.textContent = '';
    }
  };

  const setManualOrUnsupportedState = (): void => {
    if (button) {
      button.hidden = true;
      button.setAttribute('hidden', '');
    }
    if (statusEl) {
      statusEl.textContent = getManualInstallInstruction();
    }
  };

  // Initial State Resolution
  if (isRunningStandalone()) {
    setInstalledState();
  } else {
    setManualOrUnsupportedState();
  }

  const handleBeforeInstallPrompt = (e: Event): void => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    if (!isRunningStandalone()) {
      setInstallableState();
    }
  };

  const handleAppInstalled = (): void => {
    setInstalledState();
    deferredPrompt = null;
  };

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalledState();
      } else {
        setManualOrUnsupportedState();
      }
      deferredPrompt = null;
      return choiceResult.outcome === 'accepted';
    } catch {
      deferredPrompt = null;
      setManualOrUnsupportedState();
      return false;
    }
  };

  const handleButtonClick = (): void => {
    void triggerInstall();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  if (button) {
    button.addEventListener('click', handleButtonClick);
  }

  // Handle display-mode media query transitions dynamically
  let standaloneMedia: MediaQueryList | null = null;
  let wcoMedia: MediaQueryList | null = null;
  const handleMediaChange = (): void => {
    if (isRunningStandalone()) {
      setInstalledState();
    }
  };

  if (typeof window.matchMedia === 'function') {
    try {
      standaloneMedia = window.matchMedia('(display-mode: standalone)');
      wcoMedia = window.matchMedia('(display-mode: window-controls-overlay)');
      standaloneMedia.addEventListener('change', handleMediaChange);
      wcoMedia.addEventListener('change', handleMediaChange);
    } catch {
      // matchMedia listeners not supported in some test/legacy environments
    }
  }

  const destroy = (): void => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    if (button) {
      button.removeEventListener('click', handleButtonClick);
    }
    if (standaloneMedia) {
      try {
        standaloneMedia.removeEventListener('change', handleMediaChange);
      } catch {
        // no-op
      }
    }
    if (wcoMedia) {
      try {
        wcoMedia.removeEventListener('change', handleMediaChange);
      } catch {
        // no-op
      }
    }
  };

  return {
    getDeferredPrompt: () => deferredPrompt,
    triggerInstall,
    destroy,
  };
}
