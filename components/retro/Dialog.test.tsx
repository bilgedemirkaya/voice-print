import { describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";

// Strip exit animations so closing removes the dialog synchronously (keeps motion.* real).
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
  };
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} title="Display Properties" onClose={() => setOpen(false)}>
        <button>OK</button>
        <button>Cancel</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "Display Properties" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab focus within the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const close = screen.getByRole("button", { name: "Close" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    // First focusable is the title-bar Close; Shift+Tab wraps to the last control.
    close.focus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();

    // Tab from the last control wraps back to the first.
    await user.tab();
    expect(close).toHaveFocus();
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
