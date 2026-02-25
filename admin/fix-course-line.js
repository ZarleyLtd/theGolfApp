const fs = require('fs');
const path = 'c:\\CursorSites\\theGolfApp\\admin\\courses.html';
let s = fs.readFileSync(path, 'utf8');
const regex = /(\s+)if \(!confirm\([^)]+\)\) return;/;
const newLine = '$1var _cn = editingCourse.courseName;\n$1if (!confirm("Delete course \\"" + _cn.replace(/"/g, \'\\\\"\') + "\\"? This cannot be undone.")) return;';
const newS = s.replace(regex, newLine);
if (newS !== s) {
  fs.writeFileSync(path, newS);
  console.log('Replaced.');
} else {
  console.log('Pattern not found.');
  const line = s.split('\n')[650];
  console.log('Line 651:', line ? line.substring(0, 80) : 'n/a');
}
