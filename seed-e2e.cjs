const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('rss.db');

try {
  db.exec("DELETE FROM articles");
  db.exec("DELETE FROM feeds");

  const feedId = crypto.randomUUID();
  const nowInSeconds = Math.floor(Date.now() / 1000);

  // feeds table
  db.prepare("INSERT INTO feeds (id, title, url, is_active, created_at) VALUES (?, ?, ?, 1, ?)").run(
    feedId, 'Test Feed', 'https://example.com/rss', nowInSeconds
  );

  const articleId = crypto.randomUUID();
  db.prepare("INSERT INTO articles (id, feed_id, title, content, url, published_at, is_read, is_bookmarked, is_queued, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)").run(
    articleId,
    feedId,
    'Test Article',
    'This is a long content to ensure it is scrollable. ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200),
    'https://example.com/article-test',
    nowInSeconds,
    nowInSeconds
  );

  console.log('Seeded successfully with seconds-based timestamps');
} catch (e) {
  console.error(e);
  process.exit(1);
}
db.close();
