import { describe, expect, it } from "vitest";
import { paragraphs } from "./format";

describe("paragraphs", () => {
  it("splits on blank lines, keeping single line breaks and dropping empties", () => {
    expect(paragraphs("One.\n\n  Two,\nstill two.  \n \n\n")).toEqual(["One.", "Two,\nstill two."]);
    expect(paragraphs("")).toEqual([]);
  });
});
