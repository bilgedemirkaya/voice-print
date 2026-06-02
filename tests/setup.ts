// Adds jest-dom matchers (e.g. toBeInTheDocument) to Vitest's expect.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// We import test APIs explicitly (globals off), so RTL's auto-cleanup doesn't
// register itself — unmount between tests here to avoid DOM leaking across tests.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; Framer Motion's useReducedMotion needs it.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
