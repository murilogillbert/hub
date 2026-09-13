# OpenDriverHub API — build multi-stage Node/Express/Prisma
# Contexto de build = raiz do repositório hub.
FROM node:20-alpine AS build
WORKDIR /src
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /src/package*.json ./
COPY --from=build /src/prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /src/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /src/dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
