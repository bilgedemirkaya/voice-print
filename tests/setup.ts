// Adds jest-dom matchers (e.g. toBeInTheDocument) to Vitest's expect.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom-only: Framer Motion's useReducedMotion needs matchMedia. Guarded so node-env
// test files (// @vitest-environment node) can share this setup file without crashing.
if (typeof window !== "undefined" && !window.matchMedia) {
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

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
