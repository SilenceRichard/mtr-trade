const { scrapeTokleoData } = require('./scraper');
const { analyzePools } = require('./analyzer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3010;
// Create a simple HTTP server to serve the HTML report
function startWebServer(port = 3010) {
  const server = http.createServer((req, res) => {
    console.log(`Request received: ${req.url}`);
    
    // Only serve the HTML report for now
    if (req.url === '/' || req.url === '/index.html') {
      fs.readFile(path.join(__dirname, 'pool-analysis-report.html'), (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading report');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(port, () => {
    console.log(`Web server running at http://localhost:${port}/`);
  });
  
  return server;
}

async function runFullWorkflow() {
  console.log('===== STARTING TOKLEO DATA WORKFLOW =====');
  
  // Step 1: Scrape raw data from Tokleo website
  console.log('\n===== STEP 1: SCRAPING RAW DATA =====');
  await scrapeTokleoData();  
  // Step 2: Analyze the processed data
  console.log('\n===== STEP 2: ANALYZING PROCESSED DATA =====');
  const analysisReport = analyzePools();
  
  console.log('\n===== WORKFLOW COMPLETED =====');
  console.log('Results:');
  console.log('- Raw data: tokleo-raw-data.json');
  console.log('- Processed data: tokleo-structured-data.json');
  console.log('- Analysis report: pool-analysis.json');
  console.log('- Text report: pool-analysis-report.md');
  console.log('- HTML report: pool-analysis-report.html');
  
  return analysisReport;
}

// Run the workflow if this file is executed directly
if (require.main === module) {
  // Check if scheduled mode is requested via command line argument
  const args = process.argv.slice(2);
  const scheduledMode = args.includes('--scheduled');
  const webServerMode = args.includes('--web') || args.includes('--server');
  const port = args.find(arg => arg.startsWith('--port=')) 
    ? parseInt(args.find(arg => arg.startsWith('--port=')).split('=')[1]) 
    : PORT;
  
  // Start web server if requested
  let server;
  if (webServerMode) {
    server = startWebServer(port);
  }
  
  if (scheduledMode) {
    console.log('Starting scheduled execution (every 30 seconds)');
    // Initial run
    runFullWorkflow().catch(error => {
      console.error('Error in workflow:', error);
    });
    
    // Set up interval for subsequent runs
    setInterval(() => {
      console.log('\n===== SCHEDULED RUN STARTING =====');
      runFullWorkflow().catch(error => {
        console.error('Error in scheduled workflow:', error);
      });
    }, 30000); // 30 seconds in milliseconds
  } else {
    // Single run mode
    runFullWorkflow().catch(error => {
      console.error('Error in workflow:', error);
      if (!webServerMode) {
        process.exit(1);
      }
    });
  }
}

module.exports = { runFullWorkflow, startWebServer }; 