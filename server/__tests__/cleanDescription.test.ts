import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

function cleanDescription(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  const $ = cheerio.load(html);
  $("style, script").remove();
  return $("body").html() || $.html();
}

describe("cleanDescription", () => {
  it("preserves LaTeX math expressions with curly braces and removes style tags", () => {
    const input = `
      <style>p { color: red; }</style>
      <p>Formally, for agent i at time t the paper denotes a distribution (\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}}) where (\\mathcal{S}) is the (discrete) space of latent world states.</p>
    `;
    const output = cleanDescription(input);
    expect(output).not.toContain("color: red");
    expect(output).toContain("(\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}})");
    expect(output).toContain("(\\mathcal{S})");
  });
});
