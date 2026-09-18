# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run typecheck && npm run build

FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
