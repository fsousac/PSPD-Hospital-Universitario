# syntax=docker/dockerfile:1

FROM gradle:8.10-jdk21 AS build
WORKDIR /workspace

COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle build -x test --no-daemon

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /deployments

RUN groupadd -r quarkus && useradd -r -g quarkus quarkus

COPY --from=build /workspace/build/quarkus-app/lib/ ./lib/
COPY --from=build /workspace/build/quarkus-app/*.jar ./
COPY --from=build /workspace/build/quarkus-app/app/ ./app/
COPY --from=build /workspace/build/quarkus-app/quarkus/ ./quarkus/

USER quarkus

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "quarkus-run.jar"]
