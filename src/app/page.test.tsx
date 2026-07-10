import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";

// The flow-map paints to a canvas and measures the DOM per frame — behavior jsdom
// can't drive. Stub it so this smoke test verifies the app shell mounts, not that
// the canvas renders.
vi.mock("@/viz/flowmap/FlowMap", () => ({
  FlowMap: () => <div data-testid="flowmap-stub" />,
}));

describe("Home route (S0.1 smoke)", () => {
  it("holds the landing until launch, then shows the demo", async () => {
    render(<Home />);

    // The landing gates the screen: its thesis is up, the demo is not yet mounted.
    expect(screen.getByRole("heading", { name: /wired backwards/i })).toBeInTheDocument();
    expect(screen.queryByTestId("flowmap-stub")).not.toBeInTheDocument();

    // Launching swaps the landing out for the live demo.
    fireEvent.click(screen.getByRole("button", { name: /launch the live demo/i }));
    expect(screen.getByRole("heading", { name: /streamlab/i })).toBeInTheDocument();
    expect(await screen.findByTestId("flowmap-stub")).toBeInTheDocument();
  });
});
