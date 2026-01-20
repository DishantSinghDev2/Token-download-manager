# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl and aria2c
RUN apk add --no-cache curl aria2

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Create downloads directory
RUN mkdir -p /downloads

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
