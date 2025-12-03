# Backend API image
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy source files
COPY src ./src
COPY data ./data
COPY drizzle.config.js ./drizzle.config.js
COPY drizzle ./drizzle

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
