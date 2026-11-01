FROM node:18-slim AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/. .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
USER root
COPY --from=build /app/build /usr/share/nginx/html
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
	&& chown nginx:nginx /usr/share/nginx/html/config.js
USER nginx
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
