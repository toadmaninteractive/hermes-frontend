# Build
FROM node:20-bullseye-slim AS builder

ARG BUILD_ENV

WORKDIR /app

COPY . .

RUN npm ci --prefer-offline --no-audit

RUN npm run build --configuration=$BUILD_ENV

# Serve
FROM nginx:alpine-slim AS runner

COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist/browser /app

EXPOSE 80
