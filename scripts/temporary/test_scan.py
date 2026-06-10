import urllib.request, json
data = json.dumps({'model': 'qwen2.5-coder:7b', 'scope': 'rust'}).encode()
req = urllib.request.Request('http://127.0.0.1:8765/api/source/scan', data=data, headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    print('Status:', resp.status)
    body = json.loads(resp.read())
    print('created:', len(body.get('created', [])), 'error:', body.get('error'))
except urllib.error.HTTPError as e:
    print('Status:', e.code)
    print('Body:', e.read().decode())
