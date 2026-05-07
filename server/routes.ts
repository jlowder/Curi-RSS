import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import nodemailer from "nodemailer";
import { exec } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  insertFeedSchema,
  updateArticleSchema,
  updateFeedSchema,
  emailConfigSchema,
  llmConfigSchema,
  publishingSettingsSchema,
  publishQueueSchema,
  type Article,
  DEFAULT_PROMPTS,
} from "@shared/schema";
import Parser from "rss-parser";
import fetch from "node-fetch";
import keytar from "keytar";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import TurndownService from "turndown";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const parser = new Parser({
  headers: {
    "User-Agent": DEFAULT_USER_AGENT,
  },
});
const turndownService = new TurndownService();

const KEYTAR_SERVICE = "curirss";
const KEYTAR_ACCOUNT = "llm_api_key";

function normalizeLlmEndpoint(endpoint: string): string {
  if (!endpoint) return "http://localhost:8000/v1/chat/completions";

  const baseUrlsToNormalize = [
    "googleapis.com",
    "api.deepseek.com",
    "api.openai.com",
    "api.anthropic.com", // Just in case, though they have different path
  ];

  const shouldNormalize =
    endpoint.endsWith("/v1") ||
    endpoint.endsWith("/v1/") ||
    (baseUrlsToNormalize.some((baseUrl) => endpoint.includes(baseUrl)) &&
      !endpoint.includes("/chat/completions"));

  if (shouldNormalize) {
    const baseEndpoint = endpoint.endsWith("/")
      ? endpoint.slice(0, -1)
      : endpoint;
    if (!baseEndpoint.endsWith("/chat/completions")) {
      return `${baseEndpoint}/chat/completions`;
    }
  }

  return endpoint;
}

async function getLlmApiKey(): Promise<string | null> {
  try {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    return key;
  } catch (error: any) {
    let message = error.message || String(error);
    if (
      message.includes("D-Bus") ||
      message.includes("$DISPLAY") ||
      message.includes("secret_service_search_items_sync")
    ) {
      message +=
        ". On Linux, ensure the server has access to a D-Bus session (e.g. run with dbus-run-session).";
    }
    console.error("Keyring access failed:", message);
    return null;
  }
}

function cleanDescription(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  const $ = cheerio.load(html);

  // Remove <style> and <script> tags first, as a baseline
  $("style, script").remove();

  // Now, traverse all elements and look for text nodes that might contain CSS
  $("*").each(function () {
    $(this)
      .contents()
      .each(function () {
        if (this.type === "text") {
          const textNode = $(this);
          let text = textNode.text();

          // Heuristic: if a text node contains curly braces, it's likely CSS.
          if (text.includes("{") && text.includes("}")) {
            // This regex finds CSS-like rules and removes them.
            const cssRegex = /\s*[^}{]*?\{[^}]*\}/g;
            const newText = text.replace(cssRegex, "");
            textNode.replaceWith(newText);
          }
        }
      });
  });

  return $("body").html() || $.html();
}

function getCategory(item: any): string | null {
  const category = item.categories?.[0];
  if (typeof category === "object" && category !== null && "_" in category) {
    return category._;
  }
  return category || null;
}

function isArticleTooOld(pubDate: string | undefined): boolean {
  if (!pubDate) {
    return false; // Don't filter out articles with no date
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const articleDate = new Date(pubDate);
  return articleDate < thirtyDaysAgo;
}

async function extractFullArticleContent(
  url: string,
): Promise<{ content: string | null; imageUrl: string | null }> {
  let html = "";
  let browser;

  try {
    // Try fetching with puppeteer first
    try {
      console.log(`Attempting to fetch ${url} with puppeteer`);
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      html = await page.content();
    } catch (e) {
      console.warn(`Puppeteer failed for ${url}, falling back to fetch`, e);
      // Fallback to fetch if puppeteer fails
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.error(`Fetch failed with status ${response.status} for ${url}`);
        return { content: null, imageUrl: null };
      }
      html = await response.text();
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    if (!html) {
      console.log("No HTML content could be fetched.");
      return { content: null, imageUrl: null };
    }

    const $ = cheerio.load(html);

    // Extract full article content using common article selectors
    let articleContent = "";

    // Try various common article content selectors
    const contentSelectors = [
      ".acf-content",
      "article",
      '[role="main"]',
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      ".post-body",
      ".article-body",
      "#content",
      ".main-content",
      ".story-body",
      ".post",
      ".text",
      "main",
      ".article__content",
      ".article-text",
      ".story-content",
      ".post__content",
      ".entry",
      ".content-body",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        // Remove unwanted elements
        element
          .find(
            "script, style, nav, aside, .advertisement, .social-share, .related-posts, .comments, .sidebar, .navigation, .nav, .footer, .header, .ad, .ads, svg",
          )
          .remove();

        // Get content and clean it up
        const rawContent = element.html() || "";
        const textContent = element.text().trim();

        console.log(
          `Selector "${selector}" found content length: ${textContent.length} chars`,
        );

        if (textContent.length > 500) {
          // Only use if substantial text content
          articleContent = rawContent;
          console.log(`Using content from selector: ${selector}`);
          break;
        }
      }
    }

    // Fallback: try to extract main content based on text density
    if (
      !articleContent ||
      $("<div>").html(articleContent).text().trim().length < 500
    ) {
      console.log("Trying fallback content extraction...");
      const paragraphs = $("p");
      let bestContent = "";
      let maxLength = 0;

      // Find the container with the most paragraph text
      paragraphs.each((_, p) => {
        const parent = $(p).parent();
        const parentText = parent.text().trim();
        if (parentText.length > maxLength && parentText.length > 300) {
          parent
            .find(
              "script, style, nav, aside, .advertisement, .social-share, .sidebar, .navigation, .nav, .footer, .header, .ad, .ads",
            )
            .remove();
          bestContent = parent.html() || "";
          maxLength = parentText.length;
        }
      });

      if (bestContent && maxLength > 500) {
        articleContent = bestContent;
        console.log(`Using fallback content with ${maxLength} chars`);
      }

      // Last resort: try body content
      if (
        !articleContent ||
        $("<div>").html(articleContent).text().trim().length < 300
      ) {
        console.log("Trying body content as last resort...");
        const bodyContent = $("body").clone();
        bodyContent
          .find(
            "script, style, nav, aside, .advertisement, .social-share, .sidebar, .navigation, .nav, .footer, .header, .ad, .ads, .menu",
          )
          .remove();
        const bodyText = bodyContent.text().trim();
        if (bodyText.length > 1000) {
          // Extract just the paragraphs from body
          const bodyParagraphs = bodyContent
            .find("p")
            .map((_, el) => $(el).prop("outerHTML"))
            .get()
            .join("");
          if (
            bodyParagraphs &&
            $("<div>").html(bodyParagraphs).text().trim().length > 500
          ) {
            articleContent = bodyParagraphs;
            console.log(
              `Using body paragraphs with ${$("<div>").html(bodyParagraphs).text().trim().length} chars`,
            );
          }
        }
      }
    }

    // Extract image if not already found
    let imageUrl = null;

    // Try Open Graph image
    let ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && ogImage.startsWith("http")) {
      imageUrl = ogImage;
    }

    // Try Twitter card image
    if (!imageUrl) {
      let twitterImage = $('meta[name="twitter:image"]').attr("content");
      if (twitterImage && twitterImage.startsWith("http")) {
        imageUrl = twitterImage;
      }
    }

    // Try to find the first reasonable image in the article
    if (!imageUrl) {
      const images = $("img[src]");
      for (let i = 0; i < images.length; i++) {
        const img = $(images[i]);
        const src = img.attr("src");
        if (
          src &&
          src.startsWith("http") &&
          !src.includes("logo") &&
          !src.includes("avatar")
        ) {
          const width = parseInt(img.attr("width") || "0");
          const height = parseInt(img.attr("height") || "0");
          // Prefer larger images
          if (width > 200 || height > 200 || (!width && !height)) {
            imageUrl = src;
            break;
          }
        }
      }
    }

    const finalTextLength = articleContent
      ? $("<div>").html(articleContent).text().trim().length
      : 0;
    console.log(
      `Final extraction result: ${finalTextLength} characters of text content`,
    );

    return {
      content: articleContent || null,
      imageUrl,
    };
  } catch (error) {
    console.error("Error extracting full article content:", error);
    return { content: null, imageUrl: null };
  }
}

async function extractImageFromArticle(url: string): Promise<string | null> {
  try {
    const result = await extractFullArticleContent(url);
    return result.imageUrl;
  } catch (error) {
    console.error("Error extracting image from article:", error);
    return null;
  }
}

function extractImageFromItem(item: any): string | null {
  // Try various enclosure types
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  // Try media:content and media:thumbnail
  if (item["media:content"]) {
    const mediaContent = item["media:content"];
    if (Array.isArray(mediaContent)) {
      const imageMedia = mediaContent.find(
        (m: any) => m.$.type?.startsWith("image/") || m.$.medium === "image",
      );
      if (imageMedia?.$?.url) return imageMedia.$.url;
    } else if (mediaContent.$?.url) {
      return mediaContent.$.url;
    }
  }

  // Try media:thumbnail
  if (item["media:thumbnail"]?.$?.url) {
    return item["media:thumbnail"].$.url;
  }

  // Try extracting image from content/description
  const contentToSearch =
    item.content || item["content:encoded"] || item.description || "";
  const imgMatch = contentToSearch.match(/<img[^>]+src="([^"]+)"/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  // Try other common RSS image fields
  if (item.image) {
    return item.image;
  }

  return null;
}

async function ensureFullArticleContent<T extends Article>(
  article: T,
): Promise<T> {
  const isContentInsufficient =
    !article.content ||
    article.content.length < 1000 ||
    article.content === article.description;

  if (isContentInsufficient) {
    console.log(
      `Insufficient content for article "${article.title}". Fetching from source, "${article.url}".`,
    );
    try {
      const { content: newContent } = await extractFullArticleContent(
        article.url,
      );
      if (newContent && newContent.length > (article.content?.length || 0)) {
        console.log(
          `Successfully extracted new content with length ${newContent.length}.`,
        );
        const updatedArticle = await storage.updateArticleContent(article.id, {
          content: newContent,
        });
        if (updatedArticle) {
          return { ...article, ...updatedArticle };
        } else {
          console.log("not updated");
        }
      } else {
        if (newContent) {
          console.log(`fetch issue, new length=${newContent.length}`);
        } else {
          console.log("no content returned");
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch full content for article: ${article.title}`,
        error,
      );
    }
  }
  return article;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all feeds with unread counts
  app.get("/api/feeds", async (req, res) => {
    try {
      const feeds = await storage.getFeedsWithUnreadCount();
      res.json(feeds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feeds" });
    }
  });

  // Add new feed
  app.post("/api/feeds", async (req, res) => {
    try {
      const feedData = insertFeedSchema.parse(req.body);

      // Check if feed already exists
      const existingFeed = await storage.getFeedByUrl(feedData.url);
      if (existingFeed) {
        return res.status(400).json({ error: "Feed already exists" });
      }

      // Try to parse the RSS feed to validate it
      try {
        const feed = await parser.parseURL(feedData.url);

        // Create feed with parsed data
        const newFeed = await storage.createFeed({
          title: feedData.title || feed.title || "Unknown Feed",
          url: feedData.url,
          description: feedData.description || feed.description || "",
        });

        // Parse and store initial articles
        if (feed.items && feed.items.length > 0) {
          const articlesToProcess = feed.items.slice(0, 20); // Limit to 20 most recent

          // Process all articles with enhanced content and image extraction
          for (const item of articlesToProcess) {
            if (isArticleTooOld(item.pubDate)) {
              continue;
            }
            const existingArticle = await storage.getArticleByUrl(
              item.link || "",
            );

            if (!existingArticle && item.link) {
              let imageUrl = extractImageFromItem(item);
              let fullContent = item.content || item.contentSnippet || "";

              // Extract full content and enhanced image if needed
              try {
                console.log(
                  `Extracting full content for new article: ${item.title}`,
                );
                const { content, imageUrl: extractedImageUrl } =
                  await extractFullArticleContent(item.link);

                if (content && content.length > fullContent.length) {
                  fullContent = content;
                }

                if (!imageUrl && extractedImageUrl) {
                  imageUrl = extractedImageUrl;
                }
              } catch (extractError) {
                console.error(
                  "Failed to extract full content for new article:",
                  extractError,
                );
              }

              await storage.createArticle({
                feedId: newFeed.id,
                title: item.title || "Untitled",
                description: cleanDescription(
                  item.contentSnippet || item.content || "",
                ),
                content: fullContent,
                url: item.link,
                author: item.creator || item.author || null,
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                imageUrl: imageUrl,
                category: getCategory(item),
              });
            }
          }
        }

        // Update feed last fetched time
        await storage.updateFeed(newFeed.id, { lastFetched: new Date() });

        res.json(newFeed);
      } catch (parseError) {
        res
          .status(400)
          .json({ error: "Invalid RSS feed URL or feed cannot be parsed" });
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid feed data" });
    }
  });

  // Delete feed
  app.delete("/api/feeds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFeed(id);

      if (!deleted) {
        return res.status(404).json({ error: "Feed not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete feed" });
    }
  });

  // Mark all articles in feed as read
  app.post("/api/feeds/:id/mark-read", async (req, res) => {
    try {
      const { id } = req.params;

      // Check if feed exists
      const feed = await storage.getFeed(id);
      if (!feed) {
        return res.status(404).json({ error: "Feed not found" });
      }

      // Mark all unread articles in this feed as read
      await storage.updateArticlesAsReadByFeed(id);

      // Invalidate cache
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking feed as read:", error);
      res.status(500).json({ error: "Failed to mark feed as read" });
    }
  });

  // Update feed
  app.put("/api/feeds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const feedData = updateFeedSchema.parse(req.body);

      const updatedFeed = await storage.updateFeed(id, feedData);

      if (!updatedFeed) {
        return res.status(404).json({ error: "Feed not found" });
      }

      res.json(updatedFeed);
    } catch (error) {
      res.status(400).json({ error: "Invalid feed data" });
    }
  });

  // Refresh feed
  app.post("/api/feeds/:id/refresh", async (req, res) => {
    try {
      const { id } = req.params;
      const feed = await storage.getFeed(id);

      if (!feed) {
        return res.status(404).json({ error: "Feed not found" });
      }

      try {
        const parsedFeed = await parser.parseURL(feed.url);

        // Parse and store new articles
        let newArticlesCount = 0;
        if (parsedFeed.items && parsedFeed.items.length > 0) {
          for (const item of parsedFeed.items.slice(0, 20)) {
            if (isArticleTooOld(item.pubDate)) {
              continue;
            }
            const existingArticle = await storage.getArticleByUrl(
              item.link || "",
            );
            if (!existingArticle && item.link) {
              let imageUrl = extractImageFromItem(item);
              let fullContent = item.content || item.contentSnippet || "";

              // Extract full content and enhanced image if needed
              try {
                console.log(
                  `Extracting full content for refreshed article: ${item.title}`,
                );
                const { content, imageUrl: extractedImageUrl } =
                  await extractFullArticleContent(item.link);

                if (content && content.length > fullContent.length) {
                  fullContent = content;
                }

                if (!imageUrl && extractedImageUrl) {
                  imageUrl = extractedImageUrl;
                }
              } catch (extractError) {
                console.error(
                  "Failed to extract full content for refreshed article:",
                  extractError,
                );
              }

              await storage.createArticle({
                feedId: feed.id,
                title: item.title || "Untitled",
                description: cleanDescription(
                  item.contentSnippet || item.content || "",
                ),
                content: fullContent,
                url: item.link,
                author: item.creator || item.author || null,
                publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
                imageUrl: imageUrl,
                category: getCategory(item),
              });
              newArticlesCount++;
            }
          }
        }

        // Update feed last fetched time
        await storage.updateFeed(feed.id, { lastFetched: new Date() });

        res.json({ success: true, newArticlesCount });
      } catch (parseError) {
        res.status(400).json({ error: "Failed to refresh feed" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh feed" });
    }
  });

  // Get article statistics
  app.get("/api/articles/stats", async (req, res) => {
    try {
      const stats = await storage.getArticleStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch article stats" });
    }
  });

  app.post("/api/articles/delete-unknown-age", async (req, res) => {
    try {
      const deletedCount = await storage.deleteArticlesWithNullPublishedAt();
      console.log(
        `Manual cleanup completed: deleted ${deletedCount} articles with unknown age.`,
      );
      res.json({
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} articles with unknown age.`,
      });
    } catch (error) {
      console.error("Error during manual cleanup:", error);
      res.status(500).json({ error: "Failed to cleanup articles" });
    }
  });

  // Cleanup old articles
  app.post("/api/articles/cleanup", async (req, res) => {
    try {
      const { daysOld = 30 } = req.body;
      const deletedCount = await storage.cleanupOldArticles(daysOld);
      console.log(
        `Manual cleanup completed: deleted ${deletedCount} old read articles`,
      );
      res.json({
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} old read articles older than ${daysOld} days`,
      });
    } catch (error) {
      console.error("Error during manual cleanup:", error);
      res.status(500).json({ error: "Failed to cleanup articles" });
    }
  });

  // Get feed statistics
  app.get("/api/feeds/:id/stats", async (req, res) => {
    try {
      const { id } = req.params;
      const stats = await storage.getFeedStats(id);

      if (!stats) {
        return res.status(404).json({ error: "Feed not found" });
      }

      console.log("Returning feed stats:", stats);
      res.json(stats);
    } catch (error) {
      console.error("Error in feed stats route:", error);
      res.status(500).json({ error: "Failed to fetch feed stats" });
    }
  });

  // Get articles with filtering
  app.get("/api/articles", async (req, res) => {
    try {
      const { search, feedId, category } = req.query;
      const articles = await storage.getFilteredArticles(
        search as string,
        feedId as string,
        category as string,
      );
      res.json(articles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch articles" });
    }
  });

  // Get single article with full content
  app.get("/api/articles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const article = await storage.getArticle(id);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      // Always try to extract content if it's short or missing
      console.log(
        `Article "${article.title}" has ${article.content?.length || 0} chars of content`,
      );

      if (!article.content || article.content.length < 300) {
        console.log(
          `Attempting to extract full content for article: ${article.title}`,
        );
        console.log(`Article URL: ${article.url}`);
        try {
          const { content, imageUrl } = await extractFullArticleContent(
            article.url,
          );

          if (content && content.length > 200) {
            console.log(
              `Successfully extracted ${content.length} chars of content`,
            );
            // Update the article with full content
            const updatedArticle = await storage.updateArticleContent(id, {
              content,
              imageUrl: imageUrl || article.imageUrl,
            });

            if (updatedArticle) {
              console.log(`Updated article in database with new content`);
              console.log(
                `Returning updated article with content length: ${updatedArticle.content?.length || 0}`,
              );
              return res.json(updatedArticle);
            } else {
              console.log(`Failed to update article in database`);
            }
          } else {
            console.log(
              `Extraction failed or produced insufficient content: ${content?.length || 0} chars`,
            );
          }
        } catch (extractError) {
          console.error("Failed to extract content for article:", extractError);
        }
      } else {
        console.log(
          `Article already has sufficient content (${article.content.length} chars)`,
        );
      }

      res.json(article);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // Update article (mark as read/unread, bookmark/unbookmark)
  app.patch("/api/articles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateArticleSchema.parse(req.body);

      const updatedArticle = await storage.updateArticle(id, updateData);

      if (!updatedArticle) {
        return res.status(404).json({ error: "Article not found" });
      }

      res.json(updatedArticle);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Refresh all feeds
  app.post("/api/feeds/refresh-all", async (req, res) => {
    try {
      const feeds = await storage.getAllFeeds();
      let totalNewArticles = 0;

      for (const feed of feeds) {
        try {
          const parsedFeed = await parser.parseURL(feed.url);

          if (parsedFeed.items && parsedFeed.items.length > 0) {
            for (const item of parsedFeed.items.slice(0, 10)) {
              // Limit to 10 per feed
              if (isArticleTooOld(item.pubDate)) {
                continue;
              }
              const existingArticle = await storage.getArticleByUrl(
                item.link || "",
              );
              if (!existingArticle && item.link) {
                let imageUrl = extractImageFromItem(item);

                // If no image found in RSS, try to extract from article page
                if (!imageUrl) {
                  console.log(`Extracting image from article: ${item.title}`);
                  imageUrl = await extractImageFromArticle(item.link);
                }

                await storage.createArticle({
                  feedId: feed.id,
                  title: item.title || "Untitled",
                  description: cleanDescription(
                    item.contentSnippet || item.content || "",
                  ),
                  content: item.content || item.contentSnippet || "",
                  url: item.link,
                  author: item.creator || item.author || null,
                  publishedAt: item.pubDate
                    ? new Date(item.pubDate)
                    : new Date(),
                  imageUrl: imageUrl,
                  category: getCategory(item),
                });
                totalNewArticles++;
              }
            }
          }

          await storage.updateFeed(feed.id, { lastFetched: new Date() });
        } catch (parseError) {
          console.error(`Failed to refresh feed ${feed.title}:`, parseError);
        }
      }

      // After refreshing, cleanup old articles
      try {
        await storage.cleanupOldArticles(30);
      } catch (cleanupError) {
        console.error("Error during automatic cleanup:", cleanupError);
      }

      res.json({ success: true, newArticlesCount: totalNewArticles });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh feeds" });
    }
  });

  // Settings routes
  app.get("/api/settings/email-config", async (req, res) => {
    try {
      const keys = [
        "fromAddress",
        "toAddress",
        "toAddressAlternate",
        "toAddressAlternate2",
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPass",
        "smtpSecure",
      ];
      const settings = await Promise.all(
        keys.map((key) => storage.getSetting(key)),
      );
      const config = {
        fromAddress: settings[0],
        toAddress: settings[1],
        toAddressAlternate: settings[2],
        toAddressAlternate2: settings[3],
        smtpHost: settings[4],
        smtpPort: settings[5] ? parseInt(settings[5], 10) : undefined,
        smtpUser: settings[6],
        smtpPass: settings[7],
        smtpSecure: settings[8] ? settings[8] === "true" : undefined,
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get email settings" });
    }
  });

  app.post("/api/settings/email-config", async (req, res) => {
    try {
      const config = emailConfigSchema.parse(req.body);
      const keys = [
        "fromAddress",
        "toAddress",
        "toAddressAlternate",
        "toAddressAlternate2",
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPass",
        "smtpSecure",
      ];
      for (const key of keys) {
        const value = (config as any)[key];
        if (value !== undefined && value !== null) {
          await storage.setSetting(key, String(value));
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid email settings" });
    }
  });

  app.get("/api/settings/llm-config", async (req, res) => {
    try {
      const config = await storage.getLlmConfig();
      let hasApiKey = false;
      let keyringError: string | undefined = undefined;
      try {
        const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
        hasApiKey = !!apiKey;
      } catch (keytarErrorObj: any) {
        let errorMessage = keytarErrorObj.message || String(keytarErrorObj);
        if (
          errorMessage.includes("D-Bus") ||
          errorMessage.includes("$DISPLAY") ||
          errorMessage.includes("secret_service_search_items_sync")
        ) {
          errorMessage +=
            ". On Linux, ensure the server has access to a D-Bus session (e.g. run with dbus-run-session).";
        }
        keyringError = errorMessage;
        console.error("Keytar failed to check for API key:", keyringError);
      }

      res.json({
        ...config,
        hasApiKey,
        keyringError,
      });
    } catch (error) {
      console.error("Failed to get LLM config:", error);
      res.status(500).json({ error: "Failed to get LLM settings" });
    }
  });

  app.post("/api/settings/llm-config", async (req, res) => {
    try {
      const config = llmConfigSchema.parse(req.body);

      if (config.apiKey !== undefined) {
        try {
          if (config.apiKey === "") {
            console.log("Deleting LLM API key from keyring");
            await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
          } else {
            console.log("Setting LLM API key in keyring");
            await keytar.setPassword(
              KEYTAR_SERVICE,
              KEYTAR_ACCOUNT,
              config.apiKey,
            );
            // Verify it was set
            const verification = await keytar.getPassword(
              KEYTAR_SERVICE,
              KEYTAR_ACCOUNT,
            );
            if (verification === config.apiKey) {
              console.log("LLM API key verified in keyring");
            } else {
              console.warn(
                "LLM API key verification failed - retrieved value does not match",
              );
            }
          }
        } catch (keytarError: any) {
          let message = keytarError.message || String(keytarError);
          if (message.includes("D-Bus") || message.includes("$DISPLAY")) {
            message +=
              ". On Linux, ensure the server has access to a D-Bus session (e.g. run with dbus-run-session).";
          }
          console.error("Keytar failed to update password:", message);
          return res.status(500).json({ error: `Keyring error: ${message}` });
        }
      }

      // Remove sensitive data before saving to DB
      const { apiKey, hasApiKey, keyringError, ...safeConfig } = config;

      for (const [key, value] of Object.entries(safeConfig)) {
        if (value !== undefined && value !== null) {
          await storage.setSetting(`llm_${key}`, String(value));
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid LLM settings" });
    }
  });

  app.get("/api/settings/publishing", async (req, res) => {
    try {
      const keys = ["sendEpub", "sendHtml", "sendMd", "sendPdf"];
      const settings = await Promise.all(
        keys.map((key) => storage.getSetting(`pub_${key}`)),
      );
      const config = {
        sendEpub: settings[0] ? settings[0] === "true" : true,
        sendHtml: settings[1] ? settings[1] === "true" : false,
        sendMd: settings[2] ? settings[2] === "true" : false,
        sendPdf: settings[3] ? settings[3] === "true" : false,
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get publishing settings" });
    }
  });

  app.post("/api/settings/publishing", async (req, res) => {
    try {
      const config = publishingSettingsSchema.parse(req.body);
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null) {
          await storage.setSetting(`pub_${key}`, String(value));
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid publishing settings" });
    }
  });

  app.post("/api/articles/:id/summarize", async (req, res) => {
    try {
      const { id } = req.params;
      let article = await storage.getArticle(id);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      article = await ensureFullArticleContent(article);

      if (!article.content) {
        return res
          .status(404)
          .json({ error: "Article content not found even after fetching" });
      }

      const llmConfig = await storage.getLlmConfig();
      const endpoint = normalizeLlmEndpoint(llmConfig.endpoint || "");

      const promptTemplate =
        llmConfig.prompt || DEFAULT_PROMPTS.summarize;

      const plainTextContent = cheerio.load(article.content).text();
      const truncatedContent =
        plainTextContent.length > 40000
          ? plainTextContent.slice(0, 40000) + "... [truncated]"
          : plainTextContent;
      const prompt = promptTemplate.replace("{article_text}", truncatedContent);

      const apiKey = await getLlmApiKey();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const requestBody = {
        model: llmConfig.llmModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: llmConfig.max_tokens || 4000,
        temperature: llmConfig.temperature || 0.7,
      };

      console.log(`Sending LLM Summarization request to ${endpoint}`, {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        hasApiKey: !!apiKey,
      });

      let llmResponse;
      try {
        llmResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error(`Fetch error during LLM Summarization:`, fetchError);
        throw new Error(
          `Failed to connect to LLM endpoint: ${fetchError.message}`,
        );
      }

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error(`LLM Summarization request failed:`, {
          status: llmResponse.status,
          statusText: llmResponse.statusText,
          endpoint,
          model: requestBody.model,
          errorBody,
        });
        throw new Error(
          `LLM API request failed with status ${llmResponse.status}: ${errorBody}`,
        );
      }

      let llmResult;
      try {
        llmResult = (await llmResponse.json()) as any;
      } catch (parseError: any) {
        console.error(`Failed to parse LLM response as JSON:`, parseError);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }

      const summary = llmResult.choices?.[0]?.message?.content;
      const finishReason = llmResult.choices?.[0]?.finish_reason;

      if (!summary) {
        console.error(
          `Unexpected LLM response structure:`,
          JSON.stringify(llmResult),
        );
        throw new Error(
          "Failed to extract summary from LLM response. Check server logs for response structure.",
        );
      }

      console.log(
        `LLM Summarization complete. Length: ${summary.length} chars. Finish reason: ${finishReason}`,
      );
      if (summary.length > 0) {
        console.log(
          `Response start: ${summary.substring(0, 100).replace(/\n/g, " ")}...`,
        );
      }

      res.json({ summary });
    } catch (error: any) {
      console.error("Summarization error:", error);
      res.status(500).json({
        error: "Failed to summarize article",
        details: error.message,
      });
    }
  });

  app.post("/api/articles/:id/additional-info", async (req, res) => {
    try {
      const { id } = req.params;
      let article = await storage.getArticle(id);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      article = await ensureFullArticleContent(article);

      if (!article.content) {
        return res.status(404).json({ error: "Article content not found" });
      }

      const llmConfig = await storage.getLlmConfig();
      const endpoint = normalizeLlmEndpoint(llmConfig.endpoint || "");

      const promptTemplate =
        llmConfig.additionalInfoPrompt || DEFAULT_PROMPTS.additionalInfo;

      const plainTextContent = cheerio.load(article.content).text();
      const truncatedContent =
        plainTextContent.length > 40000
          ? plainTextContent.slice(0, 40000) + "... [truncated]"
          : plainTextContent;
      const prompt = promptTemplate.replace("{article_text}", truncatedContent);

      const apiKey = await getLlmApiKey();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const requestBody = {
        model: llmConfig.llmModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: llmConfig.max_tokens || 4000,
        temperature: llmConfig.temperature || 0.7,
      };

      console.log(`Sending LLM Additional Info request to ${endpoint}`, {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        hasApiKey: !!apiKey,
      });

      let llmResponse;
      try {
        llmResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error(`Fetch error during LLM Additional Info:`, fetchError);
        throw new Error(
          `Failed to connect to LLM endpoint: ${fetchError.message}`,
        );
      }

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error(`LLM Additional Info request failed:`, {
          status: llmResponse.status,
          statusText: llmResponse.statusText,
          endpoint,
          model: requestBody.model,
          errorBody,
        });
        throw new Error(
          `LLM API request failed with status ${llmResponse.status}: ${errorBody}`,
        );
      }

      let llmResult;
      try {
        llmResult = (await llmResponse.json()) as any;
      } catch (parseError: any) {
        console.error(`Failed to parse LLM response as JSON:`, parseError);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }

      const additionalInfo = llmResult.choices?.[0]?.message?.content;
      const finishReason = llmResult.choices?.[0]?.finish_reason;

      if (!additionalInfo) {
        console.error(
          `Unexpected LLM response structure:`,
          JSON.stringify(llmResult),
        );
        throw new Error(
          "Failed to extract additional info from LLM response. Check server logs for response structure.",
        );
      }

      console.log(
        `LLM Additional Info complete. Length: ${additionalInfo.length} chars. Finish reason: ${finishReason}`,
      );
      if (additionalInfo.length > 0) {
        console.log(
          `Response start: ${additionalInfo.substring(0, 100).replace(/\n/g, " ")}...`,
        );
      }

      res.json({ additionalInfo });
    } catch (error: any) {
      console.error("Additional info error:", error);
      res.status(500).json({
        error: "Failed to get additional info",
        details: error.message,
      });
    }
  });

  app.post("/api/articles/:id/deep-research", async (req, res) => {
    try {
      const { id } = req.params;
      let article = await storage.getArticle(id);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      article = await ensureFullArticleContent(article);

      if (!article.content) {
        return res.status(404).json({ error: "Article content not found" });
      }

      const llmConfig = await storage.getLlmConfig();
      const endpoint = normalizeLlmEndpoint(llmConfig.endpoint || "");

      const promptTemplate =
        llmConfig.deepResearchPrompt || DEFAULT_PROMPTS.deepResearch;

      const plainTextContent = cheerio.load(article.content).text();
      const truncatedContent =
        plainTextContent.length > 40000
          ? plainTextContent.slice(0, 40000) + "... [truncated]"
          : plainTextContent;
      const prompt = promptTemplate.replace("{article_text}", truncatedContent);

      const apiKey = await getLlmApiKey();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const requestBody = {
        model: llmConfig.llmModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: llmConfig.max_tokens || 4000,
        temperature: llmConfig.temperature || 0.8,
      };

      console.log(`Sending LLM Deep Research request to ${endpoint}`, {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        hasApiKey: !!apiKey,
      });

      let llmResponse;
      try {
        llmResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error(`Fetch error during LLM Deep Research:`, fetchError);
        throw new Error(
          `Failed to connect to LLM endpoint: ${fetchError.message}`,
        );
      }

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error(`LLM Deep Research request failed:`, {
          status: llmResponse.status,
          statusText: llmResponse.statusText,
          endpoint,
          model: requestBody.model,
          errorBody,
        });
        throw new Error(
          `LLM API request failed with status ${llmResponse.status}: ${errorBody}`,
        );
      }

      let llmResult;
      try {
        llmResult = (await llmResponse.json()) as any;
      } catch (parseError: any) {
        console.error(`Failed to parse LLM response as JSON:`, parseError);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }

      const deepResearch = llmResult.choices?.[0]?.message?.content;
      const finishReason = llmResult.choices?.[0]?.finish_reason;

      if (!deepResearch) {
        console.error(
          `Unexpected LLM response structure:`,
          JSON.stringify(llmResult),
        );
        throw new Error(
          "Failed to extract deep research from LLM response. Check server logs for response structure.",
        );
      }

      console.log(
        `LLM Deep Research complete. Length: ${deepResearch.length} chars. Finish reason: ${finishReason}`,
      );
      if (deepResearch.length > 0) {
        console.log(
          `Response start: ${deepResearch.substring(0, 100).replace(/\n/g, " ")}...`,
        );
      }

      res.json({ deepResearch });
    } catch (error: any) {
      console.error("Deep research error:", error);
      res.status(500).json({
        error: "Failed to get deep research prompts",
        details: error.message,
      });
    }
  });

  app.post("/api/articles/:id/counterpoints", async (req, res) => {
    try {
      const { id } = req.params;
      let article = await storage.getArticle(id);

      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      article = await ensureFullArticleContent(article);

      if (!article.content) {
        return res.status(404).json({ error: "Article content not found" });
      }

      const llmConfig = await storage.getLlmConfig();
      const endpoint = normalizeLlmEndpoint(llmConfig.endpoint || "");

      const promptTemplate =
        llmConfig.counterpointsPrompt || DEFAULT_PROMPTS.counterpoints;

      const plainTextContent = cheerio.load(article.content).text();
      const truncatedContent =
        plainTextContent.length > 40000
          ? plainTextContent.slice(0, 40000) + "... [truncated]"
          : plainTextContent;
      const prompt = promptTemplate.replace("{article_text}", truncatedContent);

      const apiKey = await getLlmApiKey();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const requestBody = {
        model: llmConfig.llmModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: llmConfig.max_tokens || 4000,
        temperature: llmConfig.temperature || 0.8,
      };

      console.log(`Sending LLM Counterpoints request to ${endpoint}`, {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        hasApiKey: !!apiKey,
      });

      let llmResponse;
      try {
        llmResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error(`Fetch error during LLM Counterpoints:`, fetchError);
        throw new Error(
          `Failed to connect to LLM endpoint: ${fetchError.message}`,
        );
      }

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error(`LLM Counterpoints request failed:`, {
          status: llmResponse.status,
          statusText: llmResponse.statusText,
          endpoint,
          model: requestBody.model,
          errorBody,
        });
        throw new Error(
          `LLM API request failed with status ${llmResponse.status}: ${errorBody}`,
        );
      }

      let llmResult;
      try {
        llmResult = (await llmResponse.json()) as any;
      } catch (parseError: any) {
        console.error(`Failed to parse LLM response as JSON:`, parseError);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }

      const counterpoints = llmResult.choices?.[0]?.message?.content;
      const finishReason = llmResult.choices?.[0]?.finish_reason;

      if (!counterpoints) {
        console.error(
          `Unexpected LLM response structure:`,
          JSON.stringify(llmResult),
        );
        throw new Error(
          "Failed to extract counterpoints from LLM response. Check server logs for response structure.",
        );
      }

      console.log(
        `LLM Counterpoints complete. Length: ${counterpoints.length} chars. Finish reason: ${finishReason}`,
      );
      if (counterpoints.length > 0) {
        console.log(
          `Response start: ${counterpoints.substring(0, 100).replace(/\n/g, " ")}...`,
        );
      }

      res.json({ counterpoints });
    } catch (error: any) {
      console.error("Counterpoints error:", error);
      res.status(500).json({
        error: "Failed to get counterpoints",
        details: error.message,
      });
    }
  });

  app.post("/api/articles/:id/discuss", async (req, res) => {
    try {
      const { id } = req.params;
      const { messages } = req.body; // Array of { role: 'user' | 'assistant', content: string }

      let article = await storage.getArticle(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      article = await ensureFullArticleContent(article);
      if (!article.content) {
        return res.status(404).json({ error: "Article content not found" });
      }

      const llmConfig = await storage.getLlmConfig();
      const endpoint = normalizeLlmEndpoint(llmConfig.endpoint || "");

      const plainTextContent = cheerio.load(article.content).text();
      const truncatedContent =
        plainTextContent.length > 40000
          ? plainTextContent.slice(0, 40000) + "... [truncated]"
          : plainTextContent;

      const systemPrompt = `You are a helpful assistant. Below is an article that you will discuss with the user.
Article Title: ${article.title}
Article Text:
${truncatedContent}`;

      let apiMessages = [{ role: "system", content: systemPrompt }];

      if (!messages || messages.length === 0) {
        // Initial request - use discussPrompt

        const discussPromptTemplate =
          llmConfig.discussPrompt ||
          "Summarize the article in one sentence, and ask the user what they would like to discuss about it.";
        
        apiMessages.push({ role: "user", content: discussPromptTemplate });
      } else {
        // Continuing conversation
        apiMessages = apiMessages.concat(messages);
      }

      const apiKey = await getLlmApiKey();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const requestBody = {
        model: llmConfig.llmModel || "gpt-3.5-turbo",
        messages: apiMessages,
        max_tokens: llmConfig.max_tokens || 4000,
        temperature: llmConfig.temperature || 0.7,
      };

      console.log(`Sending LLM Discuss request to ${endpoint}`, {
        model: requestBody.model,
        messageCount: apiMessages.length,
        hasApiKey: !!apiKey,
      });

      let llmResponse;
      try {
        llmResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error(`Fetch error during LLM Discuss:`, fetchError);
        throw new Error(
          `Failed to connect to LLM endpoint: ${fetchError.message}`,
        );
      }

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error(`LLM Discuss request failed:`, {
          status: llmResponse.status,
          errorBody,
        });
        throw new Error(`LLM API request failed: ${errorBody}`);
      }

      const llmResult = (await llmResponse.json()) as any;
      const responseMessage = llmResult.choices?.[0]?.message;

      if (!responseMessage) {
        throw new Error("Failed to extract response from LLM");
      }

      res.json({ message: responseMessage });
    } catch (error: any) {
      console.error("Discuss error:", error);
      res.status(500).json({
        error: "Failed to discuss article",
        details: error.message,
      });
    }
  });

  app.post("/api/feeds/find", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      let fullUrl = url;
      if (!/^https?:\/\//i.test(fullUrl)) {
        fullUrl = `https://${fullUrl}`;
      }

      let response;
      try {
        response = await fetch(fullUrl, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
          },
        });
      } catch (e) {
        return res.status(400).json({ error: "Failed to fetch URL" });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const feedUrls = new Set<string>();

      // Find RSS and Atom links in the page
      $('link[rel="alternate"]').each((i, el) => {
        const type = $(el).attr("type");
        if (type === "application/rss+xml" || type === "application/atom+xml") {
          const href = $(el).attr("href");
          if (href) {
            feedUrls.add(new URL(href, fullUrl).href);
          }
        }
      });

      // Also look in <a> tags for links to RSS feeds
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        if (href && (href.includes("rss") || href.includes("feed"))) {
          feedUrls.add(new URL(href, fullUrl).href);
        }
      });

      // Look for common feed paths
      const commonPaths = ["/rss", "/feed", "/rss.xml", "/feed.xml"];
      for (const path of commonPaths) {
        feedUrls.add(new URL(path, fullUrl).href);
      }

      const feeds = [];
      for (const feedUrl of Array.from(feedUrls)) {
        try {
          const feed = await parser.parseURL(feedUrl);
          feeds.push({
            url: feedUrl,
            title: feed.title || "Untitled Feed",
          });
        } catch (error) {
          // Ignore invalid feeds
        }
      }

      res.json({ feeds });
    } catch (error) {
      res.status(500).json({ error: "Failed to find feeds" });
    }
  });

  // Preview feed articles
  app.post("/api/feeds/preview", async (req, res) => {
    try {
      const { feedUrl } = req.body;

      if (!feedUrl) {
        return res.status(400).json({ error: "Feed URL is required" });
      }

      const feed = await parser.parseURL(feedUrl);
      const articles = feed.items.slice(0, 10).map((item) => ({
        title: item.title || "Untitled",
        url: item.link || "",
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      }));

      res.json({ articles });
    } catch (error) {
      res.status(500).json({ error: "Failed to preview feed" });
    }
  });

  // Queue publish route
  app.post("/api/queue/publish", async (req, res) => {
    const uniqueId = randomUUID();
    const htmlPath = path.join("/tmp", `queued_articles_${uniqueId}.html`);
    const epubPath = path.join("/tmp", `queued_articles_${uniqueId}.epub`);
    const mdPath = path.join("/tmp", `queued_articles_${uniqueId}.md`);
    const pdfPath = path.join("/tmp", `queued_articles_${uniqueId}.pdf`);

    try {
      const { toAddress, format } = publishQueueSchema.parse(req.body);
      const keys = [
        "fromAddress",
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPass",
        "smtpSecure",
      ];
      const settings = await Promise.all(
        keys.map((key) => storage.getSetting(key)),
      );
      const config = {
        fromAddress: settings[0],
        smtpHost: settings[1],
        smtpPort: settings[2] ? parseInt(settings[2], 10) : undefined,
        smtpUser: settings[3],
        smtpPass: settings[4],
        smtpSecure: settings[5] ? settings[5] === "true" : false,
      };

      if (!toAddress || !config.fromAddress) {
        return res
          .status(400)
          .json({ error: "Recipient and From address are not configured" });
      }

      const queuedArticles = await storage.getQueuedArticles();
      if (queuedArticles.length === 0) {
        return res.status(400).json({ error: "Queue is empty" });
      }

      // Re-fetch content for articles with short content
      for (let i = 0; i < queuedArticles.length; i++) {
        queuedArticles[i] = await ensureFullArticleContent(queuedArticles[i]);
      }

      const today = new Date().toISOString().split("T")[0];
      const ebookTitle = `Queued Articles - ${today} (${queuedArticles.length} articles) - ${uniqueId.slice(0, 8)}`;
      const ebookAuthor = "Curi RSS";
      const coverPath = path.join(process.cwd(), "dist/public/curirss.png");

      // Create HTML and Markdown content
      let htmlContent = `<html><head><title>${ebookTitle}</title></head><body>`;
      htmlContent += `<h1>${ebookTitle}</h1><ul>`;
      queuedArticles.forEach((article) => {
        htmlContent += `<li><a href="#${article.id}">${article.title}</a></li>`;
      });
      htmlContent += `</ul>`;

      let mdContent = `# ${ebookTitle}\n\n`;
      mdContent += "## Table of Contents:\n";
      queuedArticles.forEach((article) => {
        mdContent += `- [${article.title}](#${article.title.toLowerCase().replace(/ /g, "-")})\n`;
      });
      mdContent += "\n\n";

      queuedArticles.forEach((article) => {
        htmlContent += `<h2 id="${article.id}">${article.title}</h2>`;
        const $ = cheerio.load(article.content || "");
        $("img").remove();
        $("svg").remove();
        htmlContent += $.html();
        htmlContent += `<hr/>`;

        mdContent += `## <a id="${article.title.toLowerCase().replace(/ /g, "-")}">${article.title}</a>\n\n`;
        mdContent += turndownService.turndown($.html() || "");
        mdContent += "\n\n---\n\n";
      });
      htmlContent += `</body></html>`;

      const attachments = [];

      if (format === "html") {
        await fs.writeFile(htmlPath, htmlContent);
        attachments.push({
          filename: `${ebookTitle}.html`,
          path: htmlPath,
          contentType: "text/html",
        });
      }

      if (format === "md") {
        await fs.writeFile(mdPath, mdContent);
        attachments.push({
          filename: `${ebookTitle}.md`,
          path: mdPath,
          contentType: "text/markdown",
        });
      }

      if (format === "epub") {
        await fs.writeFile(htmlPath, htmlContent);
        const ebookConvertCommand = `ebook-convert "${htmlPath}" "${epubPath}" --title "${ebookTitle}" --authors "${ebookAuthor}" --cover "${coverPath}"`;
        console.log("Running ebook-convert command:", ebookConvertCommand);
        await new Promise<void>((resolve, reject) => {
          exec(ebookConvertCommand, (error) => {
            if (error) return reject(error);
            resolve();
          });
        });
        attachments.push({
          filename: `${ebookTitle}.epub`,
          path: epubPath,
          contentType: "application/epub+zip",
        });
      }

      if (format === "pdf") {
        const browser = await puppeteer.launch({
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        });
        const mergedPdf = await PDFDocument.create();

        for (const article of queuedArticles) {
          const page = await browser.newPage();
          page.on("dialog", async (dialog) => {
            console.log(`Dismissing dialog: ${dialog.message()}`);
            await dialog.dismiss();
          });
          await page.goto(article.url, {
            waitUntil: "networkidle2",
            timeout: 60000,
          });
          await page.evaluate(() => {
            const selectors = [
              '[id*="popup"]',
              '[class*="popup"]',
              '[id*="modal"]',
              '[class*="modal"]',
              '[id*="overlay"]',
              '[class*="overlay"]',
              '[id*="dialog"]',
              '[class*="dialog"]',
              '[id*="cookie"]',
              '[class*="cookie"]',
            ];
            for (const selector of selectors) {
              document.querySelectorAll(selector).forEach((el) => el.remove());
            }
          });
          const pdfBytes = await page.pdf({ format: "A4" });
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(
            pdfDoc,
            pdfDoc.getPageIndices(),
          );
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
          await page.close();
        }

        await browser.close();
        const mergedPdfBytes = await mergedPdf.save();
        await fs.writeFile(pdfPath, mergedPdfBytes);

        attachments.push({
          filename: `${ebookTitle}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        });
      }

      // Email the files
      let transporter: nodemailer.Transporter;
      if (
        config.smtpHost &&
        config.smtpPort &&
        config.smtpUser &&
        config.smtpPass
      ) {
        transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
          },
        });
      } else {
        transporter = nodemailer.createTransport({
          sendmail: true,
          newline: "unix",
          path: "/usr/sbin/sendmail",
        });
      }

      const mailOptions = {
        from: config.fromAddress,
        to: toAddress,
        subject: ebookTitle,
        text: "Here are your queued articles.",
        attachments: attachments,
      };
      console.log("Sending email with options:", mailOptions);
      await transporter.sendMail(mailOptions);

      // Mark articles as read
      const articleIds = queuedArticles.map((a) => a.id);
      await storage.updateArticlesAsPublished(articleIds);

      res.json({ success: true, message: "EPUB sent successfully." });
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      res
        .status(500)
        .json({ error: "Failed to publish queue", details: errorMessage });
    } finally {
      // Cleanup
      await fs
        .unlink(htmlPath)
        .catch((e) => console.error("Error cleaning up html file:", e));
      await fs
        .unlink(epubPath)
        .catch((e) => console.error("Error cleaning up epub file:", e));
      await fs
        .unlink(mdPath)
        .catch((e) => console.error("Error cleaning up md file:", e));
      await fs
        .unlink(pdfPath)
        .catch((e) => console.error("Error cleaning up pdf file:", e));
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
