// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  loadMatrixPanelLayout,
  MATRIX_LEFT_PANEL_COLLAPSED_KEY,
  MATRIX_RIGHT_PANEL_COLLAPSED_KEY,
  saveMatrixPanelLayout,
} from "./matrix-panel-layout.ts";

afterEach(() => {
  localStorage.clear();
});

describe("matrix panel layout persistence", () => {
  it("defaults both panels to expanded", () => {
    expect(loadMatrixPanelLayout()).toEqual({
      leftCollapsed: false,
      rightCollapsed: false,
    });
  });

  it("round-trips collapsed panel state through localStorage", () => {
    saveMatrixPanelLayout({ leftCollapsed: true, rightCollapsed: false });
    expect(localStorage.getItem(MATRIX_LEFT_PANEL_COLLAPSED_KEY)).toBe("1");
    expect(localStorage.getItem(MATRIX_RIGHT_PANEL_COLLAPSED_KEY)).toBe("0");
    expect(loadMatrixPanelLayout()).toEqual({
      leftCollapsed: true,
      rightCollapsed: false,
    });
  });
});
