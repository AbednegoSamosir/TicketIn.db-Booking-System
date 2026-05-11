FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY backend/ ./

# Copy frontend (served statically via express.static)
COPY frontend/ ../frontend/

# Expose the application port
EXPOSE 3000

CMD ["node", "server.js"]
