// ═══════════════════════════════════════════════════════════════════════════
// Safe DOM utilities — type-safe element lookups with guard clauses
// ═══════════════════════════════════════════════════════════════════════════

const ELEMENT_MISSING = (id: string, type: string): string =>
  `DOM lookup failed: expected element #${id} to be ${type}`;

export function getElementById(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function requireHtmlElement(id: string): HTMLElement {
  const el = getElementById(id);
  if (el === null) {
    throw new Error(ELEMENT_MISSING(id, 'an HTMLElement'));
  }
  return el;
}

export function requireButtonElement(id: string): HTMLButtonElement {
  const el = getElementById(id);
  if (el === null || !(el instanceof HTMLButtonElement)) {
    throw new Error(ELEMENT_MISSING(id, 'an HTMLButtonElement'));
  }
  return el;
}

export function safeAddEventListener<K extends keyof HTMLElementEventMap>(
  el: HTMLElement | null,
  type: K,
  listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
  options?: AddEventListenerOptions
): void {
  if (el) {
    el.addEventListener(type, listener, options);
  }
}

export function safeSetTextContent(el: HTMLElement | null, text: string): void {
  if (el) {
    el.textContent = text;
  }
}

export function safeToggleClass(
  el: HTMLElement | null,
  className: string,
  force?: boolean
): void {
  if (el) {
    el.classList.toggle(className, force);
  }
}

export function safeSetAttribute(
  el: HTMLElement | null,
  name: string,
  value: string
): void {
  if (el) {
    el.setAttribute(name, value);
  }
}

export function safeRemoveAttribute(
  el: HTMLElement | null,
  name: string
): void {
  if (el) {
    el.removeAttribute(name);
  }
}
