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
    const successDiv = document.getElementById('successMsg');

    btn.disabled = true;
    btn.textContent = 'Sending...';
    errDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    try {
        // Pre-flight check: does this user actually exist in our DB?
        const checkRes = await fetch('http://127.0.0.1:8000/api/auth/check-user/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone })
        });
        const checkData = await checkRes.json();
        
        if (!checkRes.ok || !checkData.exists) {
            throw new Error('This phone number is not registered in our system.');
        }

        const appVerifier = window.recaptchaVerifier;
        // Verify phone via firebase
        confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);

        document.getElementById('phoneForm').classList.add('hidden');
        document.getElementById('resetForm').classList.remove('hidden');
        document.querySelector('.form-subtitle').textContent = "Verify the code sent to " + phone;
        
        successDiv.textContent = 'OTP Sent successfully!';
        successDiv.classList.remove('hidden');

    } catch (err) {
        errDiv.textContent = err.message || "Failed to send OTP.";
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Send OTP';
        if (window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
    }
});

document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;
    const newPassword = document.getElementById('newPassword').value;
    const phone = document.getElementById('phoneNumber').value;

    const btn = document.getElementById('confirmResetBtn');
    const errDiv = document.getElementById('errorMsg');
    const successDiv = document.getElementById('successMsg');

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    errDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    try {
        // verify OTP via firebase
        const result = await confirmationResult.confirm(otp);
        const user = result.user;
        const idToken = await user.getIdToken();

        // Push new password to django backend
        const reqData = {
            phone: phone,
            id_token: idToken,
            new_password: newPassword
        };

        const res = await fetch('http://127.0.0.1:8000/api/auth/password-reset/confirm/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Password reset failed.');
        }

        successDiv.textContent = 'Password reset successful! Redirecting to login...';
        successDiv.classList.remove('hidden');
        
        setTimeout(()=> {
            window.location.href = 'login.html';
        }, 2000);

    } catch (err) {
        errDiv.textContent = err.message || "Verification Failed";
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Confirm Reset';
    }
});
