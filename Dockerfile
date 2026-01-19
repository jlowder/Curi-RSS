# Stage 1: Build dependencies and app
FROM node:20-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libsecret-1-dev \
    pkg-config \
    libglib2.0-dev \
    calibre \
    msmtp \
    sendmail \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
RUN npm ci
COPY . .
RUN npm run build
RUN npx esbuild server/start-prod.ts server/production.ts server/init-db.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# ---

# Stage 2: Final production image
FROM node:20-slim
WORKDIR /app

# Create a non-root user and group
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libsecret-1-0 \
    gnome-keyring \
    dbus-x11 \
    calibre \
    msmtp \
    sendmail \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --gid 1001 --home /home/appuser appuser

# Create the data directory in the final image
RUN mkdir -p /app/data && chown appuser:nodejs /app/data

USER root
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
USER appuser

# Copy over the built app and production dependencies with the correct ownership
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=appuser:nodejs /app/.cache/puppeteer /app/.cache/puppeteer

# Expose port 7016
EXPOSE 7016

# Set environment variables
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV NODE_ENV=production
ENV PORT=7016
ENV XDG_DATA_HOME=/app/data/xdg

# Start the application
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/start-prod.js"]
