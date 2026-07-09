import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";

// The WebGL canvas needs a real GL context, which jsdom lacks. Stub it so this
// smoke test verifies the placeholder route mounts, not that three.js renders.
vi.mock("@/viz/ConduitCanvas", () => ({
  default: () => <div data-testid="conduit-canvas-stub" />,
}));

describe("Home route (S0.1 smoke)", () => {
  it("mounts and renders the app shell", async () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /streamlab/i })).toBeInTheDocument();
    expect(await screen.findByTestId("conduit-canvas-stub")).toBeInTheDocument();
  });
});
