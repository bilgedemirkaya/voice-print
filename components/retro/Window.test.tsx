import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Window } from "./Window";

describe("Window", () => {
  it("renders the title and children", () => {
    render(
      <Window title="Visualizer">
        <p>body content</p>
      </Window>,
    );
    expect(screen.getByText("Visualizer")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("calls onMinimize and onClose from the title-bar controls", async () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="W" onClose={onClose} onMinimize={onMinimize}>
        x
      </Window>,
    );

    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the controls when no handlers are provided", () => {
    render(<Window title="W">x</Window>);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Minimize" })).toBeNull();
  });
});
