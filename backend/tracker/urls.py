from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    AdminInviteUserView, UserRegisterView, PasswordResetConfirmView,
    UserListView, UserDetailView,
    VehicleListView, GeofenceUpdateView,
    TrackingUpdateView, RequestEmailOTPView
)

urlpatterns = [
    # Auth
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', UserRegisterView.as_view(), name='register'),
    path('auth/email-otp/', RequestEmailOTPView.as_view(), name='email_otp'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    
    # Admin
    path('admin/users/invite/', AdminInviteUserView.as_view(), name='admin_invite_user'),
    path('admin/users/', UserListView.as_view(), name='admin_users'),
    path('admin/users/<int:pk>/', UserDetailView.as_view(), name='admin_user_detail'),
    
    # Vehicles & Geofence
    path('vehicles/', VehicleListView.as_view(), name='vehicle_list'),
    path('vehicles/<int:vehicle_id>/geofence/', GeofenceUpdateView.as_view(), name='geofence_update'),
    
    # Hardware
    path('tracking/update', TrackingUpdateView.as_view(), name='tracking_update'),
]
