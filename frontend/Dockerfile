# syntax=docker/dockerfile:1
FROM node:26.8.2-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm test && npm run typecheck && npm run build

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:9dac0a79194e45a7da0158a9c6da57b217585af0786db3845d1f0ec1a0dd182f AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=build --chown=65532:65532 /app/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=build --chown=65532:65532 /app/public ./public
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD ["/usr/local/bin/node", "-e", "fetch('http://127.0.0.1:3000/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["server.js"]
