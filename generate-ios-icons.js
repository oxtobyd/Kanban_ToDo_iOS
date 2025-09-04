const fs = require('fs');
const path = require('path');

// Create a square version of the logo for iOS app icon
const createSquareLogoSVG = () => {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background rounded rectangle -->
  <rect x="0" y="0" width="1024" height="1024" rx="180" fill="url(#logoGradient)" />
  
  <!-- Kanban columns representation -->
  <rect x="200" y="200" width="150" height="624" rx="50" fill="white" opacity="0.9" />
  <rect x="387" y="200" width="150" height="624" rx="50" fill="white" opacity="0.7" />
  <rect x="574" y="200" width="150" height="624" rx="50" fill="white" opacity="0.5" />
  
  <!-- Task cards in first column -->
  <rect x="225" y="250" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="225" y="360" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="225" y="470" width="100" height="80" rx="25" fill="#4a5568" />
  
  <!-- Task cards in second column -->
  <rect x="412" y="300" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="412" y="410" width="100" height="80" rx="25" fill="#4a5568" />
  
  <!-- Task cards in third column -->
  <rect x="599" y="350" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="599" y="460" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="599" y="570" width="100" height="80" rx="25" fill="#4a5568" />
  <rect x="599" y="680" width="100" height="80" rx="25" fill="#4a5568" />
</svg>`;
};

// iOS App Icon sizes needed
const iconSizes = [
  { name: 'AppIcon-20.png', size: 20 },
  { name: 'AppIcon-20@2x.png', size: 40 },
  { name: 'AppIcon-20@3x.png', size: 60 },
  { name: 'AppIcon-29.png', size: 29 },
  { name: 'AppIcon-29@2x.png', size: 58 },
  { name: 'AppIcon-29@3x.png', size: 87 },
  { name: 'AppIcon-40.png', size: 40 },
  { name: 'AppIcon-40@2x.png', size: 80 },
  { name: 'AppIcon-40@3x.png', size: 120 },
  { name: 'AppIcon-60@2x.png', size: 120 },
  { name: 'AppIcon-60@3x.png', size: 180 },
  { name: 'AppIcon-76.png', size: 76 },
  { name: 'AppIcon-76@2x.png', size: 152 },
  { name: 'AppIcon-83.5@2x.png', size: 167 },
  { name: 'AppIcon-512.png', size: 512 },
  { name: 'AppIcon-512@2x.png', size: 1024 }
];

// Create the Contents.json file for iOS
const createContentsJson = () => {
  return {
    "images": [
      {
        "filename": "AppIcon-20.png",
        "idiom": "iphone",
        "scale": "1x",
        "size": "20x20"
      },
      {
        "filename": "AppIcon-20@2x.png",
        "idiom": "iphone",
        "scale": "2x",
        "size": "20x20"
      },
      {
        "filename": "AppIcon-20@3x.png",
        "idiom": "iphone",
        "scale": "3x",
        "size": "20x20"
      },
      {
        "filename": "AppIcon-29.png",
        "idiom": "iphone",
        "scale": "1x",
        "size": "29x29"
      },
      {
        "filename": "AppIcon-29@2x.png",
        "idiom": "iphone",
        "scale": "2x",
        "size": "29x29"
      },
      {
        "filename": "AppIcon-29@3x.png",
        "idiom": "iphone",
        "scale": "3x",
        "size": "29x29"
      },
      {
        "filename": "AppIcon-40@2x.png",
        "idiom": "iphone",
        "scale": "2x",
        "size": "40x40"
      },
      {
        "filename": "AppIcon-40@3x.png",
        "idiom": "iphone",
        "scale": "3x",
        "size": "40x40"
      },
      {
        "filename": "AppIcon-60@2x.png",
        "idiom": "iphone",
        "scale": "2x",
        "size": "60x60"
      },
      {
        "filename": "AppIcon-60@3x.png",
        "idiom": "iphone",
        "scale": "3x",
        "size": "60x60"
      },
      {
        "filename": "AppIcon-20.png",
        "idiom": "ipad",
        "scale": "1x",
        "size": "20x20"
      },
      {
        "filename": "AppIcon-20@2x.png",
        "idiom": "ipad",
        "scale": "2x",
        "size": "20x20"
      },
      {
        "filename": "AppIcon-29.png",
        "idiom": "ipad",
        "scale": "1x",
        "size": "29x29"
      },
      {
        "filename": "AppIcon-29@2x.png",
        "idiom": "ipad",
        "scale": "2x",
        "size": "29x29"
      },
      {
        "filename": "AppIcon-40.png",
        "idiom": "ipad",
        "scale": "1x",
        "size": "40x40"
      },
      {
        "filename": "AppIcon-40@2x.png",
        "idiom": "ipad",
        "scale": "2x",
        "size": "40x40"
      },
      {
        "filename": "AppIcon-76.png",
        "idiom": "ipad",
        "scale": "1x",
        "size": "76x76"
      },
      {
        "filename": "AppIcon-76@2x.png",
        "idiom": "ipad",
        "scale": "2x",
        "size": "76x76"
      },
      {
        "filename": "AppIcon-83.5@2x.png",
        "idiom": "ipad",
        "scale": "2x",
        "size": "83.5x83.5"
      },
      {
        "filename": "AppIcon-512.png",
        "idiom": "mac",
        "scale": "1x",
        "size": "512x512"
      },
      {
        "filename": "AppIcon-512@2x.png",
        "idiom": "mac",
        "scale": "2x",
        "size": "512x512"
      }
    ],
    "info": {
      "author": "xcode",
      "version": 1
    }
  };
};

// Create the square logo SVG
const squareLogoSVG = createSquareLogoSVG();
fs.writeFileSync('ios-app-icon.svg', squareLogoSVG);

console.log('✅ Created ios-app-icon.svg');
console.log('📱 This is a square version of your logo optimized for iOS app icons');
console.log('');
console.log('🔧 To complete the setup:');
console.log('1. Convert ios-app-icon.svg to PNG at different sizes');
console.log('2. You can use online tools like:');
console.log('   - https://appicon.co/');
console.log('   - https://www.appicon.build/');
console.log('   - Or use design software like Figma, Sketch, or Photoshop');
console.log('');
console.log('📋 Required sizes for iOS:');
iconSizes.forEach(icon => {
  console.log(`   - ${icon.name} (${icon.size}x${icon.size}px)`);
});
console.log('');
console.log('📁 Place the generated PNG files in:');
console.log('   ios/App/App/Assets.xcassets/AppIcon.appiconset/');

// Create the Contents.json file
const contentsJson = createContentsJson();
const contentsPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json';
fs.writeFileSync(contentsPath, JSON.stringify(contentsJson, null, 2));

console.log('');
console.log('✅ Updated Contents.json for iOS app icons');
console.log('🎨 Your Kanban logo will look great as an iOS app icon!');