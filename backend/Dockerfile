FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY backend ./backend
RUN npm run backend:build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/backend ./dist/backend
COPY backend/migrations ./dist/backend/migrations
COPY backend/seeds ./dist/backend/seeds

EXPOSE 3000

CMD ["sh", "-c", "node dist/backend/src/migrate.js && node dist/backend/src/seed.js && node dist/backend/src/server.js"]
