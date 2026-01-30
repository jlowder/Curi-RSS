# Curi RSS Reader

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
- **AI Discuss**: An interactive chat interface to discuss the article content.

### Enabling AI Features

To use AI features, you must configure an LLM provider:
1. Open the application in your browser.
2. Click on the **Settings** (cog icon) in the sidebar.
3. Go to the **LLM Configuration** section.
4. Toggle **Enable LLM features**.
5. Provide your **LLM Endpoint** (e.g., `https://api.openai.com/v1`) and **API Key**.
6. (Optional) Customize the prompts for each AI function.
7. Click **Save Changes**.

Once enabled, AI buttons will appear in the article detail view.

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
