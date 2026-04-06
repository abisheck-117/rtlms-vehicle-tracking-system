const BASE_URL = 'http://127.0.0.1:8000';

async function apiFetch(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('access_token');
    
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        if(res.status === 401 && endpoint !== '/api/auth/login/') {
            localStorage.removeItem('access_token');
            window.location.href = 'login.html';
        }
        throw new Error(data.error || data.detail || 'API request failed');
    }

    return data;
}

async function apiLogin(username, password) {
    const data = await apiFetch('/api/auth/login/', 'POST', { username, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    return data;
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}
