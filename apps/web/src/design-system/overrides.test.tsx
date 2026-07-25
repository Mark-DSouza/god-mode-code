import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge, Button, Card, ProgressBar, Switch, Tabs } from "./index.ts";

/**
 * "Class-based overrides behave normally rather than losing to inline styles."
 *
 * The shipped components merge everything into one inline `style` object, which
 * beats any class a caller passes. These pin the fix — and the accessible
 * semantics the originals leave out, which are the other half of why they are
 * reimplemented rather than imported.
 */
describe("class-based overrides", () => {
  it("lets a caller's class replace a conflicting base class", () => {
    render(
      <Button variant="primary" className="bg-error">
        Wipe runs
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Wipe runs" });
    // The base `bg-accent` is gone entirely rather than both being present and
    // the winner decided by Tailwind's emission order.
    expect(button.className).toContain("bg-error");
    expect(button.className).not.toContain("bg-accent");
  });

  it("keeps non-conflicting base classes when overriding one", () => {
    render(<Button className="bg-error">Wipe runs</Button>);

    const button = screen.getByRole("button", { name: "Wipe runs" });
    expect(button.className).toContain("rounded-sm");
    expect(button.className).toContain("uppercase");
  });

  it("does not write an inline style that a class could not beat", () => {
    render(<Button className="bg-error">Wipe runs</Button>);

    // The whole defect in one assertion.
    expect(screen.getByRole("button", { name: "Wipe runs" })).not.toHaveAttribute("style");
  });

  it("applies to the surfaces too, not just buttons", () => {
    render(
      <Card className="rounded-pill" data-testid="panel">
        Panel
      </Card>,
    );

    const card = screen.getByTestId("panel");
    expect(card.className).toContain("rounded-pill");
    expect(card.className).not.toContain("rounded-md");
  });

  it("forwards arbitrary DOM props through to the element", () => {
    render(
      <Badge data-testid="chip" aria-label="Seniority">
        Junior
      </Badge>,
    );
    expect(screen.getByTestId("chip")).toHaveAttribute("aria-label", "Seniority");
  });
});

describe("accessible semantics the originals lack", () => {
  it("gives progress a role and bounds", () => {
    render(<ProgressBar value={40} max={80} label="Passage progress" />);

    const bar = screen.getByRole("progressbar", { name: "Passage progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "80");
  });

  it("makes the toggle a real control that Space operates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Digital rain" />);

    const toggle = screen.getByRole("switch", { name: "Digital rain" });
    await user.tab();
    expect(toggle).toHaveFocus();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("moves between tabs with the arrow keys and keeps one tab stop", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        label="Leaderboard period"
        value="today"
        onChange={onChange}
        items={[
          { id: "today", label: "Today" },
          { id: "week", label: "This week" },
          { id: "all", label: "All time" },
        ]}
      />,
    );

    // Only the selected tab is in the tab order; the rest are reached with
    // arrows. Otherwise a keyboard user Tabs through every filter to reach the
    // table below.
    expect(screen.getByRole("tab", { name: "Today" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "This week" })).toHaveAttribute("tabindex", "-1");

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("week");
  });
});
