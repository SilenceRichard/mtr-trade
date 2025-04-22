const notifier = require('node-notifier');
const path = require('path');

// 简单测试通知
notifier.notify(
  {
    title: 'Mac Test Notification',
    message: 'This is a direct test from node-notifier',
    icon: path.join(__dirname, 'terminal-icon.png'), // 如果有图标可用
    sound: true,
    wait: true,
    timeout: 10
  },
  function(err, response, metadata) {
    if (err) console.error('Error:', err);
    console.log('Response:', response);
    console.log('Metadata:', metadata);
  }
);

console.log('Notification sent, check your system tray/notification center');

// 使用平台特定选项试试
console.log('Current platform:', process.platform);
if (process.platform === 'darwin') {
  // macOS 专用选项
  notifier.notify({
    title: 'macOS Specific',
    message: 'Using macOS specific options',
    sound: 'Ping', // macOS 自带声音
    contentImage: path.join(__dirname, 'terminal-icon.png'), // 如果有图标可用
    timeout: 10,
    closeLabel: 'Close',
    actions: ['OK', 'Cancel'],
    dropdownLabel: 'Actions',
    reply: true
  });
} 