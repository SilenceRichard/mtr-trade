const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

// Function to scrape security metrics from GeckoTerminal
async function scrapeGeckoTerminalMetrics(tokenAddress, browser) {
  if (!tokenAddress) return null;
  
  console.log(`Scraping GeckoTerminal for token: ${tokenAddress}`);
  const page = await browser.newPage();
  page.setDefaultTimeout(90000); // Increase timeout for slow connections
  
  try {
    // Navigate to the GeckoTerminal page for this token
    await page.goto(`https://www.geckoterminal.com/solana/pools/${tokenAddress}`, { 
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    // Check if page has a "not found" message
    const notFoundText = await page.evaluate(() => {
      const notFoundElement = document.querySelector('h1.text-2xl');
      return notFoundElement ? notFoundElement.textContent : null;
    });
    
    if (notFoundText && notFoundText.includes('Not Found')) {
      console.log(`Token ${tokenAddress} not found on GeckoTerminal`);
      return null;
    }
    
    // Wait for the metrics table to load
    const metricsSelector = 'div.rounded.border.border-gray-800.min-w-\\[20rem\\].flex-1.p-2.md\\:min-w-0.md\\:flex-none > table > tbody';
    try {
      await page.waitForSelector(metricsSelector, { timeout: 30000 });
    } catch (error) {
      console.log(`Metrics table not found for token ${tokenAddress}`);
      return null;
    }
    
    // Extract the security metrics
    const securityMetrics = await page.evaluate((selector) => {
      const metricsContainer = document.querySelector(selector);
      if (!metricsContainer) return null;
      
      const metrics = {};
      const rows = metricsContainer.querySelectorAll('tr');
      
      rows.forEach(row => {
        const label = row.querySelector('th span.block')?.textContent.trim();
        const value = row.querySelector('td span')?.textContent.trim();
        
        if (label && value) {
          metrics[label] = value;
        }
      });
      
      return metrics;
    }, metricsSelector);
    
    return securityMetrics;
  } catch (error) {
    console.error(`Error scraping GeckoTerminal for ${tokenAddress}:`, error.message);
    return null;
  } finally {
    await page.close();
  }
}

// 预先分析函数，识别潜在的高收益和新兴池
function identifyPotentialPools(poolCards) {
  const potentialTokens = new Set();
  
  for (const pool of poolCards) {
    try {
      // 提取年龄
      const ageText = pool.dataPoints['Age'] || '0 hours';
      let ageHours = 0;
      
      // 解析年龄为小时
      const hours = ageText.match(/(\d+)\s*hour/);
      const days = ageText.match(/(\d+)\s*day/);
      if (hours) ageHours += parseInt(hours[1]);
      if (days) ageHours += parseInt(days[1]) * 24;
      
      // 解析费率
      const hourlyRate1h = parseFloat((pool.feeRatios['1H']?.hourly || '0%').replace('%', '')) || 0;
      const hourlyRate24h = parseFloat((pool.feeRatios['24H']?.hourly || '0%').replace('%', '')) || 0;
      
      // 解析成交量
      const parseVolume = (text) => {
        if (!text) return 0;
        const value = text.replace(/[$/,H]/g, '');
        if (value.includes('K')) return parseFloat(value.replace('K', '')) * 1000;
        if (value.includes('M')) return parseFloat(value.replace('M', '')) * 1000000;
        if (value.includes('B')) return parseFloat(value.replace('B', '')) * 1000000000;
        return parseFloat(value) || 0;
      };
      
      const volume1h = parseVolume(pool.volumeData['1H']?.hourly);
      const volume24h = parseVolume(pool.volumeData['24H']?.hourly);
      
      // 检查是否潜在高收益池
      const isPotentialHighYield = 
        ageHours > 24 &&
        hourlyRate1h > 5 &&
        hourlyRate1h > hourlyRate24h * 1.5 &&
        volume1h > volume24h * 1.5;
      
      // 检查是否潜在新兴池
      const isPotentialEmerging = 
        ageHours < 24 &&
        hourlyRate1h > hourlyRate24h * 1.5;
      
      // 如果满足任一条件，添加到潜在token列表
      if ((isPotentialHighYield || isPotentialEmerging) && pool.tokenAddress) {
        potentialTokens.add(pool.tokenAddress);
      }
    } catch (error) {
      console.error('Error analyzing pool:', error);
    }
  }
  
  console.log(`找到 ${potentialTokens.size} 个潜在的高收益或新兴池的token`);
  return [...potentialTokens];
}

// Main scraping function
async function scrapeTokleoData() {
  let browser = null;
  
  try {
    console.log('Launching browser...');
    
    // Updated browser launch configuration optimized for EC2
    browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
      ],
      ignoreHTTPSErrors: true
    }).catch(err => {
      console.error('Browser launch error:', err);
      throw new Error(`Failed to launch browser: ${err.message}`);
    });
    
    console.log('Creating new page...');
    const page = await browser.newPage().catch(err => {
      console.error('New page creation error:', err);
      throw new Error(`Failed to create new page: ${err.message}`);
    });
    
    console.log('Setting default timeout...');
    page.setDefaultTimeout(60000); // 60 seconds timeout
    
    console.log('Navigating to Tokleo...');
    try {
      await page.goto('https://tokleo.com/', { 
        waitUntil: 'networkidle2',
        timeout: 90000 // Increased timeout to 90 seconds
      });
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error(`Failed to navigate to Tokleo: ${error.message}`);
    }
    
    console.log('Page loaded, waiting for main container...');
    
    // Get the main container with all pool data
    const mainContainerSelector = 'body > div.relative.flex.min-h-screen.flex-col > div > main > div > div.mx-auto.grid.w-full.gap-4';
    try {
      await page.waitForSelector(mainContainerSelector, { timeout: 60000 });
    } catch (error) {
      console.error('Main container selector error:', error);
      
      // Take a screenshot to debug
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('Saved error screenshot to error-screenshot.png');
      
      // Dump the current page HTML to help debug selectors
      const htmlContent = await page.content();
      fs.writeFileSync('error-page.html', htmlContent);
      console.log('Saved page HTML to error-page.html');
      
      throw new Error(`Failed to find main container: ${error.message}`);
    }
    
    console.log('Main container found, extracting pool cards...');
    
    // Extract pool cards data
    let poolCards;
    try {
      poolCards = await page.evaluate(() => {
        const poolCardsData = [];
        // Select all pool card containers
        const cardElements = document.querySelectorAll('.border.border-neutral-200.text-neutral-950.shadow.dark\\:border-neutral-800.dark\\:bg-neutral-950.dark\\:text-neutral-50.w-full.rounded-none.bg-card\\/50.backdrop-blur-sm.max-w-\\[400px\\].justify-self-center');
        
        if (!cardElements || cardElements.length === 0) {
          console.error('No card elements found on the page');
          return [];
        }
        
        console.log(`Found ${cardElements.length} card elements`);
        
        cardElements.forEach((card, index) => {
          try {
            // Extract token pair
            const tokenPair = card.querySelector('.font-semibold.tracking-tight.font-mono.text-base.text-primary')?.textContent;
            
            // Extract 24h Fee/TVL
            const feeToTVL = card.querySelector('.font-medium.text-emerald-400')?.textContent;
            
            // Extract Pool Address (from link)
            const poolAddressLink = card.querySelector('a[href*="app.meteora.ag/dlmm/"]');
            const poolAddress = poolAddressLink ? new URL(poolAddressLink.href).pathname.split('/').pop() : null;
            
            // Extract Token Address from the last anchor tag in the Token section
            // Find the token section by looking for the label that says "Token"
            let tokenAddress = null;
            const tokenSections = Array.from(card.querySelectorAll('.text-xs.text-muted-foreground'))
              .filter(el => el.textContent.trim() === 'Token');
            
            if (tokenSections.length > 0) {
              // Get the parent element that contains the Token section
              const tokenSection = tokenSections[0].closest('.flex.flex-col.items-center.gap-1');
              // Find the last anchor tag within this section (it contains the token address)
              if (tokenSection) {
                const tokenLinks = tokenSection.querySelectorAll('a');
                if (tokenLinks.length > 0) {
                  const lastTokenLink = tokenLinks[tokenLinks.length - 1];
                  // Extract the token address from the URL
                  tokenAddress = new URL(lastTokenLink.href).pathname.split('/').pop();
                }
              }
            }
            
            // Extract other data points
            const dataPoints = {};
            const labels = card.querySelectorAll('.text-muted-foreground');
            labels.forEach(label => {
              const labelText = label.textContent.trim();
              if (labelText && label.nextElementSibling && label.nextElementSibling.classList.contains('font-medium')) {
                dataPoints[labelText] = label.nextElementSibling.textContent.trim();
              }
            });
            
            // Extract Fee/TVL Ratios
            const feeRatios = {};
            const ratioRows = card.querySelectorAll('.grid.grid-cols-\\[auto_auto_auto_auto\\].items-center');
            if (ratioRows.length > 0) {
              const timeframes = ratioRows[0].querySelectorAll('.text-sm.text-muted-foreground');
              timeframes.forEach((timeframe, index) => {
                const cells = ratioRows[0].children;
                const offset = index * 4;
                if (cells[offset] && cells[offset+1] && cells[offset+2]) {
                  feeRatios[timeframe.textContent] = {
                    ratio: cells[offset+1].textContent,
                    hourly: cells[offset+2].textContent,
                    change: cells[offset+3]?.textContent || null
                  };
                }
              });
            }
            
            // Extract Volume Data
            const volumeData = {};
            if (ratioRows.length > 1) {
              const timeframes = ratioRows[1].querySelectorAll('.text-sm.text-muted-foreground');
              timeframes.forEach((timeframe, index) => {
                const cells = ratioRows[1].children;
                const offset = index * 4;
                if (cells[offset] && cells[offset+1] && cells[offset+2]) {
                  volumeData[timeframe.textContent] = {
                    volume: cells[offset+1].textContent,
                    hourly: cells[offset+2].textContent,
                    change: cells[offset+3]?.textContent || null
                  };
                }
              });
            }
            
            poolCardsData.push({
              tokenPair,
              feeToTVL,
              poolAddress,
              tokenAddress,
              dataPoints,
              feeRatios,
              volumeData
            });
          } catch (err) {
            console.error(`Error parsing card ${index}:`, err);
          }
        });
        
        return poolCardsData;
      });
    } catch (error) {
      console.error('Error extracting pool cards:', error);
      throw new Error(`Failed to extract pool cards: ${error.message}`);
    }
    
    console.log(`Extracted data for ${poolCards.length} pools`);
    
    if (poolCards.length === 0) {
      console.warn('Warning: No pool cards were found. The website structure may have changed.');
      
      // Take a screenshot to help debug
      await page.screenshot({ path: 'no-cards-screenshot.png' });
      console.log('Saved screenshot to no-cards-screenshot.png');
      
      // Save the page HTML for further debugging
      const htmlContent = await page.content();
      fs.writeFileSync('page-content.html', htmlContent);
      console.log('Saved page HTML to page-content.html for debugging');
    }
    
    // 识别潜在的高收益和新兴池
    const potentialTokens = identifyPotentialPools(poolCards);
    
    // Create a cache for token security metrics to avoid duplicate requests
    const securityMetricsCache = {};
    
    // Enhance data with security metrics from GeckoTerminal
    console.log('Enhancing data with security metrics from GeckoTerminal...');
    
    // 只对潜在的高收益和新兴池进行安全性检查
    for (let i = 0; i < potentialTokens.length; i++) {
      const tokenAddress = potentialTokens[i];
      console.log(`Processing potential token ${i+1}/${potentialTokens.length}: ${tokenAddress}`);
      
      // Check if we've already scraped this token
      if (securityMetricsCache[tokenAddress]) {
        console.log(`Using cached data for token: ${tokenAddress}`);
      } else {
        const securityMetrics = await scrapeGeckoTerminalMetrics(tokenAddress, browser);
        
        // Cache the result for future use
        if (securityMetrics) {
          securityMetricsCache[tokenAddress] = securityMetrics;
          console.log(`Successfully retrieved metrics for token: ${tokenAddress}`);
        } else {
          console.log(`No security metrics found for token: ${tokenAddress}`);
          securityMetricsCache[tokenAddress] = { status: 'not_found' };
        }
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // 将安全指标添加到池数据中
    for (let i = 0; i < poolCards.length; i++) {
      if (poolCards[i].tokenAddress && securityMetricsCache[poolCards[i].tokenAddress]) {
        poolCards[i].securityMetrics = securityMetricsCache[poolCards[i].tokenAddress];
      }
    }
    
    try {
      // Get the main container for raw HTML/text backup
      const mainContainerElement = await page.$(mainContainerSelector);
      const mainContainerHTML = await page.evaluate(el => el.outerHTML, mainContainerElement);
      const mainContainerText = await page.evaluate(el => el.innerText, mainContainerElement);
      
      // Save the raw data to a file
      fs.writeFileSync('tokleo-raw-data.json', JSON.stringify({
        mainContainer: {
          html: mainContainerHTML,
          text: mainContainerText
        },
      }, null, 2));
      
      // Save the structured data to a file
      fs.writeFileSync('tokleo-structured-data.json', JSON.stringify({
        pools: poolCards,
        timestamp: new Date().toISOString(),
        count: poolCards.length
      }, null, 2));
      
      console.log('Raw data saved to tokleo-raw-data.json');
      console.log('Structured data saved to tokleo-structured-data.json');
    } catch (error) {
      console.error('Error saving data to files:', error);
      throw new Error(`Failed to save data: ${error.message}`);
    }
  
  } catch (error) {
    console.error('Error scraping Tokleo:', error);
  } finally {
    // Close browser
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

// Run the scraper with a proper promise handler
(async () => {
  try {
    await scrapeTokleoData();
    console.log('Scraping completed successfully');
  } catch (error) {
    console.error('Scraping failed:', error);
  }
})();

// Export the function for use in other files
module.exports = { scrapeTokleoData }; 