/**
 * Student Verification Manager Controller
 */

const STORAGE_BUCKET = 'Student_Verification';

let allVerifications = [];
let activeStatusFilter = 'ALL';
let searchQuery = '';

function getAdminName() {
    return getCleanAdminUser();
}

async function fetchVerificationRequests() {
    const grid = document.getElementById('requestsGrid');

    try {
        const [profilesRes, verifRes, usersRes, filesRes, instsRes, campsRes] = await Promise.all([
            window.sbClient.from('student_profiles_t').select('*').order('student_id', { ascending: false }),
            window.sbClient.from('student_verifications_t').select('*'),
            window.sbClient.from('users_t').select('*'),
            window.sbClient.from('uploaded_files_t').select('*'),
            window.sbClient.from('institutes_t').select('*'),
            window.sbClient.from('institute_campuses_t').select('*')
        ]);

        if (profilesRes.error) throw profilesRes.error;

        const profiles = profilesRes.data || [];
        const verifications = verifRes.data || [];
        const users = usersRes.data || [];
        const files = filesRes.data || [];
        const institutes = instsRes.data || [];
        const campuses = campsRes.data || [];

        const verifMap = new Map(verifications.map(v => [v.user_id, v]));
        const userMap = new Map(users.map(u => [u.user_id, u]));
        const fileMap = new Map();
        files.forEach(f => {
            if (f && f.file_id) {
                fileMap.set(String(f.file_id).toLowerCase().trim(), f);
            }
        });
        const instMap = new Map(institutes.map(i => [i.institute_id, i]));
        const campMap = new Map(campuses.map(c => [c.campus_id, c]));

        const getPublicUrl = (fileObj) => {
            if (!fileObj || !fileObj.file_path) return null;
            let path = fileObj.file_path.trim();
            if (path.startsWith('http://') || path.startsWith('https://')) return path;

            if (path.startsWith('/')) path = path.substring(1);

            const knownBuckets = ['Student_Verification', 'Vendor_Logos', 'Deals', 'categories', 'products'];
            const hasBucketPrefix = knownBuckets.some(b => path.toLowerCase().startsWith(b.toLowerCase() + '/'));

            if (!hasBucketPrefix) {
                path = `${STORAGE_BUCKET}/${path}`;
            }
            return getVendorLogoUrl(path);
        };

        allVerifications = profiles.map(prof => {
            const verif = verifMap.get(prof.user_id) || {};
            const usr = userMap.get(prof.user_id) || {};

            const cardFileId = verif.student_card_file_id || prof.student_card_file_id || null;
            const cnicFileId = verif.cnic_card_file_id || prof.cnic_card_file_id || null;

            const cardFile = cardFileId ? fileMap.get(String(cardFileId).toLowerCase().trim()) : null;
            const cnicFile = cnicFileId ? fileMap.get(String(cnicFileId).toLowerCase().trim()) : null;
            const inst = instMap.get(prof.institute_id);
            const camp = campMap.get(prof.campus_id);

            let status = 'P';
            if (prof.is_verified) {
                status = 'A';
            } else if (verif.status === 'R') {
                status = 'R';
            } else {
                status = 'P';
            }

            return {
                verification_id: verif.verification_id || null,
                student_id: prof.student_id,
                user_id: prof.user_id,
                status: status,
                is_verified: !!prof.is_verified,
                created_date: verif.created_date || prof.created_date,
                student_profile: prof,
                user: usr,
                student_card_url: getPublicUrl(cardFile),
                cnic_card_url: getPublicUrl(cnicFile),
                institute_name: inst ? inst.name : 'N/A',
                campus_name: camp ? camp.campus_name : 'N/A',
                has_docs: !!(cardFile || cnicFile)
            };
        });

        updateKPIs();
        renderCards();

    } catch (err) {
        console.error('Fetch error:', err);
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 36px; color: var(--danger); margin-bottom: 8px;">❌</div>
                    <h3>Failed to load student profiles</h3>
                    <p style="font-size: 13px; margin-top: 4px;">${err.message}</p>
                </div>
            `;
        }
    }
}

function updateKPIs() {
    const kTot = document.getElementById('kpiTotal');
    if (kTot) kTot.textContent = allVerifications.length;
    const kPen = document.getElementById('kpiPending');
    if (kPen) kPen.textContent = allVerifications.filter(v => v.status === 'P').length;
    const kApp = document.getElementById('kpiApproved');
    if (kApp) kApp.textContent = allVerifications.filter(v => v.status === 'A').length;
    const kRej = document.getElementById('kpiRejected');
    if (kRej) kRej.textContent = allVerifications.filter(v => v.status === 'R').length;
}

function renderCards() {
    const grid = document.getElementById('requestsGrid');
    if (!grid) return;

    let filtered = allVerifications.filter(v => {
        if (activeStatusFilter === 'P' && v.status !== 'P') return false;
        if (activeStatusFilter === 'A' && v.status !== 'A') return false;
        if (activeStatusFilter === 'R' && v.status !== 'R') return false;

        if (searchQuery) {
            const name = (v.student_profile.full_name || '').toLowerCase();
            const email = (v.user.email || '').toLowerCase();
            const phone = (v.student_profile.phone_number || '').toLowerCase();
            const ref = (v.student_profile.referral_code || '').toLowerCase();
            const q = searchQuery.toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || ref.includes(q);
        }

        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
                <h3>No student profiles found</h3>
                <p style="font-size: 13px; margin-top: 4px;">Try adjusting your status filter or search query.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(v => {
        const name = v.student_profile.full_name || 'Student';
        const safeName = name.replace(/'/g, "\\'");
        const safeCardUrl = (v.student_card_url || '').replace(/'/g, "\\'");
        const safeCnicUrl = (v.cnic_card_url || '').replace(/'/g, "\\'");
        const initial = name.charAt(0).toUpperCase();
        const status = v.status;
        const statusLabel = status === 'A' ? '✅ Verified' : (status === 'R' ? '❌ Rejected' : '⏳ Pending');
        const dateStr = v.created_date ? new Date(v.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

        const reqIdText = `🆔 Student #${v.student_id || v.verification_id}`;

        let actionButtonsHtml = '';
        if (status === 'A') {
            actionButtonsHtml = `
                <button type="button" class="btn-action btn-reject" style="grid-column: 1 / -1;" onclick="updateVerificationStatus('${v.user_id}', ${v.verification_id}, 'R')">
                    ❌ Reject Request
                </button>
            `;
        } else if (status === 'R') {
            actionButtonsHtml = `
                <button type="button" class="btn-action btn-accept" style="grid-column: 1 / -1;" onclick="updateVerificationStatus('${v.user_id}', ${v.verification_id}, 'A')">
                    ✅ Accept & Verify
                </button>
            `;
        } else {
            actionButtonsHtml = `
                <button type="button" class="btn-action btn-accept" onclick="updateVerificationStatus('${v.user_id}', ${v.verification_id}, 'A')">
                    ✅ Accept & Verify
                </button>
                <button type="button" class="btn-action btn-reject" onclick="updateVerificationStatus('${v.user_id}', ${v.verification_id}, 'R')">
                    ❌ Reject Request
                </button>
            `;
        }

        return `
        <div class="verification-card">
            <div>
                <div class="card-top">
                    <div class="student-profile-group">
                        <div class="avatar-circle">${initial}</div>
                        <div class="student-info">
                            <h3>${name}</h3>
                            <span class="req-id-badge">${reqIdText}</span>
                        </div>
                    </div>
                    <span class="status-pill status-${status}">${statusLabel}</span>
                </div>

                <div class="meta-list">
                    <div class="meta-row">
                        <span class="meta-label">✉️ Email:</span>
                        <span class="meta-val">${v.user.email || 'N/A'}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">📞 Phone:</span>
                        <span class="meta-val">${v.student_profile.phone_number || 'N/A'}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">🏫 Institute:</span>
                        <span class="meta-val">${v.institute_name} (${v.campus_name})</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">🏷️ Referral Code:</span>
                        <span class="meta-val">${v.student_profile.referral_code || 'N/A'}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">📅 Date Registered:</span>
                        <span class="meta-val">${dateStr}</span>
                    </div>
                </div>

                <div class="documents-section">
                    <div class="docs-header">🪪 Verification Documents</div>
                    ${v.has_docs ? `
                    <div class="docs-grid">
                        ${v.student_card_url ? `
                        <div class="doc-thumb-card">
                            <img src="${v.student_card_url}" class="doc-thumb-img" alt="Student Card" onerror="this.onerror=null; this.src='../Icons/App Icon.png';" onclick="openDocModal('${safeCardUrl}', 'Student ID Card - ${safeName}')">
                            <span class="doc-label">📄 Student Card</span>
                            <button type="button" class="btn-view-doc" onclick="openDocModal('${safeCardUrl}', 'Student ID Card - ${safeName}')">🔍 Inspect Card</button>
                        </div>
                        ` : ''}
                        ${v.cnic_card_url ? `
                        <div class="doc-thumb-card">
                            <img src="${v.cnic_card_url}" class="doc-thumb-img" alt="CNIC Card" onerror="this.onerror=null; this.src='../Icons/App Icon.png';" onclick="openDocModal('${safeCnicUrl}', 'CNIC Front - ${safeName}')">
                            <span class="doc-label">🪪 CNIC Front</span>
                            <button type="button" class="btn-view-doc" onclick="openDocModal('${safeCnicUrl}', 'CNIC Front - ${safeName}')">🔍 Inspect CNIC</button>
                        </div>
                        ` : ''}
                    </div>
                    ` : `
                    <div class="no-docs-badge">
                        ⚠️ No verification documents uploaded yet by student
                    </div>
                    `}
                </div>
            </div>

            <div class="card-actions">
                ${actionButtonsHtml}
            </div>
        </div>
        `;
    }).join('');
}

async function updateVerificationStatus(userId, verificationId, targetStatus) {
    const adminName = getAdminName();
    const nowIso = getPKTISOString();
    const isApprove = targetStatus === 'A';

    if (!confirm(`Are you sure you want to ${isApprove ? 'ACCEPT' : 'REJECT'} this student profile?`)) {
        return;
    }

    try {
        if (verificationId) {
            const { error: verifErr } = await window.sbClient
                .from('student_verifications_t')
                .update({
                    status: targetStatus,
                    updated_by: adminName,
                    update_date: nowIso
                })
                .eq('verification_id', verificationId);

            if (verifErr) throw verifErr;

        } else if (isApprove) {
            showToast('❌ Cannot approve: Student has not uploaded any verification documents yet.', 'danger', 10000);
            return;
        }

        const profileUpdate = {
            is_verified: isApprove,
            is_active: isApprove,
            updated_by: adminName,
            update_date: nowIso
        };

        const { error: profErr } = await window.sbClient
            .from('student_profiles_t')
            .update(profileUpdate)
            .eq('user_id', userId);

        if (profErr) throw profErr;

        await window.sbClient
            .from('users_t')
            .update({ is_active: isApprove })
            .eq('user_id', userId);

        showToast(
            isApprove ? '🎉 Student Profile Accepted' : '⚠️ Student Profile Rejected',
            isApprove ? 'success' : 'danger',
            10000
        );

        await fetchVerificationRequests();

    } catch (err) {
        console.error('Update error:', err);
        showToast(`❌ Action Failed: ${err.message}`, 'danger', 10000);
    }
}

function filterByStatus(status, btnElement) {
    activeStatusFilter = status;
    document.querySelectorAll('.filter-tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    renderCards();
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.trim();
    renderCards();
}

function openDocModal(imgUrl, title) {
    const modalImg = document.getElementById('modalImg');
    if (modalImg) modalImg.src = imgUrl;
    const modalTitle = document.getElementById('modalDocTitle');
    if (modalTitle) modalTitle.textContent = title;
    const docModal = document.getElementById('docModal');
    if (docModal) docModal.classList.add('active');
}

function closeDocModal() {
    const docModal = document.getElementById('docModal');
    if (docModal) docModal.classList.remove('active');
}

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    fetchVerificationRequests();
});
