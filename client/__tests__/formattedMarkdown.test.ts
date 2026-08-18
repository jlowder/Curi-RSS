import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { FormattedMarkdown, preprocessMath, renderMathInText } from "@/components/formatted-markdown";

describe("FormattedMarkdown component", () => {
  it("renders parenthetical math in user prompt to KaTeX output", () => {
    const input = `Formally, for agent i at time t the paper denotes a distribution (\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}}) where (\\mathcal{S}) is the (discrete) space of latent world states. Each entry (b_i^t(s)) is the probability that the true latent state equals s according to agent i’s current knowledge.`;

    const html = renderToString(React.createElement(FormattedMarkdown, { content: input }));
    console.log("RENDERED COMPONENT HTML:\n", html);
    expect(html).toContain("katex");
    expect(html).not.toContain("(\\mathbf{b}i^t =");
  });
});
