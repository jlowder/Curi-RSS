import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const feeds = sqliteTable("feeds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  description: text("description"),
  faviconUrl: text("favicon_url"),
  lastFetched: integer("last_fetched", { mode: 'timestamp' }),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedId: text("feed_id").notNull().references(() => feeds.id),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  url: text("url").notNull(),
  author: text("author"),
  publishedAt: integer("published_at", { mode: 'timestamp' }),
  imageUrl: text("image_url"),
  category: text("category"),
  isRead: integer("is_read", { mode: 'boolean' }).default(false),
  isBookmarked: integer("is_bookmarked", { mode: 'boolean' }).default(false),
  isQueued: integer("is_queued", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const insertFeedSchema = createInsertSchema(feeds).pick({
  title: true,
  url: true,
  description: true,
}).partial({ title: true, description: true });

export const insertArticleSchema = createInsertSchema(articles).pick({
  feedId: true,
  title: true,
  description: true,
  content: true,
  url: true,
  author: true,
  publishedAt: true,
  imageUrl: true,
  category: true,
});

export const updateArticleSchema = createInsertSchema(articles).pick({
  isRead: true,
  isBookmarked: true,
  isQueued: true,
});

export const updateFeedSchema = createInsertSchema(feeds).pick({
  title: true,
  url: true,
});

export type InsertFeed = z.infer<typeof insertFeedSchema>;
export type Feed = typeof feeds.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;
export type UpdateArticle = z.infer<typeof updateArticleSchema>;

export type FeedWithUnreadCount = Feed & {
  unreadCount: number;
};

export type FeedStats = {
  totalArticles: number;
  articlesPerDay: number;
  daysSinceCreated: number;
  lastArticleDate: Date | null;
  firstArticleDate: Date | null;
};

export type ArticleWithFeed = Article & {
  feed: Feed;
};

export type ArticleStats = {
  unreadCount: number;
  readCount: number;
  savedCount: number;
  queuedCount: number;
};

export const emailConfigSchema = z.object({
  fromAddress: z.string().email().optional(),
  toAddress: z.string().email().optional(),
  toAddressAlternate: z.string().email().optional(),
  toAddressAlternate2: z.string().email().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
});

export const llmConfigSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().url().or(z.literal("")).optional(),
  prompt: z.string().optional(),
  additionalInfoPrompt: z.string().optional(),
  deepResearchPrompt: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
});

export const publishingSettingsSchema = z.object({
  sendEpub: z.boolean().default(true),
  sendHtml: z.boolean().default(false),
  sendMd: z.boolean().default(false),
  sendPdf: z.boolean().default(false),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type PublishingSettings = z.infer<typeof publishingSettingsSchema>;

export const publishQueueSchema = z.object({
  toAddress: z.string().email(),
  format: z.enum(["epub", "html", "md", "pdf"]),
});

export type PublishQueue = z.infer<typeof publishQueueSchema>;

export type FoundFeed = {
  url: string;
  title: string;
};
