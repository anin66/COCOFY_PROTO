import os
import re

pattern = re.compile(r'color:\s*"(white|rgba\(255,\s*255,\s*255,\s*[0-9.]+\))"')
bg_pattern = re.compile(r'background:\s*"(rgba\(13,\s*6,\s*40,\s*[0-9.]+\))"')

matches = []
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith('.tsx'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                for i, line in enumerate(file, 1):
                    if pattern.search(line) or bg_pattern.search(line):
                        matches.append(f"{path}:{i} -> {line.strip()}")

print(f"Total matches: {len(matches)}")
for m in matches[:50]:
    print(m)
