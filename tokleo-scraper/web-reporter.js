const fs = require('fs');

// Generate a nicely formatted text report
function generateTextReport(report) {
  console.log('Generating text report...', report);
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

module.exports = { generateTextReport, generateHtmlReport };