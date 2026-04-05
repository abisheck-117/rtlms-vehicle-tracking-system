from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from .models import User, Vehicle, Geofence, Invite, EmailOTP
from .serializers import UserSerializer, VehicleSerializer, GeofenceSerializer, InviteSerializer
from .utils import haversine, update_live_tracking, verify_firebase_token
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import random
import time

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class AdminInviteUserView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        if not phone_number:
            return Response({'error': 'phone_number required'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(phone_number=phone_number).exists():
            return Response({'error': 'User with this phone already exists'}, status=status.HTTP_400_BAD_REQUEST)
        if email and User.objects.filter(email=email).exists():
            return Response({'error': 'User with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        invite, created = Invite.objects.get_or_create(phone_number=phone_number)
        if email:
            invite.email = email
        invite.created_by = request.user
        invite.save()
        return Response({'message': 'Invite created successfully.'})

class RequestEmailOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'email required'}, status=status.HTTP_400_BAD_REQUEST)
        
        otp = str(random.randint(100000, 999999))
        EmailOTP.objects.filter(email=email).delete() # Remove old OTPs
        EmailOTP.objects.create(email=email, otp_code=otp)

        send_mail(
            'Your Verification Code',
            f'Your verification code is: {otp}',
            'noreply@rtlms.com',
            [email],
            fail_silently=False,
        )

        return Response({'message': 'OTP sent'})

class UserRegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        id_token = request.data.get('id_token')
        email = request.data.get('email')
        email_otp = request.data.get('email_otp')
        username = request.data.get('username')
        password = request.data.get('password')

        if not email or not email_otp:
            return Response({'error': 'email and email_otp are required'}, status=status.HTTP_400_BAD_REQUEST)

        verified_phone = verify_firebase_token(id_token)
        if not verified_phone or verified_phone != phone:
            return Response({'error': 'Invalid OTP or token.'}, status=status.HTTP_400_BAD_REQUEST)

        otp_record = EmailOTP.objects.filter(email=email, otp_code=email_otp).first()
        if not otp_record or otp_record.created_at < timezone.now() - timedelta(minutes=10):
            return Response({'error': 'Invalid or expired Email OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        invite = Invite.objects.filter(phone_number=phone, is_used=False).first()
        if not invite:
            return Response({'error': 'No active invite for this phone.'}, status=status.HTTP_403_FORBIDDEN)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username taken.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email taken.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            phone_number=phone,
            role='user',
            is_active=True
        )
        invite.is_used = True
        invite.save()
        otp_record.is_verified = True
        otp_record.save()
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        })

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone = request.data.get('phone')
        id_token = request.data.get('id_token')
        new_password = request.data.get('new_password')

        verified_phone = verify_firebase_token(id_token)
        if not verified_phone or verified_phone != phone:
            return Response({'error': 'Invalid OTP token.'}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, phone_number=phone)
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password reset successful'})



class UserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)

class UserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        user.is_active = request.data.get('is_active', user.is_active)
        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



class VehicleListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role == 'admin':
            vehicles = Vehicle.objects.all()
        else:
            vehicles = Vehicle.objects.filter(owner=request.user)
        return Response(VehicleSerializer(vehicles, many=True).data)

    def post(self, request):
        serializer = VehicleSerializer(data=request.data)
        if serializer.is_valid():
            owner_id = request.data.get('owner_id')
            if request.user.role == 'admin' and owner_id:
                owner = get_object_or_404(User, pk=owner_id)
            else:
                owner = request.user
            
            serializer.save(owner=owner)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GeofenceUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, vehicle_id):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_id)
        
        # Ensure users can only modify geofences for vehicles they own
        if request.user.role != 'admin' and vehicle.owner != request.user:
            return Response({'error': 'Not your vehicle'}, status=status.HTTP_403_FORBIDDEN)

        geofence, created = Geofence.objects.get_or_create(vehicle=vehicle, defaults={
            'center_lat': 0, 'center_lng': 0, 'radius_meters': 0
        })
        
        serializer = GeofenceSerializer(geofence, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class TrackingUpdateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        device_key = request.headers.get('X-DEVICE-KEY')
        # Authenticate hardware device via pre-shared API key
        if not device_key:
            return Response({'error': 'Missing X-DEVICE-KEY'}, status=status.HTTP_401_UNAUTHORIZED)
        
        vehicle = Vehicle.objects.filter(device_api_key=device_key).first()
        if not vehicle:
            return Response({'error': 'Invalid Device Key'}, status=status.HTTP_401_UNAUTHORIZED)

        lat = request.data.get('lat')
        lng = request.data.get('lng')

        if lat is None or lng is None:
            return Response({'error': 'Missing coordinates'}, status=status.HTTP_400_BAD_REQUEST)

        ip = request.META.get('REMOTE_ADDR')
        if vehicle.last_ip != ip:
            print(f"SECURITY ALERT: Vehicle {vehicle.name} IP changed from {vehicle.last_ip} to {ip}")
            vehicle.last_ip = ip
            vehicle.save()

        # Calculate distance from geofence center
        is_inside = True
        try:
            geofence = vehicle.geofence
            distance = haversine(
                float(lat), float(lng), 
                geofence.center_lat, geofence.center_lng
            )
            if distance > geofence.radius_meters:
                is_inside = False
        except Geofence.DoesNotExist:
            pass # Fallback to True if no geofence is defined for this vehicle

        update_live_tracking(str(vehicle.device_api_key), float(lat), float(lng), is_inside)

        return Response({'status': 'ok', 'is_inside_geofence': is_inside})
