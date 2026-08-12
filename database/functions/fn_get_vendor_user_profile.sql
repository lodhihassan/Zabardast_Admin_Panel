CREATE OR REPLACE FUNCTION public.get_vendor_user_profile(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT JSON_BUILD_OBJECT(
        'user_id', vu.user_id,
        'full_name', vu.full_name,
        'vendor_role', vu.vendor_role,
        'staff_role_name', dt_role.detail_name,
        'vendor_id', v.vendor_id,
        'vendor_name', v.name,
        'vendor_logo', f.file_path,
        'branch_id', b.branch_id,
        'branch_name', COALESCE(b.branch_name, 'Main Vendor Office / All Branches')
    ) INTO v_result
    FROM public.vendor_users_t vu
    JOIN public.vendors_t v ON v.vendor_id = vu.vendor_id
    LEFT JOIN public.branches_t b ON b.branch_id = vu.branch_id
    LEFT JOIN public.uploaded_files_t f ON f.file_id::text = v.logo_file_id::text
    
    -- Dynamic Parameter Join for VENDOR_ROLES
    LEFT JOIN public.general_parameter_hd hd_role ON hd_role.description = 'VENDOR_ROLES'
    LEFT JOIN public.general_parameter_dt dt_role ON dt_role.header_id::text = hd_role.header_id::text 
                                           AND dt_role.abbreviation::text = vu.vendor_role::text

    WHERE vu.user_id = p_user_id AND vu.is_active = TRUE;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
