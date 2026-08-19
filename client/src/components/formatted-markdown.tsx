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
export function preprocessMath(text: string): string {
  if (!text) return "";
  let processed = text;

  // 1. Convert \( ... \) and \\( ... \\) to $ ... $
  processed = processed.replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, inner) => `$${inner}$`);

  // 2. Convert \[ ... \] and \\[ ... \\] to $$ ... $$
  processed = processed.replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, inner) => `$$${inner}$$`);

  // 3. Convert parenthetical expressions (...) containing LaTeX commands (\something)
  // or subscripts/superscripts into inline $...$ math blocks using a linear scan (O(N))
  // to prevent catastrophic regex backtracking on unclosed or long text.
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
          if (
            /\\{1,2}(?:[a-zA-Z]+|[^\w\s])/.test(inner) ||
            /_[0-9a-zA-Z{}]+|\^[0-9a-zA-Z{}]+/.test(inner)
          ) {
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

  // 4. Convert bracketed expressions [...] containing LaTeX commands or subscripts/superscripts into $$...$$
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
          if (
            /\\{1,2}(?:[a-zA-Z]+|[^\w\s])/.test(inner) ||
            /_[0-9a-zA-Z{}]+|\^[0-9a-zA-Z{}]+/.test(inner)
          ) {
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
 * Directly renders $...$ and $$...$$ LaTeX expressions into KaTeX HTML strings
 * so math is fully rendered regardless of raw HTML wrapper tags.
 */
export function renderMathInText(htmlOrText: string): string {
  if (!htmlOrText) return "";
  let result = htmlOrText;

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
