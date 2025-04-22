#!/bin/bash

# Detect the Linux distribution
if command -v apt &> /dev/null; then
    # Debian/Ubuntu system
    PACKAGE_MANAGER="apt"
    echo "Detected Debian/Ubuntu system. Using apt."
elif command -v yum &> /dev/null; then
    # Amazon Linux/CentOS/RHEL system
    PACKAGE_MANAGER="yum"
    echo "Detected Amazon Linux/CentOS/RHEL system. Using yum."
else
    echo "Unsupported Linux distribution. This script requires apt or yum."
    exit 1
fi

# Update system packages
echo "Updating system packages..."
if [ "$PACKAGE_MANAGER" = "apt" ]; then
    sudo apt update
else
    sudo yum update -y
fi

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js and npm..."
    if [ "$PACKAGE_MANAGER" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        # Amazon Linux / RHEL / CentOS
        curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi
fi

# Install Puppeteer dependencies
echo "Installing Puppeteer dependencies..."
if [ "$PACKAGE_MANAGER" = "apt" ]; then
    # Ubuntu/Debian dependencies
    sudo apt install -y \
        gconf-service \
        libasound2 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgcc1 \
        libgconf-2-4 \
        libgdk-pixbuf2.0-0 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libpango-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        ca-certificates \
        fonts-liberation \
        libappindicator1 \
        libnss3 \
        lsb-release \
        xdg-utils \
        wget
else
    # Amazon Linux / RHEL / CentOS dependencies
    sudo yum install -y \
        alsa-lib \
        atk \
        cups-libs \
        gtk3 \
        ipa-gothic-fonts \
        libXcomposite \
        libXcursor \
        libXdamage \
        libXext \
        libXi \
        libXrandr \
        libXScrnSaver \
        libXtst \
        pango \
        xorg-x11-fonts-100dpi \
        xorg-x11-fonts-75dpi \
        xorg-x11-fonts-cyrillic \
        xorg-x11-fonts-misc \
        xorg-x11-fonts-Type1 \
        xorg-x11-utils \
        ca-certificates \
        nss \
        wget \
        libdrm \
        mesa-libgbm \
        dbus-glib \
        GConf2
fi

# Install project dependencies
echo "Installing npm packages..."
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

# Create test script to verify installation
echo "Creating verification script..."
cat > test-puppeteer.js << 'EOL'
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  try {
    console.log('Launching test browser...');
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    console.log('Creating test page...');
    const page = await browser.newPage();
    
    console.log('Navigating to example.com...');
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'example.png' });
    
    console.log('Closing browser...');
    await browser.close();
    
    console.log('✅ Test completed successfully! Check example.png to verify.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
EOL

# Make the script executable
chmod +x setup-ec2.sh

echo "Setup complete. To test the installation, run:"
echo "node test-puppeteer.js" 