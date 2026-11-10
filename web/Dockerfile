FROM node:22-bookworm-slim AS build
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
COPY web web
RUN npm run build -w web

FROM nginx:1.27-alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
