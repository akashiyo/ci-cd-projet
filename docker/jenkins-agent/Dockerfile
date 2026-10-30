FROM jenkins/inbound-agent:latest-jdk17

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker-cli docker-compose \
    && rm -rf /var/lib/apt/lists/*
#RUN usermod -aG docker jenkins
#USER jenkins
