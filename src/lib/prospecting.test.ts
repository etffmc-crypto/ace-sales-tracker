import { describe, it, expect } from "vitest";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
  buildProspectingEmailPrompt,
} from "./prospecting";

describe("buildProspectSearchPrompt", () => {
  it("includes the account type and Harrisburg location", () => {
    const prompt = buildProspectSearchPrompt("RESTAURANT", []);
    expect(prompt).toContain("restaurant");
    expect(prompt).toContain("Harrisburg");
  });

  it("lists names to exclude when provided", () => {
    const prompt = buildProspectSearchPrompt("CONTRACTOR", [
      "Acme Construction",
      "Bob's Builders",
    ]);
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Bob's Builders");
  });

  it("omits the exclude section when the list is empty", () => {
    const prompt = buildProspectSearchPrompt("OTHER", []);
    expect(prompt).not.toContain("already tracked");
  });
});

describe("parseProspectSearchResponse", () => {
  it("parses a well-formed JSON array", () => {
    const text = `[{"name":"Joe's Diner","addressLine":"1 Main St","city":"Harrisburg","state":"PA","zip":"17101","phone":"717-555-0100","email":null,"website":"https://joes.example","notes":"busy kitchen"}]`;
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Joe's Diner");
    expect(result[0].phone).toBe("717-555-0100");
    expect(result[0].email).toBeNull();
  });

  it("parses a JSON array wrapped in a markdown code fence", () => {
    const text =
      'Here you go:\n```json\n[{"name":"Test Co","addressLine":null,"city":null,"state":null,"zip":null,"phone":null,"email":null,"website":null,"notes":null}]\n```';
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Co");
    expect(result[0].addressLine).toBeNull();
  });

  it("returns an empty array for malformed output", () => {
    expect(
      parseProspectSearchResponse("Sorry, I couldn't find anything."),
    ).toEqual([]);
  });

  it("returns an empty array for a genuinely empty result", () => {
    expect(parseProspectSearchResponse("[]")).toEqual([]);
  });

  it("drops entries missing a name", () => {
    const text = `[{"addressLine":"1 Main St"},{"name":"Valid Co"}]`;
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valid Co");
  });
});

describe("buildProspectingEmailPrompt", () => {
  it("mentions Ace Hardware, the business name, and COSTARS", () => {
    const prompt = buildProspectingEmailPrompt("Joe's Diner", "RESTAURANT");
    expect(prompt).toContain("Ace Hardware");
    expect(prompt).toContain("Joe's Diner");
    expect(prompt).toContain("COSTARS");
  });

  it("instructs a generic greeting when there is no contact name", () => {
    const prompt = buildProspectingEmailPrompt("Test Co", "OTHER");
    expect(prompt).toContain("generically");
  });
});
