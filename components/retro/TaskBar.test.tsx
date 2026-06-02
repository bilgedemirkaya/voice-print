import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TaskBar } from "./TaskBar";

function expectedClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

describe("TaskBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the Start button and a clock that re-renders on tick", () => {
    const t0 = new Date("2025-06-01T10:30:00");
    vi.setSystemTime(t0);

    render(<TaskBar />);

    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();

    const clock = screen.getByRole("status", { name: "Clock" });
    expect(clock).toHaveTextContent(expectedClock(t0));

    // Advancing the fake clock by a minute moves time forward and fires the interval.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const t1 = new Date(t0.getTime() + 60_000);
    expect(clock).toHaveTextContent(expectedClock(t1));
  });

  it("calls onStartClick when Start is pressed", () => {
    vi.setSystemTime(new Date("2025-06-01T10:30:00"));
    const onStartClick = vi.fn();
    render(<TaskBar onStartClick={onStartClick} />);

    act(() => {
      screen.getByRole("button", { name: /start/i }).click();
    });

    expect(onStartClick).toHaveBeenCalledTimes(1);
  });
});
