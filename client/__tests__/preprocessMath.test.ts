import { describe, it, expect } from "vitest";
import { preprocessMath, renderMathInText } from "@/components/formatted-markdown";

describe("preprocessMath and renderMathInText", () => {
  it("converts exact user paragraph to KaTeX math output", () => {
    const input = `Formally, for agent i at time t the paper denotes a distribution (\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}}) where (\\mathcal{S}) is the (discrete) space of latent world states. Each entry (b_i^t(s)) is the probability that the true latent state equals s according to agent i’s current knowledge.`;

    const processed = preprocessMath(input);
    expect(processed).toContain("$\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}}$");
    expect(processed).toContain("$\\mathcal{S}$");
    expect(processed).toContain("(discrete)");
    expect(processed).toContain("$b_i^t(s)$");

    const rendered = renderMathInText(processed);
    expect(rendered).toContain("class=\"katex\"");
  });

  it("handles LaTeX slashes and double slashes", () => {
    const inputInline = "Inline: \\(\\mathbf{x}\\) and \\\\(\\mathbf{y}\\\\)";
    const processedInline = preprocessMath(inputInline);
    expect(processedInline).toContain("$\\mathbf{x}$");
    expect(processedInline).toContain("$\\mathbf{y}$");

    const inputBlock = "Block: \\[\\mathcal{S}\\] and \\\\[\\mathcal{T}\\\\]";
    const processedBlock = preprocessMath(inputBlock);
    expect(processedBlock).toContain("$$\\mathcal{S}$$");
    expect(processedBlock).toContain("$$\\mathcal{T}$$");
  });

  it("handles bracketed math expressions", () => {
    const input = "Bracketed: [\\mathbf{b}_i^t = {b_i^t(s)}]";
    const processed = preprocessMath(input);
    expect(processed).toContain("$$\\mathbf{b}_i^t = {b_i^t(s)}$$");
  });

  it("does not corrupt HTML tags or image srcset with url parameters like w_36,h_36", () => {
    const substackHtml = `<img src="https://substackcdn.com/image/fetch/s!TYXN!,w_36,h_36,c_fill/https%3A%2F%2Fexample.com%2Fimg.jpeg" alt="Big Think" srcset="https://substackcdn.com/image/fetch/s!TYXN!,w_36,h_36,c_fill/https%3A%2F%2Fexample.com%2Fimg.jpeg 2x">`;
    const processed = preprocessMath(substackHtml);
    expect(processed).toBe(substackHtml);
    expect(processed).not.toContain("$");

    const rendered = renderMathInText(processed);
    expect(rendered).toBe(substackHtml);
    expect(rendered).not.toContain("katex");
  });
});
