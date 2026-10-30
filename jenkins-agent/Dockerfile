FROM docker:27-cli AS docker-cli

FROM jenkins/inbound-agent:latest-jdk17

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm curl git \
    && rm -rf /var/lib/apt/lists/*