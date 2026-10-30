FROM jenkins/inbound-agent:latest-jdk17

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io docker-compose nodejs npm curl git \
    && rm -rf /var/lib/apt/lists/*