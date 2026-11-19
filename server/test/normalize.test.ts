import { describe, expect, it } from "vitest";
import { normalizeOutput } from "../src/normalize";

describe("normalizeOutput", () => {
  it("normalizes CRLF and trailing spaces on lines", () => {
    expect(normalizeOutput("alma  \r\nkörte\t\r\n")).toBe("alma\nkörte");
  });

  it("keeps meaningful content and line order", () => {
    expect(normalizeOutput("első\nmásodik\n")).toBe("első\nmásodik");
    expect(normalizeOutput("második\nelső")).not.toBe("első\nmásodik");
  });
});
