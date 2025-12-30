import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(html: string, maxWords: number): string {
  if (!html) {
    return "";
  }

  const el = document.createElement("div");
  el.innerHTML = html;

  const totalWords = (el.textContent || "").split(/\s+/).filter(Boolean).length;
  if (totalWords <= maxWords) {
    return html;
  }

  let truncated = false;
  let wordCount = 0;

  function walk(node: Node) {
    if (truncated) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const wordsInNode = text.split(/\s+/).filter(Boolean);
      const remainingWords = maxWords - wordCount;

      if (wordsInNode.length > remainingWords) {
        const wordsToKeep = wordsInNode.slice(0, remainingWords);
        node.textContent = wordsToKeep.join(" ") + " [...]";
        truncated = true;
      } else {
        wordCount += wordsInNode.length;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childNodes = Array.from(node.childNodes);
      for (let i = 0; i < childNodes.length; i++) {
        walk(childNodes[i]);
        if (truncated) {
          // Remove all subsequent nodes
          for (let j = i + 1; j < childNodes.length; j++) {
            node.removeChild(childNodes[j]);
          }
          break;
        }
      }
    }
  }

  walk(el);

  return el.innerHTML;
}
