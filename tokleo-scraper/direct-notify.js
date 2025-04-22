// 使用 terminal-notifier (macOS 特定)
const { execSync } = require('child_process');

try {
  console.log('尝试使用 terminal-notifier 发送通知...');
  
  // 使用 osascript (AppleScript) 直接发送系统通知
  const appleScript = `
    display notification "这是一个来自 AppleScript 的测试通知" with title "测试通知" sound name "Ping"
  `;
  
  execSync(`osascript -e '${appleScript}'`);
  console.log('AppleScript 通知已发送，请检查通知中心');
  
  // 如果系统中安装了 terminal-notifier，也可以尝试使用它
  try {
    execSync('which terminal-notifier');
    console.log('发现 terminal-notifier，尝试使用它发送通知...');
    execSync('terminal-notifier -title "测试通知" -message "这是一个来自 terminal-notifier 的通知" -sound Ping');
  } catch (error) {
    console.log('未找到 terminal-notifier，跳过此方法');
  }
} catch (error) {
  console.error('发送系统通知失败:', error.message);
} 