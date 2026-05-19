const fs = require('fs');
let file = fs.readFileSync('app/utils/pushNotifications.js', 'utf8');

const target = `  const employees = await Employee.find({ 
    username: { $in: uniqueUsers.map(u => new RegExp(\`^\${u.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i')) } 
  })`;

// Add {} escape sequence regex manually to target since the formatting in node differs slightly.
const searchStr = `  const employees = await Employee.find({ \n    username: { $in: uniqueUsers.map(u => new RegExp(\`^\${u.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i')) } \n  })`;

const replacement = `  const queryRegexes = uniqueUsers.map(u => new RegExp(\`^\${u.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i'));
  const employees = await Employee.find({ 
    $or: [
      { username: { $in: queryRegexes } },
      { shortName: { $in: queryRegexes } },
      { name: { $in: queryRegexes } }
    ]
  })`;

if (file.includes(searchStr)) {
  file = file.replace(searchStr, replacement);
  fs.writeFileSync('app/utils/pushNotifications.js', file);
  console.log('Successfully replaced searchStr.');
} else {
  // Let's just do a simple replacement based on lines.
  const lines = file.split('\n');
  const newLines = [];
  let replacing = false;
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('const employees = await Employee.find({')) {
       replacing = true;
       newLines.push(`  const queryRegexes = uniqueUsers.map(u => new RegExp(\`^\${u.replace(/[.*+?^$\{()|[\\\\]\\\\\\\\]/g, '\\\\$&')}$\`, 'i'));`);
       newLines.push(`  const employees = await Employee.find({ `);
       newLines.push(`    $or: [`);
       newLines.push(`      { username: { $in: queryRegexes } },`);
       newLines.push(`      { shortName: { $in: queryRegexes } },`);
       newLines.push(`      { name: { $in: queryRegexes } }`);
       newLines.push(`    ]`);
       newLines.push(`  })`);
    } else if (replacing && lines[i].includes('})')) {
       replacing = false; // skip this line
    } else if (replacing) {
       // skip lines
    } else {
       newLines.push(lines[i]);
    }
  }
  fs.writeFileSync('app/utils/pushNotifications.js', newLines.join('\n'));
  console.log('Replaced by line parsing.');
}
