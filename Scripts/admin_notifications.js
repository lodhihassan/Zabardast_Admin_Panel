/**
 * Notification Management Center Controller
 */

let allLogs = [];
let allStudents = [];
let currentFilteredLogs = [];
let currentPage = 1;
const PAGE_SIZE = 10;

const typeMeta = {
    'V':   { label: '✅ Verified', class: 'type-V' },
    'R':   { label: '❌ Rejected', class: 'type-R' },
    'W':   { label: '👋 Welcome', class: 'type-W' },
    'ND':  { label: '🎁 New Deal', class: 'type-ND' },
    'ED':  { label: '⏰ Ending Soon', class: 'type-ED' },
    'RJ':  { label: '🤝 Referral Joined', class: 'type-RJ' },
    'RV':  { label: '🎉 Referral Verified', class: 'type-RV' },
    'RU':  { label: '🏆 Reward Unlocked', class: 'type-RU' },
    'SYS': { label: '📢 Announcement', class: 'type-SYS' }
};

async function fetchNotificationsData(silent = false) {
    try {
        const [usersRes, profilesRes] = await Promise.all([
            window.sbClient.from('users_t').select('user_id, email'),
            window.sbClient.from('student_profiles_t').select('user_id, full_name, phone_number')
        ]);

        const users = usersRes.data || [];
        const profiles = profilesRes.data || [];

        const userEmailMap = new Map(users.map(u => [u.user_id, u.email]));

        const studentMap = new Map();
        profiles.forEach(p => {
            studentMap.set(p.user_id, {
                full_name: p.full_name || 'Student User',
                email: userEmailMap.get(p.user_id) || 'N/A',
                phone: p.phone_number || 'N/A'
            });
        });

        allStudents = Array.from(studentMap.entries()).map(([uid, info]) => ({
            user_id: uid,
            ...info
        }));

        populateStudentDropdown();

        const { data: personalNotifs, error: pErr } = await window.sbClient
            .from('user_notifications_t')
            .select('*')
            .order('created_date', { ascending: false });

        if (pErr) console.warn('user_notifications_t fetch warning:', pErr);

        let globalNotifs = [];
        let readGlobalLogs = [];

        try {
            const { data: gData } = await window.sbClient
                .from('global_notifications_t')
                .select('*')
                .order('created_date', { ascending: false });
            globalNotifs = gData || [];

            const { data: rData } = await window.sbClient
                .from('user_read_global_notifications_t')
                .select('*');
            readGlobalLogs = rData || [];
        } catch (gErr) {
            console.warn('Global notifications table not ready yet:', gErr);
        }

        const readSet = new Set((readGlobalLogs || []).map(r => `${r.user_id}_${r.notification_id}`));

        const combinedLogs = [];

        (personalNotifs || []).forEach(n => {
            if (studentMap.has(n.user_id)) {
                const st = studentMap.get(n.user_id);
                combinedLogs.push({
                    id: n.notification_id,
                    user_id: n.user_id,
                    student_name: st.full_name,
                    student_email: st.email,
                    type: n.notification_type,
                    title: n.title,
                    body: n.body,
                    is_read: !!n.is_read,
                    is_global: false,
                    created_date: n.created_date
                });
            }
        });

        (globalNotifs || []).forEach(gn => {
            allStudents.forEach(st => {
                const isRead = readSet.has(`${st.user_id}_${gn.notification_id}`);
                combinedLogs.push({
                    id: `${gn.notification_id}_${st.user_id}`,
                    user_id: st.user_id,
                    student_name: st.full_name,
                    student_email: st.email,
                    type: gn.notification_type,
                    title: gn.title,
                    body: gn.body,
                    is_read: isRead,
                    is_global: true,
                    created_date: gn.created_date
                });
            });
        });

        allLogs = combinedLogs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        lastFetchedCount = allLogs.length;

        updateKPIs();
        applyFilters();

    } catch (err) {
        console.error('Error fetching notifications:', err);
        showToast(`❌ Failed to load notifications: ${err.message}`, 'danger');
    }
}

function updateKPIs() {
    const total = allLogs.length;
    const read = allLogs.filter(l => l.is_read).length;
    const unread = total - read;
    const students = allStudents.length;

    const kTot = document.getElementById('kpiTotal');
    if (kTot) kTot.textContent = total;
    const kRed = document.getElementById('kpiRead');
    if (kRed) kRed.textContent = read;
    const kUnr = document.getElementById('kpiUnread');
    if (kUnr) kUnr.textContent = unread;
    const kStu = document.getElementById('kpiStudents');
    if (kStu) kStu.textContent = students;
}

function applyFilters() {
    const sEl = document.getElementById('searchStudent');
    const q = (sEl ? sEl.value : '').toLowerCase().trim();
    const tEl = document.getElementById('filterType');
    const typeFilter = tEl ? tEl.value : 'ALL';
    const stEl = document.getElementById('filterStatus');
    const statusFilter = stEl ? stEl.value : 'ALL';
    const dEl = document.getElementById('filterDate');
    const dateFilter = dEl ? dEl.value : '';

    currentFilteredLogs = allLogs.filter(l => {
        if (q) {
            const nameMatch = (l.student_name || '').toLowerCase().includes(q);
            const emailMatch = (l.student_email || '').toLowerCase().includes(q);
            const titleMatch = (l.title || '').toLowerCase().includes(q);
            if (!nameMatch && !emailMatch && !titleMatch) return false;
        }

        if (typeFilter !== 'ALL' && l.type !== typeFilter) {
            return false;
        }

        if (statusFilter === 'READ' && !l.is_read) return false;
        if (statusFilter === 'UNREAD' && l.is_read) return false;

        if (dateFilter) {
            const logDate = new Date(l.created_date).toISOString().split('T')[0];
            if (logDate !== dateFilter) return false;
        }

        return true;
    });

    currentPage = 1;
    renderCurrentPage();
}

function renderCurrentPage() {
    const totalCount = currentFilteredLogs.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalCount);

    const pageLogs = currentFilteredLogs.slice(startIdx, endIdx);

    const rangeText = totalCount === 0 ? 'Showing 0 logs' : `Showing ${startIdx + 1}-${endIdx} of ${totalCount} logs`;
    const lbl = document.getElementById('logsCountLabel');
    if (lbl) lbl.textContent = rangeText;
    const pInfo = document.getElementById('paginationInfo');
    if (pInfo) pInfo.textContent = rangeText;

    const btnP = document.getElementById('btnPrevPage');
    if (btnP) btnP.disabled = currentPage <= 1;
    const btnN = document.getElementById('btnNextPage');
    if (btnN) btnN.disabled = currentPage >= totalPages;

    renderPageNumbers(totalPages);
    renderTable(pageLogs);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageNumbers');
    if (!container) return;
    let html = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button type="button" class="btn-page-num ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

function changePage(delta) {
    currentPage += delta;
    renderCurrentPage();
}

function goToPage(page) {
    currentPage = page;
    renderCurrentPage();
}

function formatLocalDateTime(rawDate) {
    return formatPKTDate(rawDate);
}

function renderTable(logs) {
    const tbody = document.getElementById('notificationsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
                        <h3>No notification logs found</h3>
                        <p style="font-size: 13px; margin-top: 4px;">Try adjusting your search filters.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(l => {
        const initial = (l.student_name || 'S').charAt(0).toUpperCase();
        const meta = typeMeta[l.type] || { label: l.type, class: 'type-SYS' };
        const dateStr = formatLocalDateTime(l.created_date);

        const readBadge = l.is_read 
            ? `<span class="status-badge read">✅ Read</span>` 
            : `<span class="status-badge unread">📩 Unread</span>`;

        const globalTag = l.is_global ? `<span class="global-badge">GLOBAL</span>` : '';

        return `
            <tr>
                <td>
                    <div class="student-cell">
                        <div class="avatar-circle">${initial}</div>
                        <div class="student-meta">
                            <h4>${l.student_name}</h4>
                            <p>${l.student_email}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="type-pill ${meta.class}">${meta.label}</span>
                    ${globalTag}
                </td>
                <td>
                    <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${l.title}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${l.body}</div>
                </td>
                <td>${readBadge}</td>
                <td style="font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap;">${dateStr}</td>
            </tr>
        `;
    }).join('');
}

function openSendModal() {
    const modal = document.getElementById('sendModal');
    if (modal) modal.classList.add('active');
}

function closeSendModal() {
    const modal = document.getElementById('sendModal');
    if (modal) modal.classList.remove('active');
}

function toggleStudentSelect() {
    const aud = document.getElementById('targetAudience').value;
    const grp = document.getElementById('specificStudentGroup');
    if (grp) grp.style.display = aud === 'SPECIFIC' ? 'flex' : 'none';
}

function populateStudentDropdown() {
    const sel = document.getElementById('specificStudentSelect');
    if (!sel) return;
    sel.innerHTML = allStudents.map(s => `
        <option value="${s.user_id}">${s.full_name} (${s.email})</option>
    `).join('');
}

async function handleSendCustomNotif(e) {
    e.preventDefault();
    const aud = document.getElementById('targetAudience').value;
    const type = document.getElementById('customType').value;
    const title = document.getElementById('customTitle').value.trim();
    const body = document.getElementById('customBody').value.trim();

    try {
        if (aud === 'ALL') {
            const { error } = await window.sbClient
                .from('global_notifications_t')
                .insert({
                    notification_type: type,
                    title: title,
                    body: body,
                    is_active: true,
                    created_by: getCleanAdminUser()
                });

            if (error) throw error;
            showToast('🎉 Global notification dispatched to ALL students!', 'success');
        } else {
            const targetUserId = document.getElementById('specificStudentSelect').value;
            const { error } = await window.sbClient
                .from('user_notifications_t')
                .insert({
                    user_id: targetUserId,
                    notification_type: type,
                    title: title,
                    body: body,
                    is_read: false
                });

            if (error) throw error;
            showToast('🎉 Custom notification sent to student!', 'success');
        }

        closeSendModal();
        document.getElementById('customNotifForm').reset();
        await fetchNotificationsData();

    } catch (err) {
        console.error('Send error:', err);
        showToast(`❌ Failed to send notification: ${err.message}`, 'danger');
    }
}

let realtimeChannel = null;
let refreshDebounceTimer = null;
let pollingInterval = null;
let lastFetchedCount = 0;

function setupAutoRefresh() {
    if (realtimeChannel) window.sbClient.removeChannel(realtimeChannel);

    realtimeChannel = window.sbClient
        .channel('admin-notif-live-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_notifications_t' },
            () => debouncedRefresh('📩 New personal notification!'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_notifications_t' },
            () => debouncedRefresh('📢 New global broadcast!'))
        .subscribe((status) => {
            const dot = document.getElementById('realtimeDot');
            if (status === 'SUBSCRIBED') {
                if (dot) { dot.style.background = '#10b981'; dot.title = 'Live: Realtime connected'; }
            } else {
                if (dot) { dot.style.background = '#f59e0b'; dot.title = 'Live: Polling mode (30s)'; }
            }
        });

    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        const prevCount = lastFetchedCount;
        await fetchNotificationsData(true);
        if (lastFetchedCount > prevCount) {
            showToast('📩 New notifications loaded!', 'success');
        }
    }, 30000);
}

function debouncedRefresh(toastMsg) {
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(async () => {
        await fetchNotificationsData();
        showToast(toastMsg, 'success');
    }, 800);
}

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    await fetchNotificationsData();
    setupAutoRefresh();
});

