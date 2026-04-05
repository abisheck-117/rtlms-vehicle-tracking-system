import math
import requests
import time
from django.conf import settings
from .models import Vehicle

import firebase_admin
from firebase_admin import credentials, db, auth

try:
    from django.conf import settings
    db.reference()
except Exception as e:
    print("Warning: Firebase not fully initialized or accessible:", e)
def haversine(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    r = 6371000 # Radius of earth in meters
    return c * r

def update_live_tracking(vehicle_id, lat, lng, is_inside):
    try:
        ref = db.reference(f'live_tracking/{vehicle_id}')
        ref.set({
            'lat': lat,
            'lng': lng,
            'timestamp': int(time.time()),
            'is_inside_geofence': is_inside,
            'status': 'online'
        })
    except Exception as e:
        print(f"Error publishing to Firebase: {e}")

def verify_firebase_token(id_token):
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token.get('phone_number')
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None
