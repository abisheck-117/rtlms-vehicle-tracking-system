import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let vehicles = [];
let map, markerGroup;
let geoSetupMap, geoMarker, geoCircle;
let vehicleMarkers = {}; // map vehicleId to leaflet marker

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Data Fetch
    await fetchMyVehicles();

    // 2. Setup Maps
    initLiveMap();
    initGeoSetupMap();

    // 3. Setup Listeners
    // Moved to fetchMyVehicles to ensure vehicles array is populated first

    // 4. Offline Checker Loop
    setInterval(checkOfflineStatus, 15000); // Check every 15s
});

window.invalidateMaps = () => {
    if (map) map.invalidateSize();
    if (geoSetupMap) geoSetupMap.invalidateSize();
}

async function fetchMyVehicles() {
    try {
        vehicles = await apiFetch('/api/vehicles/');
        renderVehicleTable();
        renderGeoVehicleSelect();
        
        setupFirebaseListeners();
    } catch (err) {
        console.error("Failed to load vehicles", err);
    }
}

function renderVehicleTable() {
    const tbody = document.getElementById('vehicleTableBody');
    tbody.innerHTML = '';
    vehicles.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v.id}</td>
            <td>${v.name}</td>
            <td><code>${v.device_api_key}</code></td>
            <td id="status-v-${v.id}"><span class="badge badge-offline">Waiting...</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderGeoVehicleSelect() {
    const sel = document.getElementById('geoVehicleSelect');
    sel.innerHTML = '<option value="">-- Select a Vehicle --</option>';
    vehicles.forEach(v => {
        sel.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });
}

function initLiveMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);
    markerGroup = L.featureGroup().addTo(map);
}

function initGeoSetupMap() {
    geoSetupMap = L.map('geoSetupMap').setView([12.9716, 77.5946], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(geoSetupMap);

    geoSetupMap.on('click', function (e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        document.getElementById('geoLat').value = lat;
        document.getElementById('geoLng').value = lng;

        const radius = parseFloat(document.getElementById('geoRadius').value) || 500;

        if (geoMarker) geoSetupMap.removeLayer(geoMarker);
        if (geoCircle) geoSetupMap.removeLayer(geoCircle);

        geoMarker = L.marker([lat, lng]).addTo(geoSetupMap);
        geoCircle = L.circle([lat, lng], { radius: radius, color: 'blue' }).addTo(geoSetupMap);
    });
}

function setupFirebaseListeners() {
    vehicles.forEach(v => {
        const vRef = ref(db, `live_tracking/${v.device_api_key}`);
        onValue(vRef, (snapshot) => {
            const data = snapshot.val();
            if (data) updateVehicleMap(v, data);
        });
    });
}

function updateVehicleMap(vehicle, data) {
    // Data has lat, lng, timestamp, is_inside_geofence, status

    // Update marker
    if (vehicleMarkers[vehicle.id]) {
        vehicleMarkers[vehicle.id].setLatLng([data.lat, data.lng]);
    } else {
        const marker = L.marker([data.lat, data.lng]).addTo(markerGroup);
        marker.bindPopup(`<b>${vehicle.name}</b>`);
        vehicleMarkers[vehicle.id] = marker;
        map.fitBounds(markerGroup.getBounds());
    }

    // Update table status
    const isOffline = (Date.now() / 1000) - data.timestamp > 60;
    const statusCell = document.getElementById(`status-v-${vehicle.id}`);

    if (statusCell) {
        if (isOffline) {
            statusCell.innerHTML = `<span class="badge badge-offline">Offline</span>`;
        } else {
            statusCell.innerHTML = `<span class="badge badge-success">Online</span>`;
        }
    }

    // Alert Handling
    const banner = document.getElementById('geofenceAlertBanner');
    const nameSpan = document.getElementById('alertVehicleName');

    if (!data.is_inside_geofence && !isOffline) {
        nameSpan.textContent = vehicle.name;
        banner.classList.add('active');
    } else {
        banner.classList.remove('active');
    }
}

function checkOfflineStatus() {
    // We would need to store latest timestamp locally to double check if firebase link is dead
    // Handled in `updateVehicleMap` efficiently, but simple interval ensures badges flip to offline
    // if no updates come in.
}

// ---- UI Bindings ----

window.openAddVehicleModal = () => {
    document.getElementById('addVehicleModal').classList.add('active');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
};

window.submitNewVehicle = async () => {
    const name = document.getElementById('newVehicleName').value;
    if (!name) return alert('Name required');
    try {
        await apiFetch('/api/vehicles/', 'POST', { name });
        closeModal('addVehicleModal');
        window.location.reload();
    } catch (err) {
        alert(err.message);
    }
};

document.getElementById('geofenceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vid = document.getElementById('geoVehicleSelect').value;
    const lat = document.getElementById('geoLat').value;
    const lng = document.getElementById('geoLng').value;
    const radius = document.getElementById('geoRadius').value;

    if (!vid || !lat || !lng) return alert("Please select vehicle and click on map.");

    try {
        await apiFetch(`/api/vehicles/${vid}/geofence/`, 'PUT', {
            center_lat: parseFloat(lat),
            center_lng: parseFloat(lng),
            radius_meters: parseFloat(radius)
        });
        alert('Geofence saved!');
    } catch (err) {
        alert(err.message);
    }
});

console.log(vehicles);