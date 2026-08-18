/**
 * Deals Manager Controller
 */

const STORAGE_BUCKET_NAME = 'Deals';

let finePrintList = [
    "Valid student ID required at payment.",
    "One redemption per member, per day.",
    "Not valid with other drops or promotions.",
    "Dine-in and takeaway only."
];

let editingFinePrintIndex = null;
let fetchedDealsData = [];
let editingDealId = null;
let editingDealBannerImageId = null;
let activeVoucherCode = null;
let activeRedeemDealId = null;
let activeVendorLock = null;

const prefixMap = { 'F': 'Flat', 'FI': 'Flat', 'FLAT': 'Flat', 'Flat': 'Flat', 'U': 'Up To', 'UPTO': 'Up To', 'UP TO': 'Up To', 'Up To': 'Up To' };
const typeMap = { 'P': 'Percentage', 'F': 'Flat Amount', 'BG': 'Buy 1 Get 1' };
const tagMap = { 'I': 'Insider', 'N': 'New Arrival', 'E': 'Exclusive', 'T': 'Takeaway', 'D': 'Dine-In', 'DEL': 'Delivery' };
const sectionMap = { 'HTD': 'Hot Trending Deals', 'EOZ': 'Exclusive On Zab', 'DM': 'Daily Mega Deals' };

async function applyVendorLockContext() {
    if (!activeVendorLock) return;

    const catSelect = document.getElementById('category_id');
    const vendorSelect = document.getElementById('vendor_id');
    const catFilter = document.getElementById('dealCategoryFilter');

    if (catSelect && activeVendorLock.category_id) {
        catSelect.value = activeVendorLock.category_id;
        catSelect.disabled = true;
    }

    if (catFilter && activeVendorLock.category_id) {
        catFilter.value = activeVendorLock.category_id;
        catFilter.disabled = true;
    }

    if (vendorSelect && activeVendorLock.vendor_id) {
        await populateVendorsForCategory(activeVendorLock.category_id, activeVendorLock.vendor_id);
        vendorSelect.value = activeVendorLock.vendor_id;
        vendorSelect.disabled = true;
        await populateBranchesAndProductsForVendor(activeVendorLock.vendor_id);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAuthAndSession({ allowDirect: false });
    if (!isAuthorized) return;

    const adminUser = localStorage.getItem('supabase_admin_user');

    let userObj = {};
    try { userObj = JSON.parse(adminUser); } catch(e) {}

    await loadCategories();
    await loadInstitutes();
    await loadParameterDropdown('DISCOUNT_TYPES', 'discount_type');
    await loadParameterDropdown('DAYS_OF_WEEK', 'valid_day_from');
    await loadParameterDropdown('DAYS_OF_WEEK', 'valid_day_to', '7');
    await loadParameterDropdown('DEAL_TAG', 'deal_tag');
    await loadParameterDropdown('DISCOUNT_PREFIX', 'discount_prefix');
    await loadParameterDropdown('HOME_SECTIONS', 'home_section');

    renderFinePrintUI();

    const urlParams = new URLSearchParams(window.location.search);
    const scopedVendorId = urlParams.get('vendor_id') || userObj.vendor_id;
    const userRole = urlParams.get('role') || userObj.role_code;
    const isVendorUser = (userRole === 'V' || userRole === 'VM' || userRole === 'BV' || (scopedVendorId && userRole !== 'A'));

    if (isVendorUser && scopedVendorId && scopedVendorId !== '' && scopedVendorId !== 'null') {
        const vIdNum = parseInt(scopedVendorId);
        const { data: vRecord } = await window.sbClient.from('vendors_t').select('category_id').eq('vendor_id', vIdNum).maybeSingle();
        if (vRecord) {
            activeVendorLock = {
                vendor_id: vIdNum,
                category_id: vRecord.category_id
            };
            await applyVendorLockContext();
        }
    }

    const discTypeEl = document.getElementById('discount_type');
    if (discTypeEl) discTypeEl.addEventListener('change', handleDealTypeChange);

    const discValEl = document.getElementById('discount_value');
    if (discValEl) discValEl.addEventListener('input', updateAutoTitle);

    const discPrefEl = document.getElementById('discount_prefix');
    if (discPrefEl) discPrefEl.addEventListener('change', updateAutoTitle);

    const titleEl = document.getElementById('title');
    if (titleEl) {
        titleEl.addEventListener('input', (e) => {
            if (e.target.value.trim() !== '') {
                e.target.dataset.userEdited = 'true';
            } else {
                delete e.target.dataset.userEdited;
                updateAutoTitle();
            }
        });
    }

    const bannerFileEl = document.getElementById('banner_image');
    if (bannerFileEl) {
        bannerFileEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const imgPreviewContainer = document.getElementById('deal_image_preview_container');
            const imgPreviewImg = document.getElementById('deal_image_preview_img');
            if (file && imgPreviewContainer && imgPreviewImg) {
                imgPreviewContainer.style.display = 'block';
                imgPreviewImg.src = URL.createObjectURL(file);
            }
        });
    }

    const addFpBtn = document.getElementById('add_fine_print_btn');
    if (addFpBtn) {
        addFpBtn.addEventListener('click', () => {
            const inputField = document.getElementById('fine_print_text_input');
            const text = inputField.value.trim();
            if (text) {
                if (editingFinePrintIndex !== null) {
                    finePrintList[editingFinePrintIndex] = text;
                    editingFinePrintIndex = null;
                    document.getElementById('add_fine_print_btn').textContent = '+';
                } else {
                    finePrintList.push(text);
                }
                inputField.value = '';
                renderFinePrintUI();
            }
        });
    }

    const dealForm = document.getElementById('dealForm');
    if (dealForm) {
        dealForm.addEventListener('submit', handleDealFormSubmit);
    }
});

async function uploadDealBannerFile(file, vendorId, oldFileId = null) {
    const bucket = STORAGE_BUCKET_NAME;
    const lastDotIndex = file.name.lastIndexOf('.');
    let nameWithoutExt = file.name;
    let ext = '';
    if (lastDotIndex > 0) {
        nameWithoutExt = file.name.substring(0, lastDotIndex);
        ext = file.name.substring(lastDotIndex);
    }
    const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampedFileName = `${cleanName}_${Date.now()}${ext}`;
    const storagePath = `vendor_${vendorId}/${timestampedFileName}`;
    const fullPath = `${bucket}/${storagePath}`;

    const { error: storageErr } = await window.sbClient.storage.from(bucket).upload(storagePath, file, { upsert: true });
    if (storageErr) throw new Error(`Storage Upload Error (${bucket}/${storagePath}): ${storageErr.message}`);

    const { data: fileRecord, error: fileErr } = await window.sbClient
        .from('uploaded_files_t')
        .insert({
            file_name: timestampedFileName,
            file_path: fullPath,
            file_size_bytes: file.size,
            mime_type: file.type
        })
        .select('file_id')
        .single();

    if (fileErr) {
        await window.sbClient.storage.from(bucket).remove([storagePath]);
        throw new Error(`Database File Record Error: ${fileErr.message}`);
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

    return fileRecord.file_id;
}

async function handleDealFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('btnDealFormSubmit');
    const msgDiv = document.getElementById('formMessage');

    if (submitBtn) submitBtn.disabled = true;
    if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.className = 'message info';
        msgDiv.textContent = editingDealId ? 'Updating deal...' : 'Creating deal...';
    }

    try {
        const category_id = parseInt(document.getElementById('category_id').value);
        const vendor_id = parseInt(document.getElementById('vendor_id').value);
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();

        const discount_type = document.getElementById('discount_type').value || null;
        const discount_prefix = document.getElementById('discount_prefix').value || null;
        const discount_value = document.getElementById('discount_value').value ? parseFloat(document.getElementById('discount_value').value) : 0;
        const deal_tag = document.getElementById('deal_tag').value || null;
        const home_section = document.getElementById('home_section').value || null;
        const redeem_limit_per_day = document.getElementById('redeem_limit_per_day').value ? parseInt(document.getElementById('redeem_limit_per_day').value) : 1;

        const valid_from = document.getElementById('valid_from').value || null;
        const valid_until = document.getElementById('valid_until').value || null;
        const valid_day_from = document.getElementById('valid_day_from').value || '1';
        const valid_day_to = document.getElementById('valid_day_to').value || '7';
        const start_time = document.getElementById('start_time').value ? `${document.getElementById('start_time').value}:00` : '00:00:00';
        const end_time = document.getElementById('end_time').value ? `${document.getElementById('end_time').value}:00` : '23:59:00';
        const min_purchase_amount = document.getElementById('min_purchase_amount').value ? parseFloat(document.getElementById('min_purchase_amount').value) : 0;
        const max_discount_amount = document.getElementById('max_discount_amount').value ? parseFloat(document.getElementById('max_discount_amount').value) : null;

        if (!category_id || !vendor_id || !title || !description) {
            throw new Error('Please fill in all required fields (Category, Vendor, Title, Description).');
        }

        let banner_image_id = editingDealBannerImageId;
        const bannerFileInput = document.getElementById('banner_image');
        if (bannerFileInput && bannerFileInput.files && bannerFileInput.files.length > 0) {
            const file = bannerFileInput.files[0];
            banner_image_id = await uploadDealBannerFile(file, vendor_id, banner_image_id);
        }

        const adminUser = localStorage.getItem('supabase_admin_user');
        let created_by = 'Admin';
        try {
            const uObj = JSON.parse(adminUser);
            if (uObj.full_name) created_by = uObj.full_name;
            else if (uObj.email) created_by = uObj.email;
        } catch(err) {}

        const dealPayload = {
            category_id,
            vendor_id,
            title,
            description,
            discount_type,
            discount_prefix,
            discount_value,
            deal_tag,
            home_section,
            redeem_limit_per_day,
            valid_from: valid_from || new Date().toISOString().split('T')[0],
            valid_until: valid_until || null,
            valid_day_from,
            valid_day_to,
            start_time,
            end_time,
            min_purchase_amount,
            max_discount_amount,
            banner_image_id,
            is_active: true,
            updated_by: created_by,
            updated_date: getPKTISOString()
        };

        let dealId = editingDealId;

        if (editingDealId) {
            const { error: updateErr } = await window.sbClient
                .from('deals_t')
                .update(dealPayload)
                .eq('deal_id', editingDealId);

            if (updateErr) throw updateErr;
        } else {
            dealPayload.created_by = created_by;
            dealPayload.created_date = getPKTISOString();

            const { data: newDeal, error: insertErr } = await window.sbClient
                .from('deals_t')
                .insert(dealPayload)
                .select('deal_id')
                .single();

            if (insertErr) throw insertErr;
            dealId = newDeal.deal_id;
        }

        // Scope insertion
        await window.sbClient.from('deal_scope_t').delete().eq('deal_id', dealId);

        const scopeRows = [];
        const checkedInsts = Array.from(document.querySelectorAll('.institute-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedInsts.forEach(instId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, institute_id: instId, scope_type: 'BUY', created_by });
        });

        const checkedBranches = Array.from(document.querySelectorAll('.branch-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedBranches.forEach(bId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, branch_id: bId, scope_type: 'BUY', created_by });
        });

        const checkedProds = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedProds.forEach(pId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, product_id: pId, scope_type: 'BUY', created_by });
        });

        const checkedSubProds = Array.from(document.querySelectorAll('.sub-product-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedSubProds.forEach(spId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, sub_product_id: spId, scope_type: 'BUY', created_by });
        });

        const checkedRewardProds = Array.from(document.querySelectorAll('.reward-product-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedRewardProds.forEach(pId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, product_id: pId, scope_type: 'GET', created_by });
        });

        const checkedRewardSubProds = Array.from(document.querySelectorAll('.reward-sub-product-checkbox:checked')).map(cb => parseInt(cb.value));
        checkedRewardSubProds.forEach(spId => {
            scopeRows.push({ deal_id: dealId, category_id, vendor_id, sub_product_id: spId, scope_type: 'GET', created_by });
        });

        if (scopeRows.length > 0) {
            const { error: scopeErr } = await window.sbClient.from('deal_scope_t').insert(scopeRows);
            if (scopeErr) console.warn('Error inserting deal scopes:', scopeErr);
        }

        // Fine print insertion
        await window.sbClient.from('deal_fine_print_t').delete().eq('deal_id', dealId);

        if (finePrintList && finePrintList.length > 0) {
            const finePrintRows = finePrintList.map((instruction, idx) => ({
                deal_id: dealId,
                instruction,
                instruction_text: instruction,
                order_by: idx + 1,
                created_by
            }));
            const { error: fpErr } = await window.sbClient.from('deal_fine_print_t').insert(finePrintRows);
            if (fpErr) console.warn('Error inserting fine prints:', fpErr);
        }

        showToast(editingDealId ? `Deal #${dealId} updated successfully!` : `Deal #${dealId} created successfully!`, 'success');

        if (msgDiv) {
            msgDiv.className = 'message success';
            msgDiv.textContent = editingDealId ? `Deal #${dealId} updated successfully!` : `Deal #${dealId} created successfully!`;
        }

        resetDealFormToCreate(true);
        switchDealsView('view', false);

    } catch (err) {
        console.error('Error saving deal:', err);
        showToast('Failed to save deal: ' + err.message, 'error', 10000);
        if (msgDiv) {
            msgDiv.className = 'message danger';
            msgDiv.textContent = 'Error: ' + err.message;
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function switchDealsView(view, fromTabClick = true) {
    const tabCreate = document.getElementById('tabBtnCreate');
    if (tabCreate) tabCreate.classList.toggle('active', view === 'create');

    const tabView = document.getElementById('tabBtnView');
    if (tabView) tabView.classList.toggle('active', view === 'view');

    const createSec = document.getElementById('createDealView');
    if (createSec) createSec.style.display = view === 'create' ? 'block' : 'none';

    const viewSec = document.getElementById('viewDealsSection');
    if (viewSec) viewSec.style.display = view === 'view' ? 'block' : 'none';

    if (view === 'create' && fromTabClick) {
        resetDealFormToCreate();
    }

    if (view === 'view') {
        fetchDealsList();
    }
}

async function loadCategories() {
    try {
        const { data: categories, error } = await window.sbClient.from('categories_t').select('category_id, name').eq('is_active', true).order('name');
        if (error) throw error;

        const catSelect = document.getElementById('category_id');
        const catFilter = document.getElementById('dealCategoryFilter');

        catSelect.innerHTML = '<option value="">Select Category</option>';
        catFilter.innerHTML = '<option value="">All Categories</option>';

        categories.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat.category_id}">${cat.name}</option>`;
            catFilter.innerHTML += `<option value="${cat.category_id}">${cat.name}</option>`;
        });

        catSelect.addEventListener('change', async (e) => {
            await populateVendorsForCategory(e.target.value);
        });

        const vendorSelect = document.getElementById('vendor_id');
        if (vendorSelect && !vendorSelect.dataset.listenerAttached) {
            vendorSelect.dataset.listenerAttached = 'true';
            vendorSelect.addEventListener('change', async (e) => {
                await populateBranchesAndProductsForVendor(e.target.value);
            });
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function populateVendorsForCategory(categoryId, selectedVendorIdToSet = null) {
    const vendorSelect = document.getElementById('vendor_id');
    const branchContainer = document.getElementById('branch_checkbox_container');
    const prodContainer = document.getElementById('products_checkbox_container');
    const rewardProdContainer = document.getElementById('reward_products_checkbox_container');
    const subProdContainer = document.getElementById('sub_product_checkbox_container') || document.getElementById('sub_products_checkbox_container');
    const rewardSubProdContainer = document.getElementById('reward_sub_product_checkbox_container') || document.getElementById('reward_sub_products_checkbox_container');

    vendorSelect.innerHTML = '<option value="">Loading Vendors...</option>';
    branchContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
    prodContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
    if (rewardProdContainer) rewardProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
    if (subProdContainer) subProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Product first...</span>';
    if (rewardSubProdContainer) rewardSubProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Product first...</span>';

    if (!categoryId) {
        vendorSelect.innerHTML = '<option value="">Select Category First</option>';
        return;
    }

    try {
        let query = window.sbClient.from('vendors_t').select('vendor_id, name').eq('category_id', categoryId).eq('is_active', true).order('name');

        if (activeVendorLock && activeVendorLock.vendor_id) {
            query = query.eq('vendor_id', activeVendorLock.vendor_id);
        }

        const { data: vendors, error } = await query;
        if (error) throw error;

        if (vendors.length === 0) {
            vendorSelect.innerHTML = '<option value="">No Vendors Found in this Category</option>';
            return;
        }

        vendorSelect.innerHTML = '<option value="">Select Vendor</option>';
        vendors.forEach(v => {
            const isSel = (selectedVendorIdToSet && v.vendor_id == selectedVendorIdToSet) ? 'selected' : '';
            vendorSelect.innerHTML += `<option value="${v.vendor_id}" ${isSel}>${v.name}</option>`;
        });

        if (activeVendorLock && activeVendorLock.vendor_id) {
            vendorSelect.value = activeVendorLock.vendor_id;
            vendorSelect.disabled = true;
            await populateBranchesAndProductsForVendor(activeVendorLock.vendor_id);
        }

    } catch (err) {
        console.error('Error loading vendors:', err);
        vendorSelect.innerHTML = '<option value="">Error loading vendors</option>';
    }
}

async function populateBranchesAndProductsForVendor(vendorId) {
    const branchContainer = document.getElementById('branch_checkbox_container');
    const prodContainer = document.getElementById('products_checkbox_container');
    const rewardProdContainer = document.getElementById('reward_products_checkbox_container');
    const subProdContainer = document.getElementById('sub_product_checkbox_container') || document.getElementById('sub_products_checkbox_container');
    const rewardSubProdContainer = document.getElementById('reward_sub_product_checkbox_container') || document.getElementById('reward_sub_products_checkbox_container');

    branchContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Loading branches...</span>';
    prodContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Loading products...</span>';
    if (rewardProdContainer) rewardProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Loading products...</span>';
    if (subProdContainer) subProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Product first...</span>';
    if (rewardSubProdContainer) rewardSubProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Product first...</span>';

    if (!vendorId) {
        branchContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
        prodContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
        if (rewardProdContainer) rewardProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">Select Vendor first...</span>';
        return;
    }

    try {
        const { data: branches } = await window.sbClient.from('branches_t').select('branch_id, branch_name').eq('vendor_id', vendorId).eq('is_active', true);
        branchContainer.innerHTML = '';
        if (branches && branches.length > 0) {
            branches.forEach(b => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${b.branch_id}" class="branch-checkbox"> ${b.branch_name}`;
                branchContainer.appendChild(label);
            });
        } else {
            branchContainer.innerHTML = '<span style="color: gray; font-size: 12px;">No branches for this vendor.</span>';
        }

        const { data: products } = await window.sbClient.from('products_t').select('product_id, product_name').eq('vendor_id', vendorId).eq('is_active', true);
        prodContainer.innerHTML = '';
        if (rewardProdContainer) rewardProdContainer.innerHTML = '';

        if (products && products.length > 0) {
            products.forEach(p => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${p.product_id}" class="product-checkbox" data-name="${p.product_name}"> ${p.product_name}`;
                label.querySelector('input').addEventListener('change', loadSubProductsForCheckedProducts);
                prodContainer.appendChild(label);

                if (rewardProdContainer) {
                    const rLabel = document.createElement('label');
                    rLabel.innerHTML = `<input type="checkbox" value="${p.product_id}" class="reward-product-checkbox" data-name="${p.product_name}"> ${p.product_name}`;
                    rLabel.querySelector('input').addEventListener('change', loadSubProductsForRewardCheckedProducts);
                    rewardProdContainer.appendChild(rLabel);
                }
            });
        } else {
            prodContainer.innerHTML = '<span style="color: gray; font-size: 12px;">No products for this vendor.</span>';
            if (rewardProdContainer) rewardProdContainer.innerHTML = '<span style="color: gray; font-size: 12px;">No products for this vendor.</span>';
        }

    } catch (err) {
        console.error('Error loading vendor branches/products:', err);
    }
}

function updateAutoTitle() {
    const titleEl = document.getElementById('title');
    if (!titleEl || titleEl.dataset.userEdited === 'true') return;

    const prefixEl = document.getElementById('discount_prefix');
    const valEl = document.getElementById('discount_value');
    const typeEl = document.getElementById('discount_type');

    let prefixText = prefixEl && prefixEl.selectedIndex >= 0 ? prefixEl.options[prefixEl.selectedIndex].text : '';
    if (prefixText.startsWith('Select')) prefixText = '';

    const valStr = valEl ? valEl.value.trim() : '';

    let typeVal = typeEl ? typeEl.value : '';
    let typeText = typeEl && typeEl.selectedIndex >= 0 ? typeEl.options[typeEl.selectedIndex].text : '';

    let titleParts = [];
    if (prefixText) titleParts.push(prefixText);
    if (valStr) titleParts.push(valStr);

    if (typeVal === 'P' || typeText.toLowerCase().includes('percent')) {
        titleParts.push('% OFF');
    } else if (typeVal === 'F' || typeText.toLowerCase().includes('flat amount')) {
        titleParts.push('PKR OFF');
    } else if (typeVal === 'BG' || typeText.toLowerCase().includes('buy 1 get 1') || typeText.toLowerCase().includes('bogo')) {
        titleParts.unshift('Buy 1 Get 1');
    }

    const checkedProd = document.querySelector('.product-checkbox:checked');
    if (checkedProd && checkedProd.dataset.name) {
        titleParts.push(`on ${checkedProd.dataset.name}`);
    }

    if (titleParts.length > 0) {
        titleEl.value = titleParts.join(' ');
    }
}

async function loadSubProductsForCheckedProducts() {
    const checkedProds = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => parseInt(cb.value));
    const container = document.getElementById('sub_product_checkbox_container') || document.getElementById('sub_products_checkbox_container');
    if (!container) return;

    if (checkedProds.length === 0) {
        container.innerHTML = '<span style="color: gray; font-size: 12px;">Select Product first...</span>';
        updateAutoTitle();
        return;
    }

    try {
        const { data: subProds, error } = await window.sbClient
            .from('sub_products_t')
            .select('sub_product_id, sub_product_name, product_id')
            .in('product_id', checkedProds)
            .eq('is_active', true);

        if (error) throw error;

        container.innerHTML = '';
        if (subProds && subProds.length > 0) {
            subProds.forEach(sp => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${sp.sub_product_id}" class="sub-product-checkbox"> ${sp.sub_product_name}`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = '<span style="color: gray; font-size: 12px;">No sub-products available for selected products.</span>';
        }
    } catch (err) {
        console.error('Error loading sub-products:', err);
    }
    updateAutoTitle();
}

async function loadSubProductsForRewardCheckedProducts() {
    const checkedProds = Array.from(document.querySelectorAll('.reward-product-checkbox:checked')).map(cb => parseInt(cb.value));
    const container = document.getElementById('reward_sub_product_checkbox_container') || document.getElementById('reward_sub_products_checkbox_container');
    if (!container) return;

    if (checkedProds.length === 0) {
        container.innerHTML = '<span style="color: gray; font-size: 12px;">Select Free Product first...</span>';
        return;
    }

    try {
        const { data: subProds, error } = await window.sbClient
            .from('sub_products_t')
            .select('sub_product_id, sub_product_name, product_id')
            .in('product_id', checkedProds)
            .eq('is_active', true);

        if (error) throw error;

        container.innerHTML = '';
        if (subProds && subProds.length > 0) {
            subProds.forEach(sp => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${sp.sub_product_id}" class="reward-sub-product-checkbox"> ${sp.sub_product_name}`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = '<span style="color: gray; font-size: 12px;">No sub-products available for selected reward products.</span>';
        }
    } catch (err) {
        console.error('Error loading reward sub-products:', err);
    }
}

async function loadInstitutes() {

    try {
        const { data: institutes, error } = await window.sbClient.from('institutes_t').select('institute_id, name').order('name');
        const container = document.getElementById('institute_checkbox_container');
        container.innerHTML = '';

        if (!error && institutes) {
            institutes.forEach(inst => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${inst.institute_id}" class="institute-checkbox"> ${inst.name}`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = '<span style="color: gray; font-size: 12px;">No institutes available.</span>';
        }
    } catch (err) {
        console.error('Error loading institutes:', err);
    }
}

async function loadParameterDropdown(paramDescription, elementId, defaultValue = null) {
    try {
        const { data: header } = await window.sbClient.from('general_parameter_hd').select('header_id').eq('description', paramDescription).single();
        if (!header) return;

        const { data: details } = await window.sbClient.from('general_parameter_dt').select('abbreviation, detail_name').eq('header_id', header.header_id).order('order_by');
        const select = document.getElementById(elementId);
        select.innerHTML = '<option value="">Select ' + paramDescription.replace(/_/g, ' ') + '</option>';

        if (details) {
            details.forEach(d => {
                const isSelected = (defaultValue && d.abbreviation === defaultValue) ? 'selected' : '';
                select.innerHTML += `<option value="${d.abbreviation}" ${isSelected}>${d.detail_name}</option>`;
            });
        }
    } catch (err) {
        console.error(`Error loading dropdown ${paramDescription}:`, err);
    }
}

function handleDealTypeChange(e) {
    const typeVal = e.target.value;
    const typeText = e.target.options[e.target.selectedIndex]?.text || '';
    const bogoSection = document.getElementById('bogo_reward_section');

    const isBOGO = typeText.toLowerCase().includes('buy one') || 
                   typeText.toLowerCase().includes('bogo') || 
                   typeVal.toLowerCase().includes('bogo');

    if (bogoSection) {
        bogoSection.style.display = isBOGO ? 'block' : 'none';
    }

    updateAutoTitle();
}

function renderFinePrintUI() {
    const container = document.getElementById('fine_print_container');
    if (!container) return;
    container.innerHTML = '';

    finePrintList.forEach((text, index) => {
        const item = document.createElement('div');
        item.className = 'fine-print-item';
        item.innerHTML = `
            <span>• ${text}</span>
            <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-edit-fp" onclick="editFinePrint(${index})">✏️</button>
                <button type="button" class="btn-remove-fp" onclick="removeFinePrint(${index})">✕</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function editFinePrint(index) {
    editingFinePrintIndex = index;
    const inputField = document.getElementById('fine_print_text_input');
    inputField.value = finePrintList[index];
    document.getElementById('add_fine_print_btn').textContent = '✓ Update';
}

function removeFinePrint(index) {
    finePrintList.splice(index, 1);
    renderFinePrintUI();
}

async function fetchDealsList() {
    const container = document.getElementById('dealsGridContainer');
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">Loading deals list...</div>';

    try {
        const catFilterVal = document.getElementById('dealCategoryFilter')?.value;
        const categoryId = catFilterVal ? parseInt(catFilterVal) : null;

        const { data: fileRecords } = await window.sbClient
            .from('uploaded_files_t')
            .select('file_id, file_path');

        const fileMap = {};
        if (fileRecords) {
            fileRecords.forEach(f => { fileMap[f.file_id] = f.file_path; });
        }

        const urlParams = new URLSearchParams(window.location.search);
        const adminUser = localStorage.getItem('supabase_admin_user');
        let userObj = {};
        try { userObj = JSON.parse(adminUser); } catch(e) {}
        const scopedVendorId = urlParams.get('vendor_id') || userObj.vendor_id;
        const userRole = urlParams.get('role') || userObj.role_code;
        const isVendorUser = (userRole === 'V' || userRole === 'VM' || userRole === 'BV' || (scopedVendorId && userRole !== 'A'));

        let vFilterId = null;
        if (activeVendorLock && activeVendorLock.vendor_id) {
            vFilterId = activeVendorLock.vendor_id;
        } else if (isVendorUser && scopedVendorId && scopedVendorId !== '' && scopedVendorId !== 'null') {
            vFilterId = parseInt(scopedVendorId);
        }

        let query = window.sbClient
            .from('deals_t')
            .select('*, vendors_t!inner(*), categories_t!inner(*), deal_scope_t(branch_id, branches_t(branch_name)), deal_fine_print_t(instruction, order_by)')
            .order('deal_id', { ascending: false });

        if (vFilterId) {
            query = query.eq('vendor_id', vFilterId);
        } else if (categoryId) {
            query = query.eq('category_id', categoryId);
        }

        const { data: rawDeals, error } = await query;
        if (error) throw error;


        fetchedDealsData = (rawDeals || []).map(d => {
            const v = d.vendors_t || {};
            const c = d.categories_t || {};

            const branchesMap = new Map();
            (d.deal_scope_t || []).forEach(s => {
                if (s.branch_id) {
                    branchesMap.set(s.branch_id, s.branches_t?.branch_name || `Branch #${s.branch_id}`);
                }
            });
            const branches = Array.from(branchesMap.entries()).map(([id, name]) => ({ branch_id: id, branch_name: name }));

            const fine_prints = (d.deal_fine_print_t || [])
                .sort((a, b) => (a.order_by || 0) - (b.order_by || 0))
                .map(fp => ({ instruction: fp.instruction }));

            return {
                deal_id: d.deal_id,
                banner_image_id: d.banner_image_id,
                title: d.title,
                description: d.description,
                discount_value: d.discount_value,
                discount_type: d.discount_type,
                discount_type_name: typeMap[d.discount_type] || d.discount_type,
                discount_prefix: d.discount_prefix,
                discount_prefix_name: prefixMap[d.discount_prefix] || d.discount_prefix,
                deal_tag: d.deal_tag,
                deal_tag_name: tagMap[d.deal_tag] || d.deal_tag,
                home_section: d.home_section,
                home_section_name: sectionMap[d.home_section] || d.home_section,
                valid_from: d.valid_from,
                valid_until: d.valid_until,
                valid_day_from: d.valid_day_from,
                valid_day_to: d.valid_day_to,
                start_time: d.start_time,
                end_time: d.end_time,
                is_active: d.is_active,
                category_id: d.category_id,
                category_name: c.name || 'N/A',
                vendor_id: d.vendor_id,
                vendor_name: v.name || 'N/A',
                vendor_logo_image: fileMap[v.logo_file_id] || null,
                vendor_banner_image: fileMap[v.banner_file_id] || null,
                banner_image: fileMap[d.banner_image_id] || null,
                branches,
                fine_prints
            };
        });

        await populateDealBranchFilter();
        filterDealsList();
    } catch (err) {
        console.error("Error fetching deals:", err);
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--danger);">Failed to load deals: ${err.message}</div>`;
    }
}

async function populateDealBranchFilter() {
    const branchFilter = document.getElementById('dealBranchFilter');
    if (!branchFilter) return;

    const branchesMap = new Map();
    fetchedDealsData.forEach(d => {
        if (d.branches) {
            d.branches.forEach(b => {
                if (b.branch_id) branchesMap.set(b.branch_id, b.branch_name);
            });
        }
    });

    branchFilter.innerHTML = '<option value="">All Branches</option>';
    branchesMap.forEach((name, id) => {
        branchFilter.innerHTML += `<option value="${id}">${name}</option>`;
    });
}

function filterDealsList() {
    const searchVal = document.getElementById('dealSearchInput')?.value.toLowerCase().trim();
    const branchVal = document.getElementById('dealBranchFilter')?.value;
    const statusVal = document.getElementById('dealStatusFilter')?.value;

    const filtered = fetchedDealsData.filter(deal => {
        const matchesSearch = !searchVal || 
            deal.title.toLowerCase().includes(searchVal) || 
            deal.vendor_name.toLowerCase().includes(searchVal) || 
            deal.category_name.toLowerCase().includes(searchVal) ||
            String(deal.deal_id).includes(searchVal);

        const matchesBranch = !branchVal || (deal.branches && deal.branches.some(b => String(b.branch_id) === String(branchVal)));

        let matchesStatus = true;
        if (statusVal === 'active') matchesStatus = (deal.is_active === true);
        if (statusVal === 'inactive') matchesStatus = (deal.is_active === false);

        return matchesSearch && matchesBranch && matchesStatus;
    });

    renderDealsGrid(filtered);
}

function renderDealsGrid(deals) {
    const container = document.getElementById('dealsGridContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!deals || deals.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--text-muted); font-weight: 600;">No deals found matching the selected filters.</div>';
        return;
    }

    deals.forEach(deal => {
        const card = document.createElement('div');
        card.className = 'deal-card';

        let bannerUrl = deal.banner_image ? getVendorLogoUrl(deal.banner_image) : (deal.vendor_banner_image ? getVendorLogoUrl(deal.vendor_banner_image) : 'https://placehold.co/600x300/e0e7ff/4f46e5?text=Deal+Banner');
        let logoUrl = deal.vendor_logo_image ? getVendorLogoUrl(deal.vendor_logo_image) : '../Icons/App Icon.png';

        let tagBadgeHtml = deal.deal_tag_name ? `<span class="deal-tag-badge">${deal.deal_tag_name}</span>` : '';
        let statusBadgeHtml = `<span class="deal-status-badge ${deal.is_active ? 'status-active' : 'status-inactive'}">${deal.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE'}</span>`;

        let prefixStr = deal.discount_prefix_name || deal.discount_prefix || '';
        if (prefixMap[prefixStr]) prefixStr = prefixMap[prefixStr];

        let discountDisplay = '';
        if (prefixStr) discountDisplay += prefixStr + ' ';
        if (deal.discount_value) discountDisplay += deal.discount_value;
        if (deal.discount_type === 'P') discountDisplay += '% OFF';
        else if (deal.discount_type === 'F') discountDisplay += ' PKR OFF';
        else if (deal.discount_type === 'BG') discountDisplay = 'Buy 1 Get 1';


        card.innerHTML = `
            <div class="deal-banner-wrapper">
                <div class="deal-id-top-badge">ID: #${deal.deal_id}</div>
                ${tagBadgeHtml}
                <img src="${bannerUrl}" class="deal-banner-img" alt="Deal Banner" onerror="this.src='https://placehold.co/600x300/e0e7ff/4f46e5?text=Deal+Banner'">
                <div class="deal-banner-overlay"></div>
                ${statusBadgeHtml}
                <img src="${logoUrl}" class="vendor-logo-avatar" alt="Vendor Logo" onerror="this.src='../Icons/App Icon.png'">
            </div>
            
            <div class="deal-card-body">
                <div class="deal-card-content">
                    <div class="deal-meta-row" style="margin-top: 6px;">
                        <span style="font-weight: 800; color: #4338ca; font-size: 12px;">${deal.vendor_name}</span>
                        <span>•</span>
                        <span>📁 ${deal.category_name}</span>
                    </div>

                    <div class="deal-card-title">${deal.title}</div>
                    <div class="deal-desc">${deal.description || 'No description provided.'}</div>

                    <div class="deal-chips-row">
                        ${discountDisplay ? `<span class="meta-chip">🏷️ ${discountDisplay}</span>` : ''}
                        ${deal.home_section_name ? `<span class="meta-chip">⭐ ${deal.home_section_name}</span>` : ''}
                    </div>

                    <button class="btn-toggle-details" id="toggleBtn_${deal.deal_id}" onclick="toggleDealCardDetails(${deal.deal_id})">
                        🔍 View Detailed Terms &amp; Branches <span class="arrow-icon">▼</span>
                    </button>

                    <div class="deal-details-box" id="dealDetails_${deal.deal_id}" style="display: none;">
                        <div class="deal-details-row">
                            <strong>📅 Valid Dates:</strong>
                            <span>${deal.valid_from || 'N/A'} to ${deal.valid_until || 'N/A'}</span>
                        </div>
                        <div class="deal-details-row">
                            <strong>⏰ Time Window:</strong>
                            <span>${deal.start_time || '00:00'} - ${deal.end_time || '23:59'}</span>
                        </div>
                        <div class="deal-details-row">
                            <strong>🏢 Target Branches:</strong>
                            <span>${deal.branches && deal.branches.length > 0 ? deal.branches.map(b => b.branch_name).join(', ') : 'All Branches'}</span>
                        </div>
                        ${deal.fine_prints && deal.fine_prints.length > 0 ? `
                            <div style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
                                <strong style="font-size: 11px; color: #475569;">The Fine Print:</strong>
                                <ul style="padding-left: 16px; font-size: 11px; color: #64748b; margin-top: 4px;">
                                    ${deal.fine_prints.map(fp => `<li>${fp.instruction}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="deal-card-actions">
                    <button type="button" class="btn-card-edit" onclick="editDealFromCard(${deal.deal_id})">✏️ Edit Deal</button>
                    ${deal.is_active ? `<button type="button" class="btn-card-deactivate" onclick="softDeleteDeal(${deal.deal_id})">Delete</button>` : `<span style="font-size: 11px; color: var(--danger-text); font-weight:700; align-self:center; margin-left: auto;">Deactivated</span>`}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function toggleDealCardDetails(dealId) {
    const box = document.getElementById(`dealDetails_${dealId}`);
    const btn = document.getElementById(`toggleBtn_${dealId}`);
    if (box) {
        const isHidden = box.style.display === 'none' || !box.style.display;
        if (isHidden) {
            box.style.display = 'flex';
            if (btn) btn.classList.add('open');
        } else {
            box.style.display = 'none';
            if (btn) btn.classList.remove('open');
        }
    }
}

async function softDeleteDeal(dealId) {
    if (!confirm(`Are you sure you want to delete Deal #${dealId}?`)) return;
    try {
        const { error } = await window.sbClient
            .from('deals_t')
            .update({ is_active: false, updated_by: getLoggedInUserName(), updated_date: getPKTISOString() })
            .eq('deal_id', dealId);

        if (error) throw error;
        showToast(`⚠️ Deal #${dealId} deactivated (is_active = false)`, 'success', 10000);
        await fetchDealsList();
    } catch (err) {
        showToast('Failed to delete deal: ' + err.message, 'error', 10000);
    }
}

async function editDealFromCard(dealId) {
    const deal = fetchedDealsData.find(d => d.deal_id === dealId);
    if (!deal) return;

    editingDealId = deal.deal_id;
    editingDealBannerImageId = deal.banner_image_id;

    switchDealsView('create', false);

    document.getElementById('category_id').value = deal.category_id;
    await populateVendorsForCategory(deal.category_id, deal.vendor_id);
    document.getElementById('vendor_id').value = deal.vendor_id;
    await populateBranchesAndProductsForVendor(deal.vendor_id);

    document.getElementById('title').value = deal.title || '';
    document.getElementById('title').dataset.userEdited = 'true';
    document.getElementById('description').value = deal.description || '';
    document.getElementById('discount_type').value = deal.discount_type || '';
    document.getElementById('discount_prefix').value = deal.discount_prefix || '';
    document.getElementById('deal_tag').value = deal.deal_tag || '';
    document.getElementById('home_section').value = deal.home_section || '';
    document.getElementById('discount_value').value = deal.discount_value ?? '';
    document.getElementById('valid_from').value = deal.valid_from || '';
    document.getElementById('valid_until').value = deal.valid_until || '';
    document.getElementById('valid_day_from').value = deal.valid_day_from || '1';
    document.getElementById('valid_day_to').value = deal.valid_day_to || '7';
    document.getElementById('start_time').value = deal.start_time ? deal.start_time.substring(0, 5) : '00:00';
    document.getElementById('end_time').value = deal.end_time ? deal.end_time.substring(0, 5) : '23:59';

    if (deal.banner_image) {
        const imgPreviewContainer = document.getElementById('deal_image_preview_container');
        const imgPreviewImg = document.getElementById('deal_image_preview_img');
        if (imgPreviewContainer && imgPreviewImg) {
            imgPreviewContainer.style.display = 'block';
            imgPreviewImg.src = getVendorLogoUrl(deal.banner_image);
        }
    }

    // Populate Scope Checkboxes
    const { data: scopes } = await window.sbClient.from('deal_scope_t').select('*').eq('deal_id', dealId);
    if (scopes) {
        const buyScopes = scopes.filter(s => s.scope_type === 'BUY');
        const getScopes = scopes.filter(s => s.scope_type === 'GET');

        const checkedBranches = new Set(buyScopes.map(s => s.branch_id).filter(Boolean));
        const checkedInsts = new Set(buyScopes.map(s => s.institute_id).filter(Boolean));
        const checkedProds = new Set(buyScopes.map(s => s.product_id).filter(Boolean));

        document.querySelectorAll('.branch-checkbox').forEach(cb => { cb.checked = checkedBranches.has(parseInt(cb.value)); });
        document.querySelectorAll('.institute-checkbox').forEach(cb => { cb.checked = checkedInsts.has(parseInt(cb.value)); });
        document.querySelectorAll('.product-checkbox').forEach(cb => { cb.checked = checkedProds.has(parseInt(cb.value)); });

        await loadSubProductsForCheckedProducts();
        const checkedSubProds = new Set(buyScopes.map(s => s.sub_product_id).filter(Boolean));
        document.querySelectorAll('.sub-product-checkbox').forEach(cb => { cb.checked = checkedSubProds.has(parseInt(cb.value)); });

        if (getScopes.length > 0) {
            const checkedRewardProds = new Set(getScopes.map(s => s.product_id).filter(Boolean));
            document.querySelectorAll('.reward-product-checkbox').forEach(cb => { cb.checked = checkedRewardProds.has(parseInt(cb.value)); });
            await loadSubProductsForRewardCheckedProducts();
            const checkedRewardSubProds = new Set(getScopes.map(s => s.sub_product_id).filter(Boolean));
            document.querySelectorAll('.reward-sub-product-checkbox').forEach(cb => { cb.checked = checkedRewardSubProds.has(parseInt(cb.value)); });
        }
    }

    if (deal.fine_prints) {
        finePrintList = deal.fine_prints.map(fp => fp.instruction);
        renderFinePrintUI();
    }

    document.getElementById('btnDealFormSubmit').textContent = `Update Deal (#${dealId})`;
    document.getElementById('btnCancelEditDeal').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetDealFormToCreate(keepSuccessBanner = false) {
    editingDealId = null;
    editingDealBannerImageId = null;

    const form = document.getElementById('dealForm');
    if (form) form.reset();

    const titleEl = document.getElementById('title');
    if (titleEl) delete titleEl.dataset.userEdited;

    const imgPreviewContainer = document.getElementById('deal_image_preview_container');
    if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';

    document.getElementById('btnDealFormSubmit').textContent = 'Create Deal';
    document.getElementById('btnCancelEditDeal').style.display = 'none';

    if (!keepSuccessBanner) {
        const msgDiv = document.getElementById('formMessage');
        if (msgDiv) msgDiv.style.display = 'none';
    }

    if (activeVendorLock) {
        applyVendorLockContext();
    }
}
