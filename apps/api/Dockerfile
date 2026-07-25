# syntax=docker/dockerfile:1

# Dependencies resolve in their own layer, so a source-only change does not
# re-download the world.
FROM maven:3.9-eclipse-temurin-21 AS deps
WORKDIR /build
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

FROM deps AS build
COPY src ./src
# Tests run in CI against Testcontainers, which needs a Docker socket this build
# does not have and must not be given.
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Never root. A JVM that only needs to read its own jar has no business owning
# the filesystem it runs on.
RUN addgroup -S app && adduser -S -G app app
COPY --from=build --chown=app:app /build/target/*.jar /app/app.jar
USER app

EXPOSE 8080

# Exec form, so the JVM is PID 1 and receives SIGTERM directly — which is what
# lets Spring Boot drain in-flight requests instead of being killed outright
# (ADR-0009).
ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=70", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "/app/app.jar"]
