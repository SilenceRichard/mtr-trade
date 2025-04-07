# Deploying Tokleo Scraper

This document provides instructions for deploying the Tokleo Scraper application using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Deployment Steps

1. Clone the repository to your server:
   ```bash
   git clone <repository-url>
   cd tokleo-scraper
   ```

2. Make sure your `.env` file is set up correctly (if needed):
   ```
   API_KEY=your_api_key_here
   PORT=3010
   ```

3. Build and start the Docker container:
   ```bash
   docker-compose up -d
   ```

4. Access the HTML report at `http://<your-server-ip>:3010/`

## Configuration

- The schedule service runs every 30 seconds by default. You can modify this in the `index.js` file.
- Port 3010 is used by default. You can change this in the `docker-compose.yml` file.

## Managing the Application

- View logs:
  ```bash
  docker-compose logs -f
  ```

- Stop the application:
  ```bash
  docker-compose down
  ```

- Restart the application:
  ```bash
  docker-compose restart
  ```

## Data Persistence

- Data is stored in the `./data` directory which is mounted as a volume in the Docker container.
- This ensures data persists between container restarts.

## Security Notes

- Consider setting up a reverse proxy like Nginx with HTTPS for production use.
- Add authentication if the report contains sensitive information. 