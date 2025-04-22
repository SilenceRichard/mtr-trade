FROM node:20-slim

WORKDIR /app

# Copy package.json files first for better caching
COPY tokleo-scraper/package*.json ./tokleo-scraper/
COPY trader/package*.json ./trader/

# Install dependencies
RUN cd tokleo-scraper && npm install
RUN cd trader && npm install

# Copy source code
COPY tokleo-scraper ./tokleo-scraper
COPY trader ./trader

# Build TypeScript for trader
RUN cd trader && npm run build

# Create a script to run all services
RUN echo '#!/bin/bash\n\
cd /app/tokleo-scraper && npm run scheduled & \
cd /app/tokleo-scraper && npm run server & \
cd /app/trader && npm run server & \
wait' > /app/start.sh

# Make the script executable
RUN chmod +x /app/start.sh

# Expose ports used by the servers
EXPOSE 4000 4001 3010

# Set environment variable to indicate we're in production
ENV NODE_ENV=production

# Run the script
CMD ["/app/start.sh"] 