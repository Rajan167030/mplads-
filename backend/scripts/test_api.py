import urllib.request
import json

url = 'http://localhost:8000/api/risk-scores/top?limit=3'
try:
    r = urllib.request.urlopen(url)
    data = json.loads(r.read())
    print(f'Got {len(data)} projects:')
    for p in data:
        print(f"  {p['project_name'][:50]} | band={p['risk_band']} | score={p['risk_score']}")
except Exception as e:
    print(f'Error: {e}')
