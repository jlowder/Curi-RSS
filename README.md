# Curi RSS Reader

[![License](https://img.shields.io/github/license/jlowder/Curi-RSS?branch=main)](https://github.com/jlowder/Curi-RSS/blob/main/LICENSE)
[![Version](https://img.shields.io/github/package-json/v/jlowder/Curi-RSS)](https://github.com/jlowder/Curi-RSS)
[![CI/CD](https://img.shields.io/github/actions/workflow/status/jlowder/Curi-RSS/main.yml?label=CI/CD)](https://github.com/jlowder/Curi-RSS/actions)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

A full-stack RSS Reader application with AI-powered features.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Running with Docker Compose

To build and start the application, run the following command in the project root:

```bash
docker compose up --build -d
```

The application will be available at `http://localhost:7016`.

### Applying Updates

If you have made changes to the source code and want to see them in the running container, you must rebuild the image:

```bash
docker compose build --no-cache
docker compose up -d
```

## AI Features

This application includes AI-powered features for articles:
- **AI Summary**: Generates a summary of the article.
- **Referenced Information**: Extracts and explains referenced entities.
- **Deep Research**: Generates research prompts based on the article.
- **Counterpoints**: Generates alternative perspectives or counterarguments to the article content.
- **AI Discuss**: An interactive chat interface to discuss the article content.

### Enabling AI Features

To use AI features, you must configure an LLM provider:
1. Open the application in your browser.
2. Click on the **Settings** (cog icon) in the sidebar.
3. Go to the **LLM Configuration** section.
4. Toggle **Enable LLM features**.
5. Provide your **LLM Endpoint** (e.g., `https://api.openai.com/v1`) and **API Key**.
6. (Optional) Enable/disable each AI function, and customize the prompt used for it.
7. Click **Save Changes**.

Once enabled, AI buttons will appear in the article detail view for every enabled feature.

## Development

If you prefer to run the application locally for development:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   The development server runs on port 7016.
