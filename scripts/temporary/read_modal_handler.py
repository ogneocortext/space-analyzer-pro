path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
idx = content.find('body.querySelectorAll(".modal-actions .btn")')
print(repr(content[idx-50:idx+900]))
