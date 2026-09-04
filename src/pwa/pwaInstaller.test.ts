import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getManualInstallInstruction,
  initPwaInstaller,
  isRunningStandalone,
  type BeforeInstallPromptEvent,
} from './pwaInstaller';

interface MockButton {
  id: string;
  hidden: boolean;
  attributes: Record<string, string>;
  listeners: Record<string, ((e?: unknown) => void)[]>;
  setAttribute: (key: string, value: string) => void;
  removeAttribute: (key: string) => void;
  hasAttribute: (key: string) => boolean;
  addEventListener: (event: string, handler: (e?: unknown) => void) => void;
  removeEventListener: (event: string, handler: (e?: unknown) => void) => void;
  click: () => void;
}

interface MockStatusElement {
  id: string;
  textContent: string;
}

function createMockButton(id: string): MockButton {
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  const attributes: Record<string, string> = { hidden: '' };

  const button: MockButton = {
    id,
    hidden: true,
    attributes,
    listeners,
    setAttribute(key: string, value: string) {
      attributes[key] = value;
      if (key === 'hidden') button.hidden = true;
    },
    removeAttribute(key: string) {
      delete attributes[key];
      if (key === 'hidden') button.hidden = false;
    },
    hasAttribute(key: string) {
      return key in attributes;
    },
    addEventListener(event: string, handler: (e?: unknown) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event: string, handler: (e?: unknown) => void) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    click() {
      if (listeners['click']) {
        listeners['click'].forEach((h) => h());
      }
    },
  };

  return button;
}

describe('PWA Installer Module', () => {
  let mockButton: MockButton;
  let mockStatus: MockStatusElement;
  let windowListeners: Record<string, ((e: unknown) => void)[]>;
  let mockNavigator: {
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
    serviceWorker?: unknown;
  };

  beforeEach(() => {
    mockButton = createMockButton('seo-pwa-install-btn');
    mockStatus = { id: 'pwa-status-text', textContent: '' };
    windowListeners = {};

    const mockWindow = {
      caches: {},
      addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
        if (!windowListeners[event]) return;
        windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        const handlers = windowListeners[event.type];
        if (handlers) {
          handlers.forEach((h) => h(event));
        }
        return true;
      }),
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    };

    const mockDocument = {
      getElementById: vi.fn((id: string) => {
        if (id === 'seo-pwa-install-btn') return mockButton as unknown as HTMLElement;
        if (id === 'pwa-status-text') return mockStatus as unknown as HTMLElement;
        return null;
      }),
    };

    mockNavigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      maxTouchPoints: 0,
      standalone: false,
      serviceWorker: {},
    };

    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: mockDocument,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe('getManualInstallInstruction', () => {
    it('returns unsupported message if browser lacks service worker or caches', () => {
      delete mockNavigator.serviceWorker;
      expect(getManualInstallInstruction()).toBe(
        'This browser does not support web app installation or offline play.'
      );
    });

    it('returns iOS specific instruction on iPhone/iPad', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
      expect(getManualInstallInstruction()).toBe(
        'To install on iOS, tap the Share button in Safari and select "Add to Home Screen".'
      );
    });

    it('returns Android specific instruction on Android devices', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
      expect(getManualInstallInstruction()).toBe(
        'To install on Android, tap the browser menu (⋮) and select "Add to Home screen" or "Install App".'
      );
    });

    it('returns desktop browser instruction for standard desktop browsers', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
      expect(getManualInstallInstruction()).toBe(
        'To install, tap your browser menu and select "Add to Home Screen" or "Install App".'
      );
    });
  });

  describe('initPwaInstaller Visual States', () => {
    it('detects browser standalone and window-controls-overlay modes', () => {
      expect(isRunningStandalone()).toBe(false);

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('standalone'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      expect(isRunningStandalone()).toBe(true);

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('window-controls-overlay'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      expect(isRunningStandalone()).toBe(true);

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      mockNavigator.standalone = true;

      expect(isRunningStandalone()).toBe(true);
    });

    it('initializes in manual/fallback state when not standalone and before prompt fires', () => {
      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      expect(mockButton.hidden).toBe(true);
      expect(mockStatus.textContent).toBe(
        'To install, tap your browser menu and select "Add to Home Screen" or "Install App".'
      );

      controller.destroy();
    });

    it('transitions to installable state on beforeinstallprompt event (shows button, clears text)', () => {
      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      let defaultPrevented = false;
      const mockPromptEvent = {
        type: 'beforeinstallprompt',
        preventDefault: () => {
          defaultPrevented = true;
        },
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      window.dispatchEvent(mockPromptEvent);

      expect(defaultPrevented).toBe(true);
      expect(controller.getDeferredPrompt()).toBe(mockPromptEvent);
      expect(mockButton.hidden).toBe(false);
      expect(mockButton.hasAttribute('hidden')).toBe(false);
      expect(mockStatus.textContent).toBe('');

      controller.destroy();
    });

    it('transitions to installed state upon accepting installation (hides button, shows App installed.)', async () => {
      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      const promptFn = vi.fn().mockResolvedValue(undefined);
      const mockPromptEvent = {
        type: 'beforeinstallprompt',
        preventDefault: vi.fn(),
        prompt: promptFn,
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      window.dispatchEvent(mockPromptEvent);
      expect(mockButton.hidden).toBe(false);
      expect(mockStatus.textContent).toBe('');

      mockButton.click();

      await vi.waitFor(() => {
        expect(promptFn).toHaveBeenCalledTimes(1);
        expect(mockButton.hidden).toBe(true);
        expect(mockButton.hasAttribute('hidden')).toBe(true);
        expect(mockStatus.textContent).toBe('App installed.');
        expect(controller.getDeferredPrompt()).toBeNull();
      });

      controller.destroy();
    });

    it('reverts to manual instruction state if installation prompt is dismissed', async () => {
      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      const promptFn = vi.fn().mockResolvedValue(undefined);
      const mockPromptEvent = {
        type: 'beforeinstallprompt',
        preventDefault: vi.fn(),
        prompt: promptFn,
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      window.dispatchEvent(mockPromptEvent);
      expect(mockButton.hidden).toBe(false);
      expect(mockStatus.textContent).toBe('');

      mockButton.click();

      await vi.waitFor(() => {
        expect(promptFn).toHaveBeenCalledTimes(1);
        expect(mockButton.hidden).toBe(true);
        expect(mockButton.hasAttribute('hidden')).toBe(true);
        expect(mockStatus.textContent).toBe(
          'To install, tap your browser menu and select "Add to Home Screen" or "Install App".'
        );
        expect(controller.getDeferredPrompt()).toBeNull();
      });

      controller.destroy();
    });

    it('hides install button and sets App installed. when appinstalled event fires', () => {
      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      const mockPromptEvent = {
        type: 'beforeinstallprompt',
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      window.dispatchEvent(mockPromptEvent);
      expect(mockButton.hidden).toBe(false);

      window.dispatchEvent({ type: 'appinstalled' } as unknown as Event);
      expect(mockButton.hidden).toBe(true);
      expect(mockButton.hasAttribute('hidden')).toBe(true);
      expect(mockStatus.textContent).toBe('App installed.');
      expect(controller.getDeferredPrompt()).toBeNull();

      controller.destroy();
    });

    it('shows App installed. when app starts already running in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('standalone'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const controller = initPwaInstaller('seo-pwa-install-btn', 'pwa-status-text');

      expect(mockButton.hidden).toBe(true);
      expect(mockStatus.textContent).toBe('App installed.');

      const mockPromptEvent = {
        type: 'beforeinstallprompt',
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      } as unknown as BeforeInstallPromptEvent;

      window.dispatchEvent(mockPromptEvent);

      expect(mockButton.hidden).toBe(true);
      expect(mockStatus.textContent).toBe('App installed.');

      controller.destroy();
    });
  });
});
