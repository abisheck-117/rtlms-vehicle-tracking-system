from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from tracker.models import Vehicle, Geofence, Invite
from tracker.utils import haversine
import uuid

User = get_user_model()

class TrackerLogicTests(TestCase):
    def test_haversine_calculation(self):
        # Coordinates for Bangalore (approx)
        lat1, lon1 = 12.9716, 77.5946
        # Move slightly north
        lat2, lon2 = 12.9816, 77.5946
        distance = haversine(lat1, lon1, lat2, lon2)
        
        # 0.01 degree latitude is approx 1111 meters
        self.assertAlmostEqual(distance, 1111, delta=50)

class TrackerAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser('admin', 'admin@ex.com', 'admin123', role='admin')
        self.user = User.objects.create_user('user1', 'u@ex.com', 'user123', role='user', phone_number='+1111111111')
        self.vehicle = Vehicle.objects.create(name='Test Vehicle', owner=self.user)
        self.geofence = Geofence.objects.create(vehicle=self.vehicle, center_lat=12.9716, center_lng=77.5946, radius_meters=500)

    def test_login(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {'username': 'admin', 'password': 'admin123'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_admin_invite_user(self):
        # Authenticate as admin
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin_invite_user')
        response = self.client.post(url, {'phone_number': '+9999999999'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Invite.objects.filter(phone_number='+9999999999').exists())

    def test_user_cannot_invite(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('admin_invite_user')
        response = self.client.post(url, {'phone_number': '+8888888888'})
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vehicle_list_for_user(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('vehicle_list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Test Vehicle')

    def test_hardware_tracking_update_success(self):
        url = reverse('tracking_update')
        headers = {'HTTP_X_DEVICE_KEY': str(self.vehicle.device_api_key)}
        
        # Update point inside the geofence (very close)
        payload = {'lat': 12.9717, 'lng': 77.5946}
        response = self.client.post(url, payload, format='json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_inside_geofence'])

    def test_hardware_tracking_update_outside_geofence(self):
        url = reverse('tracking_update')
        headers = {'HTTP_X_DEVICE_KEY': str(self.vehicle.device_api_key)}
        
        # Point far away (>500m)
        payload = {'lat': 12.9816, 'lng': 77.5946}
        response = self.client.post(url, payload, format='json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_inside_geofence'])

    def test_hardware_tracking_invalid_device_key(self):
        url = reverse('tracking_update')
        headers = {'HTTP_X_DEVICE_KEY': str(uuid.uuid4())}
        payload = {'lat': 12.9717, 'lng': 77.5946}
        response = self.client.post(url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
