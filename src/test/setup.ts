import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

export const mockDialogOpen = vi.fn();
export const mockDragDropCallbacks: Array<(event: { payload: unknown }) => void> = [];
export const mockSetZoom = vi.fn(async () => {});

Object.defineProperty(window, "__TAURI_INTERNALS__", {
  configurable: true,
  value: {},
});

// jsdom doesn't ship matchMedia, but the appStore reads it at module init to
// pick a theme. Returning a stub keeps imports cheap for component tests.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockDialogOpen,
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setZoom: mockSetZoom,
    onDragDropEvent: vi.fn(async (callback: (event: { payload: unknown }) => void) => {
      mockDragDropCallbacks.push(callback);
      return vi.fn();
    }),
  }),
}));

afterEach(() => {
  cleanup();
  mockDialogOpen.mockReset();
  mockSetZoom.mockClear();
  mockDragDropCallbacks.length = 0;
});
