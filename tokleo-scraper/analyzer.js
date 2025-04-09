const fs = require('fs');

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
            const poolWithToken = data.find(p => p.tokenAddress === tokenAddress && p.securityMetrics);
            resolve({
              tokenAddress,
              securityMetrics: poolWithToken?.securityMetrics || null
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

// 初步处理池数据，不包括安全检查
function processPoolDataWithoutSecurity(pool) {
  // Extract age and convert to hours
  const ageText = pool.dataPoints['Age'] || '0 hours';
  const ageHours = parseAgeToHours(ageText);
  
  // Parse fee ratios - note that in JSON they use "24H" format (uppercase)
  const feeRatio = {
    "24h": parsePercentage(pool.feeRatios['24H']?.ratio),
    "1h": parsePercentage(pool.feeRatios['1H']?.ratio),
    "2h": parsePercentage(pool.feeRatios['2H']?.ratio),
    "30m": parsePercentage(pool.feeRatios['30M']?.ratio),
    "hourlyRate24h": parsePercentage(pool.feeRatios['24H']?.hourly),
    "hourlyRate1h": parsePercentage(pool.feeRatios['1H']?.hourly),
    "hourlyRate2h": parsePercentage(pool.feeRatios['2H']?.hourly),
    "hourlyRate30m": parsePercentage(pool.feeRatios['30M']?.hourly),
    "change30m": parseRatioChange(pool.feeRatios['30M']?.change)
  };
  
  // Parse volume data - also uppercase "H" in JSON
  const volume = {
    "24hHourly": parseVolumeValue(pool.volumeData['24H']?.hourly),
    "1hHourly": parseVolumeValue(pool.volumeData['1H']?.hourly),
    "2hHourly": parseVolumeValue(pool.volumeData['6H']?.hourly) 
  };
  
  // Extract token info
  const tokenInfo = {
    name: pool.tokenPair || '',
    address: pool.tokenAddress || ''
  };
  
  // Extract and normalize other important data
  const binStep = extractNumericValue(pool.dataPoints['Bin Step']);
  const baseFee = extractNumericValue(pool.dataPoints['Base Fee']);
  const liquidity = pool.dataPoints['Liquidity'] || '$0';
  const volume24h = pool.volumeData['24H']?.volume || '$0';
  const fees24h = pool.dataPoints['Fees (24h)'] || calculateFees(volume24h, baseFee);
  
  return {
    poolName: pool.tokenPair,
    poolAddress: pool.poolAddress,
    tokenAddress: pool.tokenAddress,
    tokenInfo: tokenInfo,
    exchangeInfo: { type: 'Meteora DLMM' },
    age: pool.dataPoints['Age'] || '0 hours',
    ageHours: ageHours,
    binStep: binStep,
    baseFee: baseFee,
    liquidity: liquidity,
    volume24h: volume24h,
    fees24h: fees24h,
    feeRatio: feeRatio,
    volume: volume,
    signals: [],
    rawPool: pool // 保留原始数据以备后续处理
  };
}

// 解析比率变化值，从格式如"(+156%)"中提取数值
function parseRatioChange(changeText) {
  if (!changeText || changeText === "(base)") return 0;
  const match = changeText.match(/\(([+-])(\d+)%\)/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * parseInt(match[2], 10);
}

// 最终确定池数据，包括添加信号
function finalizePoolData(pool) {
  // 处理安全指标
  const securityMetrics = processSecurityMetrics(pool.securityMetrics || pool.rawPool?.securityMetrics);
  
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

// Process security metrics from GeckoTerminal
function processSecurityMetrics(metrics) {
  if (!metrics) return null;
  
  const holdersText = metrics['Holders'] || '0';
  const vol24hText = metrics['24h Vol'] || '$0';
  const marketCapText = metrics['Market Cap'] || '$0';
  
  return {
    holdersCount: parseHoldersCount(holdersText),
    vol24h: parseVolumeValue(vol24hText),
    marketCap: parseVolumeValue(marketCapText),
    raw: metrics
  };
}

// Parse holders count from format like "4.26K"
function parseHoldersCount(holdersText) {
  if (!holdersText) return 0;
  
  if (holdersText.includes('K')) {
    return parseFloat(holdersText.replace('K', '')) * 1000;
  }
  if (holdersText.includes('M')) {
    return parseFloat(holdersText.replace('M', '')) * 1000000;
  }
  
  return parseInt(holdersText.replace(/,/g, ''), 10) || 0;
}

// Helper functions for data parsing
function parseAgeToHours(ageText) {
  if (!ageText) return 0;
  
  // Format can be "17 hours" or "5 days 2 hours"
  const hours = ageText.match(/(\d+)\s*hour/);
  const days = ageText.match(/(\d+)\s*day/);
  
  let totalHours = 0;
  if (hours) totalHours += parseInt(hours[1]);
  if (days) totalHours += parseInt(days[1]) * 24;
  
  return totalHours || 0;
}

function parsePercentage(percentText) {
  if (!percentText) return 0;
  return parseFloat(percentText.replace('%', '')) || 0;
}

function parseVolumeValue(volumeText) {
  if (!volumeText) return 0;
  
  // Handle formats like "$916K/H" or "$220K/H"
  const value = volumeText.replace(/[$/,H]/g, '');
  
  // Handle K, M, B suffixes
  if (value.includes('K')) {
    return parseFloat(value.replace('K', '')) * 1000;
  } else if (value.includes('M')) {
    return parseFloat(value.replace('M', '')) * 1000000;
  } else if (value.includes('B')) {
    return parseFloat(value.replace('B', '')) * 1000000000;
  }
  
  return parseFloat(value) || 0;
}

function extractNumericValue(text) {
  if (!text) return 0;
  const match = text.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function calculateFees(volumeText, baseFee) {
  const volume = parseVolumeValue(volumeText);
  return (volume * baseFee / 100).toFixed(2);
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