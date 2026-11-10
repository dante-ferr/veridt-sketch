FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/events/package.json packages/events/
COPY packages/auth/package.json packages/auth/
COPY packages/evidence/package.json packages/evidence/
COPY services/identity/package.json services/identity/
COPY services/notification/package.json services/notification/
COPY services/capture/package.json services/capture/
COPY services/capture-worker/package.json services/capture-worker/
COPY services/records/package.json services/records/
COPY services/payments/package.json services/payments/
COPY gateway/package.json gateway/
COPY web/package.json web/
RUN npm ci
COPY packages packages
COPY services/identity services/identity
RUN npm run build -w packages/events \
  && npm run build -w packages/auth \
  && npm exec -w services/identity -- prisma generate \
  && npm run build -w services/identity
RUN chmod +x /app/services/identity/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/app/services/identity/docker-entrypoint.sh"]
