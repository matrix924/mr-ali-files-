import re

with open('c:/Users/mohamed/Desktop/المنصه/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
if script_match:
    js_code = script_match.group(1)
    with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'w', encoding='utf-8') as f:
        f.write(js_code)
    
    new_html = content[:script_match.start()] + '<script type="module" src="app.js"></script>' + content[script_match.end():]
    with open('c:/Users/mohamed/Desktop/المنصه/index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    print('Successfully extracted app.js')
else:
    print('Script not found')
