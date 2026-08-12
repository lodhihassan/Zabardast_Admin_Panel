/**
 * Redemption History Controller
 */

let scopedVendorId = null;
let userRole = 'A';

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;


    const adminUser = localStorage.getItem('supabase_admin_user');
    let userObj = {};
    try { userObj = JSON.parse(adminUser); } catch(e) {}


    const urlParams = new URLSearchParams(window.location.search);
    const paramVendorId = urlParams.get('vendor_id');
    userRole = urlParams.get('role') || userObj.role_code || 'A';

    if (userRole !== 'A' || (paramVendorId && paramVendorId !== 'null')) {
        scopedVendorId = parseInt(paramVendorId || userObj.vendor_id);
    }

    const badgeEl = document.getElementById('vendorScopeBadge');
    if (scopedVendorId && badgeEl) {
        const { data: vRec } = await window.sbClient.from('vendors_t').select('name').eq('vendor_id', scopedVendorId).maybeSingle();
        const vName = vRec ? vRec.name : `Vendor #${scopedVendorId}`;
        badgeEl.textContent = `🟢 🏪 Vendor: ${vName}`;
    } else if (badgeEl) {
        badgeEl.textContent = `👑 Admin View (All Vendors)`;
    }

    await populateBranchDropdown();
    await fetchRedemptionHistory();
});

async function populateBranchDropdown() {
    const branchSelect = document.getElementById('f_branch_id');
    if (!branchSelect) return;
    branchSelect.innerHTML = '<option value="">All Branches</option>';

    let query = window.sbClient.from('branches_t').select('branch_id, branch_name').eq('is_active', true).order('branch_name');
    if (scopedVendorId) {
        query = query.eq('vendor_id', scopedVendorId);
    }

    const { data: branches } = await query;
    if (branches) {
        branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.branch_id;
            opt.textContent = b.branch_name;
            branchSelect.appendChild(opt);
        });
    }
}

async function fetchRedemptionHistory() {
    const tbody = document.getElementById('redemptionTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">⌛</div><div>Fetching redemption history...</div></td></tr>`;

    const searchTerm = document.getElementById('f_search').value.trim();
    const branchIdVal = document.getElementById('f_branch_id').value;
    const fromDateVal = document.getElementById('f_from_date').value;
    const toDateVal = document.getElementById('f_to_date').value;

    const branchId = branchIdVal ? parseInt(branchIdVal) : null;

    let historyRecords = [];

    try {
        const { data: rpcData, error: rpcErr } = await window.sbClient.rpc('get_redemption_history', {
            p_vendor_id: scopedVendorId || null,
            p_branch_id: branchId,
            p_search_term: searchTerm || null,
            p_from_date: fromDateVal || null,
            p_to_date: toDateVal || null,
            p_limit: 100
        });

        if (!rpcErr && rpcData) {
            historyRecords = rpcData;
        } else {
            let query = window.sbClient
                .from('redemption_logs_history_t')
                .select(`
                    log_id, scanned_at, total_bill_amount, savings_amount,
                    deals_t(deal_id, title, discount_value, discount_type),
                    vendors_t(vendor_id, name),
                    branches_t(branch_id, branch_name),
                    student_profiles_t(user_id, full_name, phone_number, institutes_t(name)),
                    vendor_users_t(user_id, full_name, vendor_role),
                    deal_redemptions_t(manual_code)
                `)
                .order('scanned_at', { ascending: false })
                .limit(100);

            if (scopedVendorId) query = query.eq('vendor_id', scopedVendorId);
            if (branchId) query = query.eq('branch_id', branchId);
            if (fromDateVal) query = query.gte('scanned_at', `${fromDateVal}T00:00:00`);
            if (toDateVal) query = query.lte('scanned_at', `${toDateVal}T23:59:59`);

            const { data: directData, error: directErr } = await query;
            if (directErr) throw directErr;

            historyRecords = (directData || []).map(r => ({
                log_id: r.log_id,
                scanned_at: r.scanned_at,
                total_bill_amount: r.total_bill_amount,
                savings_amount: r.savings_amount,
                deal_title: r.deals_t?.title || 'N/A',
                vendor_name: r.vendors_t?.name || 'N/A',
                branch_name: r.branches_t?.branch_name || 'Main Vendor Office',
                student_name: r.student_profiles_t?.full_name || 'Student User',
                student_institute: r.student_profiles_t?.institutes_t?.name || 'Institute N/A',
                cashier_name: r.vendor_users_t?.full_name || 'Main Vendor Admin',
                cashier_role: r.vendor_users_t?.vendor_role || 'A',
                manual_code: r.deal_redemptions_t?.manual_code || 'N/A'
            }));

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                historyRecords = historyRecords.filter(r => 
                    (r.deal_title || '').toLowerCase().includes(term) ||
                    (r.student_name || '').toLowerCase().includes(term) ||
                    (r.cashier_name || '').toLowerCase().includes(term) ||
                    (r.manual_code || '').toLowerCase().includes(term)
                );
            }
        }

        renderHistoryTable(historyRecords);
    } catch (err) {
        console.error("Fetch Redemption History Error:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color: #dc2626;"><div class="empty-state-icon">⚠️</div><div>Failed to load redemption history: ${err.message}</div></td></tr>`;
    }
}

function renderHistoryTable(records) {
    const tbody = document.getElementById('redemptionTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const countEl = document.getElementById('recordCountText');
    if (countEl) countEl.textContent = records.length;

    let totalSavings = 0;
    let totalBill = 0;

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div>No redemption history logs found matching your filters.</div>
                </td>
            </tr>
        `;
        document.getElementById('kpiTotalRedemptions').textContent = '0';
        document.getElementById('kpiTotalSavings').textContent = 'Rs. 0';
        document.getElementById('kpiTotalBill').textContent = 'Rs. 0';
        return;
    }

    records.forEach(r => {
        totalSavings += parseFloat(r.savings_amount || 0);
        totalBill += parseFloat(r.total_bill_amount || 0);

        const dateObj = new Date(r.scanned_at);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let staffRoleLabel = 'Vendor Admin';
        if (r.cashier_role === 'M') staffRoleLabel = 'Manager';
        else if (r.cashier_role === 'S') staffRoleLabel = 'Supervisor';
        else if (r.cashier_role === 'C') staffRoleLabel = 'Cashier';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="user-name">${formattedDate}</div>
                <div class="user-sub">⏰ ${formattedTime}</div>
            </td>
            <td>
                <div class="user-name">${r.deal_title || 'Deal'}</div>
                <div class="user-sub">🏪 ${r.vendor_name || 'Vendor'}</div>
            </td>
            <td>
                <span style="font-weight: 700; color: #334155;">🏢 ${r.branch_name || 'Main Office'}</span>
            </td>
            <td>
                <div class="user-cell">
                    <span class="user-name">🎓 ${r.student_name || 'Student'}</span>
                    <span class="user-sub">${r.student_institute || r.student_email || ''}</span>
                </div>
            </td>
            <td>
                <div class="user-cell">
                    <span class="user-name">👤 ${r.cashier_name || 'Vendor Staff'}</span>
                    <span class="user-sub">Role: ${staffRoleLabel}</span>
                </div>
            </td>
            <td>
                <span class="code-badge">🎟️ ${r.manual_code || 'REDEEMED'}</span>
            </td>
            <td>
                <div class="user-name amount-highlight">Savings: Rs. ${parseFloat(r.savings_amount || 0).toLocaleString()}</div>
                <div class="user-sub">Bill: Rs. ${parseFloat(r.total_bill_amount || 0).toLocaleString()}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('kpiTotalRedemptions').textContent = records.length;
    document.getElementById('kpiTotalSavings').textContent = `Rs. ${totalSavings.toLocaleString()}`;
    document.getElementById('kpiTotalBill').textContent = `Rs. ${totalBill.toLocaleString()}`;
}

function resetFilters() {
    document.getElementById('f_search').value = '';
    document.getElementById('f_branch_id').value = '';
    document.getElementById('f_from_date').value = '';
    document.getElementById('f_to_date').value = '';
    fetchRedemptionHistory();
}
