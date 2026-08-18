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

  // 1. Convert \( ... \) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");

  // 2. Convert \[ ... \] to $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, "$$$$$1$$$$");

  // 3. Convert parenthetical expressions (...) containing LaTeX math commands (\something)
  // or subscripts/superscripts into inline $...$ math blocks.
  processed = processed.replace(/\(((?:[^()]+|\([^()]*\))+)\)/g, (match, inner) => {
    if (
      /\\(?:[a-zA-Z]+|[^\w\s])/.test(inner) ||
      /_[0-9a-zA-Z{}]+|\^[0-9a-zA-Z{}]+/.test(inner)
    ) {
      return `$${inner}$`;
    }
    return match;
  });

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
  const mathRendered = renderMathInText(preprocessed);
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
