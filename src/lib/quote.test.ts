import { describe, it, expect } from "vitest";
import { buildQuoteEmailPrompt } from "./quote";

describe("buildQuoteEmailPrompt", () => {
  it("includes the business name, contact name, and every line item", () => {
    const prompt = buildQuoteEmailPrompt(
      "Acme Construction",
      "Jamie Rivera",
      [
        { description: "2x4 Lumber", quantity: 50, unitPrice: 4.5 },
        { description: "Deck screws (box)", quantity: 3, unitPrice: 12.99 },
      ],
      263.97,
    );
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Jamie Rivera");
    expect(prompt).toContain("2x4 Lumber");
    expect(prompt).toContain("Deck screws (box)");
    expect(prompt).toContain("263.97");
  });

  it("instructs the model never to invent or adjust the numbers", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Widget", quantity: 1, unitPrice: 10 }],
      10,
    );
    expect(prompt).toContain("do not invent");
    expect(prompt).toContain("EXACT line items");
  });

  it("formats a single line item with quantity, unit price, and line total", () => {
    const prompt = buildQuoteEmailPrompt(
      "Solo Co",
      "Alex Kim",
      [{ description: "Widget", quantity: 1, unitPrice: 9.99 }],
      9.99,
    );
    expect(prompt).toContain("Widget: 1 x $9.99 = $9.99");
  });

  it("formats decimal prices and totals to two places", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Bolt", quantity: 100, unitPrice: 0.5 }],
      50,
    );
    expect(prompt).toContain("$0.50");
    expect(prompt).toContain("Total: $50.00");
  });

  it("instructs the model to reply in the Subject/---/body format expected by parseEmailDraftResponse", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Widget", quantity: 1, unitPrice: 10 }],
      10,
    );
    expect(prompt).toContain("Subject: <subject line>");
    expect(prompt).toContain("---");
  });

  it("tells the model it doesn't know the rep's name and to sign off generically", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Widget", quantity: 1, unitPrice: 10 }],
      10,
    );
    expect(prompt).toContain("You do not know the rep's name");
    expect(prompt).toContain("never sign with the contact's name");
  });
});
