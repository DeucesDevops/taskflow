# syntax=docker/dockerfile:1
FROM golang:1.27.1-bookworm@sha256:69a7b9788769bec032d238959b61854e9ae87f57be9029ec04e9885fabf99195 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/task-service ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab AS runtime
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/task-service /app/task-service
USER 65532:65532
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=4s --start-period=15s --retries=3 CMD ["/app/task-service", "healthcheck"]
ENTRYPOINT ["/app/task-service"]
