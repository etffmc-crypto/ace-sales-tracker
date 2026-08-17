import { describe, it, expect } from "vitest";
import { buildFollowUpEmailPrompt, parseEmailDraftResponse } from "./followUpEmail";

describe("buildFollowUpEmailPrompt", () => {
  it("includes notes and next action when a last interaction exists", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "Acme Construction",
      accountType: "CONTRACTOR",
      contactName: "Jamie Rivera",
      lastInteraction: {
        type: "VISIT",
        date: "2026-08-10",
        notes: "Discussed bulk fastener pricing.",
        nextAction: "Send a quote for 500 units.",
      },
    });
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Jamie Rivera");
    expect(prompt).toContain("Discussed bulk fastener pricing.");
    expect(prompt).toContain("Send a quote for 500 units.");
    expect(prompt).toContain("visit");
  });

  it("omits placeholder text for missing notes/next action without crashing", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "Acme Construction",
      accountType: "CONTRACTOR",
      contactName: "Jamie Rivera",
      lastInteraction: {
        type: "CALL",
        date: "2026-08-10",
        notes: null,
        nextAction: null,
      },
    });
    expect(prompt).not.toContain("null");
    expect(prompt).toContain("No notes were recorded");
    expect(prompt).toContain("No specific next action was recorded");
  });

  it("requests a generic introductory email when there is no last interaction", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "New Prospect Co",
      accountType: "OTHER",
      contactName: "Sam Lee",
      lastInteraction: null,
    });
    expect(prompt).toContain("no recorded interactions");
    expect(prompt).toContain("introductory");
  });
});

describe("parseEmailDraftResponse", () => {
  it("parses a well-formed subject/body response", () => {
    const result = parseEmailDraftResponse(
      "Subject: Following up on our visit\n---\nHi Jamie,\n\nGreat catching up last week...",
    );
    expect(result.subject).toBe("Following up on our visit");
    expect(result.body).toBe("Hi Jamie,\n\nGreat catching up last week...");
  });

  it("falls back gracefully when the format is not as expected", () => {
    const result = parseEmailDraftResponse(
      "Just some unstructured text with no subject line.",
    );
    expect(result.subject).toBe("Follow up");
    expect(result.body).toBe(
      "Just some unstructured text with no subject line.",
    );
  });

  it("handles extra surrounding whitespace", () => {
    const result = parseEmailDraftResponse(
      "\n\n  Subject: Quick check-in  \n---\n  Hello there.  \n\n",
    );
    expect(result.subject).toBe("Quick check-in");
    expect(result.body).toBe("Hello there.");
  });
});
