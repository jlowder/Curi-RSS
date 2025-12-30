import { type Feed, type InsertFeed, type Article, type InsertArticle, type UpdateArticle, type FeedWithUnreadCount, type ArticleWithFeed, type ArticleStats, type FeedStats, settings, LlmConfig } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Feed operations
  createFeed(feed: InsertFeed): Promise<Feed>;
  getFeed(id: string): Promise<Feed | undefined>;
  getFeedByUrl(url: string): Promise<Feed | undefined>;
  getAllFeeds(): Promise<Feed[]>;
  getFeedsWithUnreadCount(): Promise<FeedWithUnreadCount[]>;
  updateFeed(id: string, feed: Partial<Feed>): Promise<Feed | undefined>;
  deleteFeed(id: string): Promise<boolean>;
  getFeedStats(feedId: string): Promise<FeedStats | null>;

  // Article operations
  createArticle(article: InsertArticle): Promise<Article>;
  getArticle(id: string): Promise<ArticleWithFeed | undefined>;
  getArticlesByFeed(feedId: string): Promise<Article[]>;
  getAllArticles(): Promise<ArticleWithFeed[]>;
  getFilteredArticles(query?: string, feedId?: string, category?: string): Promise<ArticleWithFeed[]>;
  updateArticle(id: string, article: UpdateArticle): Promise<Article | undefined>;
  updateArticleContent(id: string, updates: { content?: string | null, imageUrl?: string | null }): Promise<Article | undefined>;
  deleteArticle(id: string): Promise<boolean>;
  deleteArticlesByFeed(feedId: string): Promise<boolean>;
  getArticleByUrl(url: string): Promise<Article | undefined>;
  getArticleStats(): Promise<ArticleStats>;
  cleanupOldArticles(daysOld: number): Promise<number>;
  deleteArticlesWithNullPublishedAt(): Promise<number>;
  getQueuedArticles(): Promise<Article[]>;
  updateArticlesAsPublished(ids: string[]): Promise<void>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getLlmConfig(): Promise<LlmConfig>;
}

export class MemStorage implements IStorage {
  private feeds: Map<string, Feed>;
  private articles: Map<string, Article>;

  constructor() {
    this.feeds = new Map();
    this.articles = new Map();
  }

  async createFeed(insertFeed: InsertFeed): Promise<Feed> {
    const id = randomUUID();
    const feed: Feed = {
      id,
      title: insertFeed.title || "Unknown Feed",
      url: insertFeed.url,
      description: insertFeed.description || null,
      faviconUrl: null,
      lastFetched: null,
      isActive: true,
      createdAt: new Date(),
    };
    this.feeds.set(id, feed);
    return feed;
  }

  async getFeed(id: string): Promise<Feed | undefined> {
    return this.feeds.get(id);
  }

  async getFeedByUrl(url: string): Promise<Feed | undefined> {
    return Array.from(this.feeds.values()).find(feed => feed.url === url);
  }

  async getAllFeeds(): Promise<Feed[]> {
    return Array.from(this.feeds.values());
  }

  async getFeedsWithUnreadCount(): Promise<FeedWithUnreadCount[]> {
    const feeds = Array.from(this.feeds.values());
    return feeds.map(feed => {
      const unreadCount = Array.from(this.articles.values())
        .filter(article => article.feedId === feed.id && !article.isRead).length;
      return { ...feed, unreadCount };
    });
  }

  async updateFeed(id: string, feedUpdate: Partial<Feed>): Promise<Feed | undefined> {
    const feed = this.feeds.get(id);
    if (!feed) return undefined;
    
    const updatedFeed = { ...feed, ...feedUpdate };
    this.feeds.set(id, updatedFeed);
    return updatedFeed;
  }

  async deleteFeed(id: string): Promise<boolean> {
    const deleted = this.feeds.delete(id);
    if (deleted) {
      await this.deleteArticlesByFeed(id);
    }
    return deleted;
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = randomUUID();
    const article: Article = {
      ...insertArticle,
      id,
      description: insertArticle.description || null,
      content: insertArticle.content || null,
      author: insertArticle.author || null,
      publishedAt: insertArticle.publishedAt || null,
      imageUrl: insertArticle.imageUrl || null,
      category: insertArticle.category || null,
      isRead: false,
      isBookmarked: false,
      isQueued: false,
      createdAt: new Date(),
    };
    this.articles.set(id, article);
    return article;
  }

  async getArticle(id: string): Promise<ArticleWithFeed | undefined> {
    const article = this.articles.get(id);
    if (!article) return undefined;
    const feed = this.feeds.get(article.feedId);
    if (!feed) {
      // This should not happen in a consistent state, but as a fallback:
      throw new Error(`Feed not found for article ${id}`);
    }
    return { ...article, feed };
  }

  async getArticlesByFeed(feedId: string): Promise<Article[]> {
    return Array.from(this.articles.values())
      .filter(article => article.feedId === feedId);
  }

  async getAllArticles(): Promise<ArticleWithFeed[]> {
    const articles = Array.from(this.articles.values());
    const result: ArticleWithFeed[] = [];
    
    for (const article of articles) {
      const feed = this.feeds.get(article.feedId);
      if (feed) {
        result.push({ ...article, feed });
      }
    }
    
    return result.sort((a, b) => {
      const dateA = a.publishedAt || a.createdAt;
      const dateB = b.publishedAt || b.createdAt;
      if (!dateA || !dateB) return 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  async getFilteredArticles(query?: string, feedId?: string, category?: string): Promise<ArticleWithFeed[]> {
    let articles = await this.getAllArticles();
    
    // Filter by category first
    if (category) {
      switch (category) {
        case 'unread':
          articles = articles.filter(article => !article.isRead);
          break;
        case 'read':
          articles = articles.filter(article => article.isRead && !article.isBookmarked);
          break;
        case 'saved':
          articles = articles.filter(article => article.isBookmarked);
          break;
      }
    }
    
    // Filter by specific feed only when in unread category
    if (feedId && feedId !== 'all' && (!category || category === 'unread')) {
      articles = articles.filter(article => article.feedId === feedId);
    }
    
    // Filter by search query
    if (query) {
      const searchQuery = query.toLowerCase();
      articles = articles.filter(article =>
        article.title.toLowerCase().includes(searchQuery) ||
        (article.description && article.description.toLowerCase().includes(searchQuery)) ||
        article.feed.title.toLowerCase().includes(searchQuery)
      );
    }
    
    return articles;
  }

  async updateArticle(id: string, articleUpdate: UpdateArticle): Promise<Article | undefined> {
    const article = this.articles.get(id);
    if (!article) return undefined;
    
    const updatedArticle = { ...article, ...articleUpdate };
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async updateArticleContent(id: string, updates: { content?: string | null, imageUrl?: string | null }): Promise<Article | undefined> {
    const article = this.articles.get(id);
    if (!article) return undefined;
    
    const updatedArticle = { ...article, ...updates };
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async deleteArticle(id: string): Promise<boolean> {
    return this.articles.delete(id);
  }

  async deleteArticlesByFeed(feedId: string): Promise<boolean> {
    const articles = Array.from(this.articles.entries());
    let deleted = false;
    
    for (const [id, article] of articles) {
      if (article.feedId === feedId) {
        this.articles.delete(id);
        deleted = true;
      }
    }
    
    return deleted;
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    return Array.from(this.articles.values()).find(article => article.url === url);
  }

  async getArticleStats(): Promise<ArticleStats> {
    const articles = Array.from(this.articles.values());
    
    const unreadCount = articles.filter(article => !article.isRead).length;
    const readCount = articles.filter(article => article.isRead && !article.isBookmarked).length;
    const savedCount = articles.filter(article => article.isBookmarked).length;
    const queuedCount = articles.filter(article => (article as any).isQueued).length;
    
    return { unreadCount, readCount, savedCount, queuedCount };
  }

  async getFeedStats(feedId: string): Promise<FeedStats | null> {
    const feed = this.feeds.get(feedId);
    if (!feed) return null;

    const feedArticles = Array.from(this.articles.values()).filter(article => article.feedId === feedId);
    
    if (feedArticles.length === 0) {
      const feedCreatedTime = feed.createdAt ? feed.createdAt.getTime() : new Date().getTime();
      const daysSinceCreated = Math.max(1, Math.floor((new Date().getTime() - feedCreatedTime) / (1000 * 60 * 60 * 24)));
      return {
        totalArticles: 0,
        articlesPerDay: 0,
        daysSinceCreated,
        lastArticleDate: null,
        firstArticleDate: null,
      };
    }

    const sortedArticles = feedArticles.sort((a, b) => 
      (b.publishedAt?.getTime() || (b.createdAt ? b.createdAt.getTime() : 0)) - (a.publishedAt?.getTime() || (a.createdAt ? a.createdAt.getTime() : 0))
    );

    const lastArticleDate = sortedArticles[0].publishedAt || sortedArticles[0].createdAt;
    const firstArticleDate = sortedArticles[sortedArticles.length - 1].publishedAt || sortedArticles[sortedArticles.length - 1].createdAt;
    const feedCreatedTime = feed.createdAt ? feed.createdAt.getTime() : new Date().getTime();
    const daysSinceCreated = Math.max(1, Math.floor((new Date().getTime() - feedCreatedTime) / (1000 * 60 * 60 * 24)));
    const articlesPerDay = parseFloat((feedArticles.length / daysSinceCreated).toFixed(2));

    return {
      totalArticles: feedArticles.length,
      articlesPerDay,
      daysSinceCreated,
      lastArticleDate,
      firstArticleDate,
    };
  }

  async cleanupOldArticles(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    const articlesToDelete = Array.from(this.articles.values()).filter(article => {
      // Only delete read articles that are not bookmarked and older than cutoff
      const articleDate = article.createdAt || new Date();
      return article.isRead && !article.isBookmarked && articleDate < cutoffDate;
    });
    
    for (const article of articlesToDelete) {
      this.articles.delete(article.id);
      deletedCount++;
    }
    
    return deletedCount;
  }

  async deleteArticlesWithNullPublishedAt(): Promise<number> {
    // Not implemented for MemStorage, but required for interface
    return 0;
  }

  async getQueuedArticles(): Promise<Article[]> {
    return Array.from(this.articles.values()).filter(a => (a as any).isQueued);
  }


  async updateArticlesAsPublished(ids: string[]): Promise<void> {
    ids.forEach(id => {
      const article = this.articles.get(id);
      if (article) {
        article.isRead = true;
        article.isQueued = false;
      }
    });
  }

  async getSetting(key: string): Promise<string | undefined> {
    return undefined; // Not implemented for MemStorage
  }

  async setSetting(key: string, value: string): Promise<void> {
    // Not implemented for MemStorage
  }

  async getLlmConfig(): Promise<LlmConfig> {
    return {
      enabled: true,
      endpoint: "http://localhost:8000/v1/chat/completions",
      prompt: "Create a markdown-formatted summary of the following article. The summary should be structured with three sections using h2 headings: 'Key Findings', 'Conclusion', and 'Suggested Next Steps'. The 'Key Findings' section must be a bulleted list. Do not include any text outside of these three sections.\n\nArticle Text:\n{article_text}",
    };
  }
}

// Database imports  
import { db } from "./db";
import { feeds, articles } from "@shared/schema";
import { eq, desc, and, or, like, count, sql, inArray, isNull } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  private db;

  constructor(dbInstance?: any) {
    this.db = dbInstance || db;
  }

  async createFeed(insertFeed: InsertFeed): Promise<Feed> {
    const [feed] = await this.db
      .insert(feeds)
      .values({
        title: insertFeed.title || "Unknown Feed",
        url: insertFeed.url,
        description: insertFeed.description || null,
      })
      .returning();
    return feed;
  }

  async getFeed(id: string): Promise<Feed | undefined> {
    const [feed] = await this.db.select().from(feeds).where(eq(feeds.id, id));
    return feed || undefined;
  }

  async getFeedByUrl(url: string): Promise<Feed | undefined> {
    const [feed] = await this.db.select().from(feeds).where(eq(feeds.url, url));
    return feed || undefined;
  }

  async getAllFeeds(): Promise<Feed[]> {
    return await this.db.select().from(feeds).where(eq(feeds.isActive, true)).orderBy(desc(feeds.createdAt));
  }

  async getFeedsWithUnreadCount(): Promise<FeedWithUnreadCount[]> {
    const result = await this.db
      .select({
        id: feeds.id,
        title: feeds.title,
        url: feeds.url,
        description: feeds.description,
        faviconUrl: feeds.faviconUrl,
        lastFetched: feeds.lastFetched,
        isActive: feeds.isActive,
        createdAt: feeds.createdAt,
        unreadCount: count(articles.id).as('unreadCount'),
      })
      .from(feeds)
      .leftJoin(articles, and(eq(articles.feedId, feeds.id), eq(articles.isRead, false)))
      .where(eq(feeds.isActive, true))
      .groupBy(feeds.id)
      .orderBy(desc(feeds.createdAt));

    return result.map((r: any) => ({
      ...r,
      unreadCount: Number(r.unreadCount) || 0,
    }));
  }

  async updateFeed(id: string, feedUpdate: Partial<Feed>): Promise<Feed | undefined> {
    const [feed] = await this.db
      .update(feeds)
      .set(feedUpdate)
      .where(eq(feeds.id, id))
      .returning();
    return feed || undefined;
  }

  async deleteFeed(id: string): Promise<boolean> {
    // Delete all articles for this feed first
    await this.db.delete(articles).where(eq(articles.feedId, id));
    
    // Then delete the feed
    const result = await this.db.delete(feeds).where(eq(feeds.id, id));
    return result.changes > 0;
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const [article] = await this.db
      .insert(articles)
      .values(insertArticle)
      .returning();
    return article;
  }

  async getArticle(id: string): Promise<ArticleWithFeed | undefined> {
    const result = await this.db
      .select({
        id: articles.id,
        feedId: articles.feedId,
        title: articles.title,
        description: articles.description,
        content: articles.content,
        url: articles.url,
        author: articles.author,
        publishedAt: articles.publishedAt,
        imageUrl: articles.imageUrl,
        category: articles.category,
        isRead: articles.isRead,
        isBookmarked: articles.isBookmarked,
        isQueued: articles.isQueued,
        createdAt: articles.createdAt,
        feed: {
          id: feeds.id,
          title: feeds.title,
          url: feeds.url,
          description: feeds.description,
          faviconUrl: feeds.faviconUrl,
          lastFetched: feeds.lastFetched,
          isActive: feeds.isActive,
          createdAt: feeds.createdAt,
        }
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(eq(articles.id, id));

    return result[0] || undefined;
  }

  async getArticlesByFeed(feedId: string): Promise<Article[]> {
    return await this.db
      .select()
      .from(articles)
      .where(eq(articles.feedId, feedId))
      .orderBy(desc(articles.publishedAt));
  }

  async getAllArticles(): Promise<ArticleWithFeed[]> {
    const result = await this.db
      .select({
        id: articles.id,
        feedId: articles.feedId,
        title: articles.title,
        description: articles.description,
        content: articles.content,
        url: articles.url,
        author: articles.author,
        publishedAt: articles.publishedAt,
        imageUrl: articles.imageUrl,
        category: articles.category,
        isRead: articles.isRead,
        isBookmarked: articles.isBookmarked,
        isQueued: articles.isQueued,
        createdAt: articles.createdAt,
        feed: {
          id: feeds.id,
          title: feeds.title,
          url: feeds.url,
          description: feeds.description,
          faviconUrl: feeds.faviconUrl,
          lastFetched: feeds.lastFetched,
          isActive: feeds.isActive,
          createdAt: feeds.createdAt,
        }
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(eq(feeds.isActive, true))
      .orderBy(desc(articles.publishedAt));

    return result;
  }

  async getFilteredArticles(query?: string, feedId?: string, category?: string): Promise<ArticleWithFeed[]> {
    let conditions = [eq(feeds.isActive, true)];
    
    if (query) {
      conditions.push(or(
        like(articles.title, `%${query}%`),
        like(articles.description, `%${query}%`),
        like(articles.content, `%${query}%`)
      )!);
    }
    
    if (feedId && feedId !== 'all') {
      conditions.push(eq(articles.feedId, feedId));
    }
    
    // Handle reading status categories with priority: saved > read > unread
    if (category === 'unread') {
      conditions.push(eq(articles.isRead, false));
    } else if (category === 'read') {
      conditions.push(and(
        eq(articles.isRead, true),
        eq(articles.isBookmarked, false)
      )!);
    } else if (category === 'saved') {
      conditions.push(eq(articles.isBookmarked, true));
    } else if (category === 'queued') {
      conditions.push(eq(articles.isQueued, true));
    }

    const result = await this.db
      .select({
        id: articles.id,
        feedId: articles.feedId,
        title: articles.title,
        description: articles.description,
        content: articles.content,
        url: articles.url,
        author: articles.author,
        publishedAt: articles.publishedAt,
        imageUrl: articles.imageUrl,
        category: articles.category,
        isRead: articles.isRead,
        isBookmarked: articles.isBookmarked,
        isQueued: articles.isQueued,
        createdAt: articles.createdAt,
        feed: {
          id: feeds.id,
          title: feeds.title,
          url: feeds.url,
          description: feeds.description,
          faviconUrl: feeds.faviconUrl,
          lastFetched: feeds.lastFetched,
          isActive: feeds.isActive,
          createdAt: feeds.createdAt,
        }
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(and(...conditions))
      .orderBy(desc(articles.publishedAt));

    return result;
  }

  async updateArticle(id: string, articleUpdate: UpdateArticle): Promise<Article | undefined> {
    const [article] = await this.db
      .update(articles)
      .set(articleUpdate)
      .where(eq(articles.id, id))
      .returning();
    return article || undefined;
  }

  async updateArticleContent(id: string, updates: { content?: string | null, imageUrl?: string | null }): Promise<Article | undefined> {
    const [article] = await this.db
      .update(articles)
      .set(updates)
      .where(eq(articles.id, id))
      .returning();
    return article || undefined;
  }

  async deleteArticle(id: string): Promise<boolean> {
    const result = await this.db.delete(articles).where(eq(articles.id, id));
    return result.changes > 0;
  }

  async deleteArticlesByFeed(feedId: string): Promise<boolean> {
    const result = await this.db.delete(articles).where(eq(articles.feedId, feedId));
    return result.changes > 0;
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    const [article] = await this.db.select().from(articles).where(eq(articles.url, url));
    return article || undefined;
  }

  async getArticleStats(): Promise<ArticleStats> {
    const result = await this.db
      .select({
        unreadCount: sql<number>`count(case when ${articles.isRead} = false then 1 end)`,
        readCount: sql<number>`count(case when ${articles.isRead} = true and ${articles.isBookmarked} = false then 1 end)`,
        savedCount: sql<number>`count(case when ${articles.isBookmarked} = true then 1 end)`,
        queuedCount: sql<number>`count(case when ${articles.isQueued} = true then 1 end)`,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(eq(feeds.isActive, true));

    const stats = result[0];
    return {
      unreadCount: Number(stats.unreadCount) || 0,
      readCount: Number(stats.readCount) || 0,
      savedCount: Number(stats.savedCount) || 0,
      queuedCount: Number(stats.queuedCount) || 0,
    };
  }

  async getFeedStats(feedId: string): Promise<FeedStats | null> {
    const feed = await this.getFeed(feedId);
    if (!feed) return null;

    const result = await this.db
      .select({
        totalArticles: sql<number>`count(*)`,
        lastArticleTimestamp: sql<number | null>`max(${articles.publishedAt})`,
        firstArticleTimestamp: sql<number | null>`min(${articles.publishedAt})`,
      })
      .from(articles)
      .where(eq(articles.feedId, feedId));

    const stats = result[0];
    const totalArticles = Number(stats.totalArticles) || 0;
    
    if (totalArticles === 0) {
      const feedCreatedTime = feed.createdAt ? (feed.createdAt instanceof Date ? feed.createdAt.getTime() : new Date(feed.createdAt).getTime()) : Date.now();
      const daysSinceCreated = Math.max(1, Math.floor((Date.now() - feedCreatedTime) / (1000 * 60 * 60 * 24)));
      return {
        totalArticles: 0,
        articlesPerDay: 0,
        daysSinceCreated,
        lastArticleDate: null,
        firstArticleDate: null,
      };
    }

    // Handle timestamp conversion - check if timestamp is in seconds or milliseconds
    const convertTimestamp = (timestamp: number | null) => {
      if (!timestamp) return null;
      // If timestamp is too small, it's likely in seconds, convert to milliseconds
      const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      return new Date(ts);
    };
    
    const lastArticleDate = convertTimestamp(stats.lastArticleTimestamp);
    const firstArticleDate = convertTimestamp(stats.firstArticleTimestamp);
    
    // Calculate days since feed creation using article dates
    const now = Date.now();
    let daysSinceCreated = 1;
    
    if (firstArticleDate && lastArticleDate) {
      // Calculate days between first and last article
      const timeDiff = lastArticleDate.getTime() - firstArticleDate.getTime();
      const daysBetweenArticles = Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
      daysSinceCreated = daysBetweenArticles;
    } else if (firstArticleDate) {
      // Calculate days from first article to now
      daysSinceCreated = Math.max(1, Math.ceil((now - firstArticleDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    const articlesPerDay = Number((totalArticles / daysSinceCreated).toFixed(2));

    return {
      totalArticles,
      articlesPerDay,
      daysSinceCreated,
      lastArticleDate,
      firstArticleDate,
    };
  }

  async cleanupOldArticles(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    // Condition for old articles:
    // - EITHER publishedAt is not null AND is older than the cutoff
    // - OR publishedAt is null AND createdAt is older than the cutoff
    const oldArticleCondition = or(
      and(
        sql`${articles.publishedAt} IS NOT NULL`,
        sql`${articles.publishedAt} < ${cutoffTimestamp}`
      ),
      and(
        sql`${articles.publishedAt} IS NULL`,
        sql`${articles.createdAt} < ${cutoffTimestamp}`
      )
    );

    // Delete read articles that are not bookmarked and are old
    const result = await this.db
      .delete(articles)
      .where(
        and(
          eq(articles.isRead, true),
          eq(articles.isBookmarked, false),
          oldArticleCondition
        )
      );
    
    console.log(`Cleaned up ${result.changes || 0} old read articles.`);
    return result.changes || 0;
  }

  async deleteArticlesWithNullPublishedAt(): Promise<number> {
    const result = await this.db
      .delete(articles)
      .where(isNull(articles.publishedAt));

    console.log(`Deleted ${result.changes || 0} articles with null publishedAt.`);
    return result.changes || 0;
  }

  async getQueuedArticles(): Promise<Article[]> {
    return await this.db.select().from(articles).where(eq(articles.isQueued, true));
  }


  async updateArticlesAsPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    console.log(`Updating ${ids.length} articles as published.`);
    await this.db.update(articles)
      .set({ isRead: true, isQueued: false })
      .where(inArray(articles.id, ids));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const result = await this.db.select().from(settings).where(eq(settings.key, key));
    return result[0]?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  async getLlmConfig(): Promise<LlmConfig> {
    const keys = ["enabled", "endpoint", "prompt", "additionalInfoPrompt", "deepResearchPrompt", "max_tokens", "temperature"];
    const settingsList = await Promise.all(keys.map(key => this.getSetting(`llm_${key}`)));
    return {
      enabled: settingsList[0] === undefined ? true : settingsList[0] === 'true',
      endpoint: settingsList[1] ?? undefined,
      prompt: settingsList[2] ?? undefined,
      additionalInfoPrompt: settingsList[3] ?? undefined,
      deepResearchPrompt: settingsList[4] ?? undefined,
      max_tokens: settingsList[5] ? parseInt(settingsList[5], 10) : undefined,
      temperature: settingsList[6] ? parseFloat(settingsList[6]) : undefined,
    };
  }
}

// Always use DatabaseStorage with SQLite
export const storage = new DatabaseStorage();
