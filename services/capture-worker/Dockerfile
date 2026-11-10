FROM mcr.microsoft.com/playwright:v1.49.1-jammy
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
COPY services/capture-worker services/capture-worker
RUN npm run build -w packages/events \
  && npm run build -w packages/evidence \
  && npm run build -w services/capture-worker
ENV NODE_ENV=production
EXPOSE 3010
WORKDIR /app/services/capture-worker
CMD ["node", "dist/main.js"]
