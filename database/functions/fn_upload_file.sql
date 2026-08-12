CREATE OR REPLACE FUNCTION public.upload_file(
    p_files_json JSONB,
    p_target_table TEXT,
    p_action_type TEXT, 
    p_where_column TEXT,
    p_where_value TEXT,
    p_conflict_column TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_updated_by UUID DEFAULT NULL
)
RETURNS TABLE (generated_file_ids UUID[]) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_file RECORD;
    v_new_id UUID;
    v_id_list UUID[] := '{}';
    v_columns_text TEXT := '';
    v_values_text TEXT := '';
    v_updates_text TEXT := '';
    v_query TEXT;
BEGIN
    -- STEP 1: Loop files, insert into central table (uploaded_files_t)
    FOR v_file IN SELECT * FROM jsonb_to_recordset(p_files_json) 
        AS x(file_path TEXT, file_name TEXT, mime_type TEXT, file_size_bytes BIGINT, target_column TEXT) 
    LOOP
        INSERT INTO public.uploaded_files_t (file_path, file_name, mime_type, file_size_bytes, uploaded_by)
        VALUES (v_file.file_path, v_file.file_name, v_file.mime_type, v_file.file_size_bytes, COALESCE(p_created_by, auth.uid()))
        RETURNING file_id INTO v_new_id;
        
        v_id_list := array_append(v_id_list, v_new_id);

        IF v_file.target_column IS NOT NULL AND v_file.target_column <> '' THEN
            v_columns_text := v_columns_text || format(', %I', v_file.target_column);
            v_values_text  := v_values_text  || format(', %L::UUID', v_new_id);
            v_updates_text := v_updates_text || format('%I = %L::UUID, ', v_file.target_column, v_new_id);
        END IF;
    END LOOP;

    v_updates_text := rtrim(v_updates_text, ', ');

    -- STEP 2: Execute Dynamic Action
    IF p_action_type = 'INSERT' THEN
        v_query := format(
            'INSERT INTO public.%I (%I %s, created_by, updated_by) VALUES (%L %s, %L, %L)', 
            p_target_table, p_where_column, v_columns_text,
            p_where_value, v_values_text, 
            COALESCE(p_created_by, auth.uid()), p_updated_by
        );
    
    ELSIF p_action_type = 'UPDATE' THEN
        v_query := format(
            'UPDATE public.%I SET %s, updated_by = %L WHERE %I = %L', 
            p_target_table, v_updates_text, p_updated_by,
            p_where_column, p_where_value
        );
                           
    ELSIF p_action_type = 'UPSERT' THEN
        v_query := format(
            'INSERT INTO public.%I (%I %s, created_by, updated_by) VALUES (%L %s, %L, %L) 
             ON CONFLICT (%I) DO UPDATE SET %s, updated_by = %L', 
            p_target_table, p_where_column, v_columns_text,
            p_where_value, v_values_text, 
            COALESCE(p_created_by, auth.uid()), p_updated_by,
            p_conflict_column, v_updates_text, p_updated_by
        );
    END IF;

    EXECUTE v_query;
    
    generated_file_ids := v_id_list;
    RETURN NEXT;
END;
$$;
