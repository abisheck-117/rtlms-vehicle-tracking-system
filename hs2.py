import requests
import time
import random

# Hardware Simulator

# Config
API_URL = "http://127.0.0.1:8000/api/tracking/update"
DEVICE_API_KEY = "your-device-api-key"

# Starting coords (approx Bangalore)
curr_lat = 9.9252
curr_lng = 78.1198

print("Starting GPS Hardware Simulator...")
print(f"Target: {API_URL}")
print(f"Device Key: {DEVICE_API_KEY}")

while True:
    # Simulate slight movement
    curr_lat += random.uniform(-0.0005, 0.0005)
    curr_lng += random.uniform(-0.0005, 0.0005)
    
    headers = {
        "X-DEVICE-KEY": DEVICE_API_KEY
    }
    
    payload = {
        "lat": curr_lat,
        "lng": curr_lng
    }
    
    try:
        res = requests.post(API_URL, headers=headers, json=payload)
        print(f"[{time.strftime('%H:%M:%S')}] Sent {curr_lat:.5f}, {curr_lng:.5f} -> Response: {res.status_code} {res.text}")
    except Exception as e:
        print(f"Failed to reach server: {e}")
        
    time.sleep(5) # Update every 5 seconds
