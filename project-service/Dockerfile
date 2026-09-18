# syntax=docker/dockerfile:1
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q verify

FROM eclipse-temurin:21-jre-noble AS runtime
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
