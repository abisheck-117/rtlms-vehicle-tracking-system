from django.contrib import admin
from .models import User, Vehicle, Geofence, Invite

admin.site.register(User)
admin.site.register(Vehicle)
admin.site.register(Geofence)
admin.site.register(Invite)
