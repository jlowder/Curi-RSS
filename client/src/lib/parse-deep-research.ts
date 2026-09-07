const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.*)/;
const HASH_HEADING_RE = /^\s{0,3}#{1,6}\s+(.*)/;
const KNOWLEDGE_RE = /\bknowledge\b/i;
const DEEPER_RE = /\bdeeper\b|\bdeep research\b/i;

export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`/g, "")
    .trim();
}

export interface DeepResearchSections {
  knowledge: string[];
  deeper: string[];
  hasSections: boolean;
}

function classifyHeading(headingText: string): "knowledge" | "deeper" {
  const text = stripInlineMarkdown(headingText);
  if (KNOWLEDGE_RE.test(text)) return "knowledge";
  if (DEEPER_RE.test(text)) return "deeper";
  return "knowledge"; // safe default: no buttons under unknown headings
}

export function parseDeepResearchSections(markdown: string): DeepResearchSections {
  const sections: DeepResearchSections = { knowledge: [], deeper: [], hasSections: false };
  let current: "knowledge" | "deeper" = "knowledge";

  for (const line of markdown.split("\n")) {
    const heading = line.match(HASH_HEADING_RE);
    if (heading) {
      sections.hasSections = true;
      current = classifyHeading(heading[1]);
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const q = stripInlineMarkdown(bullet[1]);
      if (q.length > 0) sections[current].push(q);
      continue;
    }

    // Plain (unmarked) heading line: short, non-bullet line containing a section keyword
    const nonSpace = line.replace(/\s/g, "").length;
    if (nonSpace > 0 && nonSpace <= 60) {
      const text = stripInlineMarkdown(line);
      if (KNOWLEDGE_RE.test(text) || DEEPER_RE.test(text)) {
        sections.hasSections = true;
        current = classifyHeading(line);
      }
    }
  }

  // Legacy: no headings at all -> flat list, all buttons
  if (!sections.hasSections) {
    sections.deeper = sections.knowledge;
    sections.knowledge = [];
  }

  return sections;
}
