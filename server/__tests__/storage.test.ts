import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseStorage } from '../storage';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../shared/schema';

describe('Storage - Unread Count Consistency', () => {
  let storage: DatabaseStorage;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    // Create in-memory database for testing
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    storage = new DatabaseStorage(db);
  });

  it('should handle NULL isRead values consistently between count and filter operations', async () => {
    // Create a test feed
    const feed = await storage.createFeed({
      title: 'Test Feed',
      url: 'https://example.com/feed.xml'
    });

    // Create articles with various isRead states
    const articles = [
      // Normal unread article (isRead = false)
      await storage.createArticle({
        feedId: feed.id,
        title: 'Unread Article 1',
        url: 'https://example.com/article1',
        isRead: false
      }),
      // Normal read article (isRead = true)
      await storage.createArticle({
        feedId: feed.id,
        title: 'Read Article 1',
        url: 'https://example.com/article2',
        isRead: true
      }),
      // Article with NULL isRead (simulating legacy data)
      await db.insert(schema.articles).values({
        id: 'test-null-read',
        feedId: feed.id,
        title: 'NULL Read Article',
        url: 'https://example.com/article3',
        isRead: null,
        isBookmarked: false,
        isQueued: false,
        createdAt: new Date()
      }).returning().then(result => result[0])
    ];

    // Test 1: Verify getFeedsWithUnreadCount includes NULL isRead articles
    const feedsWithCounts = await storage.getFeedsWithUnreadCount();
    const testFeed = feedsWithCounts.find(f => f.id === feed.id);
    expect(testFeed).toBeDefined();
    // Should count both the normal unread article and the NULL isRead article
    expect(testFeed!.unreadCount).toBe(2);

    // Test 2: Verify getFilteredArticles for unread category includes NULL isRead articles
    const unreadArticles = await storage.getFilteredArticles(undefined, feed.id, 'unread');
    // Should return both the normal unread article and the NULL isRead article
    expect(unreadArticles.length).toBe(2);
    expect(unreadArticles.some(a => a.title === 'Unread Article 1')).toBe(true);
    expect(unreadArticles.some(a => a.title === 'NULL Read Article')).toBe(true);

    // Test 3: Verify updateArticlesAsReadByFeed updates NULL isRead articles
    await storage.updateArticlesAsReadByFeed(feed.id);

    // After marking as read, both articles should now be read
    const feedsAfterUpdate = await storage.getFeedsWithUnreadCount();
    const updatedFeed = feedsAfterUpdate.find(f => f.id === feed.id);
    expect(updatedFeed!.unreadCount).toBe(0);

    // Verify individual articles are now marked as read
    const allArticles = await storage.getFilteredArticles(undefined, feed.id);
    expect(allArticles.every(a => a.isRead === true)).toBe(true);
  });

  it('should maintain consistency when marking individual articles as read', async () => {
    // Create a test feed
    const feed = await storage.createFeed({
      title: 'Consistency Test Feed',
      url: 'https://example.com/consistency.xml'
    });

    // Create articles with NULL isRead values
    const articleWithNull = await db.insert(schema.articles).values({
      id: 'null-read-test',
      feedId: feed.id,
      title: 'Initially NULL Article',
      url: 'https://example.com/null-article',
      isRead: null, // Explicitly NULL
      isBookmarked: false,
      isQueued: false,
      createdAt: new Date()
    }).returning().then(result => result[0]);

    // Initially should be counted as unread
    const initialFeeds = await storage.getFeedsWithUnreadCount();
    const initialFeed = initialFeeds.find(f => f.id === feed.id);
    expect(initialFeed!.unreadCount).toBe(1);

    // Mark the article as read directly
    await storage.updateArticle(articleWithNull.id, { isRead: true });

    // Should now show 0 unread articles
    const finalFeeds = await storage.getFeedsWithUnreadCount();
    const finalFeed = finalFeeds.find(f => f.id === feed.id);
    expect(finalFeed!.unreadCount).toBe(0);
  });

  it('should handle edge case of mixed isRead states correctly', async () => {
    // Create a test feed
    const feed = await storage.createFeed({
      title: 'Edge Case Feed',
      url: 'https://example.com/edge.xml'
    });

    // Create multiple articles with different states
    await Promise.all([
      // Normal unread
      storage.createArticle({
        feedId: feed.id,
        title: 'Normal Unread',
        url: 'https://example.com/normal-unread',
        isRead: false
      }),
      // NULL isRead
      db.insert(schema.articles).values({
        id: 'null-read-edge',
        feedId: feed.id,
        title: 'NULL Read Edge',
        url: 'https://example.com/null-edge',
        isRead: null,
        isBookmarked: false,
        isQueued: false,
        createdAt: new Date()
      }).returning().then(result => result[0]),
      // Already read
      storage.createArticle({
        feedId: feed.id,
        title: 'Already Read',
        url: 'https://example.com/already-read',
        isRead: true
      })
    ]);

    // Verify initial state
    const initialFeeds = await storage.getFeedsWithUnreadCount();
    const testFeed = initialFeeds.find(f => f.id === feed.id);
    expect(testFeed!.unreadCount).toBe(2); // Should count both false and NULL

    // Get unread articles to verify consistency
    const unreadArticles = await storage.getFilteredArticles(undefined, feed.id, 'unread');
    expect(unreadArticles.length).toBe(2);
    expect(unreadArticles.some(a => a.title === 'Normal Unread')).toBe(true);
    expect(unreadArticles.some(a => a.title === 'NULL Read Edge')).toBe(true);

    // Mark all as read using the batch operation
    await storage.updateArticlesAsReadByFeed(feed.id);

    // Verify final state
    const finalFeeds = await storage.getFeedsWithUnreadCount();
    const finalFeed = finalFeeds.find(f => f.id === feed.id);
    expect(finalFeed!.unreadCount).toBe(0);

    // Verify all articles are now read
    const allArticles = await storage.getFilteredArticles(undefined, feed.id);
    expect(allArticles.every(a => a.isRead === true)).toBe(true);
  });
});
