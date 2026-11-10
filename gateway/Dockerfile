FROM node:22-bookworm-slim
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
COPY packages/auth packages/auth
COPY gateway gateway
COPY services/identity/openapi.yaml services/identity/openapi.yaml
COPY services/notification/openapi.yaml services/notification/openapi.yaml
COPY services/capture/openapi.yaml services/capture/openapi.yaml
COPY services/records/openapi.yaml services/records/openapi.yaml
RUN npm run build -w packages/auth && npm run build -w gateway
ENV NODE_ENV=production
EXPOSE 8080
WORKDIR /app/gateway
CMD ["node", "dist/main.js"]
