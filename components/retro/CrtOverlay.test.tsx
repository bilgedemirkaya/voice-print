import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CrtOverlay } from "./CrtOverlay";

describe("CrtOverlay", () => {
  it("renders an aria-hidden overlay when enabled", () => {
    const { container } = render(<CrtOverlay enabled />);
    const overlay = container.firstElementChild;
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute("aria-hidden");
  });

  it("renders nothing when disabled", () => {
    const { container } = render(<CrtOverlay enabled={false} />);
    expect(container.firstChild).toBeNull();
  });
});
