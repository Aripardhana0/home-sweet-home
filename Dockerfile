FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src
COPY data/tasks.json ./data/tasks.json
COPY public ./public

RUN mkdir -p /app/data/rooms

EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV DATA_DIR=/app/data/rooms

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]
