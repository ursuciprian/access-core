FROM node:20-alpine

WORKDIR /app

# Install build dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY index.ts ./
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

EXPOSE 8443

# Run as non-root
USER node

CMD ["node", "dist/index.js"]
