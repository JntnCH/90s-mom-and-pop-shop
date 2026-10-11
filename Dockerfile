# Multi-stage build for Node.js / TanStack Start on Cloud Run
FROM node:22-slim AS builder

WORKDIR /app

# Install essential certificates and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition files
COPY package.json package-lock.json* ./

# Install all dependencies (ensuring devDependencies needed for build are present)
RUN npm install --include=dev

# Copy full application code
COPY . .

# Build application for node-server with environment variables injected
ARG VITE_LINE_LIFF_ID
ARG LINE_LIFF_ID
ARG LINE_CHANNEL_ACCESS_TOKEN
ARG LINE_CHANNEL_SECRET
ARG LINE_CHANNEL_ID
ARG LINE_TO_ID

ENV VITE_LINE_LIFF_ID=$VITE_LINE_LIFF_ID
ENV LINE_LIFF_ID=$LINE_LIFF_ID
ENV LINE_CHANNEL_ACCESS_TOKEN=$LINE_CHANNEL_ACCESS_TOKEN
ENV LINE_CHANNEL_SECRET=$LINE_CHANNEL_SECRET
ENV LINE_CHANNEL_ID=$LINE_CHANNEL_ID
ENV LINE_TO_ID=$LINE_TO_ID
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

RUN npm run build

# Runner stage - lightweight production image with glibc
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy built server output and static assets
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Cloud Run defaults to listening on port 8080 (or process.env.PORT)
EXPOSE 8080

# Start production server
CMD ["node", ".output/server/index.mjs"]
