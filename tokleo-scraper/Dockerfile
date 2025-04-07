FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port for the web server
EXPOSE 3010

# Run the application in scheduled mode with web server
CMD ["node", "index.js", "--scheduled", "--web"] 