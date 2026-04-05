import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('user', 'User'),
    )
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    
    # Resolving reverse accessor clashes by overriding groups and user_permissions
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='tracker_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='tracker_user_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    def __str__(self):
        return f"{self.username} ({self.role})"


class Vehicle(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehicles')
    name = models.CharField(max_length=100)
    device_api_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    last_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Geofence(models.Model):
    vehicle = models.OneToOneField(Vehicle, on_delete=models.CASCADE, related_name='geofence')
    center_lat = models.FloatField()
    center_lng = models.FloatField()
    radius_meters = models.FloatField()
    
    def __str__(self):
        return f"Geofence for {self.vehicle.name}"

# A simple model to store Admin Invitations linking to phone numbers
class Invite(models.Model):
    phone_number = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return self.phone_number

class EmailOTP(models.Model):
    email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - {self.otp_code}"
