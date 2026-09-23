# syntax=docker/dockerfile:1
FROM maven:3.9.15-eclipse-temurin-26@sha256:029a8e2838ae68238ffb8be407cddbb3f07d4d839c60c6f26c619a69fd184531 AS build
WORKDIR /build
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q verify

FROM eclipse-temurin:21-jre-noble@sha256:7739f0ffce786528961eea6bf46d9610ee968ac6127c9b2e93494757bdecce9f AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 taskflow \
    && useradd --uid 10001 --gid taskflow --no-create-home --shell /usr/sbin/nologin taskflow
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/target/project-service.jar ./project-service.jar
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 \
    CMD ["curl", "--fail", "--silent", "--max-time", "4", "http://127.0.0.1:8080/ready"]
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/project-service.jar"]
