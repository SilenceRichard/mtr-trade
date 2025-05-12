const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// 预先分析函数，识别潜在的高收益和新兴池
function identifyPotentialPools(poolData) {
  const potentialTokens = new Set();
  
  for (const pool of poolData) {
    try {
      // 从API响应中提取相关数据
      // 解析年龄为小时
      const ageHours = pool.oldest_pair_ageInHours || 0;
      
      // 解析费率
      const hourlyRate1h = pool.meteora_feeTvlRatio?.h1_per_hour || 0;
      const hourlyRate24h = pool.meteora_feeTvlRatio?.h24_per_hour || 0;
      const change30m = pool.meteora_feeTvlRatio?.m30_vs_h24_per_hour || 0;
      
      // 解析成交量
      const volume1h = pool.oldest_pair_volume?.h1_per_hour || 0;
      const volume24h = pool.oldest_pair_volume?.h24_per_hour || 0;
      
      // 检查是否潜在高收益池
      const isPotentialHighYield = 
        ageHours > 24 &&
        hourlyRate1h > 0.5 &&
        change30m > 100 &&
        volume1h > volume24h * 1.5;
      
      // 检查是否潜在新兴池
      const isPotentialEmerging = 
        ageHours < 24 &&
        hourlyRate1h > 5 &&
        change30m > 150;
      
      // 如果满足任一条件，添加到潜在token列表
      if ((isPotentialHighYield || isPotentialEmerging) && pool.meteora_degenTokenAddress) {
        potentialTokens.add(pool.meteora_degenTokenAddress);
      }
    } catch (error) {
      console.error('Error analyzing pool:', error);
    }
  }
  
  console.log(`找到 ${potentialTokens.size} 个潜在的高收益或新兴池的token`);
  return [...potentialTokens];
}

// Function to check if data has changed compared to previous run
function hasDataChanged(newData, filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`No previous data file found at ${filePath}, treating as new data`);
      return true;
    }
    
    const oldData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Simple comparison - check if the count of pools has changed
    if (newData.pools.length !== oldData.pools.length) {
      console.log(`Pool count changed: ${oldData.pools.length} -> ${newData.pools.length}`);
      return true;
    }
    
    // Check if at least one of the pools has a different tokenPair
    // This is a very simple comparison, you may want more thorough comparison
    const oldPairs = new Set(oldData.pools.map(p => p.meteora_name));
    const newPairs = newData.pools.map(p => p.meteora_name);
    let hasNewPair = false;
    
    for (const pair of newPairs) {
      if (!oldPairs.has(pair)) {
        console.log(`Found new pair: ${pair}`);
        hasNewPair = true;
        break;
      }
    }
    
    if (!hasNewPair) {
      console.log('WARNING: No new pairs detected compared to previous data');
    }
    
    return hasNewPair;
  } catch (error) {
    console.error('Error comparing data:', error);
    // If there's an error comparing, assume data has changed to be safe
    return true;
  }
}

// Main function that fetches data from Tokleo API
async function scrapeTokleoData() {
  const startTime = new Date();
  console.log(`Scraping started at: ${startTime.toISOString()}`);
  
  try {
    // Get API key from environment variables
    const apiKey = process.env.TOKLEO_API_KEY;
    if (!apiKey) {
      throw new Error('TOKLEO_API_KEY environment variable is not set. Create a .env file with TOKLEO_API_KEY=your_key');
    }
    
    console.log('Fetching data from Tokleo API...');
    
    // Make API request to get pool data
    const response = await axios.get('https://api.tokleo.com/api/public/pools', {
      headers: {
        'accept': 'application/json',
        'X-Public-Key': apiKey
      }
    });
    
    const apiData = response.data;
    console.log(`Received data for ${apiData.pools.length} pools from API`);
    
    // 直接使用API返回的数据，不做转换
    const structuredData = {
      pools: apiData.pools,
      timestamp: new Date().toISOString(),
      count: apiData.pools.length,
      lastApiUpdate: apiData.last_updated
    };
    
    // 识别潜在的高收益和新兴池
    const potentialTokens = identifyPotentialPools(apiData.pools);
    console.log(`Identified ${potentialTokens.length} potential tokens`);
    
    // Check if the data has actually changed
    const dataChanged = hasDataChanged(structuredData, 'tokleo-structured-data.json');
    
    try {
      // Append timestamp to filenames for historical tracking
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      
      // Save the raw data to a file
      fs.writeFileSync('tokleo-raw-data.json', JSON.stringify(apiData, null, 2));
      
      // Save the structured data to a file
      fs.writeFileSync('tokleo-structured-data.json', JSON.stringify(structuredData, null, 2));
      
      // Also save a timestamped copy for historical tracking
      fs.writeFileSync(`tokleo-structured-data-${timestamp}.json`, JSON.stringify(structuredData, null, 2));
      
      console.log('Raw data saved to tokleo-raw-data.json');
      console.log(`Structured data saved to tokleo-structured-data.json${dataChanged ? ' (UPDATED DATA)' : ' (NO CHANGE DETECTED)'}`);
      console.log(`Historical copy saved to tokleo-structured-data-${timestamp}.json`);
    } catch (error) {
      console.error('Error saving data to files:', error);
      throw new Error(`Failed to save data: ${error.message}`);
    }
  
    // 检查内存使用情况并打印，帮助监控
    const getMemoryUsage = () => {
      const memoryUsage = process.memoryUsage();
      return {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      };
    };

    console.log('Memory usage after extraction:', getMemoryUsage());

    const endTime = new Date();
    const durationMs = endTime - startTime;
    console.log(`Scraping completed at: ${endTime.toISOString()}`);
    console.log(`Total duration: ${Math.floor(durationMs / 1000)} seconds`);
    console.log('Final memory usage:', getMemoryUsage());
  
  } catch (error) {
    console.error('Error fetching Tokleo data:', error);
    throw error; // Re-throw to indicate failure to the caller
  }
}

// Export the function for use in other files
module.exports = { scrapeTokleoData };

// 添加一个简单的运行脚本
if (require.main === module) {
  console.log(`
=============================================
确保已设置环境变量，可以创建.env文件:
TOKLEO_API_KEY=你的API密钥
=============================================
  `);
  
  (async () => {
    try {
      await scrapeTokleoData();
      console.log('Scraping completed successfully');
    } catch (error) {
      console.error('Scraping failed:', error);
    }
  })();
} 