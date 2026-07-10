/**
 * S5.4 — the landing hero. Verifies the differentiator is legible up front (the
 * retrograde-demand thesis, AC1) and that there is a clear entry into the live demo
 * (AC2). The "0 functions" deploy (AC3) is a build property (static export), covered
 * by CI's `next build`, not a render test.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Landing } from "./Landing";

describe("S5.4 landing frames the thesis (AC1)", () => {
  it("headlines the 'neural network wired backwards' idea", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/wired backwards/i);
  });

  it("states the retrograde-demand thesis: the consumer drives the producer", () => {
    render(<Landing />);
    expect(screen.getByText(/consumer drives the producer/i)).toBeInTheDocument();
    expect(screen.getByText(/demand travels/i)).toBeInTheDocument();
  });

  it("makes the credibility claim — a pure function of a real execution log", () => {
    render(<Landing />);
    expect(
      screen.getByText(/pure function of a real Java Stream execution log/i),
    ).toBeInTheDocument();
  });
});

describe("S5.4 landing enters the demo (AC2)", () => {
  it("offers a call-to-action that launches the demo on click", () => {
    const onLaunch = vi.fn();
    render(<Landing onLaunch={onLaunch} />);
    const cta = screen.getByRole("button", { name: /launch the live demo/i });
    fireEvent.click(cta);
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });
});
