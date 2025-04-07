#!/bin/bash

# Tokleo Scraper deployment script

echo "Starting Tokleo Scraper deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Warning: docker-compose command not found. Using 'docker compose' instead."
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Create data directory if it doesn't exist
mkdir -p data

# Build and start the containers
echo "Building and starting containers..."
$DOCKER_COMPOSE up -d --build

# Check if the containers are running
if [ $? -eq 0 ]; then
    echo "Tokleo Scraper deployed successfully!"
    echo "The HTML report is available at: http://localhost:3010/"
    echo ""
    echo "To view logs, run: $DOCKER_COMPOSE logs -f"
    echo "To stop the application, run: $DOCKER_COMPOSE down"
else
    echo "Error: Failed to deploy Tokleo Scraper."
    exit 1
fi 