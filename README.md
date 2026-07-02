# Curi RSS Reader

RSS reader with AI-powered article analysis.

![Screenshot](doc/screenshot.png)

## Quick start

### Docker

```bash
docker compose up --build -d
```

Runs on `http://localhost:7016`.

### From GitHub Container Registry

```bash
docker volume create rss_data
docker run -d -p 7016:7016 -v rss_data:/app/data ghcr.io/jlowder/curi-rss:main
```

## AI features

Process articles with LLM-powered tools:

- **Summary** - Article summary
- **References** - Extract and explain cited entities
- **Deep research** - Generate research prompts
- **Counterpoints** - Alternative perspectives
- **Discuss** - Chat about article content

### Enable AI features

1. Open Settings (cog icon in sidebar)
2. Go to LLM Configuration
3. Toggle Enable LLM features
4. Enter your endpoint (e.g., `https://api.openai.com/v1`) and API key
5. Customize prompts per feature if desired
6. Click Save

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test              # unit/integration
npm run test:e2e          # Playwright E2E tests
```

Run E2E tests once to install browsers:

```bash
npx playwright install chromium
```

E2E tests verify settings dialog and article scrolling.
