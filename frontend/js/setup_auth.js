import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();

let confirmationResult = null;

document.addEventListener('DOMContentLoaded', () => {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
    });
});

document.getElementById('phoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phoneNumber').value;
    const btn = document.getElementById('requestOtpBtn');
    const errDiv = document.getElementById('errorMsg');

    btn.disabled = true;
    btn.textContent = 'Sending...';
    errDiv.classList.add('hidden');

    try {
        const appVerifier = window.recaptchaVerifier;
        confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);

        document.getElementById('phoneForm').classList.add('hidden');
        document.getElementById('setupForm').classList.remove('hidden');

    } catch (err) {
        errDiv.textContent = err.message || "Failed to send OTP.";
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Request OTP';
        if (window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
    }
});

document.getElementById('email').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('requestEmailOtpBtn').click();
    }
});

document.getElementById('requestEmailOtpBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const errDiv = document.getElementById('errorMsg');
    const btn = document.getElementById('requestEmailOtpBtn');
    
    if (!email) {
        errDiv.textContent = "Please enter an email address first.";
        errDiv.classList.remove('hidden');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Sending...';
    errDiv.classList.add('hidden');
    
    try {
        const res = await fetch('http://127.0.0.1:8000/api/auth/email-otp/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send Email OTP');
        
        btn.textContent = 'Sent!';
        setTimeout(() => { btn.textContent = 'Send Again'; btn.disabled = false; }, 5000);
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Send OTP';
    }
});

document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;
    const email = document.getElementById('email').value;
    const emailOtpCode = document.getElementById('emailOtpCode').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phoneNumber').value;

    const btn = document.getElementById('completeSetupBtn');
    const errDiv = document.getElementById('errorMsg');

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    errDiv.classList.add('hidden');

    try {
        const result = await confirmationResult.confirm(otp);
        const user = result.user;
        const idToken = await user.getIdToken();

        const reqData = {
            phone: phone,
            id_token: idToken,
            email: email,
            email_otp: emailOtpCode,
            username: username,
            password: password
        };

        const res = await fetch('http://127.0.0.1:8000/api/auth/register/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);

        alert("Account setup complete! Redirecting to Dashboard...");
        window.location.href = 'user_dashboard.html';

    } catch (err) {
        errDiv.textContent = err.message || "Verification Failed";
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Verify & Create Account';
    }
});
