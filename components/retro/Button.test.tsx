import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("fires onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>OK</Button>);

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button", () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole("button", { name: "OK" })).toHaveAttribute("type", "button");
  });

  it("carries the pressed + focus-visible utility classes", () => {
    render(<Button>OK</Button>);
    const button = screen.getByRole("button", { name: "OK" });
    expect(button.className).toContain("active:bevel-pressed");
    expect(button.className).toContain("focus-visible:outline");
  });

  it("is keyboard-focusable (tab-reachable)", async () => {
    const user = userEvent.setup();
    render(<Button>OK</Button>);

    await user.tab();

    expect(screen.getByRole("button", { name: "OK" })).toHaveFocus();
  });
});
