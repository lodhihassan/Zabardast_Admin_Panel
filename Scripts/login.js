/**
 * Login & Auth Controller
 */

let currentAuthMode = 'signin';

window.addEventListener('DOMContentLoaded', async () => {
    await loadAuthRoles();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === '1') {
        showGateAlert('⚠️ Session expired after 1 hour. Please sign in again.', 'warning');
    }

    const loginForm = document.getElementById('loginGateForm');
    if (loginForm) loginForm.addEventListener('submit', handleSignInSubmit);

    const signupForm = document.getElementById('signupGateForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignUpSubmit);
});

// ── Auth Mode Toggle ──
function switchAuthMode(mode) {
    currentAuthMode = mode;
    const signinForm = document.getElementById('loginGateForm');
    const signupForm = document.getElementById('signupGateForm');
    const tabSignin = document.getElementById('btnTabSignin');
    const tabSignup = document.getElementById('btnTabSignup');
    const title = document.getElementById('gateTitle');
    const subtitle = document.getElementById('gateSubtitle');
    const footerBtn = document.getElementById('btnAuthFooterToggle');

    if (mode === 'signin') {
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
        if (tabSignin) tabSignin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
        if (title) title.textContent = 'Admin Suite';
        if (subtitle) subtitle.textContent = 'Enter your credentials to access Admin Dashboard';
        if (footerBtn) {
            footerBtn.textContent = '📝 Need an Account? Sign Up Here';
            footerBtn.onclick = () => switchAuthMode('signup');
        }
    } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
        if (tabSignin) tabSignin.classList.remove('active');
        if (tabSignup) tabSignup.classList.add('active');
        if (title) title.textContent = 'Create New Account';
        if (subtitle) subtitle.textContent = 'Register a new Admin, Student, or Vendor user';
        if (footerBtn) {
            footerBtn.textContent = '🔑 Already Registered? Sign In Here';
            footerBtn.onclick = () => switchAuthMode('signin');
        }
    }
}

// ── Load Roles ──
async function loadAuthRoles() {
    const roleSelect = document.getElementById('gateSignupRole');
    if (!roleSelect) return;
    try {
        const { data: roles, error } = await window.sbClient
            .from('roles_t')
            .select('role_id, role_name, role_code, is_active')
            .eq('is_active', true)
            .order('role_id');

        if (error || !roles || roles.length === 0) {
            roleSelect.innerHTML = `
                <option value="">-- Select Role --</option>
                <option value="A">Admin</option>
                <option value="V">Vendor</option>
                <option value="S">Student</option>`;
            return;
        }
        roleSelect.innerHTML = `<option value="">-- Select Role --</option>` +
            roles.map(r => `<option value="${r.role_code}">${r.role_name}</option>`).join('');
    } catch (err) {
        console.error('Error loading roles:', err);
        roleSelect.innerHTML = `
            <option value="">-- Select Role --</option>
            <option value="A">Admin</option>
            <option value="V">Vendor</option>
            <option value="S">Student</option>`;
    }
}

// ── Alert Helper ──
function showGateAlert(msg, type) {
    const alertBox = document.getElementById('gateAlert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = `alert-box ${type}`;
    alertBox.style.display = 'block';
    setTimeout(() => { alertBox.style.display = 'none'; }, 6000);
}

// ══ SIGN IN SUBMIT ══
async function handleSignInSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('gateEmail').value.trim();
    const password = document.getElementById('gatePassword').value.trim();
    const btn = document.getElementById('btnGateSubmit');

    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    try {
        const { data, error } = await window.sbClient.auth.signInWithPassword({ email, password });
        if (error) {
            showGateAlert(`❌ Invalid Credentials: ${error.message}`, 'error');
            return;
        }

        if (data && data.user) {
            const userMeta = data.user.user_metadata || {};
            const appMeta = data.user.app_metadata || {};

            let uData = null;
            let vuData = null;

            try {
                const { data: userData } = await window.sbClient
                    .from('users_t')
                    .select('*')
                    .eq('user_id', data.user.id)
                    .maybeSingle();
                uData = userData;
            } catch (err) {
                console.warn('users_t query warning:', err);
            }

            try {
                const { data: vendorUserData } = await window.sbClient
                    .from('vendor_users_t')
                    .select('*, vendors_t(name, logo_file_id, logo_file:uploaded_files_t!logo_file_id(file_path)), branches_t(branch_name)')
                    .eq('user_id', data.user.id)
                    .maybeSingle();
                vuData = vendorUserData;
            } catch (err) {
                console.warn('vendor_users_t query warning:', err);
            }

            let roleCode = null;
            let roleName = null;
            let roleId = null;

            // 1. Resolve from vendor_users_t (if mapped as vendor/branch cashier/admin)
            if (vuData) {
                roleCode = vuData.branch_id ? 'BV' : 'V';
                roleName = vuData.branch_id ? 'Branch Vendor' : 'Main Vendor';
                roleId = vuData.branch_id ? 4 : 2;
            }

            // 2. Resolve from users_t and roles_t
            if (uData) {
                if (uData.role_id) {
                    roleId = uData.role_id;
                    try {
                        const { data: rData } = await window.sbClient
                            .from('roles_t')
                            .select('role_code, role_name')
                            .eq('role_id', uData.role_id)
                            .maybeSingle();
                        if (rData) {
                            roleCode = rData.role_code;
                            roleName = rData.role_name;
                        }
                    } catch (e) {
                        console.warn('roles_t query warning:', e);
                    }

                    if (!roleCode) {
                        if (uData.role_id == 1 || uData.role_id === '1') {
                            roleCode = 'A';
                            roleName = 'System Admin';
                        } else if (uData.role_id == 2 || uData.role_id === '2') {
                            roleCode = 'V';
                            roleName = 'Main Vendor';
                        } else if (uData.role_id == 4 || uData.role_id === '4') {
                            roleCode = 'BV';
                            roleName = 'Branch Vendor';
                        } else if (uData.role_id == 3 || uData.role_id === '3') {
                            roleCode = 'S';
                            roleName = 'Student';
                        }
                    }
                }
                if (!roleCode && uData.role_code) roleCode = uData.role_code.toUpperCase();
            }

            // 3. Fallback to Supabase Auth user_metadata and app_metadata
            const metaRoleCode = (
                userMeta.role_code ||
                userMeta.role ||
                appMeta.role_code ||
                appMeta.role ||
                ''
            ).toString().trim().toUpperCase();

            const metaRoleId = userMeta.role_id || appMeta.role_id;

            if (!roleCode) {
                if (metaRoleCode === 'A' || metaRoleCode === 'ADMIN' || metaRoleId == 1 || metaRoleId === '1') {
                    roleCode = 'A';
                    roleName = 'System Admin';
                    roleId = 1;
                } else if (
                    metaRoleCode === 'V' ||
                    metaRoleCode === 'VM' ||
                    metaRoleCode === 'VENDOR' ||
                    metaRoleCode === 'MAIN VENDOR' ||
                    metaRoleId == 2 ||
                    metaRoleId === '2'
                ) {
                    roleCode = 'V';
                    roleName = 'Main Vendor';
                    roleId = 2;
                } else if (
                    metaRoleCode === 'BV' ||
                    metaRoleCode === 'BRANCH VENDOR' ||
                    metaRoleId == 4 ||
                    metaRoleId === '4'
                ) {
                    roleCode = 'BV';
                    roleName = 'Branch Vendor';
                    roleId = 4;
                } else if (
                    metaRoleCode === 'S' ||
                    metaRoleCode === 'STUDENT' ||
                    metaRoleId == 3 ||
                    metaRoleId === '3'
                ) {
                    roleCode = 'S';
                    roleName = 'Student';
                    roleId = 3;
                } else if (metaRoleCode) {
                    roleCode = metaRoleCode;
                    roleName = userMeta.role_name || metaRoleCode;
                }
            }

            // Final fallback for roleName
            if (!roleName) {
                if (roleCode === 'A' || roleCode === 'ADMIN') roleName = 'System Admin';
                else if (roleCode === 'V' || roleCode === 'VM' || roleCode === 'VENDOR') roleName = 'Main Vendor';
                else if (roleCode === 'BV') roleName = 'Branch Vendor';
                else if (roleCode === 'S' || roleCode === 'STUDENT') roleName = 'Student';
                else roleName = 'User';
            }

            // Authorization checks
            const isAdmin = Boolean(
                roleCode === 'A' ||
                roleCode === 'ADMIN' ||
                (uData && (uData.role_id == 1 || uData.role_id === '1')) ||
                (metaRoleId == 1 || metaRoleId === '1') ||
                metaRoleCode === 'A' ||
                metaRoleCode === 'ADMIN'
            );

            const isBranchVendor = Boolean(
                roleCode === 'BV' ||
                metaRoleCode === 'BV' ||
                metaRoleId == 4 ||
                (vuData && vuData.branch_id !== null && vuData.branch_id !== undefined) ||
                (uData && (uData.role_id == 4 || uData.role_id === '4'))
            );

            const isMainVendor = !isBranchVendor && Boolean(
                roleCode === 'V' ||
                roleCode === 'VM' ||
                roleCode === 'VENDOR' ||
                metaRoleCode === 'V' ||
                metaRoleCode === 'VM' ||
                metaRoleCode === 'VENDOR' ||
                metaRoleId == 2 ||
                (vuData && (vuData.branch_id === null || vuData.branch_id === undefined)) ||
                (uData && (uData.role_id == 2 || uData.role_id === '2'))
            );

            if (isBranchVendor) {
                await window.sbClient.auth.signOut();
                localStorage.removeItem('supabase_admin_user');
                showGateAlert(`🚫 Access Denied: Branch Vendor accounts cannot access this portal. Only Main Vendor and Admin accounts are permitted.`, 'error');
                return;
            }

            if (!isAdmin && !isMainVendor) {
                await window.sbClient.auth.signOut();
                localStorage.removeItem('supabase_admin_user');
                showGateAlert(`🚫 Access Denied: Only Admin and Main Vendor accounts can log in. Your role: ${roleName || 'User'}`, 'error');
                return;
            }

            // Background upsert to users_t to ensure record continuity if table is writable
            if (!uData && (isAdmin || isMainVendor)) {
                try {
                    await window.sbClient.from('users_t').upsert({
                        user_id: data.user.id,
                        email: data.user.email,
                        role_id: isAdmin ? 1 : 2,
                        is_active: true
                    }, { onConflict: 'user_id' });
                } catch (ignore) {}
            }

            let userDisplayName = vuData?.full_name || uData?.full_name || userMeta.full_name || userMeta.name || '';
            if (!userDisplayName || userDisplayName.includes('@')) {
                const emailStr = data.user.email || '';
                const prefix = emailStr.split('@')[0] || 'User';
                userDisplayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }

            let vendorLogoUrl = null;
            if (vuData?.vendors_t?.logo_file?.file_path) {
                vendorLogoUrl = getVendorLogoUrl(vuData.vendors_t.logo_file.file_path);
            }

            const sessionObj = {
                user_id: data.user.id,
                email: data.user.email,
                full_name: userDisplayName,
                role_id: uData?.role_id || roleId || (isAdmin ? 1 : 2),
                role_code: isAdmin ? 'A' : (roleCode || 'V'),
                role_name: isAdmin ? 'System Admin' : (roleName || 'Main Vendor'),
                vendor_id: vuData?.vendor_id || userMeta.vendor_id || null,
                vendor_name: vuData?.vendors_t?.name || userMeta.vendor_name || null,
                vendor_logo_url: vendorLogoUrl,
                branch_id: vuData?.branch_id || userMeta.branch_id || null,
                branch_name: vuData?.branches_t?.branch_name || userMeta.branch_name || null,
                vendor_role: vuData?.vendor_role || userMeta.vendor_role || null
            };

            localStorage.setItem('supabase_admin_user', JSON.stringify(sessionObj));
            localStorage.setItem('supabase_login_time', Date.now().toString());

            showGateAlert(`✅ Welcome ${userDisplayName}! Redirecting...`, 'success');
            setTimeout(() => {
                window.location.href = 'admin_portal.html';
            }, 700);
        } else {
            showGateAlert('❌ Authentication failed. Please check your credentials.', 'error');
        }
    } catch (err) {
        showGateAlert(`❌ Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In to Portal';
    }
}

// ══ SIGN UP SUBMIT ══
async function handleSignUpSubmit(e) {
    e.preventDefault();

    const roleCode = document.getElementById('gateSignupRole').value;
    const fullName = document.getElementById('gateSignupFullName').value.trim();
    const email = document.getElementById('gateSignupEmail').value.trim().toLowerCase();
    const phone = document.getElementById('gateSignupPhone').value.trim();
    const password = document.getElementById('gateSignupPassword').value;
    const btn = document.getElementById('btnSignupSubmit');

    if (!roleCode) {
        showGateAlert('Please select a valid user role!', 'error');
        return;
    }
    if (!fullName || !email || !password) {
        showGateAlert('Full Name, Email, and Password are required!', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Registering Account...';

    try {
        // Resolve role_id from roles_t dynamically
        let roleId = null;
        const { data: roleRow } = await window.sbClient
            .from('roles_t')
            .select('role_id')
            .eq('role_code', roleCode)
            .maybeSingle();
        if (roleRow) roleId = roleRow.role_id;

        // Fallback hardcoded values if roles_t query fails
        if (!roleId) {
            if (roleCode === 'A') roleId = 1;
            else if (roleCode === 'V') roleId = 2;
            else if (roleCode === 'S') roleId = 3;
            else if (roleCode === 'BV') roleId = 4;
            else roleId = 3;
        }

        // signUp via Supabase Auth — trigger fn_handle_auth_user_signup fires automatically
        const { data, error } = await window.sbClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    role_code: roleCode,
                    role_id: roleId,
                    full_name: fullName,
                    phone_number: phone,
                    created_by: fullName
                }
            }
        });

        if (error) throw error;

        if (data && data.user) {
            // users_t is inserted by the auth trigger automatically.
            // Only do a safe upsert with valid columns (user_id, email, role_id, is_active).
            try {
                await window.sbClient.from('users_t').upsert({
                    user_id: data.user.id,
                    email: email,
                    role_id: roleId,
                    is_active: true
                }, { onConflict: 'user_id' });
            } catch (upsertErr) {
                console.warn('Post-signup users_t upsert warning:', upsertErr.message);
            }
        }

        showGateAlert('🎉 Account created successfully! You can now sign in.', 'success');
        setTimeout(() => switchAuthMode('signin'), 2000);

    } catch (err) {
        showGateAlert(`❌ Registration Failed: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Register Account';
    }
}


// ── Forgot Password Modal Handlers ──
function openForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').style.display = 'flex';
    resetFpModalToStep1();
    const currentEmail = document.getElementById('gateEmail').value.trim();
    if (currentEmail) document.getElementById('fpEmail').value = currentEmail;
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
}

function resetFpModalToStep1() {
    document.getElementById('fpStep1').style.display = 'block';
    document.getElementById('fpStep2').style.display = 'none';
    document.getElementById('modalAlert').style.display = 'none';
}

function showModalAlert(msg, type) {
    const alertBox = document.getElementById('modalAlert');
    if (!msg) {
        alertBox.style.display = 'none';
        return;
    }
    alertBox.textContent = msg;
    alertBox.className = `alert-box ${type}`;
    alertBox.style.display = 'block';
}

async function handleSendResetOtp() {
    const email = document.getElementById('fpEmail').value.trim();
    if (!email) {
        showModalAlert('Please enter your email address.', 'error');
        return;
    }

    const btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.textContent = '⏳ Sending 6-Digit OTP...';
    showModalAlert('', '');

    try {
        const { data, error } = await window.sbClient.auth.signInWithOtp({
            email: email,
            options: { shouldCreateUser: false }
        });

        if (error) throw error;

        showModalAlert('✅ 6-Digit OTP code sent to your email! Please check your Inbox.', 'success');
        document.getElementById('fpStep1').style.display = 'none';
        document.getElementById('fpStep2').style.display = 'block';
    } catch (err) {
        console.error('Send OTP Error:', err);
        const msg = err.message || 'Failed to send OTP code';
        if (msg.includes('rate limit')) {
            showModalAlert('⚠️ Email Rate Limit Exceeded (Max 3 emails per hour). Please wait 1 hour or check Spam folder.', 'error');
        } else if (msg.includes('Signups not allowed') || msg.includes('User not found') || msg.includes('Invalid email')) {
            showModalAlert('🚫 No account found with this email address in Supabase Auth.', 'error');
        } else {
            showModalAlert(`❌ Error: ${msg}`, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '📩 Send 6-Digit Reset OTP';
    }
}

async function handleVerifyResetOtp() {
    const email = document.getElementById('fpEmail').value.trim();
    const token = document.getElementById('fpOtp').value.trim();
    const newPassword = document.getElementById('fpNewPassword').value.trim();

    if (!token || token.length !== 6) {
        showModalAlert('Please enter a valid 6-digit OTP code.', 'error');
        return;
    }
    if (!newPassword || newPassword.length < 6) {
        showModalAlert('New password must be at least 6 characters.', 'error');
        return;
    }

    const btn = document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.textContent = '⏳ Verifying & Updating...';

    try {
        let { data, error } = await window.sbClient.auth.verifyOtp({
            email: email,
            token: token,
            type: 'recovery'
        });

        if (error) {
            const fallback = await window.sbClient.auth.verifyOtp({
                email: email,
                token: token,
                type: 'email'
            });
            if (fallback.error) throw fallback.error;
            data = fallback.data;
        }

        const { error: updateError } = await window.sbClient.auth.updateUser({
            password: newPassword
        });

        if (updateError) throw updateError;

        showModalAlert('🎉 Password Reset Successful! You can now sign in.', 'success');
        setTimeout(() => {
            closeForgotPasswordModal();
            document.getElementById('gatePassword').value = newPassword;
            document.getElementById('gateEmail').value = email;
            showGateAlert('✅ Password reset complete! Click Sign In to log in.', 'success');
        }, 2000);

    } catch (err) {
        console.error('Verify OTP Error:', err);
        showModalAlert(`❌ ${err.message || 'Invalid OTP code or expired.'}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Verify OTP & Update Password';
    }
}
