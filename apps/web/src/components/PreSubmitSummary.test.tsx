import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreSubmitSummary } from "./PreSubmitSummary";

describe("pre-submit summary", () => {
  it("does not confirm after a failed simulation", () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmitSummary
        simulation={{ ok: false, message: "Simulation failed. The draft is unchanged." }}
        onConfirm={onConfirm}
      />,
    );
    const button = screen.getByRole("button", { name: "Confirm" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("enables confirm after a successful simulation", () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmitSummary
        simulation={{ ok: true, message: "Simulation succeeded.", fee: "0.01 XLM", signers: ["GABC"] }}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Estimated fee 0.01 XLM")).toBeTruthy();
  });
});
