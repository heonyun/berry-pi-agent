// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MatrixDetailPane } from "./MatrixDetailPane.tsx";

describe("MatrixDetailPane", () => {
  afterEach(() => {
    cleanup();
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
