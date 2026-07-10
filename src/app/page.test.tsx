import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";

// The flow-map paints to a canvas and measures the DOM per frame — behavior jsdom
// can't drive. Stub it so this smoke test verifies the app shell mounts and the
// (dynamically imported) stage slot appears, not that the canvas renders.
vi.mock("@/viz/flowmap/FlowMap", () => ({
  FlowMap: () => <div data-testid="flowmap-stub" />,
}));

describe("Home route (S0.1 smoke)", () => {
  it("mounts and renders the app shell", async () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /streamlab/i })).toBeInTheDocument();
    expect(await screen.findByTestId("flowmap-stub")).toBeInTheDocument();
  });
});
