from rest_framework import serializers
from .models import User, Vehicle, Geofence, Invite

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'role', 'is_active']

class GeofenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Geofence
        fields = ['center_lat', 'center_lng', 'radius_meters']

class VehicleSerializer(serializers.ModelSerializer):
    geofence = GeofenceSerializer(read_only=True)
    
    class Meta:
        model = Vehicle
        fields = ['id', 'owner', 'name', 'device_api_key', 'geofence', 'created_at']
        read_only_fields = ['owner']

class InviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invite
        fields = ['phone_number', 'email', 'created_at', 'is_used']
