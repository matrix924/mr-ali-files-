with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

js = js.replace(
    "document.addEventListener('DOMContentLoaded', async () => {",
    "(async () => {"
)

lines = js.split('\n')
for i in range(len(lines)-1, -1, -1):
    if lines[i].startswith('    });'):
        lines[i] = '    })();'
        break

with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('Patched DOMContentLoaded')
