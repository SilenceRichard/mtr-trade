const fs = require('fs');
const notifier = require('node-notifier');

// Function to send macOS system notification
function sendNotification(title, message) {
  notifier.notify({
    title: title,
    message: message,
    sound: true,
    wait: true
  });
}

// test notification


// Function to load and analyze the scraped data
async function analyzePools() {
  try {
    // Load the structured data from scraper
    const rawData = JSON.parse(fs.readFileSync('tokleo-structured-data.json', 'utf8'));
    const data = rawData.pools;
    console.log(`Loaded ${data.length} pools for analysis`);
    
    // 初步处理数据，但不做安全检查
    const initialProcessedData = data.map(pool => {
      // 基本信息处理，不包括安全检查
      return processPoolDataWithoutSecurity(pool);
    });
    
    // 新标准: 使用30M数据筛选高潜力池
    const potentialHighYieldOldPools = initialProcessedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      return (
        ageHours > 24 &&
        feeRatio.hourlyRate30m > 0.5 &&
        feeRatio.change30m > 100
      );
    });
    
    // 中等收益老池筛选
    const potentialMediumYieldOldPools = initialProcessedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      return (
        ageHours > 24 &&
        feeRatio.hourlyRate30m >= 0.5 &&
        feeRatio.change30m >= 50 &&
        feeRatio.change30m <= 100
      );
    });
    
    const potentialEmergingPools = initialProcessedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      return (
        ageHours < 24 &&
        feeRatio.hourlyRate30m > 5 &&
        feeRatio.change30m > 150
      );
    });
    
    // 找出需要进行安全检查的token地址
    const potentialTokens = new Set();
    [...potentialHighYieldOldPools, ...potentialMediumYieldOldPools, ...potentialEmergingPools].forEach(pool => {
      if (pool.tokenAddress) {
        potentialTokens.add(pool.tokenAddress);
      }
    });
    
    console.log(`需要进行安全检查的token数量: ${potentialTokens.size}`);
    
    // 请求GeckoTerminal获取这些token的安全指标
    if (potentialTokens.size > 0) {
      console.log('正在获取潜在高收益和新兴池子的安全指标...');
      const securityPromises = [...potentialTokens].map(tokenAddress => {
        return new Promise(async (resolve) => {
          try {
            // 这里可以添加调用GeckoTerminal API的代码
            // 现在暂时使用原始数据中已有的安全指标
            const poolWithToken = data.find(p => p.meteora_degenTokenAddress === tokenAddress);
            resolve({
              tokenAddress,
              securityMetrics: poolWithToken ? extractSecurityMetrics(poolWithToken) : null
            });
          } catch (error) {
            console.error(`获取${tokenAddress}安全指标出错:`, error);
            resolve({
              tokenAddress,
              securityMetrics: null
            });
          }
        });
      });
      
      const securityResults = await Promise.all(securityPromises);
      
      // 创建token安全指标映射
      const tokenSecurityMap = {};
      securityResults.forEach(result => {
        tokenSecurityMap[result.tokenAddress] = result.securityMetrics;
      });
      
      // 更新所有池子的安全指标
      initialProcessedData.forEach(pool => {
        if (pool.tokenAddress && tokenSecurityMap[pool.tokenAddress]) {
          pool.securityMetrics = tokenSecurityMap[pool.tokenAddress];
        }
      });
    }
    
    // 最终基于所有指标（包括安全指标）的处理数据
    const processedData = initialProcessedData.map(pool => {
      return finalizePoolData(pool);
    });
    
    // 根据安全指标和其他指标再次筛选最终的高收益池和新兴池
    // 🔥 高收益老池 (High Yield Old Pools)
    const highYieldPools = processedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      const securityCheck = pool.securityMetrics && 
                           pool.securityMetrics.holdersCount > 1000 && 
                           (pool.securityMetrics.vol24h > pool.securityMetrics.marketCap || 
                            pool.securityMetrics.vol24h > 1000000);
      return (
        securityCheck &&
        ageHours > 24 &&
        feeRatio.hourlyRate30m > 0.5 &&
        feeRatio.change30m > 100
      );
    });

    // Send notification if high-yield pools are discovered
    if (highYieldPools.length > 0) {
      sendNotification(
        '🔥 High Yield Pools Discovered!',
        `Found ${highYieldPools.length} high-yield pools. Check details in pool-analysis.json`
      );
      console.log(`🔔 Notification sent for ${highYieldPools.length} high-yield pools`);
    }

    // ⭐ 中等收益老池 (Medium Yield Old Pools)
    const mediumYieldPools = processedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      const securityCheck = pool.securityMetrics && 
                           pool.securityMetrics.holdersCount > 1000 && 
                           (pool.securityMetrics.vol24h > pool.securityMetrics.marketCap || 
                            pool.securityMetrics.vol24h > 1000000);
      return (
        securityCheck &&
        ageHours > 24 &&
        feeRatio.hourlyRate30m >= 0.5 &&
        feeRatio.change30m >= 50 &&
        feeRatio.change30m <= 100
      );
    });
    
    // 🌊 新兴高潜力池 (Emerging High Potential Pools)
    const emergingPools = processedData.filter(pool => {
      const { ageHours, feeRatio } = pool;
      const securityCheck = pool.securityMetrics && 
                           pool.securityMetrics.holdersCount > 1000 && 
                           (pool.securityMetrics.vol24h > pool.securityMetrics.marketCap || 
                            pool.securityMetrics.vol24h > 1000000);
      return (
        securityCheck &&
        ageHours < 24 &&
        feeRatio.hourlyRate30m > 5 &&
        feeRatio.change30m > 150
      );
    });
    
    // Send notification if emerging pools are discovered
    if (emergingPools.length > 0) {
      sendNotification(
        '🌊 Emerging Pools Alert!',
        `Found ${emergingPools.length} emerging high-potential pools. Check details in pool-analysis.json`
      );
      console.log(`🔔 Notification sent for ${emergingPools.length} emerging pools`);
    }
    
    // ⚠️ 避免参与 (Avoid Participating)
    const avoidPools = processedData.filter(pool => {
      const { feeRatio } = pool;
      const feeRatioTrend = feeRatio.hourlyRate30m < feeRatio.hourlyRate24h * 0.5;
      const volumeTrend = pool.volume["1hHourly"] < pool.volume["24hHourly"] * 0.7;
      
      // Check for instability by comparing different time frames
      const feeRatioInstability = Math.abs(feeRatio.hourlyRate30m - feeRatio.hourlyRate2h) / (feeRatio.hourlyRate24h || 1) > 0.5;
      
      return feeRatioTrend && volumeTrend && feeRatioInstability;
    });
    
    // 🔒 安全池 (Safe Pools)
    const safePools = processedData.filter(pool => {
      return pool.securityMetrics && 
             pool.securityMetrics.holdersCount > 1000 && 
             (pool.securityMetrics.vol24h > pool.securityMetrics.marketCap || 
              pool.securityMetrics.vol24h > 1000000);
    });
    
    // Create an overview report
    const report = {
      totalPools: processedData.length,
      topPoolsByFeeRatio: processedData
        .sort((a, b) => b.feeRatio["24h"] - a.feeRatio["24h"])
        .slice(0, 10)
        .map(formatPoolSummary),
      highYieldPools: highYieldPools.map(formatPoolSummary),
      mediumYieldPools: mediumYieldPools.map(formatPoolSummary),
      emergingPools: emergingPools.map(formatPoolSummary),
      avoidPools: avoidPools.map(formatPoolSummary),
      safePools: safePools.map(formatPoolSummary)
    };
    
    // Save the analysis report
    fs.writeFileSync('pool-analysis.json', JSON.stringify(report, null, 2));
    console.log('Analysis saved to pool-analysis.json');
  
    
    return report;
  } catch (error) {
    console.error('Error analyzing pool data:', error);
  }
}

// 从原始API数据中提取安全指标
function extractSecurityMetrics(pool) {
  // 使用原始API数据中的字段构建安全指标
  return {
    holdersCount: parseHoldersCount(pool.oldest_pair_txns?.h24?.total || 0),
    vol24h: pool.oldest_pair_volume?.h24 || 0,
    marketCap: pool.oldest_pair_mcap || 0
  };
}

// 初步处理池数据，不包括安全检查
function processPoolDataWithoutSecurity(pool) {
  // 从原始API响应直接提取数据
  const ageHours = pool.oldest_pair_ageInHours || 0;

  // 处理费率数据
  const feeRatio = {
    "24h": pool.meteora_feeTvlRatio?.h24 || 0,
    "1h": pool.meteora_feeTvlRatio?.h1 || 0,
    "2h": pool.meteora_feeTvlRatio?.h2 || 0,
    "30m": pool.meteora_feeTvlRatio?.m30 || 0,
    "hourlyRate24h": pool.meteora_feeTvlRatio?.h24_per_hour || 0,
    "hourlyRate1h": pool.meteora_feeTvlRatio?.h1_per_hour || 0,
    "hourlyRate2h": pool.meteora_feeTvlRatio?.h2_per_hour || 0,
    "hourlyRate30m": pool.meteora_feeTvlRatio?.m30_per_hour || 0,
    "change30m": pool.meteora_feeTvlRatio?.m30_vs_h24_per_hour || 0
  };
  
  // 处理成交量数据
  const volume = {
    "24hHourly": pool.oldest_pair_volume?.h24_per_hour || 0,
    "1hHourly": pool.oldest_pair_volume?.h1_per_hour || 0,
    "2hHourly": pool.oldest_pair_volume?.h6_per_hour || 0
  };
  
  // 提取token信息
  const tokenInfo = {
    name: pool.meteora_name || '',
    address: pool.meteora_degenTokenAddress || ''
  };
  
  // 构建格式化的年龄字符串
  const ageString = `${Math.floor(ageHours / 24)} days ${ageHours % 24} hours`;
  
  return {
    poolName: pool.meteora_name,
    poolAddress: pool.meteora_address,
    tokenAddress: pool.meteora_degenTokenAddress,
    tokenInfo: tokenInfo,
    exchangeInfo: { type: 'Meteora DLMM' },
    age: ageString,
    ageHours: ageHours,
    binStep: pool.meteora_binStep || 0,
    baseFee: pool.meteora_baseFeePercentage || 0,
    liquidity: pool.meteora_liquidity || 0,
    volume24h: pool.oldest_pair_volume?.h24 || 0,
    fees24h: pool.meteora_fees?.h24 || 0,
    feeRatio: feeRatio,
    volume: volume,
    signals: [],
    rawPool: pool // 保留原始数据以备后续处理
  };
}

// 最终确定池数据，包括添加信号
function finalizePoolData(pool) {
  // 处理安全指标
  const securityMetrics = pool.securityMetrics || extractSecurityMetrics(pool.rawPool);
  
  // 识别信号
  const signals = [];
  const { ageHours, feeRatio, volume } = pool;
  
  // 安全池信号
  const securityCheck = securityMetrics && 
                      securityMetrics.holdersCount > 1000 && 
                      (securityMetrics.vol24h > securityMetrics.marketCap || 
                       securityMetrics.vol24h > 1000000);
  if (securityCheck) {
    signals.push('🔒 安全池 推荐');
    
    // 新标准: 老池 Age > 24h, 30M ratio > 0.5%, 30M ratio change >> 24H radio change
    if (ageHours > 24 && 
        feeRatio.hourlyRate30m >= 0.5 && 
        feeRatio.change30m > 100) { // 30M变化比24H基准高出100%以上
      signals.push('🔥 高收益老池 ⭐⭐⭐⭐⭐');
    }
    
    // 中等收益老池 50% <= change30m <= 100%
    if (ageHours > 24 && 
        feeRatio.hourlyRate30m >= 0.5 && 
        feeRatio.change30m >= 50 && 
        feeRatio.change30m <= 100) {
      signals.push('⭐ 中等收益老池 ⭐⭐⭐');
    }
    
    // 新标准: 新池 Age < 24h, 30M ratio > 5%, ratio change >> 24H ratio change
    if (ageHours < 24 && 
        feeRatio.hourlyRate30m > 5 && 
        feeRatio.change30m > 150) { // 30M变化比24H基准高出150%以上
      signals.push('🌊 新兴高潜力池 ⭐⭐⭐⭐');
    }
  }
  
  // Avoid pool signals (regardless of security)
  if (feeRatio.hourlyRate30m < feeRatio.hourlyRate24h * 0.5 && 
      volume["1hHourly"] < volume["24hHourly"] * 0.7 &&
      feeRatio.change30m < -50) { // 30M ratio下降50%以上
    signals.push('⚠️ 避免参与 不推荐');
  }
  
  // Additional information signals
  if (volume["1hHourly"] > volume["24hHourly"] * 2) signals.push('交易量飙升');
  if (feeRatio["24h"] > 20) signals.push('高APR收益');
  if (feeRatio.change30m > 200) signals.push('30分钟热度 (+200%)');
  
  // 创建最终对象
  const result = { ...pool, securityMetrics, signals };
  delete result.rawPool; // 移除临时数据
  return result;
}

// Parse holders count from format like "4.26K"
function parseHoldersCount(holdersText) {
  if (!holdersText) return 0;
  
  if (typeof holdersText === 'string') {
    if (holdersText.includes('K')) {
      return parseFloat(holdersText.replace('K', '')) * 1000;
    }
    if (holdersText.includes('M')) {
      return parseFloat(holdersText.replace('M', '')) * 1000000;
    }
    
    return parseInt(holdersText.replace(/,/g, ''), 10) || 0;
  }
  
  return holdersText;
}

// Helper function to format a pool for the summary report
function formatPoolSummary(pool) {
  // Determine rating based on signals
  let rating = '';
  if (pool.signals.includes('🔥 高收益老池')) {
    rating = '⭐⭐⭐⭐⭐ 极推荐';
  } else if (pool.signals.includes('⭐ 中等收益老池')) {
    rating = '⭐⭐⭐ 推荐';
  } else if (pool.signals.includes('🌊 新兴高潜力池')) {
    rating = '⭐⭐⭐⭐ 高推荐';
  } else if (pool.signals.includes('⚠️ 避免参与')) {
    rating = '❌ 不推荐';
  } else if (pool.signals.includes('🔒 安全池')) {
    rating = '✅ 安全推荐';
  } else {
    rating = '⭐⭐ 一般';  // Default rating
  }

  // Create links for Meteora and GMGN
  const meteoraLink = `https://app.meteora.ag/dlmm/${pool.poolAddress}`;
  const gmgnLink = `https://gmgn.ai/sol/token/${pool.tokenAddress}`;
  const geckoTerminalLink = `https://www.geckoterminal.com/solana/pools/${pool.tokenAddress}`;

  // Calculate 1H change (compare hourlyRate1h to hourlyRate24h)
  const change1h = pool.feeRatio.hourlyRate1h > 0 && pool.feeRatio.hourlyRate24h > 0 
    ? Math.round(((pool.feeRatio.hourlyRate1h / pool.feeRatio.hourlyRate24h) - 1) * 100) 
    : 0;
  const change1hFormatted = (change1h > 0 ? "+" : "") + change1h + "%";

  return {
    poolName: pool.poolName,
    poolAddress: pool.poolAddress,
    tokenAddress: pool.tokenAddress,
    meteoraLink: meteoraLink,
    gmgnLink: gmgnLink,
    geckoTerminalLink: geckoTerminalLink,
    tokenInfo: pool.tokenInfo,
    exchangeInfo: pool.exchangeInfo,
    age: pool.age,
    binStep: pool.binStep,
    baseFee: pool.baseFee,
    liquidity: pool.liquidity,
    volume24h: pool.volume24h,
    fees24h: pool.fees24h,
    feeRatio24h: pool.feeRatio["24h"].toFixed(2) + "%",
    hourlyRate24h: pool.feeRatio.hourlyRate24h.toFixed(2) + "%/H",
    hourlyRate1h: pool.feeRatio.hourlyRate1h.toFixed(2) + "%/H",
    hourlyRate30m: pool.feeRatio.hourlyRate30m.toFixed(2) + "%/H",
    change30m: (pool.feeRatio.change30m > 0 ? "+" : "") + pool.feeRatio.change30m + "%",
    change1h: change1hFormatted,
    volume24hHourly: "$" + Math.round(pool.volume["24hHourly"]).toLocaleString(),
    volume1hHourly: "$" + Math.round(pool.volume["1hHourly"]).toLocaleString(),
    // Include security metrics if available
    holders: pool.securityMetrics ? formatNumber(pool.securityMetrics.holdersCount) : "N/A",
    vol24hGecko: pool.securityMetrics ? "$" + formatNumber(pool.securityMetrics.vol24h) : "N/A",
    marketCap: pool.securityMetrics ? "$" + formatNumber(pool.securityMetrics.marketCap) : "N/A",
    securityRating: pool.securityMetrics && 
                    pool.securityMetrics.holdersCount > 1000 && 
                    (pool.securityMetrics.vol24h > pool.securityMetrics.marketCap || 
                     pool.securityMetrics.vol24h > 1000000) ? "🔒 安全" : "",
    signals: pool.signals.join(", "),
    rating: rating
  };
}

// Helper function to format large numbers with K, M, B suffixes
function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toString();
}

// If this file is executed directly, call the analysis function
if (require.main === module) {
  analyzePools().catch(error => {
    console.error('Error running analyzer:', error);
  });
}

// Export the function for use in other files
module.exports = { analyzePools }; 