path = r'c:\CursorSites\theGolfApp\admin\society-admin.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
idx = 1998
correct = "        if (!confirm(\"Delete team '\" + name + \"' and remove all members? This cannot be undone.\")) return;\n"
lines[idx] = correct
with open(path, 'w', encoding='utf-8', newline='') as f:
    f.writelines(lines)
print('Done')
