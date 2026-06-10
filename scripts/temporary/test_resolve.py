import urllib.request, json
data = json.dumps({"model": "llama3"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8765/api/issues/mainissuetracker:34af6f76922f/resolve",
    data=data,
    headers={"Content-Type": "application/json"},
)
try:
    resp = urllib.request.urlopen(req)
    print("OK:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Body:", e.read().decode())
