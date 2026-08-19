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

  const preprocessed = preprocessMath(content);
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
