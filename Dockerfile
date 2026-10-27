# Multi-stage build for Node.js / TanStack Start
# Compatible with: Google Cloud Run + Railway (+ any Docker host)
FROM node:22-slim AS builder

WORKDIR /app

# Install essential certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition files
COPY package.json package-lock.json* ./

# Install all dependencies (devDependencies needed for build)
RUN npm install --include=dev

# Copy full application code
COPY . .

# Build-time public env (Vite). Pass via --build-arg or Railway Variables (Build phase)
ARG VITE_LINE_LIFF_ID
ARG LINE_LIFF_ID
ARG LINE_CHANNEL_ACCESS_TOKEN
ARG LINE_CHANNEL_SECRET
ARG LINE_CHANNEL_ID
ARG LINE_TO_ID
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID

ENV VITE_LINE_LIFF_ID=$VITE_LINE_LIFF_ID
ENV LINE_LIFF_ID=$LINE_LIFF_ID
ENV LINE_CHANNEL_ACCESS_TOKEN=$LINE_CHANNEL_ACCESS_TOKEN
ENV LINE_CHANNEL_SECRET=$LINE_CHANNEL_SECRET
ENV LINE_CHANNEL_ID=$LINE_CHANNEL_ID
ENV LINE_TO_ID=$LINE_TO_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

RUN npm run build

# Runner stage - lightweight production image
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Default for local/Cloud Run; Railway injects PORT at runtime and overrides this
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy built server output and static assets
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Cloud Run / Railway both use process.env.PORT
EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
