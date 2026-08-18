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
});
