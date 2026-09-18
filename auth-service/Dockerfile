# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm run build && npm test && npm prune --omit=dev

FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/package.json ./
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=build --chown=1000:1000 /app/dist ./dist
USER 1000:1000
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
