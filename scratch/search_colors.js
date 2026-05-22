const fs = require('fs');
const path = require('path');

const colorRegex = /color:\s*"(white|rgba\(255,\s*255,\s*255,\s*[0-9.]+\))"/g;
const bgRegex = /background:\s*"(rgba\(13,\s*6,\s*40,\s*[0-9.]+\))"/g;

const matches = [];

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walk(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        colorRegex.lastIndex = 0;
        bgRegex.lastIndex = 0;
        if (colorRegex.test(line) || bgRegex.test(line)) {
          matches.push(`${fullPath}:${idx + 1} -> ${line.trim()}`);
        }
      });
    }
  });
}

walk('src');
console.log(`Total matches: ${matches.length}`);
matches.slice(0, 100).forEach(m => console.log(m));
