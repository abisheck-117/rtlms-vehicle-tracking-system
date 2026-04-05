import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let allUsers = [];
let allVehicles = [];
let adminMap, adminMarkerGroup;
let vehicleMarkers = {}; // map vehicleId to leaflet marker

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAllUsers();
    await fetchAllVehicles();

    initAdminMap();

    setupFirebaseAdminListeners();

    setInterval(updateVehicleStatuses, 15000);
});

window.invalidateAdminMap = () => {
    if (adminMap) adminMap.invalidateSize();
}

async function fetchAllUsers() {
    try {
        allUsers = await apiFetch('/api/admin/users/');
        renderUsersTable();
    } catch (err) {
        console.error("Failed to load users", err);
    }
}

async function fetchAllVehicles() {
    try {
        allVehicles = await apiFetch('/api/vehicles/');
        renderVehiclesTable();
    } catch (err) {
        console.error("Failed to load vehicles", err);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    allUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.email || '-'}</td>
            <td>${u.phone_number || 'Invited/Pending'}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-offline'}">${u.role.toUpperCase()}</span></td>
            <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Deactivated'}</span></td>
            <td>
                <button class="btn btn-sm" onclick="toggleUserStatus(${u.id}, ${!u.is_active})">
                    ${u.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderVehiclesTable() {
    const tbody = document.getElementById('globalVehiclesTableBody');
    tbody.innerHTML = '';
    allVehicles.forEach(v => {
        const ownerName = allUsers.find(u => u.id === v.owner)?.username || `User ${v.owner}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v.id}</td>
            <td>${v.name}</td>
            <td>${ownerName}</td>
            <td><code>${v.device_api_key}</code></td>
            <td id="global-status-v-${v.id}"><span class="badge badge-offline">Waiting...</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initAdminMap() {
    adminMap = L.map('adminMap').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(adminMap);
    adminMarkerGroup = L.featureGroup().addTo(adminMap);
}

function setupFirebaseAdminListeners() {
    const trackingRef = ref(db, 'live_tracking');
    onValue(trackingRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(vId => {
                const vData = data[vId];
                const vehicle = allVehicles.find(v => v.device_api_key == vId || v.id == vId);
                if (vehicle) {
                    updateAdminMapMarker(vehicle, vData);
                }
            });
        }
    });
}

function updateAdminMapMarker(vehicle, data) {
    if (vehicleMarkers[vehicle.id]) {
        vehicleMarkers[vehicle.id].setLatLng([data.lat, data.lng]);
    } else {
        const marker = L.marker([data.lat, data.lng]).addTo(adminMarkerGroup);
        const ownerName = allUsers.find(u => u.id === vehicle.owner)?.username || 'Unknown';
        marker.bindPopup(`<b>${vehicle.name}</b><br>Owner: ${ownerName}`);
        vehicleMarkers[vehicle.id] = marker;
        adminMap.fitBounds(adminMarkerGroup.getBounds());
    }

    const isOffline = (Date.now() / 1000) - data.timestamp > 60;
    const statusCell = document.getElementById(`global-status-v-${vehicle.id}`);

    if (statusCell) {
        if (isOffline) {
            statusCell.innerHTML = `<span class="badge badge-offline">Offline</span>`;
        } else {
            statusCell.innerHTML = `<span class="badge badge-success">Online</span>`;
        }
    }
}

function updateVehicleStatuses() {
}

// ---- UI Bindings ----

window.openInviteModal = () => {
    document.getElementById('inviteUserModal').classList.add('active');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
};

window.submitInviteUser = async () => {
    const phone = document.getElementById('invitePhone').value;
    const email = document.getElementById('inviteEmail').value;
    if (!phone) return alert('Phone required');
    try {
        await apiFetch('/api/admin/users/invite/', 'POST', { phone_number: phone, email: email });
        alert("Invite created! Tell the user to go to the Complete Setup page.");
        closeModal('inviteUserModal');
        await fetchAllUsers();
    } catch (err) {
        alert(err.message);
    }
};

window.toggleUserStatus = async (userId, newStatus) => {
    try {
        await apiFetch(`/api/admin/users/${userId}/`, 'PUT', { is_active: newStatus });
        await fetchAllUsers();
    } catch (err) {
        alert(err.message);
    }
};
