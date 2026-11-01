FROM node:18-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/. .
USER node
EXPOSE 5000
CMD ["npm", "start"]
