# Tokleo Pool Scraper and Analyzer

This tool scrapes pool data from Tokleo.com, processes it using the DeepSeek API, and analyzes the data to identify profitable liquidity pools.

## Setup

1. Install dependencies:
```
npm install
```

2. Set up DeepSeek API key as an environment variable:
```
export DEEPSEEK_API_KEY=your_api_key_here
```

## Usage

There are several ways to run the tool:

### Run the entire workflow:
```
node index.js
```
This will:
1. Scrape raw data from Tokleo
2. Process it with DeepSeek API
3. Analyze the data and generate reports

### Run individual steps:
```
npm run scrape     # Only scrape data
npm run process    # Only process raw data
npm run analyze    # Only analyze processed data
```

### Run all steps sequentially:
```
npm run run-all
```

## Output Files

The tool generates several output files:

- `tokleo-raw-data.json`: Raw HTML and text data scraped from Tokleo
- `tokleo-data.json`: Structured pool data processed by DeepSeek API
- `pool-analysis.json`: Analysis results in JSON format
- `pool-analysis-report.md`: Analysis results in Markdown format

## Analyzed Pool Categories

The analyzer identifies several categories of pools:

1. **Hot New Pools**: Recently created pools with increasing activity
2. **Rebound Opportunities**: Pools with recent significant upticks in activity
3. **Stable Long-Term Pools**: Established pools with consistent performance
4. **High Fee Pools**: Pools with high fees and strong returns

## Customization

You can modify the filtering criteria in `analyzer.js` to adjust the pool categorization logic.

## Features

- 🔎 Scrapes all pool data from Tokleo.com
- 📊 Analyzes pools based on Fee/TVL ratios, volume trends, age, and other metrics
- 🏷 Categorizes pools into:
  - 🔥 Hot New Pools - New pools (<10h) with high recent activity
  - 📈 Rebound Opportunities - Pools with sudden increases in volume and fees
  - 🛡️ Stable Long-Term Pools - Consistent performers for lower-risk LP
  - 💰 High Fee Pools - Pools with high binStep and base fee percentages
- 📄 Generates comprehensive reports (JSON and Markdown)

## How It Works

1. **Scraping Phase**: 
   - Launches a headless browser to access Tokleo.com
   - Extracts data from pool cards using DOM selectors
   - Attempts to find pool addresses and token addresses
   - Monitors network requests for additional data
   - Saves both raw and processed data

2. **Analysis Phase**:
   - Applies filters based on the criteria from the README
   - Categorizes pools into different opportunity types
   - Calculates key metrics like hourly rate changes 
   - Generates formatted reports for easy interpretation

## Selection Criteria

This tool uses the following criteria for identifying promising pools:

- **🔥 Hot New Pools**: Age < 10h, recent hourly rates > 24h average, recent volume > 24h average
- **📈 Rebound Opportunities**: Recent hourly rates 50%+ above 24h average, recent volume 50%+ above 24h average
- **🛡️ Stable Long-Term Pools**: Age > 24h, consistent hourly rates and volume (±30% variance), Fee/TVL > 5%
- **💰 High Fee Pools**: BinStep ≥ 100, Base Fee ≥ 1%, 24h Fee/TVL > 10%

## Example Report

The generated Markdown report will look something like this:

```markdown
# Tokleo Pool Analysis Report

Analysis of 83 pools from Tokleo.com

## Top 10 Pools by Fee/TVL Ratio

| Pool | Age | Bin Step | Base Fee | Liquidity | 24h Fee/TVL | 1h Rate | 24h Volume | 1h Volume | Signals |
| ---- | --- | -------- | -------- | --------- | ----------- | ------- | ---------- | --------- | ------- |
| PT/SOL | 57 hours | 125 | 1.00% | $6K | 296.10% | 0.30%/H | $126,000 | $23,000 | 🛡️ Stable long-term pool |
...

## 🔥 Hot New Pools (3)

| Pool | Age | Bin Step | Base Fee | Liquidity | 24h Fee/TVL | 1h Rate | 24h Volume | 1h Volume | Signals |
...
```

## Requirements

- Node.js 14+
- NPM or Yarn
- Internet connection

## License

MIT

## EC2 Deployment Guide

### 1. Launch an EC2 Instance

1. Log in to your AWS console
2. Launch an EC2 instance (t2.medium or larger recommended)
   - Supported operating systems:
     - Ubuntu/Debian (Amazon Linux 2 AMI)
     - Amazon Linux 2/Amazon Linux 2023
3. Configure security group to allow SSH (port 22)
4. Create and download your key pair

### 2. Connect to your EC2 Instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-public-dns   # For Amazon Linux
# OR
ssh -i your-key.pem ubuntu@your-ec2-public-dns     # For Ubuntu
```

### 3. Set Up the Environment

Clone the repository and run the setup script:

```bash
# Install Git if needed
sudo apt install -y git     # Ubuntu
# OR
sudo yum install -y git     # Amazon Linux

# Clone repository
git clone https://github.com/your-username/tokleo-scraper.git
cd tokleo-scraper

# Make setup script executable
chmod +x setup-ec2.sh

# Run setup script (works with both Ubuntu and Amazon Linux)
./setup-ec2.sh
```

### 4. Verify Installation

Test that Puppeteer works correctly on your EC2 instance:

```bash
node test-puppeteer.js
```

If successful, you should see a confirmation message and an `example.png` file created.

### 5. Run the Scraper

```bash
node scraper.js
```

### 6. Set Up as a Scheduled Task (Optional)

To run the scraper on a schedule using cron:

```bash
# Edit crontab
crontab -e

# Add a line to run every 6 hours (at 0:00, 6:00, 12:00, and 18:00)
0 */6 * * * cd /path/to/tokleo-scraper && node scraper.js >> scraper.log 2>&1
```

## Troubleshooting

### Common Issues:

1. **Browser Launch Error**: Ensure all dependencies are installed correctly using the setup script
2. **Memory Issues**: Consider increasing the EC2 instance size if you encounter memory problems
3. **Timeout Errors**: Check your network configuration and increase timeout values in the code

### Debugging:

Check the error screenshots and HTML dumps created by the scraper:
- `error-screenshot.png`
- `error-page.html`
- `no-cards-screenshot.png`
- `page-content.html`

## Output Files

The scraper generates two main output files:
- `tokleo-raw-data.json`: Raw HTML/text data from the main container
- `tokleo-structured-data.json`: Structured data for all pools

## License

MIT 