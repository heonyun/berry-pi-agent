// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatrixOnboarding } from "./MatrixOnboarding.tsx";

describe("MatrixOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows onboarding until dismissed", () => {
    render(<MatrixOnboarding />);
    expect(screen.getByTestId("matrix-onboarding")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("matrix-onboarding")).toBeNull();
  });

  it("stays hidden when previously dismissed", () => {
    localStorage.setItem("context-matrix-onboarding-dismissed", "1");
    render(<MatrixOnboarding />);
    expect(screen.queryByTestId("matrix-onboarding")).toBeNull();
  });
});
