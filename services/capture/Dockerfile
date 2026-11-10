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
COPY gateway/package.json gateway/
COPY web/package.json web/
RUN npm ci
COPY packages packages
COPY services/capture services/capture
RUN npm run build -w packages/events \
  && npm run build -w packages/auth \
  && npm run build -w packages/evidence \
  && npm exec -w services/capture -- prisma generate \
  && npm run build -w services/capture
RUN chmod +x /app/services/capture/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/app/services/capture/docker-entrypoint.sh"]
