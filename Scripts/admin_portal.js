/**
 * Admin Portal Main Controller
 */

let currentSessionUser = null;

// ── Parameter Manager State ──
let currentParamTab = 'hd';
let paramRecords = [];
let selectedParamRecord = null;
let allParamHeaders = [];
let selectedParamHeaderContext = null;

// ── Institute Manager State ──
let currentInstTab = 'inst';
let instRecords = [];
let selectedInstRecord = null;
let allInstitutes = [];
let selectedInstituteContext = null;

function getLoggedInAdminName() {
    return getCleanAdminUser();
}

window.addEventListener('DOMContentLoaded', async () => {
    restoreSidebarState();

    const isAuthorized = await checkAuthAndSession({ allowDirect: true });
    if (!isAuthorized) return;

    const adminUser = localStorage.getItem('supabase_admin_user');
    try { currentSessionUser = JSON.parse(adminUser); } catch (e) { currentSessionUser = { email: adminUser }; }

    const roleCode = currentSessionUser.role_code || 'A';
    const isVendorUser = (roleCode === 'V' || roleCode === 'VM' || roleCode === 'BV' || roleCode === 'VENDOR');

    if (isVendorUser) {
        document.querySelectorAll('.admin-only-nav').forEach(el => el.style.display = 'none');
        
        const vendorId = currentSessionUser.vendor_id;
        let vName = currentSessionUser.vendor_name || 'Vendor';
        let vLogoUrl = currentSessionUser.vendor_logo_url || null;

        if (vendorId && !vLogoUrl) {
            try {
                const { data: vData } = await window.sbClient
                    .from('vendors_t')
                    .select('name, logo_file:uploaded_files_t!logo_file_id(file_path)')
                    .eq('vendor_id', vendorId)
                    .maybeSingle();

                if (vData) {
                    if (vData.name) vName = vData.name;
                    if (vData.logo_file && vData.logo_file.file_path) {
                        vLogoUrl = getVendorLogoUrl(vData.logo_file.file_path);
                    }
                }
            } catch(e) { console.warn('Vendor logo fetch:', e); }
        }

        const brandLogoEl = document.getElementById('sidebarBrandLogo');
        const wordmarkEl = document.getElementById('sidebarWordmark');
        const titleTextEl = document.getElementById('sidebarTitleText');
        const subTitleEl = document.getElementById('sidebarSubTitle');

        if (vLogoUrl && brandLogoEl) {
            brandLogoEl.src = vLogoUrl;
            brandLogoEl.style.objectFit = 'cover';
            brandLogoEl.style.borderRadius = '10px';
        }

        if (wordmarkEl && titleTextEl) {
            wordmarkEl.style.display = 'none';
            titleTextEl.style.display = 'block';
            titleTextEl.textContent = vName;
        }

        if (subTitleEl) {
            subTitleEl.textContent = 'Vendor Portal';
        }

        const roleBadgeText = roleCode === 'BV' ? '🏢 Branch Vendor' : '🏪 Main Vendor';
        document.getElementById('userBadge').textContent = `🟢 ${roleBadgeText}: ${vName}`;
        
        const loggedInUserName = currentSessionUser.full_name || currentSessionUser.email || 'Vendor Staff';
        const userAccEl = document.getElementById('userAccountName');
        if (userAccEl) {
            userAccEl.style.display = 'block';
            userAccEl.textContent = `👤 User: ${loggedInUserName}`;
        }
    } else {
        document.querySelectorAll('.admin-only-nav').forEach(el => el.style.display = 'flex');
        
        const subTitleEl = document.getElementById('sidebarSubTitle');
        if (subTitleEl) subTitleEl.textContent = 'Admin Control Panel';
        
        document.getElementById('userBadge').textContent = `🟢 Admin Control`;
        
        const loggedInUserName = currentSessionUser.full_name || currentSessionUser.email || 'Admin User';
        const userAccEl = document.getElementById('userAccountName');
        if (userAccEl) {
            userAccEl.style.display = 'block';
            userAccEl.textContent = `👤 User: ${loggedInUserName}`;
        }
    }

    const loginGate = document.getElementById('loginGate');
    if (loginGate) loginGate.style.display = 'none';
    const mainDash = document.getElementById('mainDashboard');
    if (mainDash) mainDash.style.display = 'flex';

    showDashboardPage('catalog', document.getElementById('nav-catalog'));

    const paramForm = document.getElementById('paramForm');
    if (paramForm) paramForm.addEventListener('submit', handleParamFormSubmit);

    const instForm = document.getElementById('instForm');
    if (instForm) instForm.addEventListener('submit', handleInstFormSubmit);
});

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');

    if (toggleBtn) {
        toggleBtn.textContent = isCollapsed ? '▶' : '◀';
        toggleBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
    }

    localStorage.setItem('admin_sidebar_collapsed', isCollapsed ? 'true' : 'false');
}

function restoreSidebarState() {
    if (localStorage.getItem('admin_sidebar_collapsed') === 'true') {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        if (sidebar) sidebar.classList.add('collapsed');
        if (toggleBtn) {
            toggleBtn.textContent = '▶';
            toggleBtn.title = 'Expand Sidebar';
        }
    }
}

function handleLogout() {
    localStorage.removeItem('supabase_admin_user');
    window.sbClient.auth.signOut();
    window.location.href = 'login.html';
}

function showDashboardPage(pageId, targetEl) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));

    if (targetEl) {
        targetEl.classList.add('active');
    } else if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    const targetView = document.getElementById(`view-${pageId}`);
    if (targetView) targetView.classList.add('active');

    const u = currentSessionUser || {};
    const queryContext = `?v=2.5&vendor_id=${u.vendor_id || ''}&branch_id=${u.branch_id || ''}&role=${u.role_code || ''}`;

    if (pageId === 'catalog') {
        const catIframe = document.getElementById('catalogIframe');
        if (catIframe) catIframe.src = `catalog.html${queryContext}`;
    } else if (pageId === 'deals') {
        const dealsIframe = document.getElementById('dealsIframe');
        if (dealsIframe) dealsIframe.src = `deals.html${queryContext}`;
    } else if (pageId === 'redemptions') {
        const redIframe = document.getElementById('redemptionsIframe');
        if (redIframe) redIframe.src = `redemption_history.html${queryContext}`;
    } else if (pageId === 'params') {
        resetParamHeaderContext();
        switchParamTab('hd');
    } else if (pageId === 'institutes') {
        resetInstituteContext();
        switchInstTab('inst');
    } else if (pageId === 'referrals') {
        const refIframe = document.getElementById('referralsIframe');
        if (refIframe) refIframe.src = `referral_rewards.html${queryContext}`;
    }
}

// GENERAL PARAMETERS MANAGER
function resetParamHeaderContext() {
    selectedParamHeaderContext = null;
    const txt = document.getElementById('paramContextText');
    if (txt) txt.textContent = 'Active Header Filter: None (Showing all details)';
    if (document.getElementById('paramHeaderFilter')) {
        document.getElementById('paramHeaderFilter').value = '';
    }
    if (currentParamTab === 'dt') {
        fetchParamRecords();
    }
}

async function switchParamTab(tab) {
    currentParamTab = tab;
    document.querySelectorAll('#view-params .sub-tab-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById(`pTab_${tab}`);
    if (tabEl) tabEl.classList.add('active');

    const titleEl = document.getElementById('paramListTitle');
    if (titleEl) titleEl.textContent = tab === 'hd' ? 'Parameter Headers' : 'Parameter Details';
    resetParamForm();

    const { data: headers } = await window.sbClient.from('general_parameter_hd').select('header_id, description').eq('is_active', true).order('description');
    allParamHeaders = headers || [];

    renderParamFilterBar();
    await fetchParamRecords();
}

function renderParamFilterBar() {
    const bar = document.getElementById('paramFilterBar');
    if (!bar) return;
    if (currentParamTab === 'hd') {
        bar.innerHTML = `<input type="text" id="paramSearch" class="search-input" placeholder="🔍 Search headers by description..." oninput="filterParamRecords()">`;
    } else {
        const preHId = selectedParamHeaderContext ? selectedParamHeaderContext.header_id : '';
        bar.innerHTML = `
        <div class="filter-row">
            <select id="paramHeaderFilter" class="filter-select" onchange="onParamHeaderFilterChange()">
                <option value="">-- All Headers --</option>
                ${allParamHeaders.map(h => `<option value="${h.header_id}" ${preHId == h.header_id ? 'selected' : ''}>${h.description}</option>`).join('')}
            </select>
        </div>
        <input type="text" id="paramSearch" class="search-input" placeholder="🔍 Search detail name / abbr..." oninput="filterParamRecords()">
    `;
    }
}

function onParamHeaderFilterChange() {
    const filterVal = document.getElementById('paramHeaderFilter').value;
    if (filterVal && filterVal !== "") {
        const h = allParamHeaders.find(x => x.header_id == filterVal);
        if (h) {
            selectedParamHeaderContext = h;
            document.getElementById('paramContextText').textContent = `Active Header Filter: ⚙️ ${h.description} (Filtered)`;
        }
    } else {
        selectedParamHeaderContext = null;
        document.getElementById('paramContextText').textContent = 'Active Header Filter: None (Showing all details)';
    }
    fetchParamRecords();
}

async function fetchParamRecords() {
    const container = document.getElementById('paramListContainer');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading records...</div>';

    try {
        let query;
        if (currentParamTab === 'hd') {
            query = window.sbClient.from('general_parameter_hd').select('*').order('header_id', { ascending: false });
        } else {
            query = window.sbClient.from('general_parameter_dt').select('*, general_parameter_hd(description)').order('detail_id', { ascending: false });

            const filterSelect = document.getElementById('paramHeaderFilter');
            const filterHId = filterSelect ? filterSelect.value : (selectedParamHeaderContext ? selectedParamHeaderContext.header_id : "");

            if (filterHId && filterHId !== "") {
                query = query.eq('header_id', filterHId);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        paramRecords = data || [];
        filterParamRecords();
    } catch (err) {
        container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error: ${err.message}</div>`;
    }
}

function filterParamRecords() {
    const term = (document.getElementById('paramSearch')?.value || '').toLowerCase();
    const container = document.getElementById('paramListContainer');
    if (!container) return;
    container.innerHTML = '';

    const filtered = paramRecords.filter(r => {
        if (currentParamTab === 'hd') return (r.description || '').toLowerCase().includes(term);
        return (r.detail_name || '').toLowerCase().includes(term) || (r.abbreviation || '').toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No record found</div>';
        return;
    }

    filtered.forEach(rec => {
        const id = currentParamTab === 'hd' ? rec.header_id : rec.detail_id;
        const title = currentParamTab === 'hd' ? (rec.description || `Header #${rec.header_id}`) : (rec.detail_name || `Detail #${rec.detail_id}`);
        const sub = currentParamTab === 'hd' ? `Order: ${rec.order_by || 0}` : `Abbr: ${rec.abbreviation || '-'} | Header: ${rec.general_parameter_hd ? rec.general_parameter_hd.description : ''}`;

        const div = document.createElement('div');
        div.className = `record-item ${selectedParamRecord && (currentParamTab === 'hd' ? selectedParamRecord.header_id : selectedParamRecord.detail_id) === id ? 'selected' : ''}`;
        div.onclick = () => selectParamRecord(rec);

        div.innerHTML = `
        <div class="record-details">
            <h4>${title}</h4>
            <p>${sub}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <span class="status-badge ${rec.is_active ? 'status-active' : 'status-inactive'}">${rec.is_active ? 'Active' : 'Inactive'}</span>
            <button class="btn-sm btn-delete" onclick="event.stopPropagation(); softDeleteParamById(${id})">Delete</button>
        </div>
    `;
        container.appendChild(div);
    });
}

function selectParamRecord(rec) {
    selectedParamRecord = rec;
    const id = currentParamTab === 'hd' ? rec.header_id : rec.detail_id;

    document.getElementById('paramEditId').value = id;
    document.getElementById('paramFormTitle').textContent = `Edit Record (#${id})`;
    document.getElementById('paramModeBadge').textContent = 'Update';
    document.getElementById('paramModeBadge').className = 'status-badge status-active';
    document.getElementById('btnParamSubmit').textContent = 'Update Record';
    document.getElementById('paramDeleteDiv').style.display = 'block';

    renderParamFields();

    if (currentParamTab === 'hd') {
        document.getElementById('f_hd_desc').value = rec.description || '';
        document.getElementById('f_hd_order').value = rec.order_by || 0;

        selectedParamHeaderContext = { header_id: rec.header_id, description: rec.description };
        document.getElementById('paramContextText').textContent = `Active Header Filter: ⚙️ ${rec.description} (Filtered)`;
    } else {
        document.getElementById('f_dt_header_id').value = rec.header_id || '';
        document.getElementById('f_dt_name').value = rec.detail_name || '';
        document.getElementById('f_dt_abbr').value = rec.abbreviation || '';
        document.getElementById('f_dt_order').value = rec.order_by || 0;
    }
    filterParamRecords();
}

function resetParamForm() {
    selectedParamRecord = null;
    document.getElementById('paramEditId').value = '';
    document.getElementById('paramFormTitle').textContent = currentParamTab === 'hd' ? 'Create Parameter Header' : 'Create Parameter Detail';
    document.getElementById('paramModeBadge').textContent = 'Create';
    document.getElementById('btnParamSubmit').textContent = 'Save Record';
    document.getElementById('paramDeleteDiv').style.display = 'none';

    renderParamFields();
    if (paramRecords.length > 0) {
        const firstRec = paramRecords[0];
        const isHdRecords = firstRec.hasOwnProperty('description');
        if ((currentParamTab === 'hd' && isHdRecords) || (currentParamTab === 'dt' && !isHdRecords)) {
            filterParamRecords();
        } else {
            document.getElementById('paramListContainer').innerHTML = '';
        }
    }
}

function renderParamFields() {
    const container = document.getElementById('paramFieldsContainer');
    if (!container) return;
    if (currentParamTab === 'hd') {
        container.innerHTML = `
        <div class="form-group full-width">
            <label>Header Description (Unique Code Name) *</label>
            <input type="text" id="f_hd_desc" placeholder="e.g. DISCOUNT_TYPES, HOME_SECTIONS" required>
        </div>
        <div class="form-group full-width">
            <label>Order By</label>
            <input type="number" id="f_hd_order" value="0">
        </div>
    `;
    } else {
        const preHId = selectedParamHeaderContext ? selectedParamHeaderContext.header_id : '';
        container.innerHTML = `
        <div class="form-group full-width">
            <label>Select Header *</label>
            <select id="f_dt_header_id" required>
                <option value="">-- Select Parameter Header --</option>
                ${allParamHeaders.map(h => `<option value="${h.header_id}" ${h.header_id == preHId ? 'selected' : ''}>${h.description}</option>`).join('')}
            </select>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Detail Name *</label>
                <input type="text" id="f_dt_name" placeholder="e.g. Percentage Discount" required>
            </div>
            <div class="form-group">
                <label>Abbreviation / Value Code *</label>
                <input type="text" id="f_dt_abbr" placeholder="e.g. P, F, 1, 7" required>
            </div>
        </div>
        <div class="form-group full-width">
            <label>Order By</label>
            <input type="number" id="f_dt_order" value="0">
        </div>
    `;
    }
}

async function smartInsert(table, primaryKeyCol, payload) {
    let { error } = await window.sbClient.from(table).insert(payload);
    if (error && (error.code === '23505' || (error.message || '').includes('unique constraint') || (error.details || '').includes('already exists'))) {
        const { data: maxRecord } = await window.sbClient
            .from(table)
            .select(primaryKeyCol)
            .order(primaryKeyCol, { ascending: false })
            .limit(1)
            .maybeSingle();

        const maxId = maxRecord ? (parseInt(maxRecord[primaryKeyCol]) || 0) : 0;
        payload[primaryKeyCol] = maxId + 1;

        const { error: retryError } = await window.sbClient.from(table).insert(payload);
        if (retryError) throw retryError;
    } else if (error) {
        throw error;
    }
}

async function handleParamFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnParamSubmit');
    const editId = document.getElementById('paramEditId').value;
    const isEdit = !!editId;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        if (currentParamTab === 'hd') {
            const description = document.getElementById('f_hd_desc').value.trim();
            const order_by = parseInt(document.getElementById('f_hd_order').value) || 0;
            let payload = { description, order_by, is_active: true, created_by: getLoggedInAdminName() };

            if (isEdit) {
                delete payload.created_by;
                payload.updated_by = getLoggedInAdminName();
                const { error } = await window.sbClient.from('general_parameter_hd').update(payload).eq('header_id', editId);
                if (error) throw error;
                showParamAlert('✅ Header updated successfully!', 'success');
            } else {
                await smartInsert('general_parameter_hd', 'header_id', payload);
                showParamAlert('✅ Header created successfully!', 'success');
            }
        } else {
            const header_id = parseInt(document.getElementById('f_dt_header_id').value);
            const detail_name = document.getElementById('f_dt_name').value.trim();
            const abbreviation = document.getElementById('f_dt_abbr').value.trim();
            const order_by = parseInt(document.getElementById('f_dt_order').value) || 0;

            let payload = { header_id, detail_name, abbreviation, order_by, is_active: true, created_by: getLoggedInAdminName() };

            if (isEdit) {
                delete payload.created_by;
                payload.updated_by = getLoggedInAdminName();
                const { error } = await window.sbClient.from('general_parameter_dt').update(payload).eq('detail_id', editId);
                if (error) throw error;
                showParamAlert('✅ Detail updated successfully!', 'success');
            } else {
                await smartInsert('general_parameter_dt', 'detail_id', payload);
                showParamAlert('✅ Detail created successfully!', 'success');
            }
        }

        resetParamForm();
        const { data: headers } = await window.sbClient.from('general_parameter_hd').select('header_id, description').eq('is_active', true).order('description');
        allParamHeaders = headers || [];
        renderParamFilterBar();
        await fetchParamRecords();

    } catch (err) {
        showParamAlert(`❌ Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? 'Update Record' : 'Save Record';
    }
}

async function softDeleteParamById(id) {
    if (!confirm('Are you sure you want to soft-delete this record?')) return;
    const table = currentParamTab === 'hd' ? 'general_parameter_hd' : 'general_parameter_dt';
    const pk = currentParamTab === 'hd' ? 'header_id' : 'detail_id';

    try {
        const { error } = await window.sbClient.from(table).update({ is_active: false, updated_by: getLoggedInAdminName() }).eq(pk, id);
        if (error) throw error;
        showParamAlert(`⚠️ Record #${id} deactivated`, 'success');
        resetParamForm();
        await fetchParamRecords();
    } catch (err) {
        showParamAlert(`❌ Error: ${err.message}`, 'error');
    }
}

async function softDeleteParamRecord() {
    const id = document.getElementById('paramEditId').value;
    if (id) await softDeleteParamById(id);
}

function showParamAlert(msg, type = 'success') {
    showToast(msg, type, 10000);
    const box = document.getElementById('paramAlert');
    if (box) box.style.display = 'none';
}

// INSTITUTES & CAMPUSES MANAGER LOGIC
function resetInstituteContext() {
    selectedInstituteContext = null;
    const txt = document.getElementById('instContextText');
    if (txt) txt.textContent = 'Active Institute Filter: None (Showing all campuses)';
    if (document.getElementById('instFilterSelect')) {
        document.getElementById('instFilterSelect').value = '';
    }
    if (currentInstTab === 'camp') {
        fetchInstRecords();
    }
}

async function switchInstTab(tab) {
    currentInstTab = tab;
    document.querySelectorAll('#view-institutes .sub-tab-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById(`iTab_${tab}`);
    if (tabEl) tabEl.classList.add('active');

    const titleEl = document.getElementById('instListTitle');
    if (titleEl) titleEl.textContent = tab === 'inst' ? 'Institutes List' : 'Campuses List';
    resetInstForm();

    const { data: insts } = await window.sbClient.from('institutes_t').select('institute_id, name').eq('is_active', true).order('name');
    allInstitutes = insts || [];

    renderInstFilterBar();
    await fetchInstRecords();
}

function renderInstFilterBar() {
    const bar = document.getElementById('instFilterBar');
    if (!bar) return;
    if (currentInstTab === 'inst') {
        bar.innerHTML = `<input type="text" id="instSearch" class="search-input" placeholder="🔍 Search institutes by name..." oninput="filterInstRecords()">`;
    } else {
        const preIId = selectedInstituteContext ? selectedInstituteContext.institute_id : '';
        bar.innerHTML = `
        <div class="filter-row">
            <select id="instFilterSelect" class="filter-select" onchange="onInstFilterChange()">
                <option value="">-- All Institutes --</option>
                ${allInstitutes.map(i => `<option value="${i.institute_id}" ${preIId == i.institute_id ? 'selected' : ''}>${i.name}</option>`).join('')}
            </select>
        </div>
        <input type="text" id="instSearch" class="search-input" placeholder="🔍 Search campuses / city..." oninput="filterInstRecords()">
    `;
    }
}

function onInstFilterChange() {
    const filterVal = document.getElementById('instFilterSelect').value;
    if (filterVal && filterVal !== "") {
        const inst = allInstitutes.find(x => x.institute_id == filterVal);
        if (inst) {
            selectedInstituteContext = inst;
            document.getElementById('instContextText').textContent = `Active Institute Filter: 🏫 ${inst.name} (Filtered)`;
        }
    } else {
        selectedInstituteContext = null;
        document.getElementById('instContextText').textContent = 'Active Institute Filter: None (Showing all campuses)';
    }
    fetchInstRecords();
}

async function fetchInstRecords() {
    const container = document.getElementById('instListContainer');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading records...</div>';

    try {
        let query;
        if (currentInstTab === 'inst') {
            query = window.sbClient.from('institutes_t').select('*').order('institute_id', { ascending: false });
        } else {
            query = window.sbClient.from('institute_campuses_t').select('*, institutes_t(name)').order('campus_id', { ascending: false });

            const filterSelect = document.getElementById('instFilterSelect');
            const filterIId = filterSelect ? filterSelect.value : (selectedInstituteContext ? selectedInstituteContext.institute_id : "");

            if (filterIId && filterIId !== "") {
                query = query.eq('institute_id', filterIId);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        instRecords = data || [];
        filterInstRecords();
    } catch (err) {
        container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error: ${err.message}</div>`;
    }
}

function filterInstRecords() {
    const term = (document.getElementById('instSearch')?.value || '').toLowerCase();
    const container = document.getElementById('instListContainer');
    if (!container) return;
    container.innerHTML = '';

    const filtered = instRecords.filter(r => {
        if (currentInstTab === 'inst') return (r.name || '').toLowerCase().includes(term);
        return (r.campus_name || '').toLowerCase().includes(term) || (r.city || '').toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No record found</div>';
        return;
    }

    filtered.forEach(rec => {
        const id = currentInstTab === 'inst' ? rec.institute_id : rec.campus_id;
        const title = currentInstTab === 'inst' ? (rec.name || `Institute #${rec.institute_id}`) : (rec.campus_name || `Campus #${rec.campus_id}`);
        const sub = currentInstTab === 'inst' ? `ID: #${id}` : `City: ${rec.city || '-'} | Inst: ${rec.institutes_t ? rec.institutes_t.name : ''}`;

        const div = document.createElement('div');
        div.className = `record-item ${selectedInstRecord && (currentInstTab === 'inst' ? selectedInstRecord.institute_id : selectedInstRecord.campus_id) === id ? 'selected' : ''}`;
        div.onclick = () => selectInstRecord(rec);

        div.innerHTML = `
        <div class="record-details">
            <h4>${title}</h4>
            <p>${sub}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <span class="status-badge ${rec.is_active ? 'status-active' : 'status-inactive'}">${rec.is_active ? 'Active' : 'Inactive'}</span>
            <button class="btn-sm btn-delete" onclick="event.stopPropagation(); softDeleteInstById(${id})">Delete</button>
        </div>
    `;
        container.appendChild(div);
    });
}

function selectInstRecord(rec) {
    selectedInstRecord = rec;
    const id = currentInstTab === 'inst' ? rec.institute_id : rec.campus_id;

    document.getElementById('instEditId').value = id;
    document.getElementById('instFormTitle').textContent = `Edit Record (#${id})`;
    document.getElementById('instModeBadge').textContent = 'Update';
    document.getElementById('btnInstSubmit').textContent = 'Update Record';
    document.getElementById('instDeleteDiv').style.display = 'block';

    renderInstFields();

    if (currentInstTab === 'inst') {
        document.getElementById('f_inst_name').value = rec.name || '';
        selectedInstituteContext = { institute_id: rec.institute_id, name: rec.name };
        document.getElementById('instContextText').textContent = `Active Institute Filter: 🏫 ${rec.name} (Filtered)`;
    } else {
        document.getElementById('f_camp_institute_id').value = rec.institute_id || '';
        document.getElementById('f_camp_name').value = rec.campus_name || '';
        document.getElementById('f_camp_city').value = rec.city || '';
        document.getElementById('f_camp_address').value = rec.address || '';
    }
    filterInstRecords();
}

function resetInstForm() {
    selectedInstRecord = null;
    document.getElementById('instEditId').value = '';
    document.getElementById('instFormTitle').textContent = currentInstTab === 'inst' ? 'Create Institute' : 'Create Campus';
    document.getElementById('instModeBadge').textContent = 'Create';
    document.getElementById('btnInstSubmit').textContent = 'Save Record';
    document.getElementById('instDeleteDiv').style.display = 'none';

    renderInstFields();
    if (instRecords.length > 0) {
        const firstRec = instRecords[0];
        const isInstRecords = firstRec.hasOwnProperty('name');
        if ((currentInstTab === 'inst' && isInstRecords) || (currentInstTab === 'camp' && !isInstRecords)) {
            filterInstRecords();
        } else {
            document.getElementById('instListContainer').innerHTML = '';
        }
    }
}

function renderInstFields() {
    const container = document.getElementById('instFieldsContainer');
    if (!container) return;
    if (currentInstTab === 'inst') {
        container.innerHTML = `
        <div class="form-group full-width">
            <label>Institute Name *</label>
            <input type="text" id="f_inst_name" placeholder="e.g. FAST NUCES, IBA Karachi" required>
        </div>
    `;
    } else {
        const preIId = selectedInstituteContext ? selectedInstituteContext.institute_id : '';
        container.innerHTML = `
        <div class="form-group full-width">
            <label>Select Institute *</label>
            <select id="f_camp_institute_id" required>
                <option value="">-- Select Institute --</option>
                ${allInstitutes.map(i => `<option value="${i.institute_id}" ${i.institute_id == preIId ? 'selected' : ''}>${i.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Campus Name *</label>
                <input type="text" id="f_camp_name" placeholder="e.g. Main Campus, City Campus" required>
            </div>
            <div class="form-group">
                <label>City *</label>
                <input type="text" id="f_camp_city" placeholder="e.g. Karachi, Lahore" required>
            </div>
        </div>
        <div class="form-group full-width">
            <label>Full Address</label>
            <input type="text" id="f_camp_address" placeholder="e.g. ST-4, Sector 17-D, Korangi Creek">
        </div>
    `;
    }
}

async function handleInstFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnInstSubmit');
    const editId = document.getElementById('instEditId').value;
    const isEdit = !!editId;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        if (currentInstTab === 'inst') {
            const name = document.getElementById('f_inst_name').value.trim();
            const currentUser = getLoggedInAdminName();
            const nowPKT = getPKTISOString();

            let payload = {
                name,
                is_active: true,
                created_by: currentUser,
                updated_date: nowPKT
            };

            if (isEdit) {
                delete payload.created_by;
                payload.updated_by = currentUser;
                payload.updated_date = nowPKT;
                const { error } = await window.sbClient.from('institutes_t').update(payload).eq('institute_id', editId);
                if (error) throw error;
                showInstAlert('✅ Institute updated successfully!', 'success');
            } else {
                await smartInsert('institutes_t', 'institute_id', payload);
                showInstAlert('✅ Institute created successfully!', 'success');
            }
        } else {
            const institute_id = parseInt(document.getElementById('f_camp_institute_id').value);
            const campus_name = document.getElementById('f_camp_name').value.trim();
            const city = document.getElementById('f_camp_city').value.trim();
            const address = document.getElementById('f_camp_address').value.trim();
            const currentUser = getLoggedInAdminName();
            const nowPKT = getPKTISOString();

            let payload = {
                institute_id,
                campus_name,
                city,
                address,
                is_active: true,
                created_by: currentUser,
                updated_date: nowPKT
            };

            if (isEdit) {
                delete payload.created_by;
                payload.updated_by = currentUser;
                payload.updated_date = nowPKT;
                const { error } = await window.sbClient.from('institute_campuses_t').update(payload).eq('campus_id', editId);
                if (error) throw error;
                showInstAlert('✅ Campus updated successfully!', 'success');
            } else {
                await smartInsert('institute_campuses_t', 'campus_id', payload);
                showInstAlert('✅ Campus created successfully!', 'success');
            }
        }

        resetInstForm();
        const { data: insts } = await window.sbClient.from('institutes_t').select('institute_id, name').eq('is_active', true).order('name');
        allInstitutes = insts || [];
        renderInstFilterBar();
        await fetchInstRecords();

    } catch (err) {
        showInstAlert(`❌ Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? 'Update Record' : 'Save Record';
    }
}

async function softDeleteInstById(id) {
    if (!confirm('Are you sure you want to soft-delete this record?')) return;
    const table = currentInstTab === 'inst' ? 'institutes_t' : 'institute_campuses_t';
    const pk = currentInstTab === 'inst' ? 'institute_id' : 'campus_id';

    try {
        const { error } = await window.sbClient.from(table).update({ is_active: false, updated_by: getLoggedInAdminName() }).eq(pk, id);
        if (error) throw error;
        showInstAlert(`⚠️ Record #${id} deactivated`, 'success');
        resetInstForm();
        await fetchInstRecords();
    } catch (err) {
        showInstAlert(`❌ Error: ${err.message}`, 'error');
    }
}

async function softDeleteInstRecord() {
    const id = document.getElementById('instEditId').value;
    if (id) await softDeleteInstById(id);
}

function showInstAlert(msg, type = 'success') {
    showToast(msg, type, 10000);
    const box = document.getElementById('instAlert');
    if (box) box.style.display = 'none';
}
