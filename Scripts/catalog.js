/**
 * Catalog Setup Manager Controller
 */

let currentTab = 'category';
let currentRecords = [];
let selectedRecord = null;

// GLOBAL HIERARCHY CONTEXT (STRICT FK CASCADING)
let selectedCategoryId = null;
let selectedVendorId = null;
let selectedProductId = null;

// Master Data Caches
let allCategories = [];
let allVendors = [];
let allProducts = [];
let allVendorRoles = [];
let allVendorUsers = [];
let allSystemUsers = [];
let editingVendorUserId = null;


const tabConfigs = {
    category: { title: 'Category', table: 'categories_t', pk: 'category_id', nameCol: 'name', bucket: 'categories' },
    vendor: { title: 'Vendor', table: 'vendors_t', pk: 'vendor_id', nameCol: 'name', bucket: 'vendors' },
    branch: { title: 'Branch', table: 'branches_t', pk: 'branch_id', nameCol: 'branch_name', bucket: null },
    product: { title: 'Product', table: 'products_t', pk: 'product_id', nameCol: 'product_name', bucket: 'product' },
    sub_product: { title: 'Sub-Product', table: 'sub_products_t', pk: 'sub_product_id', nameCol: 'sub_product_name', bucket: 'sub product' }
};

function slugify(text) {
    return (text || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').trim();
}

function showAlert(msg, type = 'success') {
    showToast(msg, type, 10000);
    const box = document.getElementById('alertBox');
    if (box) box.style.display = 'none';
}

function showFileName(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files.length > 0) {
        preview.textContent = `✓ Selected: ${input.files[0].name}`;
    }
}

function getVendorUserScopedVendorId() {
    const urlParams = new URLSearchParams(window.location.search);
    const adminUser = localStorage.getItem('supabase_admin_user');
    let userObj = {};
    try { userObj = JSON.parse(adminUser); } catch(e) {}
    const scopedVendorId = urlParams.get('vendor_id') || userObj.vendor_id;
    return (scopedVendorId && scopedVendorId !== '' && scopedVendorId !== 'null') ? parseInt(scopedVendorId) : null;
}

function isVendorUserRole() {
    const urlParams = new URLSearchParams(window.location.search);
    const adminUser = localStorage.getItem('supabase_admin_user');
    let userObj = {};
    try { userObj = JSON.parse(adminUser); } catch(e) {}

    const scopedVendorId = urlParams.get('vendor_id') || userObj.vendor_id;
    const userRole = urlParams.get('role') || userObj.role_code;
    const roleId = userObj.role_id;
    return !!(userRole === 'V' || userRole === 'VM' || userRole === 'BV' || roleId == 2 || roleId == 4 || (scopedVendorId && userRole !== 'A' && roleId != 1));
}

function enforceVendorContext() {
    if (isVendorUserRole()) {
        const scopedVid = getVendorUserScopedVendorId();
        if (scopedVid) {
            selectedVendorId = scopedVid;
            const vObj = allVendors.find(v => v.vendor_id == selectedVendorId);
            if (vObj) selectedCategoryId = vObj.category_id;
        }
    }
}

// Render Breadcrumb Context UI
function renderBreadcrumbBar() {
    const bar = document.getElementById('contextBreadcrumbBar') || document.querySelector('.context-breadcrumb-bar');
    if (isVendorUserRole()) {
        if (bar) bar.style.display = 'none';
        return;
    } else if (bar) {
        bar.style.display = 'flex';
    }

    const container = document.getElementById('breadcrumbContainer');
    if (!container) return;
    let html = '<span>Hierarchy Context:</span>';

    const catObj = allCategories.find(c => c.category_id == selectedCategoryId);
    const vendObj = allVendors.find(v => v.vendor_id == selectedVendorId);
    const prodObj = allProducts.find(p => p.product_id == selectedProductId);

    let chips = [];
    if (catObj) {
        chips.push(`<div class="breadcrumb-chip">📁 Category: ${catObj.name} <span class="remove-btn" onclick="clearCategoryContext()">×</span></div>`);
    }
    if (vendObj) {
        chips.push(`<div class="breadcrumb-chip">🏪 Vendor: ${vendObj.name} <span class="remove-btn" onclick="clearVendorContext()">×</span></div>`);
    }
    if (prodObj) {
        chips.push(`<div class="breadcrumb-chip">📦 Product: ${prodObj.product_name} <span class="remove-btn" onclick="clearProductContext()">×</span></div>`);
    }

    if (chips.length > 0) {
        html += chips.join(' ➔ ');
    } else {
        html += '<span style="color: #64748b; font-weight: 500;">No master selected (Showing all records)</span>';
    }

    container.innerHTML = html;
}

function clearCategoryContext() {
    if (isVendorUserRole()) {
        enforceVendorContext();
    } else {
        selectedCategoryId = null;
        selectedVendorId = null;
        selectedProductId = null;
    }
    onContextChange();
}

function clearVendorContext() {
    if (isVendorUserRole()) {
        enforceVendorContext();
    } else {
        selectedVendorId = null;
        selectedProductId = null;
    }
    onContextChange();
}

function clearProductContext() {
    selectedProductId = null;
    onContextChange();
}

function clearHierarchyContext() {
    if (isVendorUserRole()) {
        enforceVendorContext();
    } else {
        selectedCategoryId = null;
        selectedVendorId = null;
        selectedProductId = null;
    }
    onContextChange();
}

async function onContextChange() {
    renderBreadcrumbBar();
    renderLeftFilterBar();
    await fetchRecordsList();
    renderFormFields();
}

// Switch Tab
async function switchActiveTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetTabBtn = document.getElementById(`tab_${tabName}`);
    if (targetTabBtn) targetTabBtn.classList.add('active');

    const titlePrefix = tabConfigs[tabName].title === 'Category' ? 'Categories' : `${tabConfigs[tabName].title}s`;
    const titleEl = document.getElementById('listPanelTitle');
    if (titleEl) titleEl.textContent = `${titlePrefix} List`;

    await reloadCoreMasterData();
    if (tabName === 'branch' || tabName === 'vendor') {
        await fetchBranchVendorUsers();
    }

    resetFormToCreate();
    renderBreadcrumbBar();
    renderLeftFilterBar();
    await fetchRecordsList();
}

// Reload Master Lists
async function reloadCoreMasterData() {
    try {
        const { data: cats } = await window.sbClient.from('categories_t').select('category_id, name, order_by, is_active').order('order_by', { ascending: true });
        allCategories = cats || [];

        const { data: vends } = await window.sbClient.from('vendors_t').select('vendor_id, name, category_id, is_active').order('name');
        allVendors = vends || [];

        const { data: prods } = await window.sbClient.from('products_t').select('product_id, product_name, vendor_id, is_active').order('product_name');
        allProducts = prods || [];

        const { data: vRoles } = await window.sbClient
            .from('general_parameter_dt')
            .select('detail_id, detail_name, abbreviation, general_parameter_hd!inner(description)')
            .eq('general_parameter_hd.description', 'VENDOR_ROLES')
            .eq('is_active', true)
            .order('order_by');

        allVendorRoles = vRoles || [];
        if (!allVendorRoles || allVendorRoles.length === 0) {
            allVendorRoles = [
                { abbreviation: 'M', detail_name: 'Manager' },
                { abbreviation: 'S', detail_name: 'Supervisor' },
                { abbreviation: 'C', detail_name: 'Cashier' }
            ];
        }

        await fetchBranchVendorUsers();
    } catch (err) {
        console.error('Error fetching master data:', err);
        allVendorRoles = [
            { abbreviation: 'M', detail_name: 'Manager' },
            { abbreviation: 'S', detail_name: 'Supervisor' },
            { abbreviation: 'C', detail_name: 'Cashier' }
        ];
    }
}

async function fetchBranchVendorUsers() {
    try {
        const { data: vUsers } = await window.sbClient
            .from('vendor_users_t')
            .select('*')
            .order('created_date', { ascending: false });
        allVendorUsers = vUsers || [];

        const { data: sysUsers } = await window.sbClient
            .from('users_t')
            .select('user_id, email, role_id');
        allSystemUsers = sysUsers || [];
    } catch (err) {
        console.error('Error fetching vendor users:', err);
        allVendorUsers = [];
    }
}

// Render Left Filter Controls Bar
function renderLeftFilterBar() {
    const container = document.getElementById('leftFilterContainer');
    if (!container) return;

    if (currentTab === 'category') {
        container.innerHTML = `
        <input type="text" id="leftSearchInput" class="search-input" placeholder="🔍 Search categories by name..." oninput="filterRecordsList()">
    `;
    } else if (currentTab === 'vendor') {
        container.innerHTML = `
        <div class="filter-row">
            <select id="leftCategoryFilter" class="filter-select" onchange="onLeftCategoryFilterChange(this.value)">
                <option value="">-- All Categories --</option>
                ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
        </div>
        <input type="text" id="leftSearchInput" class="search-input" placeholder="🔍 Search vendors by name..." oninput="filterRecordsList()">
    `;
    } else if (currentTab === 'branch' || currentTab === 'product') {
        const filteredVendors = selectedCategoryId ? allVendors.filter(v => v.category_id == selectedCategoryId) : allVendors;

        container.innerHTML = `
        <div class="filter-row">
            <select id="leftCategoryFilter" class="filter-select" ${isVendorUserRole() ? 'disabled' : ''} onchange="onLeftCategoryFilterChange(this.value)">
                <option value="">-- All Categories --</option>
                ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <select id="leftVendorFilter" class="filter-select" ${isVendorUserRole() ? 'disabled' : ''} onchange="onLeftVendorFilterChange(this.value)">
                <option value="">-- ${selectedCategoryId ? 'Filtered Vendors' : 'All Vendors'} --</option>
                ${filteredVendors.map(v => `<option value="${v.vendor_id}" ${selectedVendorId == v.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
            </select>
        </div>
        <input type="text" id="leftSearchInput" class="search-input" placeholder="🔍 Search ${currentTab}s by name..." oninput="filterRecordsList()">
    `;
    } else if (currentTab === 'sub_product') {
        const filteredVendors = selectedCategoryId ? allVendors.filter(v => v.category_id == selectedCategoryId) : allVendors;
        const filteredProducts = selectedVendorId ? allProducts.filter(p => p.vendor_id == selectedVendorId) : allProducts;

        container.innerHTML = `
        <div class="filter-row">
            <select id="leftCategoryFilter" class="filter-select" ${isVendorUserRole() ? 'disabled' : ''} onchange="onLeftCategoryFilterChange(this.value)">
                <option value="">-- All Categories --</option>
                ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <select id="leftVendorFilter" class="filter-select" ${isVendorUserRole() ? 'disabled' : ''} onchange="onLeftVendorFilterChange(this.value)">
                <option value="">-- ${selectedCategoryId ? 'Filtered Vendors' : 'All Vendors'} --</option>
                ${filteredVendors.map(v => `<option value="${v.vendor_id}" ${selectedVendorId == v.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
            </select>
        </div>
        <div class="filter-row">
            <select id="leftProductFilter" class="filter-select" onchange="onLeftProductFilterChange(this.value)">
                <option value="">-- ${selectedVendorId ? 'Filtered Products' : 'All Products'} --</option>
                ${filteredProducts.map(p => `<option value="${p.product_id}" ${selectedProductId == p.product_id ? 'selected' : ''}>${p.product_name}</option>`).join('')}
            </select>
        </div>
        <input type="text" id="leftSearchInput" class="search-input" placeholder="🔍 Search sub-products..." oninput="filterRecordsList()">
    `;
    }
}

function onLeftCategoryFilterChange(catId) {
    selectedCategoryId = catId ? parseInt(catId) : null;
    selectedVendorId = null;
    selectedProductId = null;
    onContextChange();
}

function onLeftVendorFilterChange(vendId) {
    selectedVendorId = vendId ? parseInt(vendId) : null;
    selectedProductId = null;
    onContextChange();
}

function onLeftProductFilterChange(prodId) {
    selectedProductId = prodId ? parseInt(prodId) : null;
    onContextChange();
}

// Fetch Records based on Active Tab & Hierarchy Filters
async function fetchRecordsList() {
    if (isVendorUserRole()) {
        enforceVendorContext();
    }
    const config = tabConfigs[currentTab];
    const container = document.getElementById('recordsListContainer');
    if (!container) return;
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading records...</div>';

    try {
        let query;

        if (currentTab === 'category') {
            query = window.sbClient.from('categories_t').select('*, uploaded_files_t(file_path)').order('order_by', { ascending: true });
        }
        else if (currentTab === 'vendor') {
            query = window.sbClient.from('vendors_t').select('*, logo_file:uploaded_files_t!logo_file_id(file_path), banner_file:uploaded_files_t!banner_file_id(file_path), categories_t(name)').order('order_by', { ascending: true });
            if (selectedCategoryId) {
                query = query.eq('category_id', selectedCategoryId);
            }
            await fetchBranchVendorUsers();
        }
        else if (currentTab === 'branch') {
            query = window.sbClient.from('branches_t').select('*, vendors_t(name, category_id)').order('order_by', { ascending: true });
            if (selectedVendorId) {
                query = query.eq('vendor_id', selectedVendorId);
            } else if (selectedCategoryId) {
                const validVendIds = allVendors.filter(v => v.category_id == selectedCategoryId).map(v => v.vendor_id);
                if (validVendIds.length > 0) query = query.in('vendor_id', validVendIds);
                else { currentRecords = []; renderRecordsList([]); return; }
            }
            await fetchBranchVendorUsers();
        }
        else if (currentTab === 'product') {
            query = window.sbClient.from('products_t').select('*, uploaded_files_t(file_path), vendors_t(name, category_id)').order('order_by', { ascending: true });
            if (selectedVendorId) {
                query = query.eq('vendor_id', selectedVendorId);
            } else if (selectedCategoryId) {
                const validVendIds = allVendors.filter(v => v.category_id == selectedCategoryId).map(v => v.vendor_id);
                if (validVendIds.length > 0) query = query.in('vendor_id', validVendIds);
                else { currentRecords = []; renderRecordsList([]); return; }
            }
        }
        else if (currentTab === 'sub_product') {
            query = window.sbClient.from('sub_products_t').select('*, uploaded_files_t(file_path), vendors_t(name), products_t(product_name)').order('order_by', { ascending: true });
            if (selectedProductId) {
                query = query.eq('product_id', selectedProductId);
            } else if (selectedVendorId) {
                query = query.eq('vendor_id', selectedVendorId);
            } else if (selectedCategoryId) {
                const validVendIds = allVendors.filter(v => v.category_id == selectedCategoryId).map(v => v.vendor_id);
                if (validVendIds.length > 0) query = query.in('vendor_id', validVendIds);
                else { currentRecords = []; renderRecordsList([]); return; }
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        currentRecords = data || [];
        filterRecordsList();

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 20px;">Error: ${err.message}</div>`;
    }
}

// Render Records List Items
function renderRecordsList(records) {
    const container = document.getElementById('recordsListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (records.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 30px; font-weight: 500;">No record found</div>`;
        return;
    }

    const config = tabConfigs[currentTab];

    records.forEach(rec => {
        const id = rec[config.pk];
        const name = rec[config.nameCol];
        const isActive = rec.is_active;

        let subText = '';
        if (currentTab === 'vendor' && rec.categories_t) subText = `Category: ${rec.categories_t.name} | Order: #${rec.order_by || rec.vendor_id} | ⭐ ${rec.rating ?? 5.0}`;
        else if (currentTab === 'branch') subText = `Vendor: ${rec.vendors_t ? rec.vendors_t.name : ''} (${rec.location || ''})`;
        else if (currentTab === 'product' && rec.vendors_t) subText = `Vendor: ${rec.vendors_t.name}`;
        else if (currentTab === 'sub_product') subText = `Product: ${rec.products_t ? rec.products_t.product_name : ''} | Vendor: ${rec.vendors_t ? rec.vendors_t.name : ''}`;

        let imgUrl = null;
        if (currentTab === 'category' && rec.uploaded_files_t?.file_path) {
            imgUrl = getVendorLogoUrl(rec.uploaded_files_t.file_path);
        } else if (currentTab === 'vendor' && rec.logo_file?.file_path) {
            imgUrl = getVendorLogoUrl(rec.logo_file.file_path);
        } else if (currentTab === 'product' && rec.uploaded_files_t?.file_path) {
            imgUrl = getVendorLogoUrl(rec.uploaded_files_t.file_path);
        } else if (currentTab === 'sub_product' && rec.uploaded_files_t?.file_path) {
            imgUrl = getVendorLogoUrl(rec.uploaded_files_t.file_path);
        }

        const thumbHtml = imgUrl
            ? `<img src="${imgUrl}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover; border: 1px solid #cbd5e1;" alt="${name}" onerror="this.onerror=null; this.src='../Icons/App Icon.png'">`
            : `<div class="record-img-thumb">${currentTab === 'branch' ? '🏢' : currentTab === 'vendor' ? '🏪' : currentTab === 'category' ? '📁' : '📦'}</div>`;

        const isSelected = selectedRecord && selectedRecord[config.pk] === id;

        const div = document.createElement('div');
        div.className = `record-item ${isSelected ? 'selected' : ''}`;
        div.onclick = () => selectRecordForEdit(rec);

        div.innerHTML = `
        <div class="record-info">
            ${thumbHtml}
            <div class="record-details">
                <h4>${name}</h4>
                <p>${subText ? subText + ' | ' : ''}Order: #${rec.order_by ?? id} (ID: #${id})</p>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
            <button class="btn-sm btn-delete" onclick="event.stopPropagation(); softDeleteById(${id})">Delete</button>
        </div>
    `;
        container.appendChild(div);
    });
}

function filterRecordsList() {
    const term = (document.getElementById('leftSearchInput')?.value || '').toLowerCase();
    const config = tabConfigs[currentTab];
    const filtered = currentRecords.filter(r => {
        const name = (r[config.nameCol] || '').toLowerCase();
        return name.includes(term);
    });
    renderRecordsList(filtered);
}

// Select Record for Edit Mode
async function selectRecordForEdit(record) {
    selectedRecord = record;
    const config = tabConfigs[currentTab];
    const id = record[config.pk];

    if (currentTab === 'category') {
        selectedCategoryId = record.category_id;
    } else if (currentTab === 'vendor') {
        selectedVendorId = record.vendor_id;
        selectedCategoryId = record.category_id;
    } else if (currentTab === 'product') {
        selectedProductId = record.product_id;
        selectedVendorId = record.vendor_id;
        const vend = allVendors.find(v => v.vendor_id == record.vendor_id);
        if (vend) selectedCategoryId = vend.category_id;
    }

    renderBreadcrumbBar();

    document.getElementById('editingRecordId').value = id;
    document.getElementById('formTitle').textContent = `Edit ${config.title} (#${id})`;
    document.getElementById('modeBadge').textContent = 'Mode: Update';
    document.getElementById('modeBadge').style.background = '#3b82f6';
    document.getElementById('btnSubmitForm').textContent = `Update ${config.title}`;
    
    const delContainer = document.getElementById('deleteBtnContainer');
    if (delContainer) {
        delContainer.style.display = 'block';
        const delBtn = delContainer.querySelector('button');
        if (delBtn) {
            const isRecActive = record.is_active !== false;
            if (isRecActive) {
                delBtn.textContent = 'Delete';
                delBtn.className = 'btn-danger-full';
                delBtn.style.background = '#ef4444';
            } else {
                delBtn.textContent = 'Activate';
                delBtn.className = 'btn-primary';
                delBtn.style.background = '#10b981';
            }
        }
    }

    renderFormFields();

    if (currentTab === 'category') {
        document.getElementById('f_cat_name').value = record.name || '';
        document.getElementById('f_cat_order_by').value = record.order_by ?? record.category_id ?? '';
        const imgPath = record.uploaded_files_t?.file_path;
        const box = document.getElementById('prev_cat_img_box');
        if (box) {
            box.innerHTML = imgPath ? `
            <div style="margin-top: 10px; padding: 8px 12px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <img src="${getVendorLogoUrl(imgPath)}" style="height: 48px; max-width: 80px; border-radius: 6px; object-fit: cover; border: 1px solid #a5b4fc;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #3730a3;">Active Uploaded Image</div>
                </div>
            </div>` : '';
        }
    } else if (currentTab === 'vendor') {
        if (document.getElementById('f_ven_category_id')) document.getElementById('f_ven_category_id').value = record.category_id || '';
        if (document.getElementById('f_ven_name')) document.getElementById('f_ven_name').value = record.name || '';
        if (document.getElementById('f_ven_order_by')) document.getElementById('f_ven_order_by').value = record.order_by ?? record.vendor_id ?? '';
        if (document.getElementById('f_ven_rating')) document.getElementById('f_ven_rating').value = record.rating ?? 5.0;

        const logoPath = record.logo_file?.file_path;
        const logoBox = document.getElementById('prev_ven_logo_box');
        if (logoBox) {
            logoBox.innerHTML = logoPath ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <img src="${getVendorLogoUrl(logoPath)}" style="height: 40px; width: 40px; border-radius: 6px; object-fit: cover; border: 1px solid #a5b4fc;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #3730a3;">Active Logo</div>
                </div>
            </div>` : '';
        }

        const bannerPath = record.banner_file?.file_path;
        const bannerBox = document.getElementById('prev_ven_banner_box');
        if (bannerBox) {
            bannerBox.innerHTML = bannerPath ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <img src="${getVendorLogoUrl(bannerPath)}" style="height: 40px; max-width: 90px; border-radius: 6px; object-fit: cover; border: 1px solid #a5b4fc;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #3730a3;">Active Banner</div>
                </div>
            </div>` : '';
        }
    } else if (currentTab === 'branch') {
        if (record.vendors_t && record.vendors_t.category_id) {
            document.getElementById('f_br_category_id').value = record.vendors_t.category_id;
            onFormCategoryChangeForBranch(record.vendors_t.category_id);
        }
        document.getElementById('f_br_vendor_id').value = record.vendor_id || '';
        document.getElementById('f_br_name').value = record.branch_name || '';
        document.getElementById('f_br_order_by').value = record.order_by ?? record.branch_id ?? '';
        document.getElementById('f_br_location').value = record.location || '';
        document.getElementById('f_br_lat').value = record.latitude || '';
        document.getElementById('f_br_lng').value = record.longitude || '';
        document.getElementById('f_br_address').value = record.address || '';
    } else if (currentTab === 'product') {
        if (record.vendors_t && record.vendors_t.category_id) {
            document.getElementById('f_prod_category_id').value = record.vendors_t.category_id;
            onFormCategoryChangeForProduct(record.vendors_t.category_id);
        }
        document.getElementById('f_prod_vendor_id').value = record.vendor_id || '';
        document.getElementById('f_prod_name').value = record.product_name || '';
        document.getElementById('f_prod_order_by').value = record.order_by ?? record.product_id ?? '';

        const imgPath = record.uploaded_files_t?.file_path;
        const box = document.getElementById('prev_prod_img_box');
        if (box) {
            box.innerHTML = imgPath ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <img src="${getVendorLogoUrl(imgPath)}" style="height: 40px; max-width: 80px; border-radius: 6px; object-fit: cover;">
                <span style="font-size: 11px; font-weight: 800; color: #3730a3;">Active Image</span>
            </div>` : '';
        }
    } else if (currentTab === 'sub_product') {
        const vendObj = allVendors.find(v => v.vendor_id == record.vendor_id);
        if (vendObj && vendObj.category_id) {
            document.getElementById('f_sub_category_id').value = vendObj.category_id;
            onFormCategoryChangeForSubProduct(vendObj.category_id);
        }
        document.getElementById('f_sub_vendor_id').value = record.vendor_id || '';
        onFormVendorChangeForSubProduct(record.vendor_id);
        document.getElementById('f_sub_product_id').value = record.product_id || '';
        document.getElementById('f_sub_name').value = record.sub_product_name || '';
        document.getElementById('f_sub_order_by').value = record.order_by ?? record.sub_product_id ?? '';

        const imgPath = record.uploaded_files_t?.file_path;
        const box = document.getElementById('prev_sub_img_box');
        if (box) {
            box.innerHTML = imgPath ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <img src="${getVendorLogoUrl(imgPath)}" style="height: 40px; max-width: 80px; border-radius: 6px; object-fit: cover;">
                <span style="font-size: 11px; font-weight: 800; color: #3730a3;">Active Image</span>
            </div>` : '';
        }
    }

    renderRecordsList(currentRecords);
}

// Reset Form
function resetFormToCreate() {
    selectedRecord = null;
    const config = tabConfigs[currentTab];

    const editIdEl = document.getElementById('editingRecordId');
    if (editIdEl) editIdEl.value = '';
    const formTitleEl = document.getElementById('formTitle');
    if (formTitleEl) formTitleEl.textContent = `Create ${config.title}`;
    const modeBadgeEl = document.getElementById('modeBadge');
    if (modeBadgeEl) {
        modeBadgeEl.textContent = 'Mode: Create';
        modeBadgeEl.style.background = 'var(--primary)';
    }
    const btnSubmitEl = document.getElementById('btnSubmitForm');
    if (btnSubmitEl) btnSubmitEl.textContent = `Save ${config.title}`;
    const delContainerEl = document.getElementById('deleteBtnContainer');
    if (delContainerEl) delContainerEl.style.display = 'none';

    renderFormFields();
    renderRecordsList(currentRecords);
}

// Render Right Form Fields
function renderFormFields() {
    const container = document.getElementById('formFieldsContainer');
    if (!container) return;

    const defaultBtnGroup = document.querySelector('.form-panel > form > .btn-group');
    const defaultDeleteDiv = document.getElementById('deleteBtnContainer');

    if (currentTab === 'branch' || currentTab === 'vendor') {
        if (defaultBtnGroup) defaultBtnGroup.style.display = 'none';
        if (defaultDeleteDiv) defaultDeleteDiv.style.display = 'none';
    } else {
        if (defaultBtnGroup) defaultBtnGroup.style.display = 'flex';
        if (defaultDeleteDiv && selectedRecord) defaultDeleteDiv.style.display = 'block';
    }

    if (currentTab === 'category') {
        container.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Category Name *</label>
                <input type="text" id="f_cat_name" placeholder="e.g. Food & Beverages, Fashion" required>
            </div>
            <div class="form-group">
                <label>Order By</label>
                <input type="number" id="f_cat_order_by" placeholder="e.g. 1" min="1">
            </div>
        </div>
        <div class="form-group full-width">
            <label>Category Image</label>
            <div class="file-dropzone">
                <input type="file" id="f_cat_image" accept="image/*" onchange="showFileName(this, 'prev_cat_img')">
                <div class="file-dropzone-text">📁 Drag & Drop or <span>Browse Image</span></div>
                <div id="prev_cat_img" class="file-preview-name"></div>
            </div>
            <div id="prev_cat_img_box"></div>
        </div>
    `;
    }
    else if (currentTab === 'vendor') {
        const currentVendorId = selectedRecord?.vendor_id;
        let activeMainVendorUsers = [];
        if (currentVendorId) {
            activeMainVendorUsers = allVendorUsers.filter(u => u.vendor_id == currentVendorId && !u.branch_id);
        }

        container.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Select Category *</label>
                <select id="f_ven_category_id" required>
                    <option value="">-- Choose Category --</option>
                    ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Vendor / Brand Name *</label>
                <input type="text" id="f_ven_name" placeholder="e.g. KFC, Nike" required>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Order By</label>
                <input type="number" id="f_ven_order_by" placeholder="e.g. 1" min="1">
            </div>
            <div class="form-group">
                <label>Vendor Rating (⭐ 1.0 - 5.0)</label>
                <input type="number" id="f_ven_rating" placeholder="e.g. 4.8" min="1.0" max="5.0" step="0.1" value="5.0">
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Logo Image</label>
                <div class="file-dropzone">
                    <input type="file" id="f_ven_logo" accept="image/*" onchange="showFileName(this, 'prev_ven_logo')">
                    <div class="file-dropzone-text">🖼️ Select Logo</div>
                    <div id="prev_ven_logo" class="file-preview-name"></div>
                </div>
                <div id="prev_ven_logo_box"></div>
            </div>
            <div class="form-group">
                <label>Banner Image</label>
                <div class="file-dropzone">
                    <input type="file" id="f_ven_banner" accept="image/*" onchange="showFileName(this, 'prev_ven_banner')">
                    <div class="file-dropzone-text">🖼️ Select Banner</div>
                    <div id="prev_ven_banner" class="file-preview-name"></div>
                </div>
                <div id="prev_ven_banner_box"></div>
            </div>
        </div>

        <div class="btn-group" style="margin-top: 16px; margin-bottom: 14px;">
            <button type="submit" class="btn-primary" id="btnSubmitForm">${currentVendorId ? 'Update Vendor' : 'Save Vendor'}</button>
            <button type="button" class="btn-secondary" onclick="resetFormToCreate()">Cancel</button>
        </div>

        ${currentVendorId ? `
        <div style="margin-bottom: 16px;">
            <button type="button" class="${selectedRecord?.is_active !== false ? 'btn-danger-full' : 'btn-primary'}" style="width: 100%; ${selectedRecord?.is_active === false ? 'background: #10b981;' : ''}" onclick="softDeleteCurrentRecord()">
                ${selectedRecord?.is_active !== false ? 'Delete' : 'Activate'}
            </button>
        </div>` : ''}

        ${!currentVendorId ? `
            <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">
                💡 <strong>Save this vendor first.</strong><br>Once the vendor is created, you can register Main Vendor user accounts for it here.
            </div>
        ` : `
            <div class="vendor-staff-container" style="margin-top: 20px;">
                <div class="vstaff-card-header">
                    <h3>👑 Register Main Vendor User Account</h3>
                    <span style="font-size: 11px; font-weight: 700; color: #4f46e5; background: #e0e7ff; padding: 3px 8px; border-radius: 6px;">
                        Vendor #${currentVendorId}
                    </span>
                </div>

                <div class="vstaff-form-box">
                    <input type="hidden" id="f_vuser_role" value="A">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>Account Role</label>
                            <div style="padding: 10px 14px; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 8px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                                👑 <span>Vendor Admin</span>
                            </div>
                        </div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="f_vuser_fullname" placeholder="e.g. Vendor Admin">
                        </div>
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="text" id="f_vuser_phone" placeholder="03001234567">
                        </div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Email Address *</label>
                            <input type="email" id="f_vuser_email" placeholder="vendor@brand.com">
                        </div>
                        <div class="form-group">
                            <label>Password *</label>
                            <input type="password" id="f_vuser_password" placeholder="••••••••" minlength="6">
                        </div>
                    </div>

                    <button type="button" class="btn-action-sm" id="btnCreateVendorUser" style="width: 100% !important; padding: 10px !important; margin-top: 4px;" onclick="handleCreateVendorUser()">
                        ➕ Register Main Vendor Admin
                    </button>
                </div>

                <div class="vstaff-card-header" style="margin-top: 16px;">
                    <h3>📋 Registered Main Vendor Accounts (${activeMainVendorUsers.length})</h3>
                </div>

                <div id="vstaffListContainer">
                    ${activeMainVendorUsers.length === 0 ? `
                        <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;">
                            No main vendor admin accounts registered for this vendor yet.
                        </div>
                    ` : activeMainVendorUsers.map(u => {
                        const initials = (u.full_name || 'MV').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
                        const rCode = u.vendor_role || 'DEFAULT';
                        const rObj = allVendorRoles.find(r => r.abbreviation === rCode);
                        let rName = rObj ? rObj.detail_name : rCode;
                        if (rCode === 'A' || rName === 'A') rName = 'Vendor Admin';
                        const uEmailObj = allSystemUsers.find(sysU => sysU.user_id === u.user_id);
                        const displayEmail = uEmailObj ? uEmailObj.email : 'N/A';

                        return `
                            <div class="vstaff-item-card">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="vstaff-user-avatar">${initials}</div>
                                    <div>
                                        <div style="font-size: 13px; font-weight: 800; color: #1e1b4b;">
                                            ${u.full_name} 
                                            <span class="role-pill role-pill-${rCode}">${rName}</span>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                                            📞 ${u.phone_number || 'N/A'} | ✉️ ${displayEmail}
                                        </div>
                                    </div>
                                </div>
                                <button type="button" class="btn-sm btn-delete" onclick="deleteVendorUser('${u.user_id}')">Remove</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `}
    `;
    }
    else if (currentTab === 'branch') {
        const filteredVendors = selectedCategoryId ? allVendors.filter(v => v.category_id == selectedCategoryId) : allVendors;
        const currentBranchId = selectedRecord?.branch_id;

        let activeBranchUsers = [];
        if (currentBranchId) {
            activeBranchUsers = allVendorUsers.filter(u => u.branch_id == currentBranchId);
        }

        container.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Filter Category (Optional)</label>
                <select id="f_br_category_id" ${isVendorUserRole() ? 'disabled' : ''} onchange="onFormCategoryChangeForBranch(this.value)">
                    <option value="">-- All Categories --</option>
                    ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Select Vendor *</label>
                <select id="f_br_vendor_id" ${isVendorUserRole() ? 'disabled' : ''} required>
                    <option value="">-- Choose Vendor --</option>
                    ${filteredVendors.map(v => `<option value="${v.vendor_id}" ${selectedVendorId == v.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Branch Name *</label>
                <input type="text" id="f_br_name" placeholder="e.g. Gulshan Branch" required>
            </div>
            <div class="form-group">
                <label>Location / City *</label>
                <input type="text" id="f_br_location" placeholder="e.g. Karachi" required>
            </div>
        </div>
        <div class="form-group full-width">
            <label>Order By</label>
            <input type="number" id="f_br_order_by" placeholder="e.g. 1" min="1">
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Latitude</label>
                <input type="number" step="any" id="f_br_lat" placeholder="e.g. 24.8607">
            </div>
            <div class="form-group">
                <label>Longitude</label>
                <input type="number" step="any" id="f_br_lng" placeholder="e.g. 67.0011">
            </div>
        </div>
        <div class="form-group full-width">
            <label>Full Address</label>
            <input type="text" id="f_br_address" placeholder="e.g. Commercial Area Phase 5">
        </div>

        <div class="btn-group" style="margin-top: 16px; margin-bottom: 14px;">
            <button type="submit" class="btn-primary" id="btnSubmitForm">${currentBranchId ? 'Update Branch' : 'Save Branch'}</button>
            <button type="button" class="btn-secondary" onclick="resetFormToCreate()">Cancel</button>
        </div>

        ${currentBranchId ? `
        <div style="margin-bottom: 16px;">
            <button type="button" class="${selectedRecord?.is_active !== false ? 'btn-danger-full' : 'btn-primary'}" style="width: 100%; ${selectedRecord?.is_active === false ? 'background: #10b981;' : ''}" onclick="softDeleteCurrentRecord()">
                ${selectedRecord?.is_active !== false ? 'Delete' : 'Activate'}
            </button>
        </div>` : ''}

        ${!currentBranchId ? `
            <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">
                💡 <strong>Save this branch first.</strong><br>Once the branch is created, you will be able to register vendor staff users for it here.
            </div>
        ` : `
            <div class="vendor-staff-container" style="margin-top: 20px;">
                <div class="vstaff-card-header">
                    <h3>👤 Register Vendor Staff User</h3>
                    <span style="font-size: 11px; font-weight: 700; color: #4f46e5; background: #e0e7ff; padding: 3px 8px; border-radius: 6px;">
                        Branch #${currentBranchId}
                    </span>
                </div>

                <div class="vstaff-form-box">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Vendor Role *</label>
                            <select id="f_vuser_role">
                                <option value="">-- Choose Vendor Role --</option>
                                ${allVendorRoles.map(r => `<option value="${r.abbreviation}">${r.detail_name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="f_vuser_fullname" placeholder="e.g. Tariq Ahmed">
                        </div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="text" id="f_vuser_phone" placeholder="03001234567">
                        </div>
                        <div class="form-group">
                            <label>Email Address *</label>
                            <input type="email" id="f_vuser_email" placeholder="manager@vendor.com">
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label>Password *</label>
                        <input type="password" id="f_vuser_password" placeholder="••••••••" minlength="6">
                    </div>

                    <button type="button" class="btn-action-sm" id="btnCreateVendorUser" style="width: 100% !important; padding: 10px !important; margin-top: 4px;" onclick="handleCreateVendorUser()">
                        ➕ Register Vendor User
                    </button>
                </div>

                <div class="vstaff-card-header" style="margin-top: 16px;">
                    <h3>📋 Registered Vendor Staff (${activeBranchUsers.length})</h3>
                </div>

                <div id="vstaffListContainer">
                    ${activeBranchUsers.length === 0 ? `
                        <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;">
                            No staff accounts registered for this branch yet.
                        </div>
                    ` : activeBranchUsers.map(u => {
                        const initials = (u.full_name || 'VU').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
                        const rCode = u.vendor_role || 'DEFAULT';
                        const rObj = allVendorRoles.find(r => r.abbreviation === rCode);
                        const rName = rObj ? rObj.detail_name : rCode;
                        const uEmailObj = allSystemUsers.find(sysU => sysU.user_id === u.user_id);
                        const displayEmail = uEmailObj ? uEmailObj.email : 'N/A';

                        return `
                            <div class="vstaff-item-card">
                                <div class="vstaff-user-avatar">${initials}</div>
                                <div class="vstaff-info-block">
                                    <div class="vstaff-name-row">
                                        <span>${u.full_name}</span> 
                                        <span class="role-pill role-pill-${rCode}">${rName}</span>
                                    </div>
                                    <div class="vstaff-contact-row">
                                        <span>📞 ${u.phone_number || 'N/A'}</span>
                                        <span>✉️ ${displayEmail}</span>
                                    </div>
                                </div>
                                <div class="vstaff-actions">
                                    <button type="button" class="btn-sm btn-edit" onclick="editVendorUser('${u.user_id}')">✏️ Edit</button>
                                    <button type="button" class="btn-sm btn-delete" onclick="deleteVendorUser('${u.user_id}')">Remove</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `}
    `;
    updateHeaderBarVisibility();
    }

    else if (currentTab === 'product') {
        const filteredVendors = selectedCategoryId ? allVendors.filter(v => v.category_id == selectedCategoryId) : allVendors;

        container.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Filter Category (Optional)</label>
                <select id="f_prod_category_id" ${isVendorUserRole() ? 'disabled' : ''} onchange="onFormCategoryChangeForProduct(this.value)">
                    <option value="">-- All Categories --</option>
                    ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Select Vendor *</label>
                <select id="f_prod_vendor_id" ${isVendorUserRole() ? 'disabled' : ''} required>
                    <option value="">-- Choose Vendor --</option>
                    ${filteredVendors.map(v => `<option value="${v.vendor_id}" ${selectedVendorId == v.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Product Name *</label>
                <input type="text" id="f_prod_name" placeholder="e.g. Zinger Burger, Running Shoes" required>
            </div>
            <div class="form-group">
                <label>Order By</label>
                <input type="number" id="f_prod_order_by" placeholder="e.g. 1" min="1">
            </div>
        </div>
        <div class="form-group full-width">
            <label>Product Image</label>
            <div class="file-dropzone">
                <input type="file" id="f_prod_image" accept="image/*" onchange="showFileName(this, 'prev_prod_img')">
                <div class="file-dropzone-text">📦 Choose Product Image</div>
                <div id="prev_prod_img" class="file-preview-name"></div>
            </div>
            <div id="prev_prod_img_box"></div>
        </div>
    `;
    }
    else if (currentTab === 'sub_product') {
        const filteredVendors = selectedCategoryId ? allVendors.filter(v => v.category_id == selectedCategoryId) : allVendors;
        const filteredProducts = selectedVendorId ? allProducts.filter(p => p.vendor_id == selectedVendorId) : allProducts;

        container.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>1. Select Category *</label>
                <select id="f_sub_category_id" ${isVendorUserRole() ? 'disabled' : ''} onchange="onFormCategoryChangeForSubProduct(this.value)">
                    <option value="">-- All Categories --</option>
                    ${allCategories.map(c => `<option value="${c.category_id}" ${selectedCategoryId == c.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>2. Select Vendor *</label>
                <select id="f_sub_vendor_id" ${isVendorUserRole() ? 'disabled' : ''} onchange="onFormVendorChangeForSubProduct(this.value)" required>
                    <option value="">-- Choose Vendor --</option>
                    ${filteredVendors.map(v => `<option value="${v.vendor_id}" ${selectedVendorId == v.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-group full-width">
            <label>3. Select Product *</label>
            <select id="f_sub_product_id" required>
                <option value="">-- Choose Product --</option>
                ${filteredProducts.map(p => `<option value="${p.product_id}" ${selectedProductId == p.product_id ? 'selected' : ''}>${p.product_name}</option>`).join('')}
            </select>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label>Sub-Product / Variant Name *</label>
                <input type="text" id="f_sub_name" placeholder="e.g. Spicy Zinger, Regular Fries" required>
            </div>
            <div class="form-group">
                <label>Order By</label>
                <input type="number" id="f_sub_order_by" placeholder="e.g. 1" min="1">
            </div>
        </div>
        <div class="form-group full-width">
            <label>Sub-Product Image</label>
            <div class="file-dropzone">
                <input type="file" id="f_sub_image" accept="image/*" onchange="showFileName(this, 'prev_sub_img')">
                <div class="file-dropzone-text">🏷️ Choose Sub-Product Image</div>
                <div id="prev_sub_img" class="file-preview-name"></div>
            </div>
            <div id="prev_sub_img_box"></div>
        </div>
    `;
    }
}

// Cascading Handlers in Form
function onFormCategoryChangeForBranch(catId) {
    const select = document.getElementById('f_br_vendor_id');
    if (!select) return;
    const vends = catId ? allVendors.filter(v => v.category_id == catId) : allVendors;
    select.innerHTML = '<option value="">-- Choose Vendor --</option>' + vends.map(v => `<option value="${v.vendor_id}">${v.name}</option>`).join('');
}

function onFormCategoryChangeForProduct(catId) {
    const select = document.getElementById('f_prod_vendor_id');
    if (!select) return;
    const vends = catId ? allVendors.filter(v => v.category_id == catId) : allVendors;
    select.innerHTML = '<option value="">-- Choose Vendor --</option>' + vends.map(v => `<option value="${v.vendor_id}">${v.name}</option>`).join('');
}

function onFormCategoryChangeForSubProduct(catId) {
    const selectV = document.getElementById('f_sub_vendor_id');
    if (!selectV) return;
    const vends = catId ? allVendors.filter(v => v.category_id == catId) : allVendors;
    selectV.innerHTML = '<option value="">-- Choose Vendor --</option>' + vends.map(v => `<option value="${v.vendor_id}">${v.name}</option>`).join('');
    onFormVendorChangeForSubProduct(selectV.value);
}

function onFormVendorChangeForSubProduct(vendId) {
    const selectP = document.getElementById('f_sub_product_id');
    if (!selectP) return;
    if (!vendId) {
        selectP.innerHTML = '<option value="">Select Vendor First</option>';
        return;
    }
    const prods = allProducts.filter(p => p.vendor_id == vendId);
    if (prods.length > 0) {
        selectP.innerHTML = '<option value="">-- Choose Product --</option>' + prods.map(p => `<option value="${p.product_id}">${p.product_name}</option>`).join('');
    } else {
        selectP.innerHTML = '<option value="">No record found</option>';
    }
}

// Unified Managed Upload Handler
async function processManagedUpload({ bucket, columnName, entityId, entityName, file, oldFileId = null }) {
    if (!file) return null;

    const colLower = (columnName || '').toLowerCase();
    const typeFolder = (colLower.includes('logo') || colLower.includes('icon')) ? 'icons' : 'images';
    const entityFolder = `${entityId}_${slugify(entityName || 'item')}`;

    const lastDotIndex = file.name.lastIndexOf('.');
    let nameWithoutExt = file.name;
    let ext = '';
    if (lastDotIndex > 0) {
        nameWithoutExt = file.name.substring(0, lastDotIndex);
        ext = file.name.substring(lastDotIndex);
    }
    const timestampedFileName = `${nameWithoutExt}_${Date.now()}${ext}`;

    const storagePath = `${typeFolder}/${entityFolder}/${timestampedFileName}`;
    const fullPath = `${bucket}/${storagePath}`;

    const { error: storageErr } = await window.sbClient.storage.from(bucket).upload(storagePath, file, { upsert: true });
    if (storageErr) throw new Error(`Storage Upload Error (${bucket}/${storagePath}): ${storageErr.message}`);

    let fileRecord;
    try {
        const { data, error: fileErr } = await window.sbClient
            .from('uploaded_files_t')
            .insert({
                file_name: timestampedFileName,
                file_path: fullPath,
                file_size_bytes: file.size,
                mime_type: file.type
            })
            .select('file_id')
            .single();

        if (fileErr) throw fileErr;
        fileRecord = data;
    } catch (dbErr) {
        await window.sbClient.storage.from(bucket).remove([storagePath]);
        throw new Error(`Database File Record Error: ${dbErr.message}`);
    }

    if (oldFileId) {
        try {
            const { data: oldFile } = await window.sbClient
                .from('uploaded_files_t')
                .select('file_path')
                .eq('file_id', oldFileId)
                .single();

            if (oldFile && oldFile.file_path) {
                const relativePath = oldFile.file_path.startsWith(`${bucket}/`)
                    ? oldFile.file_path.replace(`${bucket}/`, '')
                    : oldFile.file_path;

                await window.sbClient.storage.from(bucket).remove([relativePath]);
            }
            await window.sbClient.from('uploaded_files_t').delete().eq('file_id', oldFileId);
        } catch (cleanupErr) {
            console.warn('Old file cleanup warning:', cleanupErr);
        }
    }

    return { fileId: fileRecord.file_id, storagePath, fullPath, bucket };
}

async function rollbackManagedUpload(uploadInfo) {
    if (!uploadInfo || !uploadInfo.fileId) return;
    try {
        await window.sbClient.from('uploaded_files_t').delete().eq('file_id', uploadInfo.fileId);
        await window.sbClient.storage.from(uploadInfo.bucket).remove([uploadInfo.storagePath]);
    } catch (e) {
        console.error('Rollback error:', e);
    }
}

// Status Toggle Handler (Activates or Deactivates records)
async function softDeleteById(id, forcedStatus = null) {
    const config = tabConfigs[currentTab];
    const targetRec = currentRecords.find(r => r[config.pk] == id);
    const currentActive = targetRec ? (targetRec.is_active !== false) : true;
    const newStatus = forcedStatus !== null ? forcedStatus : !currentActive;
    const actionText = newStatus ? 'activate' : 'delete';

    if (!confirm(`Are you sure you want to ${actionText} this ${config.title}?`)) return;

    try {
        const { error } = await window.sbClient
            .from(config.table)
            .update({ is_active: newStatus, updated_by: getCleanAdminUser() })
            .eq(config.pk, id);

        if (error) throw error;
        showAlert(`✅ Record #${id} ${newStatus ? 'activated' : 'deleted'} successfully!`);
        if (selectedRecord && selectedRecord[config.pk] === id) resetFormToCreate();
        await reloadCoreMasterData();
        renderLeftFilterBar();
        await fetchRecordsList();
    } catch (err) {
        showAlert(`❌ Failed to update status: ${err.message}`, 'error');
    }
}

async function softDeleteCurrentRecord() {
    const id = document.getElementById('editingRecordId').value;
    if (id) {
        const isRecActive = selectedRecord ? (selectedRecord.is_active !== false) : true;
        await softDeleteById(id, !isRecActive);
    }
}

function updateHeaderBarVisibility() {
    const headerBar = document.querySelector('.header-bar');
    if (headerBar) {
        if (isVendorUserRole()) {
            headerBar.style.display = 'none';
        } else {
            headerBar.style.display = 'flex';
        }
    }
}

function editVendorUser(userId) {
    const u = allVendorUsers.find(usr => usr.user_id === userId);
    if (!u) return;

    editingVendorUserId = userId;

    const roleEl = document.getElementById('f_vuser_role');
    const fnEl = document.getElementById('f_vuser_fullname');
    const phEl = document.getElementById('f_vuser_phone');
    const emEl = document.getElementById('f_vuser_email');
    const pwEl = document.getElementById('f_vuser_password');
    const btn = document.getElementById('btnCreateVendorUser');

    if (roleEl) roleEl.value = u.vendor_role || '';
    if (fnEl) fnEl.value = u.full_name || '';
    if (phEl) phEl.value = u.phone_number || '';

    const uEmailObj = allSystemUsers.find(sysU => sysU.user_id === userId);
    if (emEl) emEl.value = uEmailObj ? uEmailObj.email : '';
    if (pwEl) pwEl.placeholder = '(Leave empty to keep unchanged)';

    if (btn) btn.textContent = '✏️ Update Vendor Staff User';

    let cancelBtn = document.getElementById('btnCancelVendorUserEdit');
    if (!cancelBtn && btn) {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'btnCancelVendorUserEdit';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.style.marginTop = '6px';
        cancelBtn.style.width = '100%';
        cancelBtn.style.padding = '8px';
        cancelBtn.style.fontSize = '12px';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.onclick = resetVendorUserForm;
        btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
    } else if (cancelBtn) {
        cancelBtn.style.display = 'block';
    }
}

function resetVendorUserForm() {
    editingVendorUserId = null;
    const roleEl = document.getElementById('f_vuser_role');
    const fnEl = document.getElementById('f_vuser_fullname');
    const phEl = document.getElementById('f_vuser_phone');
    const emEl = document.getElementById('f_vuser_email');
    const pwEl = document.getElementById('f_vuser_password');
    const btn = document.getElementById('btnCreateVendorUser');
    const cancelBtn = document.getElementById('btnCancelVendorUserEdit');

    if (roleEl) roleEl.value = '';
    if (fnEl) fnEl.value = '';
    if (phEl) phEl.value = '';
    if (emEl) emEl.value = '';
    if (pwEl) { pwEl.value = ''; pwEl.placeholder = '••••••••'; }

    if (btn) btn.textContent = '➕ Register Vendor User';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleCreateVendorUser() {
    let targetVendorId = null;
    let targetBranchId = null;

    if (currentTab === 'vendor') {
        targetVendorId = selectedRecord?.vendor_id || selectedVendorId;
        targetBranchId = null;
        if (!targetVendorId) {
            showAlert('🚨 Please save or select a Vendor first before registering admin accounts!', 'error');
            return;
        }
    } else if (currentTab === 'branch') {
        targetBranchId = selectedRecord?.branch_id;
        const vendorSelect = document.getElementById('f_br_vendor_id');
        targetVendorId = vendorSelect ? parseInt(vendorSelect.value) : (selectedRecord?.vendor_id || selectedVendorId);

        if (!targetBranchId) {
            showAlert('🚨 Please save or select a Branch first before registering staff users!', 'error');
            return;
        }
    } else {
        showAlert('🚨 User registration is supported under Vendor or Branch tab.', 'error');
        return;
    }

    let roleCode = document.getElementById('f_vuser_role')?.value;
    if (currentTab === 'vendor' || !roleCode) {
        roleCode = 'A';
    }

    const fullName = document.getElementById('f_vuser_fullname')?.value.trim();
    const phone = document.getElementById('f_vuser_phone')?.value.trim();
    const email = document.getElementById('f_vuser_email')?.value.trim().toLowerCase();
    const password = document.getElementById('f_vuser_password')?.value;

    if (editingVendorUserId) {
        if (!fullName) {
            showAlert('🚨 Full Name is required!', 'error');
            return;
        }

        const btn = document.getElementById('btnCreateVendorUser');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating Account...'; }

        try {
            const cleanUser = getCleanAdminUser();
            const { error: vuUpErr } = await window.sbClient
                .from('vendor_users_t')
                .update({
                    full_name: fullName,
                    phone_number: phone,
                    vendor_role: roleCode,
                    updated_by: cleanUser
                })
                .eq('user_id', editingVendorUserId);

            if (vuUpErr) throw vuUpErr;

            showAlert(`✅ Vendor Staff User '${fullName}' updated successfully!`);
            resetVendorUserForm();
            await fetchBranchVendorUsers();
            renderFormFields();
        } catch (err) {
            showAlert(`❌ Update Error: ${err.message}`, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '➕ Register Vendor User'; }
        }
        return;
    }

    if (!targetVendorId) {
        showAlert('🚨 Please select a Vendor first!', 'error');
        return;
    }
    if (!fullName || !email || !password) {
        showAlert('🚨 Full Name, Email, and Password are required!', 'error');
        return;
    }


    const btn = document.getElementById('btnCreateVendorUser');
    if (btn) { btn.disabled = true; btn.textContent = 'Registering Account...'; }

    try {
        const authClient = window.supabase.createClient(
            'https://ypxbpwufoioxnvixwmqq.supabase.co',
            'sb_publishable_lLB4-6dkBBrNIdLUS89urQ_HhL_SrXs',
            { auth: { persistSession: false } }
        );

        const { data: authData, error: authErr } = await authClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    role_code: targetBranchId ? 'BV' : 'V',
                    full_name: fullName,
                    phone_number: phone
                }
            }
        });

        if (authErr) throw authErr;

        const newUserId = authData?.user?.id;
        if (!newUserId) throw new Error('Could not retrieve User UUID from Auth response.');

        const targetSysRoleCode = targetBranchId ? 'BV' : 'V';
        const { data: roleRow } = await window.sbClient
            .from('roles_t')
            .select('role_id')
            .eq('role_code', targetSysRoleCode)
            .maybeSingle();

        const resolvedRoleId = roleRow?.role_id || (targetBranchId ? 4 : 2);

        await window.sbClient.from('users_t').upsert({
            user_id: newUserId,
            email: email,
            role_id: resolvedRoleId,
            is_active: true
        }, { onConflict: 'user_id' });

        const cleanUser = getCleanAdminUser();
        const { error: vuErr } = await window.sbClient.from('vendor_users_t').insert({
            user_id: newUserId,
            vendor_id: targetVendorId,
            branch_id: targetBranchId,
            full_name: fullName,
            phone_number: phone,
            vendor_role: roleCode,
            is_active: true,
            created_by: cleanUser
        });

        if (vuErr) throw vuErr;

        showAlert(`🎉 Vendor User '${fullName}' registered successfully!`);

        if (document.getElementById('f_vuser_fullname')) document.getElementById('f_vuser_fullname').value = '';
        if (document.getElementById('f_vuser_email')) document.getElementById('f_vuser_email').value = '';
        if (document.getElementById('f_vuser_password')) document.getElementById('f_vuser_password').value = '';
        if (document.getElementById('f_vuser_phone')) document.getElementById('f_vuser_phone').value = '';

        await fetchBranchVendorUsers();
        renderFormFields();

    } catch (err) {
        showAlert(`❌ Vendor User Error: ${err.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '➕ Register Vendor User'; }
    }
}

async function deleteVendorUser(userId) {
    if (!confirm('Are you sure you want to remove this vendor user account?')) return;
    try {
        const { error } = await window.sbClient.from('vendor_users_t').delete().eq('user_id', userId);
        if (error) throw error;
        showAlert('✅ Vendor user account removed.');
        await fetchBranchVendorUsers();
        renderFormFields();
    } catch (e) {
        showAlert(`❌ Delete error: ${e.message}`, 'error');
    }
}

// Initial Load
window.addEventListener('DOMContentLoaded', async () => {
    if (window.self !== window.top) {
        document.body.classList.add('in-iframe');
    }

    const dynamicForm = document.getElementById('dynamicForm');
    if (dynamicForm) {
        dynamicForm.addEventListener('submit', handleCatalogFormSubmit);
    }

    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    updateHeaderBarVisibility();
    await reloadCoreMasterData();

    const adminUser = localStorage.getItem('supabase_admin_user');
    let userObj = {};
    try { userObj = JSON.parse(adminUser); } catch(e) {}


    const urlParams = new URLSearchParams(window.location.search);
    const scopedVendorId = urlParams.get('vendor_id') || userObj.vendor_id;
    const userRole = urlParams.get('role') || userObj.role_code;
    const isVendorUser = (userRole === 'V' || userRole === 'VM' || userRole === 'BV' || (scopedVendorId && userRole !== 'A'));

    if (scopedVendorId && scopedVendorId !== '' && scopedVendorId !== 'null') {
        selectedVendorId = parseInt(scopedVendorId);
        const vObj = allVendors.find(v => v.vendor_id == selectedVendorId);
        if (vObj) selectedCategoryId = vObj.category_id;
    }

    if (isVendorUser) {
        const catTabBtn = document.getElementById('tab_category');
        const vendTabBtn = document.getElementById('tab_vendor');
        if (catTabBtn) catTabBtn.style.display = 'none';
        if (vendTabBtn) vendTabBtn.style.display = 'none';

        await switchActiveTab('branch');
        return;
    }

    await switchActiveTab('category');
});

// Form Submission Handler
async function handleCatalogFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitForm');
    const editingId = document.getElementById('editingRecordId').value;
    const isEdit = !!editingId;

    btn.disabled = true;
    btn.textContent = isEdit ? 'Updating...' : 'Saving...';

    let upload1Res = null;
    let upload2Res = null;

    try {
        if (currentTab === 'category') {
            const name = document.getElementById('f_cat_name').value.trim();
            const order_by = parseInt(document.getElementById('f_cat_order_by').value) || null;
            const file = document.getElementById('f_cat_image').files[0];

            if (isEdit) {
                let payload = { name, updated_by: getCleanAdminUser() };
                payload.order_by = order_by || parseInt(editingId);

                if (file) {
                    upload1Res = await processManagedUpload({
                        bucket: 'categories',
                        columnName: 'image_file_id',
                        entityId: editingId,
                        entityName: name,
                        file,
                        oldFileId: selectedRecord?.image_file_id
                    });
                    payload.image_file_id = upload1Res.fileId;
                }

                const { error } = await window.sbClient.from('categories_t').update(payload).eq('category_id', editingId);
                if (error) {
                    if (upload1Res) await rollbackManagedUpload(upload1Res);
                    throw error;
                }
                showAlert(`✅ Category updated successfully!`);
            } else {
                let insertObj = { name, is_active: true, created_by: getCleanAdminUser() };
                if (order_by) insertObj.order_by = order_by;

                const { data: newCat, error: createErr } = await window.sbClient
                    .from('categories_t')
                    .insert(insertObj)
                    .select('category_id')
                    .single();

                if (createErr) throw createErr;

                if (!order_by) {
                    await window.sbClient.from('categories_t').update({ order_by: newCat.category_id }).eq('category_id', newCat.category_id);
                }

                if (file) {
                    try {
                        upload1Res = await processManagedUpload({
                            bucket: 'categories',
                            columnName: 'image_file_id',
                            entityId: newCat.category_id,
                            entityName: name,
                            file
                        });
                        await window.sbClient.from('categories_t').update({ image_file_id: upload1Res.fileId }).eq('category_id', newCat.category_id);
                    } catch (imgErr) {
                        if (upload1Res) await rollbackManagedUpload(upload1Res);
                        await window.sbClient.from('categories_t').delete().eq('category_id', newCat.category_id);
                        throw imgErr;
                    }
                }
                showAlert(`✅ Category created successfully!`);
            }
        }
        else if (currentTab === 'vendor') {
            const category_id = parseInt(document.getElementById('f_ven_category_id').value);
            const name = document.getElementById('f_ven_name').value.trim();
            const order_by = parseInt(document.getElementById('f_ven_order_by').value) || null;
            const rating = parseFloat(document.getElementById('f_ven_rating').value) || 5.0;
            const logoFile = document.getElementById('f_ven_logo').files[0];
            const bannerFile = document.getElementById('f_ven_banner').files[0];

            if (isEdit) {
                let payload = { category_id, name, rating, updated_by: getCleanAdminUser() };
                payload.order_by = order_by || parseInt(editingId);

                if (logoFile) {
                    upload1Res = await processManagedUpload({
                        bucket: 'vendors',
                        columnName: 'logo_file_id',
                        entityId: editingId,
                        entityName: name,
                        file: logoFile,
                        oldFileId: selectedRecord?.logo_file_id
                    });
                    payload.logo_file_id = upload1Res.fileId;
                }
                if (bannerFile) {
                    upload2Res = await processManagedUpload({
                        bucket: 'vendors',
                        columnName: 'banner_file_id',
                        entityId: editingId,
                        entityName: name,
                        file: bannerFile,
                        oldFileId: selectedRecord?.banner_file_id
                    });
                    payload.banner_file_id = upload2Res.fileId;
                }

                const { error } = await window.sbClient.from('vendors_t').update(payload).eq('vendor_id', editingId);
                if (error) {
                    if (upload1Res) await rollbackManagedUpload(upload1Res);
                    if (upload2Res) await rollbackManagedUpload(upload2Res);
                    throw error;
                }
                showAlert(`✅ Vendor updated successfully!`);
            } else {
                let insertObj = { category_id, name, rating, is_active: true, created_by: getCleanAdminUser() };
                if (order_by) insertObj.order_by = order_by;

                const { data: newVen, error: createErr } = await window.sbClient
                    .from('vendors_t')
                    .insert(insertObj)
                    .select('vendor_id')
                    .single();

                if (createErr) throw createErr;

                if (!order_by) {
                    await window.sbClient.from('vendors_t').update({ order_by: newVen.vendor_id }).eq('vendor_id', newVen.vendor_id);
                }

                try {
                    let updatePayload = {};
                    if (logoFile) {
                        upload1Res = await processManagedUpload({
                            bucket: 'vendors',
                            columnName: 'logo_file_id',
                            entityId: newVen.vendor_id,
                            entityName: name,
                            file: logoFile
                        });
                        updatePayload.logo_file_id = upload1Res.fileId;
                    }
                    if (bannerFile) {
                        upload2Res = await processManagedUpload({
                            bucket: 'vendors',
                            columnName: 'banner_file_id',
                            entityId: newVen.vendor_id,
                            entityName: name,
                            file: bannerFile
                        });
                        updatePayload.banner_file_id = upload2Res.fileId;
                    }

                    if (Object.keys(updatePayload).length > 0) {
                        const { error: upErr } = await window.sbClient.from('vendors_t').update(updatePayload).eq('vendor_id', newVen.vendor_id);
                        if (upErr) throw upErr;
                    }
                } catch (uploadErr) {
                    if (upload1Res) await rollbackManagedUpload(upload1Res);
                    if (upload2Res) await rollbackManagedUpload(upload2Res);
                    await window.sbClient.from('vendors_t').delete().eq('vendor_id', newVen.vendor_id);
                    throw uploadErr;
                }
                showAlert(`✅ Vendor created successfully!`);
            }
        }
        else if (currentTab === 'branch') {
            const vendor_id = parseInt(document.getElementById('f_br_vendor_id').value) || selectedVendorId;
            const branch_name = document.getElementById('f_br_name').value.trim();
            const location = document.getElementById('f_br_location').value.trim();
            const order_by = parseInt(document.getElementById('f_br_order_by').value) || null;
            const lat = document.getElementById('f_br_lat').value ? parseFloat(document.getElementById('f_br_lat').value) : null;
            const lng = document.getElementById('f_br_lng').value ? parseFloat(document.getElementById('f_br_lng').value) : null;
            const address = document.getElementById('f_br_address').value.trim();

            let payload = { vendor_id, branch_name, location, latitude: lat, longitude: lng, address, is_active: true, created_by: getCleanAdminUser() };
            if (order_by) payload.order_by = order_by;

            if (isEdit) {
                delete payload.created_by;
                payload.updated_by = getCleanAdminUser();
                payload.order_by = order_by || parseInt(editingId);
                const { error } = await window.sbClient.from('branches_t').update(payload).eq('branch_id', editingId);
                if (error) throw error;
                showAlert(`✅ Branch updated successfully!`);
            } else {
                const { data: newBranchData, error } = await window.sbClient.from('branches_t').insert(payload).select().single();
                if (error) throw error;
                if (!order_by && newBranchData) {
                    await window.sbClient.from('branches_t').update({ order_by: newBranchData.branch_id }).eq('branch_id', newBranchData.branch_id);
                }
                showAlert(`✅ Branch created successfully! You can now register vendor staff below.`);
                await fetchRecordsList();
                if (newBranchData) {
                    selectRecordForEdit(newBranchData);
                    return;
                }
            }
        }
        else if (currentTab === 'product') {
            const vendor_id = parseInt(document.getElementById('f_prod_vendor_id').value) || selectedVendorId;
            const product_name = document.getElementById('f_prod_name').value.trim();
            const order_by = parseInt(document.getElementById('f_prod_order_by').value) || null;
            const file = document.getElementById('f_prod_image').files[0];

            if (isEdit) {
                let payload = { vendor_id, product_name, updated_by: getCleanAdminUser() };
                payload.order_by = order_by || parseInt(editingId);

                if (file) {
                    upload1Res = await processManagedUpload({
                        bucket: 'vendors',
                        columnName: 'image_file_id',
                        entityId: editingId,
                        entityName: product_name,
                        file,
                        oldFileId: selectedRecord?.image_file_id
                    });
                    payload.image_file_id = upload1Res.fileId;
                }

                const { error } = await window.sbClient.from('products_t').update(payload).eq('product_id', editingId);
                if (error) {
                    if (upload1Res) await rollbackManagedUpload(upload1Res);
                    throw error;
                }
                showAlert(`✅ Product updated successfully!`);
            } else {
                let insertObj = { vendor_id, product_name, is_active: true, created_by: getCleanAdminUser() };
                if (order_by) insertObj.order_by = order_by;

                const { data: newProd, error: createErr } = await window.sbClient
                    .from('products_t')
                    .insert(insertObj)
                    .select('product_id')
                    .single();

                if (createErr) throw createErr;

                if (!order_by) {
                    await window.sbClient.from('products_t').update({ order_by: newProd.product_id }).eq('product_id', newProd.product_id);
                }

                if (file) {
                    try {
                        upload1Res = await processManagedUpload({
                            bucket: 'vendors',
                            columnName: 'image_file_id',
                            entityId: newProd.product_id,
                            entityName: product_name,
                            file
                        });
                        await window.sbClient.from('products_t').update({ image_file_id: upload1Res.fileId }).eq('product_id', newProd.product_id);
                    } catch (imgErr) {
                        if (upload1Res) await rollbackManagedUpload(upload1Res);
                        await window.sbClient.from('products_t').delete().eq('product_id', newProd.product_id);
                        throw imgErr;
                    }
                }
                showAlert(`✅ Product created successfully!`);
            }
        }
        else if (currentTab === 'sub_product') {
            const vendor_id = parseInt(document.getElementById('f_sub_vendor_id').value) || selectedVendorId;
            const product_id = parseInt(document.getElementById('f_sub_product_id').value);
            const sub_product_name = document.getElementById('f_sub_name').value.trim();
            const order_by = parseInt(document.getElementById('f_sub_order_by').value) || null;
            const file = document.getElementById('f_sub_image').files[0];

            if (isEdit) {
                let payload = { vendor_id, product_id, sub_product_name, updated_by: getCleanAdminUser() };
                payload.order_by = order_by || parseInt(editingId);

                if (file) {
                    upload1Res = await processManagedUpload({
                        bucket: 'vendors',
                        columnName: 'image_file_id',
                        entityId: editingId,
                        entityName: sub_product_name,
                        file,
                        oldFileId: selectedRecord?.image_file_id
                    });
                    payload.image_file_id = upload1Res.fileId;
                }

                const { error } = await window.sbClient.from('sub_products_t').update(payload).eq('sub_product_id', editingId);
                if (error) {
                    if (upload1Res) await rollbackManagedUpload(upload1Res);
                    throw error;
                }
                showAlert(`✅ Sub-Product updated successfully!`);
            } else {
                let insertObj = { vendor_id, product_id, sub_product_name, is_active: true, created_by: getCleanAdminUser() };
                if (order_by) insertObj.order_by = order_by;

                const { data: newSub, error: createErr } = await window.sbClient
                    .from('sub_products_t')
                    .insert(insertObj)
                    .select('sub_product_id')
                    .single();

                if (createErr) throw createErr;

                if (!order_by) {
                    await window.sbClient.from('sub_products_t').update({ order_by: newSub.sub_product_id }).eq('sub_product_id', newSub.sub_product_id);
                }

                if (file) {
                    try {
                        upload1Res = await processManagedUpload({
                            bucket: 'vendors',
                            columnName: 'image_file_id',
                            entityId: newSub.sub_product_id,
                            entityName: sub_product_name,
                            file
                        });
                        await window.sbClient.from('sub_products_t').update({ image_file_id: upload1Res.fileId }).eq('sub_product_id', newSub.sub_product_id);
                    } catch (imgErr) {
                        if (upload1Res) await rollbackManagedUpload(upload1Res);
                        await window.sbClient.from('sub_products_t').delete().eq('sub_product_id', newSub.sub_product_id);
                        throw imgErr;
                    }
                }
                showAlert(`✅ Sub-Product created successfully!`);
            }
        }

        resetFormToCreate();
        await reloadCoreMasterData();
        renderBreadcrumbBar();
        renderLeftFilterBar();
        await fetchRecordsList();

    } catch (err) {
        showAlert(`❌ Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? `Update ${tabConfigs[currentTab].title}` : `Save ${tabConfigs[currentTab].title}`;
    }
}
