# Fix courses.html line 651 - replace broken confirm() line
path = r'c:\CursorSites\theGolfApp\admin\courses.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 651 is index 650 (0-based)
new_line = '          var _cn = editingCourse.courseName; if (!confirm("Delete course \\"" + _cn.replace(/"/g, \'\\\\"\') + "\\"? This cannot be undone.")) return;\n'
lines[650] = new_line

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done.')
