#!/bin/bash

echo "Starting all services..."

# Start meteora-trade-admin
cd ~/Documents/coding/mtr-trade/meteora-trade-admin
pm2 start npm --name "mtr-admin" -- run preview

# Start tokleo-server
cd /Users/fengge/Documents/coding/mtr-trade/tokleo-scraper
pm2 start npm --name "tokleo-server" -- run server

# Start tokleo-scraper
pm2 start npm --name "tokleo-scraper" -- run scheduled

# Start trader
cd /Users/fengge/Documents/coding/mtr-trade/trader
pm2 start npm --name "trader" -- run server

echo "All services started successfully!" 