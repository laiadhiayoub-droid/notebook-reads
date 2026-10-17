import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

afterEach(() => vi.restoreAllMocks());

it("updates mobile state when the viewport crosses the breakpoint and cleans up", () => {
  let onChange: (() => void) | undefined;
  const removeEventListener = vi.fn();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event, listener) => {
      onChange = listener as () => void;
    }),
    removeEventListener,
    dispatchEvent: vi.fn(),
  }));
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(767);
  const { result, unmount } = renderHook(() => useIsMobile());
  expect(result.current).toBe(true);
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(768);
  act(() => onChange?.());
  expect(result.current).toBe(false);
  unmount();
  expect(removeEventListener).toHaveBeenCalledWith("change", onChange);
});