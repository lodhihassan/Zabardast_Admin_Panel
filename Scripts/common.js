/**
 * Common JavaScript Utilities for Zabardast Admin & Vendor Suite
 */

const appConfig = window.APP_CONFIG || {};
const SUPABASE_URL = appConfig.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = appConfig.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing runtime configuration. SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
}

// Supabase Public Storage Base URL
const PUBLIC_STORAGE_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/`;

// 1. Initialize Supabase Client
function initSupabaseClient() {
    if (!window.sbClient && typeof supabase !== 'undefined') {
        window.sbClient = supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );
    }
    return window.sbClient;
}

// 2. Global Toast Notification System (Top-Right)
function showToast(message, type = 'success', duration = 10000) {
    let container = document.getElementById('toast-container') || document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const toastType = (type === 'danger' || type === 'error') ? 'toast-error' : (type === 'warning' ? 'toast-warning' : 'toast-success');
    toast.className = `toast-message ${toastType} toast-show`;
    toast.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px;">${message}</span>
        <button class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 350);
    }, duration);
}

// 3. Extract Active Logged-In User Identity for created_by / updated_by
function getCleanAdminUser() {
    let raw = localStorage.getItem('supabase_admin_user') || localStorage.getItem('admin_username') || localStorage.getItem('user_full_name');
    let userStr = '';
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                userStr = parsed.full_name || parsed.name || parsed.username || parsed.email || '';
            } else {
                userStr = String(parsed);
            }
        } catch (e) {
            userStr = raw;
        }
    }
    if (userStr) {
        if (userStr.includes('@')) {
            const prefix = userStr.split('@')[0];
            return prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }
        return userStr;
    }
    return 'Admin';
}

// 4. Generate Pakistan Time (+05:00) ISO String
function getPKTISOString(dateObj = new Date()) {
    const pktOffsetMs = 5 * 60 * 60 * 1000;
    const localTimeMs = dateObj.getTime();
    const utcTimeMs = localTimeMs + (dateObj.getTimezoneOffset() * 60000);
    const pktTime = new Date(utcTimeMs + pktOffsetMs);

    const pad = (num) => String(num).padStart(2, '0');

    const year = pktTime.getFullYear();
    const month = pad(pktTime.getMonth() + 1);
    const day = pad(pktTime.getDate());
    const hours = pad(pktTime.getHours());
    const minutes = pad(pktTime.getMinutes());
    const seconds = pad(pktTime.getSeconds());

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:00`;
}

// 5. Format Date/Time in Pakistan Timezone (PKT Asia/Karachi)
function formatPKTDate(rawDate) {
    if (!rawDate) return 'N/A';
    let d;
    if (typeof rawDate === 'string') {
        if (!rawDate.endsWith('Z') && !rawDate.includes('+') && !rawDate.includes('T')) {
            d = new Date(rawDate.replace(' ', 'T') + 'Z');
        } else if (!rawDate.endsWith('Z') && !rawDate.includes('+')) {
            d = new Date(rawDate + 'Z');
        } else {
            d = new Date(rawDate);
        }
    } else {
        d = new Date(rawDate);
    }

    if (isNaN(d.getTime())) return String(rawDate);

    return d.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }) + ' PKT';
}

// 5. Vendor Logo Storage URL Resolver
function getVendorLogoUrl(filePath) {
    if (!filePath) return '../Icons/App Icon.png';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    return `${PUBLIC_STORAGE_BASE}${cleanPath}`;
}

// 6. Global Auth & 1-Hour Session Guard + Direct Iframe Access Enforcer
async function checkAuthAndSession(options = { allowDirect: false }) {
    const adminUser = localStorage.getItem('supabase_admin_user');
    const loginTime = localStorage.getItem('supabase_login_time');
    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 Hour (60 minutes) in milliseconds

    const isInsideViewsDir = window.location.pathname.includes('/Views/');
    const loginPageUrl = isInsideViewsDir ? 'login.html' : 'Views/login.html';
    const portalPageUrl = isInsideViewsDir ? 'admin_portal.html' : 'Views/admin_portal.html';

    // A. Check Session Expiry (1 Hour)
    if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime, 10);
        if (elapsed > ONE_HOUR_MS) {
            console.warn('Session expired (exceeded 1 hour). Redirecting to login...');
            localStorage.removeItem('supabase_admin_user');
            localStorage.removeItem('supabase_login_time');
            try {
                if (window.sbClient) await window.sbClient.auth.signOut();
            } catch (e) {}

            if (window.top && window.top !== window.self) {
                window.top.location.href = loginPageUrl + '?expired=1';
            } else {
                window.location.href = loginPageUrl + '?expired=1';
            }
            return false;
        }
    }

    // B. Check Auth Status
    if (!adminUser) {
        if (window.top && window.top !== window.self) {
            window.top.location.href = loginPageUrl;
        } else {
            window.location.href = loginPageUrl;
        }
        return false;
    }

    // C. Direct Access Guard (Prevent sub-pages from opening directly in address bar)
    if (!options.allowDirect && window.self === window.top) {
        console.warn('Direct sub-page access detected. Redirecting to Portal Shell...');
        window.location.href = portalPageUrl + window.location.search;
        return false;
    }

    return true;
}

// Auto-run Supabase Init when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseClient);
} else {
    initSupabaseClient();
}
