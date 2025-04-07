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
    
    // Generate a formatted text report
    generateTextReport(report);
    
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

// Generate a nicely formatted text report
function generateTextReport(report) {
  let reportText = `# Tokleo Pool Analysis Report\n\n`;
  reportText += `Analysis of ${report.totalPools} pools from [https://tokleo.com/](https://tokleo.com/)\n\n`;
  
  // 优先展示高收益老池
  reportText += `\n\n## 🔥 高收益老池 - High Yield Old Pools (${report.highYieldPools.length})\n\n`;
  reportText += `筛选条件：\n- 池子年龄 > 24小时\n- 30分钟收益率 > 0.5%\n- 30分钟收益变化率 > 100%\n- 满足安全条件：持有人 > 1000 且 24小时交易量 > 市值或 > 100万美元\n\n`;
  
  if (report.highYieldPools.length > 0) {
    reportText += formatPoolTable(report.highYieldPools);
  } else {
    reportText += `该类别暂无池子。\n`;
  }
  
  // 其次展示中等收益老池
  reportText += `\n\n## ⭐ 中等收益老池 - Medium Yield Old Pools (${report.mediumYieldPools.length})\n\n`;
  reportText += `筛选条件：\n- 池子年龄 > 24小时\n- 30分钟收益率 >= 0.5%\n- 30分钟收益变化率在50%至100%之间\n- 满足安全条件：持有人 > 1000 且 24小时交易量 > 市值或 > 100万美元\n\n`;
  
  if (report.mediumYieldPools.length > 0) {
    reportText += formatPoolTable(report.mediumYieldPools);
  } else {
    reportText += `该类别暂无池子。\n`;
  }
  
  // 第三展示新兴高潜力池
  reportText += `\n\n## 🌊 新兴高潜力池 - Emerging High Potential Pools (${report.emergingPools.length})\n\n`;
  reportText += `筛选条件：\n- 池子年龄 < 24小时（新池子）\n- 30分钟收益率 > 5%\n- 30分钟收益变化率 > 150%\n- 满足安全条件：持有人 > 1000 且 24小时交易量 > 市值或 > 100万美元\n\n`;
  
  if (report.emergingPools.length > 0) {
    reportText += formatPoolTable(report.emergingPools);
  } else {
    reportText += `该类别暂无池子。\n`;
  }
  
  // 其他池子集中展示
  reportText += `\n\n## 📊 其他池子 - Other Pools\n\n`;
  
  // 展示收益率TOP池子
  reportText += `### 📈 收益率TOP池子 - Top Fee/TVL Pools (10)\n\n`;
  reportText += `按24小时收益率排序的前10个池子，不考虑其他筛选条件\n\n`;
  reportText += formatPoolTable(report.topPoolsByFeeRatio);
  
  // 安全池但不符合其他高收益条件的池子
  const otherSafePools = report.safePools.filter(safePool => {
    const isHighYield = report.highYieldPools.some(p => p.poolAddress === safePool.poolAddress);
    const isMediumYield = report.mediumYieldPools.some(p => p.poolAddress === safePool.poolAddress);
    const isEmerging = report.emergingPools.some(p => p.poolAddress === safePool.poolAddress);
    const isAvoid = report.avoidPools.some(p => p.poolAddress === safePool.poolAddress);
    return !isHighYield && !isMediumYield && !isEmerging && !isAvoid;
  });
  
  if (otherSafePools.length > 0) {
    reportText += `\n\n### 🔒 其他安全池 - Other Safe Pools (${otherSafePools.length})\n\n`;
    reportText += `筛选条件：\n- 持有人 > 1000\n- 24小时交易量 > 市值或 > 100万美元\n- 不符合高收益或新兴池条件\n\n`;
    reportText += formatPoolTable(otherSafePools);
  }
  
  // 避免参与池
  if (report.avoidPools.length > 0) {
    reportText += `\n\n### ⚠️ 避免参与 - Avoid Pools (${report.avoidPools.length})\n\n`;
    reportText += `筛选条件：\n- 30分钟收益率大幅下降（低于24小时收益率的50%）\n- 交易量萎缩（1小时交易量低于24小时平均的70%）\n- 30分钟收益变化率 < -50%（负增长）\n\n`;
    reportText += formatPoolTable(report.avoidPools);
  }
  
  fs.writeFileSync('pool-analysis-report.md', reportText, 'utf8');
  console.log('Text report saved to pool-analysis-report.md');
  
  // Also generate HTML report
  generateHtmlReport(reportText);
}

// Format a table of pools for the report
function formatPoolTable(pools) {
  if (pools.length === 0) {
    return '该类别暂无池子。\n';
  }
  
  let table = `| 池子名称 | 年龄 | Bin Step | Base Fee | 费率/TVL | 30分钟收益率 | 30分钟变化 | 1H变化率 | 链接 |\n`;
  table += `| ---- | --- | -------- | -------- | ------- | -------- | ---------- | -------- | ----- |\n`;
  
  pools.forEach(pool => {
    const links = `[Meteora](${pool.meteoraLink})<br>[GMGN](${pool.gmgnLink})<br>[GeckoTerminal](${pool.geckoTerminalLink})`;
    table += `| ${pool.poolName} | ${pool.age} | ${pool.binStep} | ${pool.baseFee}% | ${pool.feeRatio24h} | ${pool.hourlyRate30m} | ${pool.change30m} | ${pool.change1h} | ${links} |\n`;
  });
  
  return table;
}

// Convert markdown report to HTML
function generateHtmlReport(markdownText) {
  // Simple function to convert markdown tables to HTML tables
  function markdownTableToHtml(tableText) {
    const lines = tableText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 3) return ''; // Not enough lines for a table
    
    // Convert header row
    const headerCells = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
    let htmlTable = '<table class="report-table">\n<thead>\n<tr>\n';
    headerCells.forEach(cell => {
      htmlTable += `<th>${cell}</th>\n`;
    });
    htmlTable += '</tr>\n</thead>\n<tbody>\n';
    
    // Find indices of "30分钟收益率" and "30分钟变化" columns
    const rate30mIndex = headerCells.findIndex(header => header.includes('30分钟收益率'));
    const change30mIndex = headerCells.findIndex(header => header.includes('30分钟变化'));
    
    // Skip header row and separator row (lines[0] and lines[1])
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // Check if this row should be highlighted based on both conditions
      let shouldHighlight = false;
      if (rate30mIndex !== -1 && change30mIndex !== -1) {
        const rate30m = cells[rate30mIndex];
        const change30m = cells[change30mIndex];
        
        // Extract numeric value from rate30m (e.g. "3.60%/H" -> 3.60)
        const rateValue = parseFloat(rate30m);
        // Check if change30m has a "+" sign
        const isChangePositive = change30m.includes('+');
        
        // Highlight if rate > 2% and change is positive
        shouldHighlight = !isNaN(rateValue) && rateValue > 2 && isChangePositive;
      }
      
      htmlTable += shouldHighlight ? '<tr class="highlight-row">\n' : '<tr>\n';
      
      cells.forEach(cell => {
        // Process markdown links [text](url) to HTML links <a href="url">text</a>
        const processedCell = cell.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        htmlTable += `<td>${processedCell}</td>\n`;
      });
      htmlTable += '</tr>\n';
    }
    
    htmlTable += '</tbody>\n</table>\n';
    return htmlTable;
  }
  
  // Convert markdown headings to HTML headings
  function markdownHeadingsToHtml(text) {
    let processedText = text;
    // Replace h1
    processedText = processedText.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Replace h2
    processedText = processedText.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    // Replace h3
    processedText = processedText.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    // Replace bullet points
    processedText = processedText.replace(/^- (.+)$/gm, '<li>$1</li>');
    // Wrap bullet points
    processedText = processedText.replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>');
    return processedText;
  }
  
  // Process the markdown text
  let htmlContent = markdownHeadingsToHtml(markdownText);
  
  // Find and convert tables
  const tablePattern = /\|\s.*\|\s*\n\|\s*-+\s*\|\s*-+.*\n(\|\s.*\|\s*\n)+/g;
  htmlContent = htmlContent.replace(tablePattern, match => markdownTableToHtml(match));
  
  // Convert newlines to <p> tags for non-table text (but not within lists)
  htmlContent = htmlContent.replace(/\n\n(?!<(ul|ol|table))/g, '</p><p>');
  
  // Wrap the content in basic HTML structure with CSS
  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tokleo Pool Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    h1, h2, h3 {
      color: #1a73e8;
    }
    h1 {
      border-bottom: 2px solid #1a73e8;
      padding-bottom: 10px;
    }
    h2 {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }
    ul {
      padding-left: 20px;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.9em;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
      border-radius: 5px;
      overflow: hidden;
    }
    .report-table thead tr {
      background-color: #1a73e8;
      color: white;
      text-align: left;
    }
    .report-table th, .report-table td {
      padding: 12px 15px;
    }
    .report-table tbody tr {
      border-bottom: 1px solid #dddddd;
    }
    .report-table tbody tr:nth-of-type(even) {
      background-color: #f3f3f3;
    }
    .highlight-row {
      background-color: #e6ffe6 !important; /* Light green background that overrides other row styles */
    }
    .report-table tbody tr:last-of-type {
      border-bottom: 2px solid #1a73e8;
    }
    .report-table tbody tr:hover {
      background-color: #e0f0ff;
    }
    .updated-time {
      font-style: italic;
      color: #666;
      text-align: right;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <p>${htmlContent}</p>
  <div class="updated-time">Last updated: ${new Date().toLocaleString()}</div>
</body>
</html>`;

  fs.writeFileSync('pool-analysis-report.html', htmlReport, 'utf8');
  console.log('HTML report saved to pool-analysis-report.html');
}

// If this file is executed directly, call the analysis function
if (require.main === module) {
  analyzePools().catch(error => {
    console.error('Error running analyzer:', error);
  });
}

// Export the function for use in other files
module.exports = { analyzePools }; 