const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'rss.db');
console.log(`Using database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  db.exec("DELETE FROM articles");
  db.exec("DELETE FROM feeds");

  const feedId = crypto.randomUUID();
  db.prepare("INSERT INTO feeds (id, title, url, is_active) VALUES (?, ?, ?, 1)").run(
    feedId, 'Test Feed', 'https://example.com/rss'
  );

  const articleCount = 50;
  const now = Date.now();

  const insertArticle = db.prepare("INSERT INTO articles (id, feed_id, title, content, url, published_at, is_read, is_bookmarked, is_queued) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)");

  for (let i = 0; i < articleCount; i++) {
    insertArticle.run(
      crypto.randomUUID(),
      feedId,
      `Test Article ${i}`,
      'This is a long content to ensure it is scrollable. ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200),
      `https://example.com/article-${i}`,
      now - (i * 60000)
    );
  }

  console.log(`Seeded successfully with ${articleCount} articles`);
} catch (e) {
  console.error('Seeding error:', e);
  process.exit(1);
} finally {
  db.close();
}
