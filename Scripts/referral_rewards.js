/**
 * Referral Rewards Manager Controller
 */

let allCategories = [];
let allVendors = [];
let allRewardTiers = [];
let filteredTiers = [];

let currentTierPage = 1;
const pageSize = 10;

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    await loadCategories();
    await loadVendors();
    await loadRewardTiers();
    await loadKPIStats();

    const form = document.getElementById('rewardTierForm');
    if (form) form.addEventListener('submit', handleSaveRewardTier);
});


function switchTab(tabId) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content-view').forEach(view => view.classList.remove('active'));

    const btn = document.getElementById(`tab_${tabId}`);
    if (btn) btn.classList.add('active');
    const view = document.getElementById(`view-${tabId}`);
    if (view) view.classList.add('active');

    if (tabId === 'logs') {
        loadStudentRedemptionLogs();
    }
}

async function loadCategories() {
    try {
        const { data, error } = await window.sbClient
            .from('categories_t')
            .select('category_id, name')
            .eq('is_active', true)
            .order('name');

        if (!error && data) {
            allCategories = data;
            const modalCatSelect = document.getElementById('modal_category_id');
            const filterCatSelect = document.getElementById('filterCategory');

            if (modalCatSelect) {
                modalCatSelect.innerHTML = '<option value="">-- Select Category --</option>';
                data.forEach(c => {
                    modalCatSelect.innerHTML += `<option value="${c.category_id}">${c.name}</option>`;
                });
            }

            if (filterCatSelect) {
                filterCatSelect.innerHTML = '<option value="">All Categories</option>';
                data.forEach(c => {
                    filterCatSelect.innerHTML += `<option value="${c.category_id}">${c.name}</option>`;
                });
            }
        }
    } catch (err) {
        console.error("Failed to load categories:", err);
    }
}

async function loadVendors() {
    try {
        const { data, error } = await window.sbClient
            .from('vendors_t')
            .select('vendor_id, category_id, name, logo_file_id, logo_file:uploaded_files_t!logo_file_id(file_path)')
            .eq('is_active', true)
            .order('name');

        if (error) {
            const fallback = await window.sbClient.from('vendors_t').select('vendor_id, category_id, name, logo_file_id').eq('is_active', true);
            allVendors = fallback.data || [];
        } else {
            allVendors = data || [];
        }
    } catch (err) {
        console.error("Failed to load vendors:", err);
    }
}

function handleModalCategoryChange() {
    const catId = document.getElementById('modal_category_id').value;
    const vendorSelect = document.getElementById('modal_vendor_id');
    const dealSelect = document.getElementById('modal_deal_id');

    if (dealSelect) {
        dealSelect.innerHTML = '<option value="">-- Choose Vendor First --</option>';
        dealSelect.disabled = true;
    }

    if (!vendorSelect) return;

    if (!catId) {
        vendorSelect.innerHTML = '<option value="">-- Choose Category First --</option>';
        vendorSelect.disabled = true;
        return;
    }

    const filteredVendors = allVendors.filter(v => String(v.category_id) === String(catId));
    vendorSelect.innerHTML = '<option value="">-- Choose Vendor --</option>';
    filteredVendors.forEach(v => {
        vendorSelect.innerHTML += `<option value="${v.vendor_id}">${v.name}</option>`;
    });
    vendorSelect.disabled = false;
}

async function handleModalVendorChange() {
    const vendorId = document.getElementById('modal_vendor_id').value;
    const dealSelect = document.getElementById('modal_deal_id');

    if (!dealSelect) return;

    dealSelect.innerHTML = '<option value="">Loading deals...</option>';
    dealSelect.disabled = true;

    if (!vendorId) {
        dealSelect.innerHTML = '<option value="">-- Choose Vendor First --</option>';
        return;
    }

    try {
        const { data: deals, error } = await window.sbClient
            .from('deals_t')
            .select('deal_id, title')
            .eq('vendor_id', parseInt(vendorId))
            .eq('is_active', true)
            .order('title');

        dealSelect.innerHTML = '<option value="">-- None (Stand-alone Reward) --</option>';
        if (!error && deals && deals.length > 0) {
            deals.forEach(d => {
                dealSelect.innerHTML += `<option value="${d.deal_id}">${d.title}</option>`;
            });
        } else {
            dealSelect.innerHTML = '<option value="">-- No active deals found for vendor --</option>';
        }
        dealSelect.disabled = false;
    } catch (err) {
        console.error("Failed to load vendor deals:", err);
        dealSelect.innerHTML = '<option value="">-- Error loading deals --</option>';
    }

    updateLivePreview();
}

function handleModalDealChange() {
    const dealSelect = document.getElementById('modal_deal_id');
    const selectedOpt = dealSelect.options[dealSelect.selectedIndex];
    const titleInput = document.getElementById('title');

    if (selectedOpt && selectedOpt.value && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = selectedOpt.text;
    }
    updateLivePreview();
}

function updateLivePreview() {
    const vendorSelect = document.getElementById('modal_vendor_id');
    if (!vendorSelect) return;
    const vendorId = parseInt(vendorSelect.value);
    const title = (document.getElementById('title').value || '').trim() || 'Reward Title';
    const subNote = (document.getElementById('reward_sub_text').value || '').trim() || 'Rs 500 OFF';

    const vendorObj = allVendors.find(v => v.vendor_id === vendorId);
    const brandName = vendorObj ? vendorObj.name : 'Brand Name';
    const initials = brandName.substring(0, 2).toUpperCase();

    const pvB = document.getElementById('pvBrand');
    if (pvB) pvB.innerText = brandName;
    const pvT = document.getElementById('pvTitle');
    if (pvT) pvT.innerText = title;
    const pvS = document.getElementById('pvSubNote');
    if (pvS) pvS.innerText = subNote;

    const logoContainer = document.getElementById('pvLogo');
    if (logoContainer) {
        if (vendorObj && vendorObj.logo_file && vendorObj.logo_file.file_path) {
            const logoUrl = getVendorLogoUrl(vendorObj.logo_file.file_path);
            logoContainer.innerHTML = `<img src="${logoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" onerror="this.src='Icons/App Icon.png'">`;
        } else {
            logoContainer.innerText = initials;
        }
    }
}

async function loadKPIStats() {
    try {
        const { count: countJoined } = await window.sbClient
            .from('student_profiles_t')
            .select('student_id', { count: 'exact', head: true })
            .not('referred_by', 'is', null);
        const kJoin = document.getElementById('kpiTotalJoined');
        if (kJoin) kJoin.innerText = countJoined || 0;

        const { count: countUnlocked } = await window.sbClient
            .from('student_referral_rewards_t')
            .select('user_reward_id', { count: 'exact', head: true });
        const kUnlk = document.getElementById('kpiUnlockedRewards');
        if (kUnlk) kUnlk.innerText = countUnlocked || 0;

        const { count: countRedeemed } = await window.sbClient
            .from('student_referral_rewards_t')
            .select('user_reward_id', { count: 'exact', head: true })
            .eq('status', 'RDM');
        const kRdm = document.getElementById('kpiRedeemedRewards');
        if (kRdm) kRdm.innerText = countRedeemed || 0;
    } catch (err) {
        console.error("KPI load error:", err);
    }
}

async function loadRewardTiers() {
    try {
        const { data, error } = await window.sbClient
            .from('referral_reward_tiers_t')
            .select(`
                *,
                vendors_t (
                    vendor_id, 
                    category_id, 
                    name, 
                    logo_file_id, 
                    logo_file:uploaded_files_t!logo_file_id(file_path)
                ),
                deals_t (deal_id, title)
            `)
            .order('required_referrals', { ascending: true });

        if (error) {
            const fallback = await window.sbClient
                .from('referral_reward_tiers_t')
                .select('*, vendors_t(vendor_id, category_id, name, logo_file_id, logo_file:uploaded_files_t!logo_file_id(file_path)), deals_t(title)')
                .order('required_referrals', { ascending: true });
            allRewardTiers = fallback.data || [];
        } else {
            allRewardTiers = data || [];
        }

        const kTier = document.getElementById('kpiTotalTiers');
        if (kTier) kTier.innerText = allRewardTiers.filter(t => t.is_active).length;
        applyTierFilters();
    } catch (err) {
        console.error("Error loading reward tiers:", err);
        allRewardTiers = [];
        applyTierFilters();
    }
}

function applyTierFilters() {
    const sEl = document.getElementById('filterSearch');
    const searchVal = (sEl ? sEl.value : '').toLowerCase().trim();
    const cEl = document.getElementById('filterCategory');
    const catVal = cEl ? cEl.value : '';
    const stEl = document.getElementById('filterStatus');
    const statusVal = stEl ? stEl.value : 'ALL';

    filteredTiers = allRewardTiers.filter(t => {
        const vendorObj = t.vendors_t || {};
        const brandName = (vendorObj.name || '').toLowerCase();
        const titleText = (t.title || '').toLowerCase();

        const matchesSearch = !searchVal || brandName.includes(searchVal) || titleText.includes(searchVal);
        const matchesCat = !catVal || String(vendorObj.category_id) === String(catVal);

        let matchesStatus = true;
        if (statusVal === 'ACTIVE') matchesStatus = (t.is_active === true);
        if (statusVal === 'INACTIVE') matchesStatus = (t.is_active === false);

        return matchesSearch && matchesCat && matchesStatus;
    });

    currentTierPage = 1;
    renderTiersTable();
}

function renderTiersTable() {
    const tbody = document.getElementById('tiersTableBody');
    if (!tbody) return;
    const totalRecords = filteredTiers.length;
    const subTitle = document.getElementById('tierCountSubtitle');
    if (subTitle) subTitle.innerText = `${totalRecords} total tiers matching filter`;

    if (!filteredTiers || totalRecords === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    No referral reward tiers found matching filters.
                </td>
            </tr>`;
        renderTierPagination(0);
        return;
    }

    const startIdx = (currentTierPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRecords);
    const pageData = filteredTiers.slice(startIdx, endIdx);

    tbody.innerHTML = pageData.map(t => {
        const vendorObj = t.vendors_t || {};
        let logoPath = 'Icons/App Icon.png';
        if (vendorObj.logo_file && vendorObj.logo_file.file_path) {
            logoPath = getVendorLogoUrl(vendorObj.logo_file.file_path);
        }
        const linkedDealId = t.deal_id || (t.deals_t && t.deals_t.deal_id);
        const dealTitle = (t.deals_t && t.deals_t.title) 
            ? `${t.deals_t.title} <span class="deal-id-badge" style="font-size:11px; font-weight:700; color:#4f46e5; background:#e0e7ff; padding:2px 7px; border-radius:6px; margin-left:6px; display:inline-block;">Deal #${linkedDealId}</span>` 
            : '<span style="color:#94a3b8;">None</span>';
        const subText = t.reward_sub_text ? `<div class="subtext-pill">🏷️ ${t.reward_sub_text}</div>` : '';

        return `
            <tr>
                <td><span class="req-badge">${t.required_referrals}</span></td>
                <td>
                    <div class="vendor-badge-info">
                        <img src="${logoPath}" class="vendor-logo-thumb" alt="Logo" onerror="this.src='Icons/App Icon.png'">
                        <div>
                            <strong style="color:#0f172a; font-size:13.5px;">${vendorObj.name || 'Unknown Vendor'}</strong>
                        </div>
                    </div>
                </td>
                <td>${dealTitle}</td>
                <td>
                    <strong style="color:#1e1b4b;">${t.title}</strong>
                    ${subText}
                </td>
                <td>
                    <span class="status-badge ${t.is_active ? 'active' : 'inactive'}">
                        ${t.is_active ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                </td>
                <td style="text-align: right;">
                    <button type="button" class="btn-action-sm" onclick="editRewardTier(${t.tier_id})">✏️ Edit</button>
                    <button type="button" class="btn-action-sm btn-action-danger" onclick="toggleRewardTierStatus(${t.tier_id}, ${!t.is_active})">
                        ${t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>`;
    }).join('');

    renderTierPagination(totalRecords);
}

function renderTierPagination(totalRecords) {
    const info = document.getElementById('tierPaginationInfo');
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;

    const startIdx = totalRecords > 0 ? (currentTierPage - 1) * pageSize + 1 : 0;
    const endIdx = Math.min(currentTierPage * pageSize, totalRecords);
    if (info) info.innerText = `Showing ${startIdx}-${endIdx} of ${totalRecords} tiers`;

    const btnPrev = document.getElementById('btnPrevTierPage');
    if (btnPrev) btnPrev.disabled = (currentTierPage <= 1);
    const btnNext = document.getElementById('btnNextTierPage');
    if (btnNext) btnNext.disabled = (currentTierPage >= totalPages);

    const numContainer = document.getElementById('tierPageNumbersContainer');
    if (numContainer) {
        numContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i <= 5 || i === totalPages) {
                numContainer.innerHTML += `
                    <button class="btn-page ${i === currentTierPage ? 'active' : ''}" style="${i === currentTierPage ? 'background:var(--primary); color:white;' : ''}" onclick="goToTierPage(${i})">${i}</button>`;
            }
        }
    }
}

function changeTierPage(delta) {
    currentTierPage += delta;
    renderTiersTable();
}

function goToTierPage(p) {
    currentTierPage = p;
    renderTiersTable();
}

async function loadStudentRedemptionLogs() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                Loading student redemptions log...
            </td>
        </tr>`;

    const stEl = document.getElementById('logFilterStatus');
    const statusVal = stEl ? stEl.value : 'ALL';
    const srEl = document.getElementById('logFilterSearch');
    const searchVal = (srEl ? srEl.value : '').trim();

    try {
        const { data, error } = await window.sbClient.rpc('fn_get_admin_student_referral_rewards_log', {
            p_status: statusVal,
            p_search: searchVal
        });

        if (error) throw error;

        const logs = (data && data.logs) ? data.logs : [];
        const logSub = document.getElementById('logCountSubtitle');
        if (logSub) logSub.innerText = `${logs.length} student rewards logged`;

        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                        No student reward unlocks or redemptions found matching filters.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = logs.map(l => {
            const logoPath = getVendorLogoUrl(l.vendor_logo_url);
            const isRedeemed = (l.status === 'RDM');
            const statusClass = isRedeemed ? 'status-badge redeemed' : 'status-badge ready';
            const statusLabel = isRedeemed ? '🔵 REDEEMED' : '🟢 READY';

            const unlockedStr = l.unlocked_at ? l.unlocked_at : '-';
            const redeemedStr = l.redeemed_at ? l.redeemed_at : '<span style="color:#94a3b8;">Not Redeemed Yet</span>';

            return `
                <tr>
                    <td>
                        <div>
                            <strong style="color:#0f172a;">${l.student_name || 'Student'}</strong>
                            <div style="font-size:11.5px; color:#64748b;">📱 ${l.phone_number || '-'}</div>
                        </div>
                    </td>
                    <td>
                        <div class="vendor-badge-info">
                            <img src="${logoPath}" class="vendor-logo-thumb" alt="Logo" onerror="this.src='Icons/App Icon.png'">
                            <div>
                                <strong style="color:#0f172a; font-size:13px;">${l.vendor_name}</strong>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong style="color:#1e1b4b;">${l.reward_title}</strong>
                        ${l.reward_sub_text ? `<div class="subtext-pill">🏷️ ${l.reward_sub_text}</div>` : ''}
                    </td>
                    <td>
                        ${l.deal_title && l.deal_title !== 'N/A' ? `${l.deal_title} ${l.deal_id ? `<span class="deal-id-badge" style="font-size:11px; font-weight:700; color:#4f46e5; background:#e0e7ff; padding:2px 7px; border-radius:6px; margin-left:6px; display:inline-block;">Deal #${l.deal_id}</span>` : ''}` : '<span style="color:#94a3b8;">None</span>'}
                    </td>
                    <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700;">${l.voucher_code_issued || 'N/A'}</code></td>
                    <td><span class="${statusClass}">${statusLabel}</span></td>
                    <td style="font-size:12px; color:#475569;">${unlockedStr}</td>
                    <td style="font-size:12px; color:#475569;">${redeemedStr}</td>
                </tr>`;
        }).join('');

    } catch (err) {
        console.error("Failed to load redemption logs:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--danger); padding: 30px;">
                    Failed to load redemption logs: ${err.message || 'Error'}
                </td>
            </tr>`;
    }
}

function openCreateModal() {
    resetRewardForm();
    document.getElementById('modalTitle').innerText = 'Create New Reward Tier';
    document.getElementById('btnSubmitModal').innerText = 'Create Reward Tier';
    document.getElementById('rewardModalOverlay').classList.add('active');
}

function closeRewardModal() {
    document.getElementById('rewardModalOverlay').classList.remove('active');
    hideModalAlert();
}

async function editRewardTier(tierId) {
    const tier = allRewardTiers.find(t => t.tier_id === tierId);
    if (!tier) return;

    resetRewardForm();

    document.getElementById('tierEditId').value = tier.tier_id;
    document.getElementById('required_referrals').value = tier.required_referrals;

    const vendorObj = allVendors.find(v => v.vendor_id === tier.vendor_id);
    if (vendorObj && vendorObj.category_id) {
        document.getElementById('modal_category_id').value = vendorObj.category_id;
        handleModalCategoryChange();
        document.getElementById('modal_vendor_id').value = tier.vendor_id;
        await handleModalVendorChange();
    } else if (tier.vendor_id) {
        document.getElementById('modal_vendor_id').value = tier.vendor_id;
        await handleModalVendorChange();
    }

    if (tier.deal_id) {
        document.getElementById('modal_deal_id').value = tier.deal_id;
    }

    document.getElementById('title').value = tier.title || '';
    document.getElementById('reward_sub_text').value = tier.reward_sub_text || '';
    document.getElementById('voucher_code').value = tier.voucher_code || '';
    document.getElementById('display_order').value = tier.display_order || 1;
    document.getElementById('is_active').checked = tier.is_active;

    document.getElementById('modalTitle').innerText = '✏️ Edit Reward Tier';
    document.getElementById('btnSubmitModal').innerText = 'Update Reward Tier';

    updateLivePreview();
    document.getElementById('rewardModalOverlay').classList.add('active');
}

function resetRewardForm() {
    document.getElementById('tierEditId').value = '';
    document.getElementById('rewardTierForm').reset();
    document.getElementById('modal_vendor_id').innerHTML = '<option value="">-- Choose Category First --</option>';
    document.getElementById('modal_vendor_id').disabled = true;
    document.getElementById('modal_deal_id').innerHTML = '<option value="">-- Choose Vendor First --</option>';
    document.getElementById('modal_deal_id').disabled = true;
    hideModalAlert();
    updateLivePreview();
}

async function handleSaveRewardTier(e) {
    e.preventDefault();
    hideModalAlert();

    const editId = document.getElementById('tierEditId').value;
    const required_referrals = parseInt(document.getElementById('required_referrals').value);
    const vendor_id = parseInt(document.getElementById('modal_vendor_id').value);
    const deal_id_val = document.getElementById('modal_deal_id').value;
    const deal_id = deal_id_val ? parseInt(deal_id_val) : null;
    const title = document.getElementById('title').value.trim();
    const reward_sub_text = document.getElementById('reward_sub_text').value.trim();
    const voucher_code = document.getElementById('voucher_code').value.trim();
    const display_order = parseInt(document.getElementById('display_order').value) || 1;
    const is_active = document.getElementById('is_active').checked;

    if (!required_referrals || !vendor_id || !title) {
        showModalAlert("Please fill in all required fields (Referrals, Vendor, Title)", "error");
        return;
    }

    const payload = {
        required_referrals,
        vendor_id,
        deal_id,
        title,
        reward_sub_text: reward_sub_text || null,
        voucher_code: voucher_code || null,
        display_order,
        is_active,
        updated_date: getPKTISOString()
    };

    try {
        let response;
        if (editId) {
            response = await window.sbClient
                .from('referral_reward_tiers_t')
                .update(payload)
                .eq('tier_id', parseInt(editId));
        } else {
            payload.created_by = getCleanAdminUser();
            response = await window.sbClient
                .from('referral_reward_tiers_t')
                .insert([payload]);
        }

        if (response.error) throw response.error;

        closeRewardModal();
        await loadRewardTiers();
        await loadKPIStats();
    } catch (err) {
        console.error("Save failed:", err);
        showModalAlert(err.message || "Failed to save reward tier", "error");
    }
}

async function toggleRewardTierStatus(tierId, newStatus) {
    try {
        const { error } = await window.sbClient
            .from('referral_reward_tiers_t')
            .update({ is_active: newStatus, updated_date: getPKTISOString() })
            .eq('tier_id', tierId);

        if (error) throw error;

        await loadRewardTiers();
        await loadKPIStats();
    } catch (err) {
        console.error("Failed to toggle status:", err);
        alert("Failed to change status: " + err.message);
    }
}

function showModalAlert(msg, type) {
    const alertBox = document.getElementById('modalAlert');
    if (!alertBox) return;
    alertBox.innerText = msg;
    alertBox.className = `alert-box ${type === 'success' ? 'alert-success' : 'alert-error'}`;
    alertBox.style.display = 'block';
}

function hideModalAlert() {
    const alertBox = document.getElementById('modalAlert');
    if (alertBox) alertBox.style.display = 'none';
}
