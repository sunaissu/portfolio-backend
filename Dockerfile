FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
    && test -s dist/main.js \
    && test -s dist/portfolio/data/portfolio.snapshot.json \
    && npm test -- --runInBand local-resume-storage.spec.ts \
    && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts ./scripts

RUN install -d -m 0700 -o node -g node /app/data/uploads

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
