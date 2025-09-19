const fs = require('fs');
const path = require('path');

// Ensure www directory exists
if (!fs.existsSync('www')) {
    fs.mkdirSync('www');
}

// Copy files from public to www
const filesToCopy = [
    'index-capacitor.html',
    'script-capacitor.js',
    'data-service-robust.js',
    'icloud-sync-robust.js',
    'sync-debug.js',
    'sync-migration.js',
    'sync-test.js',
    'sync-validator.js',
    'styles.css',
    'favicon.svg',
    'favicon-32x32.png',
    'favicon-16x16.png',
    'apple-touch-icon.png',
    'favicon.ico',
    'logo.svg'
];

filesToCopy.forEach(file => {
    const srcPath = path.join('public', file);
    const destPath = path.join('www', file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file}`);
    } else {
        console.warn(`Warning: ${file} not found in public directory`);
    }
});

// Rename index-capacitor.html to index.html in www
if (fs.existsSync('www/index-capacitor.html')) {
    fs.renameSync('www/index-capacitor.html', 'www/index.html');
    console.log('Renamed index-capacitor.html to index.html');
}

// Rename script-capacitor.js to script.js in www
if (fs.existsSync('www/script-capacitor.js')) {
    fs.renameSync('www/script-capacitor.js', 'www/script.js');
    console.log('Renamed script-capacitor.js to script.js');
}

// Update the HTML file to reference the correct script
if (fs.existsSync('www/index.html')) {
    let html = fs.readFileSync('www/index.html', 'utf8');
    html = html.replace('script-capacitor.js', 'script.js');
    fs.writeFileSync('www/index.html', html);
    console.log('Updated script reference in index.html');
}

console.log('Build complete! Ready for Capacitor sync.');