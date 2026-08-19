import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Preprocesses text to ensure LaTeX math notation (including \(...\), \[...\],
 * and (...) parens containing math expressions) is converted to standard
 * $...$ / $$...$$ inline/block math syntax.
 */
/**
 * Helper to check if inner text inside (...) or [...] looks like LaTeX math.
 */
function isMathContent(inner: string): boolean {
  // LaTeX backslash commands like \mathbf, \mathcal, \in, \frac, \sum, etc.
  if (/\\{1,2}(?:[a-zA-Z]+|[^\w\s])/.test(inner)) {
    return true;
  }
  // Subscript/superscript with braces like _{foo} or ^{bar}
  if (/_[{][^}]+[}]|\^[{][^}]+[}]/.test(inner)) {
    return true;
  }
  // Combination of subscript AND superscript like b_i^t
  if (/_[\w]+\^[\w]+|\^[\w]+_[\w]+/.test(inner)) {
    return true;
  }
  return false;
}

/**
 * Transforms math notations in a single plain text segment (outside HTML tags).
 */
function preprocessMathSegment(text: string): string {
  if (!text) return "";
  let processed = text;

  // 1. Convert \( ... \) and \\( ... \\) to $ ... $
  processed = processed.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, inner) => `$${inner}$`);

  // 2. Convert \[ ... \] and \\[ ... \\] to $$ ... $$
  processed = processed.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, inner) => `$$${inner}$$`);

  // 3. Convert parenthetical expressions (...) containing LaTeX commands or sub/superscripts
  if (processed.includes("(")) {
    let result = "";
    let i = 0;
    const len = processed.length;

    while (i < len) {
      if (processed[i] === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < len && depth > 0) {
          if (processed[j] === "(") depth++;
          else if (processed[j] === ")") depth--;
          j++;
        }

        if (depth === 0) {
          const inner = processed.substring(i + 1, j - 1);
          if (isMathContent(inner)) {
            result += `$${inner}$`;
          } else {
            result += processed.substring(i, j);
          }
          i = j;
          continue;
        }
      }
      result += processed[i];
      i++;
    }
    processed = result;
  }

  // 4. Convert bracketed expressions [...] containing LaTeX commands or sub/superscripts
  if (processed.includes("[")) {
    let result = "";
    let i = 0;
    const len = processed.length;

    while (i < len) {
      if (processed[i] === "[") {
        let depth = 1;
        let j = i + 1;
        while (j < len && depth > 0) {
          if (processed[j] === "[") depth++;
          else if (processed[j] === "]") depth--;
          j++;
        }

        if (depth === 0) {
          const inner = processed.substring(i + 1, j - 1);
          if (isMathContent(inner)) {
            result += `$$${inner}$$`;
          } else {
            result += processed.substring(i, j);
          }
          i = j;
          continue;
        }
      }
      result += processed[i];
      i++;
    }
    processed = result;
  }

  return processed;
}

/**
 * Splits text into HTML tag tokens and text content tokens so math preprocessing
 * and rendering are NEVER performed inside HTML tags or attributes.
 */
function processOutsideHtmlTags(input: string, transformText: (text: string) => string): string {
  if (!input) return "";
  // Match HTML comments or tags
  const tagRegex = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;
  let lastIndex = 0;
  let result = "";
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = input.substring(lastIndex, match.index);
      result += transformText(textChunk);
    }
    // Append HTML tag as-is without transformation
    result += match[0];
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    const textChunk = input.substring(lastIndex);
    result += transformText(textChunk);
  }

  return result;
}

/**
 * Preprocesses text to convert LaTeX math notation (such as \(...\), \[...\],
 * and (...) parens containing math expressions) to standard $...$ / $$...$$ math syntax,
 * while safely ignoring HTML tags and attributes.
 */
/**
 * Cleans HTML string on the frontend using DOMParser to strip unplayable player shells,
 * empty padding containers, broken aspect ratio elements, and embedded post previews.
 */
export function cleanHtmlFrontend(html: string): string {
  if (!html || !html.includes("<")) {
    return html;
  }
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // 1. Remove scripts, styles, nav, aside, ads, comments, headers/footers
      doc
        .querySelectorAll(
          "script, style, nav, aside, .advertisement, .social-share, .related-posts, .comments, .sidebar, .navigation, .nav, .footer, .header, .ad, .ads, svg",
        )
        .forEach((el) => el.remove());

      // 2. Remove unplayable video/audio JS player shells & placeholders
      doc
        .querySelectorAll(
          ".shows-video-player-container, .shows-video-player-shell-area, [class*='playerShell'], [class*='playerRoot'], [class*='shows-video'], .video-player-with-background, [class*='video-player'], [class*='audio-player'], [class*='media-player'], .player-container, .embed-placeholder, .media-wrapper",
        )
        .forEach((el) => el.remove());

      // 3. Remove embedded post preview recommendations inside article
      doc
        .querySelectorAll(
          "[role='article'], .post-preview, [data-testid*='post-preview'], .related-articles, .recommended-posts",
        )
        .forEach((el) => el.remove());

      // 4. Remove empty or invalid iframes
      doc.querySelectorAll("iframe").forEach((el) => {
        const src = el.getAttribute("src");
        if (
          !src ||
          !src.trim() ||
          src.startsWith("about:blank") ||
          src.startsWith("javascript:")
        ) {
          el.remove();
        }
      });

      // 5. Clean elements with padding-top/bottom or height/aspect-ratio inline styles if they contain no media or text
      doc.querySelectorAll("[style]").forEach((el) => {
        const style = el.getAttribute("style") || "";
        if (
          /padding-(top|bottom)\s*:\s*\d+(\.\d+)?%/i.test(style) ||
          /height\s*:\s*\d+/i.test(style) ||
          /aspect-ratio/i.test(style)
        ) {
          if (
            !el.querySelector("img, iframe, video, audio") &&
            !(el.textContent || "").trim()
          ) {
            el.remove();
          }
        }
      });

      // 6. Iteratively remove empty containers that have no text and no media
      for (let pass = 0; pass < 3; pass++) {
        let removedAny = false;
        doc
          .querySelectorAll("div, p, section, figure, span")
          .forEach((el) => {
            if (
              el.children.length === 0 &&
              !(el.textContent || "").trim()
            ) {
              const tagName = el.tagName.toLowerCase();
              if (
                !["img", "iframe", "video", "audio", "hr", "br"].includes(
                  tagName,
                )
              ) {
                el.remove();
                removedAny = true;
              }
            }
          });
        if (!removedAny) break;
      }

      return doc.body.innerHTML;
    } catch {
      return html;
    }
  }

  // Fallback for environments without DOMParser (e.g., Node unit test environment)
  let cleaned = html;
  cleaned = cleaned.replace(
    /<div[^>]*class="[^"]*(?:shows-video-player|playerShell|playerRoot|video-player)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    "",
  );
  cleaned = cleaned.replace(
    /<div[^>]*style="[^"]*padding-(?:bottom|top)\s*:\s*\d+(?:\.\d+)?%[^"]*"[^>]*>\s*<\/div>/gi,
    "",
  );
  return cleaned;
}

export function preprocessMath(text: string): string {
  return processOutsideHtmlTags(text, preprocessMathSegment);
}

/**
 * Directly renders $...$ and $$...$$ LaTeX expressions into KaTeX HTML strings
 * for text content outside HTML tags.
 */
export function renderMathInText(htmlOrText: string): string {
  return processOutsideHtmlTags(htmlOrText, (text) => {
    let result = text;

    // Replace $$...$$ block math
    result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false });
      } catch {
        return match;
      }
    });

    // Replace $...$ inline math
    result = result.replace(/\$((?!\$)[^\n]+?)\$/g, (match, math) => {
      try {
        return katex.renderToString(math, { displayMode: false, throwOnError: false });
      } catch {
        return match;
      }
    });

    return result;
  });
}

interface FormattedMarkdownProps {
  content: string | null | undefined;
  className?: string;
  allowHtml?: boolean;
}

export function FormattedMarkdown({
  content,
  className = "prose prose-invert max-w-none text-gray-300",
  allowHtml = true,
}: FormattedMarkdownProps) {
  if (!content) return null;

  const cleanedHtml = allowHtml ? cleanHtmlFrontend(content) : content;
  const preprocessed = preprocessMath(cleanedHtml);
  const mathRendered = allowHtml ? renderMathInText(preprocessed) : preprocessed;
  const rehypePlugins = allowHtml
    ? [rehypeRaw, rehypeKatex]
    : [rehypeKatex];

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={rehypePlugins}
      >
        {mathRendered}
      </ReactMarkdown>
    </div>
  );
}
