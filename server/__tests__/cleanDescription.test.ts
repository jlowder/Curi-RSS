import { describe, it, expect } from "vitest";
import { cleanArticleHtml } from "../routes";

describe("cleanArticleHtml", () => {
  it("preserves LaTeX math expressions with curly braces and removes style tags", () => {
    const input = `
      <style>p { color: red; }</style>
      <p>Formally, for agent i at time t the paper denotes a distribution (\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}}) where (\\mathcal{S}) is the (discrete) space of latent world states.</p>
    `;
    const output = cleanArticleHtml(input);
    expect(output).not.toContain("color: red");
    expect(output).toContain("(\\mathbf{b}i^t = {b_i^t(s) }{s\\in\\mathcal{S}})");
    expect(output).toContain("(\\mathcal{S})");
  });

  it("removes video player shells and empty aspect-ratio/padding containers", () => {
    const input = `
      <div class="shows-video-player-container">
        <div style="padding-bottom:56.2500%;" class="video-player"></div>
      </div>
      <h2>Article Title</h2>
      <p>This is the real content of the article.</p>
    `;
    const output = cleanArticleHtml(input);
    expect(output).not.toContain("shows-video-player-container");
    expect(output).not.toContain("padding-bottom:56.2500%");
    expect(output).toContain("Article Title");
    expect(output).toContain("This is the real content of the article.");
  });

  it("removes embedded post preview recommendations inside article", () => {
    const input = `
      <p>Main text</p>
      <div role="article" class="post-preview">
        <a href="https://example.com/other">Recommended post title</a>
      </div>
    `;
    const output = cleanArticleHtml(input);
    expect(output).toContain("Main text");
    expect(output).not.toContain("Recommended post title");
  });

  it("preserves valid images and text paragraphs", () => {
    const input = `
      <p>Introduction paragraph.</p>
      <img src="https://example.com/image.jpg" alt="Test image" />
      <p>Conclusion paragraph.</p>
    `;
    const output = cleanArticleHtml(input);
    expect(output).toContain("Introduction paragraph.");
    expect(output).toContain("image.jpg");
    expect(output).toContain("Conclusion paragraph.");
  });
});
