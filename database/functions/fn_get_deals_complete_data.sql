CREATE OR REPLACE FUNCTION public.get_deals_complete_data(
    p_category_id INT DEFAULT NULL,
    p_deal_id INT DEFAULT NULL,
    p_institute_id INT DEFAULT NULL, 
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 10.0,
    p_only_active_dates BOOLEAN DEFAULT TRUE
)
RETURNS SETOF JSON AS $$
BEGIN
    RETURN QUERY
    WITH branch_distances AS (
        SELECT 
            b.branch_id,
            b.vendor_id,
            CASE 
                WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN
                    (6371 * acos(
                        LEAST(1.0, GREATEST(-1.0,
                            cos(radians(p_user_lat)) * 
                            cos(radians(b.latitude)) * 
                            cos(radians(b.longitude) - radians(p_user_lng)) + 
                            sin(radians(p_user_lat)) * 
                            sin(radians(b.latitude))
                        ))
                    ))
                ELSE NULL
            END AS distance_km
        FROM public.branches_t b
        WHERE b.is_active = TRUE
    ),
    min_deal_distances AS (
        SELECT 
            ds.deal_id,
            MIN(bd.distance_km) AS min_distance_km
        FROM public.deal_scope_t ds
        LEFT JOIN branch_distances bd 
               ON bd.branch_id = ds.branch_id 
               OR (ds.branch_id IS NULL AND ds.vendor_id = bd.vendor_id)
        GROUP BY ds.deal_id
    )
    SELECT JSON_BUILD_OBJECT(
        'deal_id', d.deal_id,
        'title', d.title,
        'description', d.description,
        'discount_value', d.discount_value,
        'min_purchase_amount', d.min_purchase_amount,
        'max_discount_amount', d.max_discount_amount,
        'valid_from', d.valid_from,
        'valid_until', d.valid_until,
        'start_time', d.start_time,
        'end_time', d.end_time,
        'is_active', d.is_active,
        
        -- Home Section Tag
        'home_section', d.home_section,
        'home_section_name', dt_section.detail_name,
        
        -- Calculated Location Distance
        'distance_km', ROUND(md.min_distance_km::numeric, 2),
        'is_near_you', CASE WHEN md.min_distance_km IS NOT NULL AND md.min_distance_km <= p_radius_km THEN TRUE ELSE FALSE END,
        
        -- Category Data
        'category_id', c.category_id,
        'category_name', c.name,
        
        -- Vendor Data with Rating
        'vendor_id', v.vendor_id,
        'vendor_name', v.name,
        'vendor_rating', COALESCE(v.rating, 5.0),
        'vendor_logo_image', v_file.file_path,
        'vendor_banner_image', v_file1.file_path,
        
        -- Deal Banner Image
        'banner_image', deal_file.file_path,
        
        -- Parameters
        'discount_type', d.discount_type,
        'discount_type_name', dt_type.detail_name,
        'discount_prefix', d.discount_prefix,
        'discount_prefix_name', dt_prefix.detail_name,
        'deal_tag', d.deal_tag,
        'deal_tag_name', dt_tag.detail_name,
        'valid_day_from', d.valid_day_from,
        'valid_day_from_name', dt_day_from.detail_name,
        'valid_day_to', d.valid_day_to,
        'valid_day_to_name', dt_day_to.detail_name,

        -- FINE PRINTS LIST
        'fine_prints', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'instruction', fp.instruction,
                        'order_by', fp.order_by
                    ) ORDER BY fp.order_by ASC
                ), '[]'::json
            )
            FROM public.deal_fine_print_t fp
            WHERE fp.deal_id = d.deal_id
        ),

        -- APPLICABLE BRANCHES LIST (Guaranteed Unique Branches, No Duplicates)
        'branches', (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'branch_id', b.branch_id,
                        'branch_name', b.branch_name,
                        'location', b.location,
                        'latitude', b.latitude,
                        'longitude', b.longitude,
                        'distance_km', CASE 
                            WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN
                                ROUND((6371 * acos(
                                    LEAST(1.0, GREATEST(-1.0,
                                        cos(radians(p_user_lat)) * 
                                        cos(radians(b.latitude)) * 
                                        cos(radians(b.longitude) - radians(p_user_lng)) + 
                                        sin(radians(p_user_lat)) * 
                                        sin(radians(b.latitude))
                                    ))
                                ))::numeric, 2)
                            ELSE NULL
                        END
                    ) ORDER BY b.branch_name ASC
                ), '[]'::json
            )
            FROM public.branches_t b
            WHERE b.vendor_id = d.vendor_id 
              AND b.is_active = TRUE
              AND (
                  EXISTS (
                      SELECT 1 FROM public.deal_scope_t ds 
                      WHERE ds.deal_id = d.deal_id AND ds.branch_id = b.branch_id
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.deal_scope_t ds 
                      WHERE ds.deal_id = d.deal_id AND ds.branch_id IS NULL
                  )
              )
        )
    )
    FROM public.deals_t d
    JOIN public.categories_t c ON c.category_id = d.category_id
    JOIN public.vendors_t v ON v.vendor_id = d.vendor_id
    LEFT JOIN min_deal_distances md ON md.deal_id = d.deal_id
    
    -- File Joins
    LEFT JOIN public.uploaded_files_t deal_file ON deal_file.file_id = d.banner_image_id
    LEFT JOIN public.uploaded_files_t v_file ON v_file.file_id = v.logo_file_id
    LEFT JOIN public.uploaded_files_t v_file1 ON v_file1.file_id = v.banner_file_id
    
    -- Parameter Joins with Safe Text Casting
    LEFT JOIN public.general_parameter_hd hd_section ON hd_section.description = 'HOME_SECTION'
    LEFT JOIN public.general_parameter_dt dt_section ON dt_section.header_id::text = hd_section.header_id::text AND dt_section.abbreviation::text = d.home_section::text
    
    LEFT JOIN public.general_parameter_hd hd_type ON hd_type.description = 'DISCOUNT_TYPE'
    LEFT JOIN public.general_parameter_dt dt_type ON dt_type.header_id::text = hd_type.header_id::text AND dt_type.abbreviation::text = d.discount_type::text
    
    LEFT JOIN public.general_parameter_hd hd_prefix ON hd_prefix.description = 'DISCOUNT_PREFIX'
    LEFT JOIN public.general_parameter_dt dt_prefix ON dt_prefix.header_id::text = hd_prefix.header_id::text AND dt_prefix.abbreviation::text = d.discount_prefix::text
    
    LEFT JOIN public.general_parameter_hd hd_tag ON hd_tag.description = 'DEAL_TAG'
    LEFT JOIN public.general_parameter_dt dt_tag ON dt_tag.header_id::text = hd_tag.header_id::text AND dt_tag.abbreviation::text = d.deal_tag::text
    
    LEFT JOIN public.general_parameter_hd hd_day_from ON hd_day_from.description = 'DAYS_OF_WEEK'
    LEFT JOIN public.general_parameter_dt dt_day_from ON dt_day_from.header_id::text = hd_day_from.header_id::text AND dt_day_from.abbreviation::text = d.valid_day_from::text
    
    LEFT JOIN public.general_parameter_hd hd_day_to ON hd_day_to.description = 'DAYS_OF_WEEK'
    LEFT JOIN public.general_parameter_dt dt_day_to ON dt_day_to.header_id::text = hd_day_to.header_id::text AND dt_day_to.abbreviation::text = d.valid_day_to::text

    WHERE d.is_active = TRUE
      AND (p_category_id IS NULL OR d.category_id = p_category_id)
      AND (p_deal_id IS NULL OR d.deal_id = p_deal_id)
      AND (
          p_only_active_dates = FALSE 
          OR (
              (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE >= d.valid_from 
              AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE <= d.valid_until
          )
      )
      AND (
          p_institute_id IS NULL 
          OR EXISTS (
              SELECT 1 FROM public.deal_scope_t ds
              WHERE ds.deal_id = d.deal_id 
                AND (ds.institute_id IS NULL OR ds.institute_id = p_institute_id)
          )
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
