const fs = require('fs');
let file = fs.readFileSync('app/controllers/schedule.controller.js', 'utf8');

let lines = file.split('\n');
let newLines = [];
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('const employees = await Employee.find({ username: { $in: usernames } }).select({ username: 1, name: 1, shortName: 1 }).lean();')) {
     newLines.push(`      const regexes = usernames.map(u => new RegExp(\`^\${u.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i'));`);
     newLines.push(`      const employees = await Employee.find({ $or: [{ username: { $in: regexes } }, { shortName: { $in: regexes } }, { name: { $in: regexes } }] }).select({ username: 1, name: 1, shortName: 1 }).lean();`);
  } else if (lines[i].includes('const emp = await Employee.findOne({ username: assignMode }).select({ username: 1, name: 1, shortName: 1 }).lean();')) {
     newLines.push(`      const regexAssign = new RegExp(\`^\${assignMode.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i');`);
     newLines.push(`      const emp = await Employee.findOne({ $or: [{ username: regexAssign }, { shortName: regexAssign }, { name: regexAssign }] }).select({ username: 1, name: 1, shortName: 1 }).lean();`);
  } else {
     newLines.push(lines[i]);
  }
}
fs.writeFileSync('app/controllers/schedule.controller.js', newLines.join('\n'));
console.log('Done replacement.');
