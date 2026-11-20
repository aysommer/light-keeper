# Игровой сервер Light Keeper.
# Сборка: esbuild собирает сервер вместе с пакетом shared в один файл,
# поэтому в итоговом образе нет ни исходников, ни node_modules.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY client/package.json client/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY shared shared
COPY api api
RUN npm run build -w @light-keeper/api

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    RECORDS_FILE=/data/records.json
WORKDIR /app
# Сборка — ES-модуль; без package.json c type=module Node прочитает его как CommonJS.
RUN echo '{"type":"module"}' > package.json \
 && mkdir -p /data \
 && chown node:node /data
COPY --from=build /app/api/dist ./dist
USER node
# Таблица рекордов переживает пересоздание контейнера.
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
