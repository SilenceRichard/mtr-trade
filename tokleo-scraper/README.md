# Tokleo Scraper

A Node.js application for fetching token pool data from the Tokleo API and analyzing token pool metrics.

## Features

- Fetches pool data from the Tokleo API
- Scrapes security metrics from GeckoTerminal for potential high-yield pools
- Analyzes pools to identify high-yield and emerging pools
- Saves data to structured JSON files for further analysis
- Provides notifications for high-potential pools

## Installation

1. Clone this repository
2. Install dependencies:

```bash
cd tokleo-scraper
npm install
```

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit the `.env` file and set your Tokleo API key:

```
TOKLEO_API_KEY=your_api_key_here
```

You can obtain an API key from the Tokleo platform.

## Usage

### Running the Scraper

To run the scraper with garbage collection enabled (recommended):

```bash
node --expose-gc scraper.js
```

Or without garbage collection:

```bash
npm run scrape
```

### Running the Analyzer

To analyze the scraped data:

```bash
npm run analyze
```

### Running Everything

To run both the scraper and analyzer:

```bash
npm start
```

## Output Files

The scraper generates several files:

- `tokleo-raw-data.json` - Raw data from the API
- `tokleo-structured-data.json` - Processed data in a structured format
- `tokleo-structured-data-TIMESTAMP.json` - Historical snapshot of the structured data
- `pool-analysis.json` - Analysis results with pool recommendations

## Data Structure

The scraper transforms the API data into a format compatible with the analyzer. Each pool entry contains:

- Basic pool information (name, address, token address)
- Age and liquidity metrics
- Fee-to-TVL ratios across different timeframes
- Volume data
- Security metrics (when available)

## License

ISC 