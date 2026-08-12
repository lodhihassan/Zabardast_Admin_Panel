/**
 * Admin Dashboard Controller
 */

let D = { students:[], profiles:[], verifs:[], vendors:[], branches:[], deals:[], products:[], subProducts:[], categories:[] };
let drawerData = [];
let currentDrawerType = '';
let chartLine, chartDonut, chartBar;

function goto(url) { window.location.href = url; }
function scrollTop() { window.scrollTo({top:0,behavior:'smooth'}); }

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d.includes('T') ? d : d+'Z').toLocaleDateString('en-US',{timeZone:'Asia/Karachi',day:'numeric',month:'short',year:'numeric'});
}

function kpiHtml(ico, cls, lbl, val, sub) {
    return `<div class="kpi-card"><div class="kpi-ico ${cls}">${ico}</div><div class="kpi-txt"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div></div>`;
}

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    const adminUser = localStorage.getItem('supabase_admin_user');
    const u = JSON.parse(adminUser || '{}');

    const name = u.full_name || u.email || 'Admin';
    const sbAv = document.getElementById('sbAvatar');
    if (sbAv) sbAv.textContent = name.charAt(0).toUpperCase();
    const sbN = document.getElementById('sbName');
    if (sbN) sbN.textContent = name;
    const sbE = document.getElementById('sbEmail');
    if (sbE) sbE.textContent = u.email || '';
    const now = new Date().toLocaleString('en-US',{timeZone:'Asia/Karachi',weekday:'long',month:'long',day:'numeric'});
    const dashSub = document.getElementById('dashSub');
    if (dashSub) dashSub.textContent = `Welcome, ${name} · ${now}`;

    await loadAll();
});

async function handleLogout() {
    await window.sbClient.auth.signOut();
    localStorage.removeItem('supabase_admin_user');
    window.location.href = 'login.html';
}

async function loadAll() {
    const [sRes, pRes, vfRes, vnRes, brRes, dlRes, prRes, spRes, ctRes] = await Promise.all([
        window.sbClient.from('users_t').select('user_id,email,is_active,created_date').eq('role_id',3),
        window.sbClient.from('student_profiles_t').select('user_id,full_name,is_verified,is_active,created_date').order('created_date',{ascending:false}),
        window.sbClient.from('student_verifications_t').select('user_id,status'),
        window.sbClient.from('vendors_t').select('vendor_id,name,is_active').order('vendor_id',{ascending:false}),
        window.sbClient.from('branches_t').select('branch_id,branch_name,vendor_id,is_active,location').order('branch_id',{ascending:false}),
        window.sbClient.from('deals_t').select('deal_id,title,vendor_id,category_id,is_active,valid_until,created_date').order('deal_id',{ascending:false}),
        window.sbClient.from('products_t').select('product_id,product_name'),
        window.sbClient.from('sub_products_t').select('sub_product_id,sub_product_name,product_id'),
        window.sbClient.from('categories_t').select('category_id,name')
    ]);

    D.students   = sRes.data   || [];
    D.profiles   = pRes.data   || [];
    D.verifs     = vfRes.data  || [];
    D.vendors    = vnRes.data  || [];
    D.branches   = brRes.data  || [];
    D.deals      = dlRes.data  || [];
    D.products   = prRes.data  || [];
    D.subProducts= spRes.data  || [];
    D.categories = ctRes.data  || [];

    renderKPIs();
    renderTables();
    renderCharts();
}

function renderKPIs() {
    const totalSt = D.students.length;
    const verified = D.profiles.filter(p=>p.is_verified).length;
    const pending  = D.verifs.filter(v=>v.status==='P').length;
    const totalVn  = D.vendors.length;
    const activeVn = D.vendors.filter(v=>v.is_active).length;
    const totalDl  = D.deals.length;
    const activeDl = D.deals.filter(d=>d.is_active).length;
    const totalBr  = D.branches.length;
    const activeBr = D.branches.filter(b=>b.is_active).length;
    const totalPr  = D.products.length;
    const totalSp  = D.subProducts.length;
    const totalCt  = D.categories.length;

    const row1 = document.getElementById('kpiRow1');
    if (row1) {
        row1.innerHTML =
            kpiHtml('🎓','ico-blue','Total Students', totalSt, `<span class="g">${verified} verified</span> · <span class="w">${pending} pending</span>`) +
            kpiHtml('🏪','ico-green','Total Vendors', totalVn, `<span class="g">${activeVn} active</span> · ${totalVn-activeVn} inactive`) +
            kpiHtml('🎁','ico-purple','Total Deals', totalDl, `<span class="g">${activeDl} active</span> · ${totalDl-activeDl} inactive`) +
            kpiHtml('🏢','ico-teal','Total Branches', totalBr, `<span class="g">${activeBr} active</span> branches`);
    }

    const row2 = document.getElementById('kpiRow2');
    if (row2) {
        row2.innerHTML =
            kpiHtml('📦','ico-orange','Products', totalPr, `${totalSp} sub-products total`) +
            kpiHtml('🏷️','ico-yellow','Categories', totalCt, `Deal categories`) +
            kpiHtml('📊','ico-pink','Active Deal Rate', activeDl>0?Math.round(activeDl/totalDl*100)+'%':'—', `${activeDl} of ${totalDl} deals live`) +
            kpiHtml('✅','ico-red','Verification Rate', totalSt>0?Math.round(verified/totalSt*100)+'%':'—', `${verified} of ${totalSt} students`);
    }
}

function renderTables() {
    const verifMap  = new Map(D.verifs.map(v=>[v.user_id,v]));
    const vendorMap = new Map(D.vendors.map(v=>[v.vendor_id,v.name]));
    const branchCnt = {};
    D.branches.forEach(b=>{ branchCnt[b.vendor_id]=(branchCnt[b.vendor_id]||0)+1; });
    const subCnt = {};
    D.subProducts.forEach(s=>{ subCnt[s.product_id]=(subCnt[s.product_id]||0)+1; });

    const tblSt = document.getElementById('tblStudents');
    if (tblSt) {
        tblSt.innerHTML = D.profiles.slice(0,5).map(p=>{
            const v = verifMap.get(p.user_id);
            const badge = p.is_verified ? '<span class="badge bg">✅ Verified</span>' : v?.status==='P' ? '<span class="badge by">⏳ Pending</span>' : '<span class="badge br">Unverified</span>';
            return `<tr><td><div class="cell-flex"><div class="av av-blue">${(p.full_name||'S').charAt(0).toUpperCase()}</div><span class="av-name">${p.full_name||'—'}</span></div></td><td>${badge}</td><td style="font-size:11.5px;color:var(--muted)">${fmtDate(p.created_date)}</td></tr>`;
        }).join('') || '<tr class="em-row"><td colspan="3">No students yet</td></tr>';
    }

    const tblVn = document.getElementById('tblVendors');
    if (tblVn) {
        tblVn.innerHTML = D.vendors.slice(0,5).map(v=>`<tr>
            <td><div class="cell-flex"><div class="av av-green">${v.name.charAt(0).toUpperCase()}</div><span class="av-name">${v.name}</span></div></td>
            <td><span class="badge bt">${branchCnt[v.vendor_id]||0} br</span></td>
            <td>${v.is_active?'<span class="badge bg">Active</span>':'<span class="badge br">Inactive</span>'}</td>
        </tr>`).join('') || '<tr class="em-row"><td colspan="3">No vendors yet</td></tr>';
    }

    const tblDl = document.getElementById('tblDeals');
    if (tblDl) {
        tblDl.innerHTML = D.deals.filter(d=>d.is_active).slice(0,5).map(d=>`<tr>
            <td><span class="truncate" style="font-weight:700;font-size:12px">${d.title||'—'}</span></td>
            <td><span class="badge bp" style="font-size:10px">${vendorMap.get(d.vendor_id)||'—'}</span></td>
            <td style="font-size:11px;color:var(--muted)">${fmtDate(d.valid_until)}</td>
        </tr>`).join('') || '<tr class="em-row"><td colspan="3">No active deals</td></tr>';
    }

    const tblBr = document.getElementById('tblBranches');
    if (tblBr) {
        tblBr.innerHTML = D.branches.slice(0,5).map(b=>`<tr>
            <td style="font-weight:700;font-size:12.5px">${b.branch_name||'—'}</td>
            <td style="font-size:11.5px;color:var(--muted)">${vendorMap.get(b.vendor_id)||'—'}</td>
            <td>${b.is_active?'<span class="badge bg">Active</span>':'<span class="badge br">Inactive</span>'}</td>
        </tr>`).join('') || '<tr class="em-row"><td colspan="3">No branches</td></tr>';
    }

    const tblPr = document.getElementById('tblProducts');
    if (tblPr) {
        tblPr.innerHTML = D.products.slice(0,5).map(p=>`<tr>
            <td style="font-weight:700;font-size:12.5px">${p.product_name}</td>
            <td><span class="badge bt">${subCnt[p.product_id]||0}</span></td>
        </tr>`).join('') || '<tr class="em-row"><td colspan="2">No products</td></tr>';
    }
}

function renderCharts() {
    const monthLabels = [];
    const monthCounts = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthLabels.push(d.toLocaleString('en-US',{month:'short',year:'2-digit'}));
        const count = D.profiles.filter(p => {
            const pd = new Date(p.created_date);
            return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        }).length;
        monthCounts.push(count);
    }
    if (chartLine) chartLine.destroy();
    const lineEl = document.getElementById('chartLine');
    if (lineEl) {
        chartLine = new Chart(lineEl, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [{
                    label: 'Students', data: monthCounts,
                    borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)',
                    borderWidth: 2.5, fill: true, tension: 0.4,
                    pointBackgroundColor: '#4f46e5', pointRadius: 4
                }]
            },
            options: {
                responsive: true, plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, font:{size:11} }, grid:{ color:'#f0f0f0' } },
                    x: { ticks: { font:{size:11} }, grid:{ display:false } }
                }
            }
        });
    }

    const verified  = D.profiles.filter(p=>p.is_verified).length;
    const pending   = D.verifs.filter(v=>v.status==='P').length;
    const unverified= D.profiles.length - verified - pending;
    if (chartDonut) chartDonut.destroy();
    const donutEl = document.getElementById('chartDonut');
    if (donutEl) {
        chartDonut = new Chart(donutEl, {
            type: 'doughnut',
            data: {
                labels: ['Verified', 'Pending', 'Unverified'],
                datasets: [{
                    data: [verified, pending, Math.max(0,unverified)],
                    backgroundColor: ['#10b981','#f59e0b','#ef4444'],
                    borderWidth: 2, borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                cutout: '68%',
                plugins: {
                    legend: { position: 'bottom', labels: { font:{size:11}, padding: 10 } }
                }
            }
        });
    }

    const catMap = new Map(D.categories.map(c=>[c.category_id, c.name]));
    const catCount = {};
    D.deals.filter(d=>d.is_active).forEach(d=>{
        const name = catMap.get(d.category_id) || 'Other';
        catCount[name] = (catCount[name]||0)+1;
    });
    const catLabels = Object.keys(catCount);
    const catVals   = Object.values(catCount);
    const barColors = ['#4f46e5','#10b981','#f59e0b','#8b5cf6','#0ea5e9','#f97316','#ec4899','#ef4444'];
    if (chartBar) chartBar.destroy();
    const barEl = document.getElementById('chartBar');
    if (barEl) {
        chartBar = new Chart(barEl, {
            type: 'bar',
            data: {
                labels: catLabels,
                datasets: [{
                    label: 'Active Deals', data: catVals,
                    backgroundColor: catLabels.map((_,i)=>barColors[i%barColors.length]+'cc'),
                    borderRadius: 7, borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                plugins: { legend:{ display:false } },
                scales: {
                    y: { beginAtZero:true, ticks:{ stepSize:1, font:{size:11} }, grid:{ color:'#f0f0f0' } },
                    x: { ticks:{ font:{size:10} }, grid:{ display:false } }
                }
            }
        });
    }
}

const drawerTitles = {
    students: '🎓 All Students',
    vendors:  '🏪 All Vendors',
    deals:    '🎁 All Deals',
    branches: '🏢 All Branches',
    products: '📦 All Products'
};

function openDrawer(type) {
    currentDrawerType = type;
    document.getElementById('drawerTitle').textContent = drawerTitles[type] || 'Details';
    document.getElementById('drawerSearch').value = '';
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    renderDrawerContent(type, '');
}

function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
}

function filterDrawer() {
    const q = document.getElementById('drawerSearch').value.toLowerCase();
    renderDrawerContent(currentDrawerType, q);
}

function renderDrawerContent(type, q) {
    const vendorMap = new Map(D.vendors.map(v=>[v.vendor_id,v.name]));
    const verifMap  = new Map(D.verifs.map(v=>[v.user_id,v]));
    const branchCnt = {};
    D.branches.forEach(b=>{ branchCnt[b.vendor_id]=(branchCnt[b.vendor_id]||0)+1; });
    const subCnt = {};
    D.subProducts.forEach(s=>{ subCnt[s.product_id]=(subCnt[s.product_id]||0)+1; });

    let html = '';
    let total = 0;

    if (type === 'students') {
        const rows = D.profiles.filter(p=> !q || (p.full_name||'').toLowerCase().includes(q));
        total = rows.length;
        html = `<table><thead><tr><th>Student</th><th>Status</th><th>Verified</th><th>Joined</th></tr></thead><tbody>` +
            (rows.length === 0 ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No results</td></tr>` :
            rows.map(p=>{
                const v = verifMap.get(p.user_id);
                const badge = p.is_verified ? '<span class="badge bg">✅ Verified</span>' : v?.status==='P' ? '<span class="badge by">⏳ Pending</span>' : '<span class="badge br">Unverified</span>';
                return `<tr><td><div class="cell-flex"><div class="av av-blue">${(p.full_name||'S').charAt(0).toUpperCase()}</div><span class="av-name">${p.full_name||'—'}</span></div></td><td>${badge}</td><td style="font-size:11.5px">${p.is_verified?'Yes':'No'}</td><td style="font-size:11.5px;color:var(--muted)">${fmtDate(p.created_date)}</td></tr>`;
            }).join('')) + `</tbody></table>`;
    }

    else if (type === 'vendors') {
        const rows = D.vendors.filter(v=> !q || v.name.toLowerCase().includes(q));
        total = rows.length;
        html = `<table><thead><tr><th>Vendor</th><th>Branches</th><th>Status</th></tr></thead><tbody>` +
            (rows.length === 0 ? `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--muted)">No results</td></tr>` :
            rows.map(v=>`<tr>
                <td><div class="cell-flex"><div class="av av-green">${v.name.charAt(0).toUpperCase()}</div><span class="av-name">${v.name}</span></div></td>
                <td><span class="badge bt">${branchCnt[v.vendor_id]||0} branches</span></td>
                <td>${v.is_active?'<span class="badge bg">Active</span>':'<span class="badge br">Inactive</span>'}</td>
            </tr>`).join('')) + `</tbody></table>`;
    }

    else if (type === 'deals') {
        const rows = D.deals.filter(d=> !q || (d.title||'').toLowerCase().includes(q) || (vendorMap.get(d.vendor_id)||'').toLowerCase().includes(q));
        total = rows.length;
        html = `<table><thead><tr><th>Deal Title</th><th>Vendor</th><th>Status</th><th>Expires</th></tr></thead><tbody>` +
            (rows.length === 0 ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No results</td></tr>` :
            rows.map(d=>`<tr>
                <td style="font-weight:700;max-width:150px"><span class="truncate">${d.title||'—'}</span></td>
                <td style="font-size:11.5px">${vendorMap.get(d.vendor_id)||'—'}</td>
                <td>${d.is_active?'<span class="badge bg">Active</span>':'<span class="badge br">Inactive</span>'}</td>
                <td style="font-size:11.5px;color:var(--muted)">${fmtDate(d.valid_until)}</td>
            </tr>`).join('')) + `</tbody></table>`;
    }

    else if (type === 'branches') {
        const rows = D.branches.filter(b=> !q || (b.branch_name||'').toLowerCase().includes(q) || (vendorMap.get(b.vendor_id)||'').toLowerCase().includes(q));
        total = rows.length;
        html = `<table><thead><tr><th>Branch Name</th><th>Vendor</th><th>Location</th><th>Status</th></tr></thead><tbody>` +
            (rows.length === 0 ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No results</td></tr>` :
            rows.map(b=>`<tr>
                <td style="font-weight:700">${b.branch_name||'—'}</td>
                <td style="font-size:11.5px">${vendorMap.get(b.vendor_id)||'—'}</td>
                <td style="font-size:11.5px;color:var(--muted)">${b.location||'—'}</td>
                <td>${b.is_active?'<span class="badge bg">Active</span>':'<span class="badge br">Inactive</span>'}</td>
            </tr>`).join('')) + `</tbody></table>`;
    }

    else if (type === 'products') {
        const rows = D.products.filter(p=> !q || p.product_name.toLowerCase().includes(q));
        total = rows.length;
        html = `<table><thead><tr><th>Product</th><th>Sub-Products</th></tr></thead><tbody>` +
            (rows.length === 0 ? `<tr><td colspan="2" style="text-align:center;padding:24px;color:var(--muted)">No results</td></tr>` :
            rows.map(p=>`<tr>
                <td style="font-weight:700">${p.product_name}</td>
                <td><span class="badge bt">${subCnt[p.product_id]||0} sub-products</span></td>
            </tr>`).join('')) + `</tbody></table>`;
    }

    document.getElementById('drawerBody').innerHTML = html;
    document.getElementById('drawerCount').textContent = `Showing ${total} record${total !== 1 ? 's' : ''}`;
}
