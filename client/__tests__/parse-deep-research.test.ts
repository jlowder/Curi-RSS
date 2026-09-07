import { describe, it, expect } from "vitest";
import { parseDeepResearchSections, stripInlineMarkdown } from "@/lib/parse-deep-research";

describe("parseDeepResearchSections", () => {
  it("splits canonical two-heading output into 3 knowledge and 4 deeper items", () => {
    const markdown = [
      "## Test Your Knowledge",
      "- What is a quantum computer, and how does it differ from a classical one?",
      "- How do qubits store and process information?",
      "- Why is decoherence a problem for quantum hardware?",
      "",
      "## Go Deeper",
      "- How do leading error-correction codes scale with qubit count?",
      "- What architectures are most promising for fault-tolerant machines?",
      "- Which workloads are most likely to benefit first, and at what cost?",
      "- What economic and regulatory barriers slow real-world adoption?",
    ].join("\n");

    const sections = parseDeepResearchSections(markdown);
    expect(sections.hasSections).toBe(true);
    expect(sections.knowledge).toHaveLength(3);
    expect(sections.deeper).toHaveLength(4);
    expect(sections.knowledge[0]).toBe(
      "What is a quantum computer, and how does it differ from a classical one?",
    );
    expect(sections.deeper[2]).toBe(
      "Which workloads are most likely to benefit first, and at what cost?",
    );
  });

  it("recognizes ### headings and bold-wrapped heading text", () => {
    const markdown = [
      "### Test Your Knowledge",
      "- Basic question one?",
      "- Basic question two?",
      "",
      "## **Go Deeper**",
      "- Deep question one?",
      "- Deep question two?",
      "- Deep question three?",
    ].join("\n");

    const sections = parseDeepResearchSections(markdown);
    expect(sections.hasSections).toBe(true);
    expect(sections.knowledge).toEqual(["Basic question one?", "Basic question two?"]);
    expect(sections.deeper).toEqual([
      "Deep question one?",
      "Deep question two?",
      "Deep question three?",
    ]);
  });

  it("splits correctly when the sections are reordered (Go Deeper first)", () => {
    const markdown = [
      "## Go Deeper",
      "- Deep prompt A?",
      "- Deep prompt B?",
      "",
      "## Test Your Knowledge",
      "- Easy question C?",
    ].join("\n");

    const sections = parseDeepResearchSections(markdown);
    expect(sections.hasSections).toBe(true);
    expect(sections.knowledge).toEqual(["Easy question C?"]);
    expect(sections.deeper).toEqual(["Deep prompt A?", "Deep prompt B?"]);
  });

  it("treats a headingless flat list as all-deeper (legacy behavior)", () => {
    const markdown = [
      "- Prompt one?",
      "- Prompt two?",
      "- Prompt three?",
      "- Prompt four?",
      "- Prompt five?",
      "- Prompt six?",
      "- Prompt seven?",
    ].join("\n");

    const sections = parseDeepResearchSections(markdown);
    expect(sections.hasSections).toBe(false);
    expect(sections.knowledge).toHaveLength(0);
    expect(sections.deeper).toHaveLength(7);
    expect(sections.deeper[6]).toBe("Prompt seven?");
  });

  it("returns empty arrays for a prose-only response", () => {
    const markdown = [
      "This piece takes a long view of the industry and argues that several forces",
      "are converging in ways that practitioners have long underestimated.",
    ].join("\n");

    const sections = parseDeepResearchSections(markdown);
    expect(sections.hasSections).toBe(false);
    expect(sections.knowledge).toEqual([]);
    expect(sections.deeper).toEqual([]);
  });

  it("strips inline markdown from text", () => {
    expect(
      stripInlineMarkdown("[Quantum computing](https://example.com) and **bold** stuff"),
    ).toBe("Quantum computing and bold stuff");
  });
});
