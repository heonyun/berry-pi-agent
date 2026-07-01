// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MatrixDetailPane } from "./MatrixDetailPane.tsx";

describe("MatrixDetailPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes detail views as an accessible segmented tablist", () => {
    render(
      <MatrixDetailPane
        detailCell={{ row: 1, col: 2, body: "Summary text" }}
        detailFrontmatter="status: draft"
        detailTab="summary"
        domainCell={{
          value: null,
          body: "Summary text",
          frontmatter: "status: draft",
          provenance: undefined,
        }}
        onTabChange={vi.fn()}
        onBodyChange={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onFrontmatterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Cell detail views" })).toBeTruthy();
    expect(screen.getByTestId("detail-tab-summary").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("detail-tab-provenance").getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(screen.getByTestId("detail-tab-markdown").getAttribute("aria-selected")).toBe("false");
  });

  it("switches detail views with arrow keys", () => {
    const onTabChange = vi.fn();

    render(
      <MatrixDetailPane
        detailCell={{ row: 1, col: 2, body: "Summary text" }}
        detailFrontmatter="status: draft"
        detailTab="provenance"
        domainCell={{
          value: null,
          body: "Summary text",
          frontmatter: "status: draft",
          provenance: undefined,
        }}
        onTabChange={onTabChange}
        onBodyChange={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onFrontmatterChange={vi.fn()}
      />,
    );

    screen.getByTestId("detail-tab-provenance").focus();
    fireEvent.keyDown(screen.getByTestId("detail-tab-provenance"), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenLastCalledWith("markdown");
    expect(document.activeElement).toBe(screen.getByTestId("detail-tab-markdown"));

    fireEvent.keyDown(screen.getByTestId("detail-tab-provenance"), { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenLastCalledWith("summary");

    fireEvent.keyDown(screen.getByTestId("detail-tab-provenance"), { key: "Home" });
    expect(onTabChange).toHaveBeenLastCalledWith("summary");

    fireEvent.keyDown(screen.getByTestId("detail-tab-provenance"), { key: "End" });
    expect(onTabChange).toHaveBeenLastCalledWith("markdown");
  });

  it("shows frontmatter in provenance from domainCell", () => {
    render(
      <MatrixDetailPane
        detailCell={{ row: 1, col: 2, body: "Summary text" }}
        detailFrontmatter="status: draft"
        detailTab="provenance"
        domainCell={{
          value: null,
          body: "Summary text",
          frontmatter: "status: draft",
          provenance: undefined,
        }}
        onTabChange={vi.fn()}
        onBodyChange={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onFrontmatterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("status: draft")).toBeTruthy();
    expect(screen.queryByText("(empty)")).toBeNull();
  });
});
