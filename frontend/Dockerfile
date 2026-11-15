# Pinned Node version (the Angular CLI needs v22.22.3 or newer). Update on purpose (and commit).
FROM node:22.23.5-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Source is bind-mounted in dev; this COPY is a fallback for production builds
COPY . .

EXPOSE 8080

CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "8080", "--poll", "1000"]
