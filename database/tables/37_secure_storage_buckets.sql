-- ==============================================================================
-- Migration: 37_secure_storage_buckets.sql
-- Description: Secures Supabase Storage Buckets and Objects for Auditor Compliance.
-- 
-- Fixes Auditor (HEARD LLP) Issue 2.1:
--   - "Student ID documents are in public storage. Every verification requires a
--      student card and a CNIC image, stored in the Student_Verification bucket,
--      which is marked public. Student_Profile is also public. All five buckets
--      accept any file type."
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Update storage.buckets - Privacy, MIME Types & File Size Limits
-- ------------------------------------------------------------------------------

-- 1. Student_Verification: Private, restricted to safe images & PDF, max 10MB
UPDATE storage.buckets 
SET public = false,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'],
    file_size_limit = 10485760
WHERE id = 'Student_Verification';

-- 2. Student_Profile: Private, restricted to safe image formats, max 5MB
UPDATE storage.buckets 
SET public = false,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
    file_size_limit = 5242880
WHERE id = 'Student_Profile';

-- 3. Deals: Public read-only for app display, restricted image types, max 10MB
UPDATE storage.buckets 
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'],
    file_size_limit = 10485760
WHERE id = 'Deals';

-- 4. categories: Public read-only, restricted image types, max 5MB
UPDATE storage.buckets 
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'],
    file_size_limit = 5242880
WHERE id = 'categories';

-- 5. vendors: Public read-only, restricted image types, max 5MB
UPDATE storage.buckets 
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'],
    file_size_limit = 5242880
WHERE id = 'vendors';


-- ------------------------------------------------------------------------------
-- STEP 2: Drop all legacy open policies on storage.objects
-- ------------------------------------------------------------------------------

-- Drop Student_Verification policies
DROP POLICY IF EXISTS "CRUD_OPT 1kbebq7_0" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 1kbebq7_1" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 1kbebq7_2" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 1kbebq7_3" ON storage.objects;
DROP POLICY IF EXISTS "student_verif_select" ON storage.objects;
DROP POLICY IF EXISTS "student_verif_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_verif_modify" ON storage.objects;

-- Drop Student_Profile policies
DROP POLICY IF EXISTS "Select And Insert hrqan9_0" ON storage.objects;
DROP POLICY IF EXISTS "Select And Insert hrqan9_1" ON storage.objects;
DROP POLICY IF EXISTS "Select And Insert hrqan9_2" ON storage.objects;
DROP POLICY IF EXISTS "student_prof_select" ON storage.objects;
DROP POLICY IF EXISTS "student_prof_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_prof_modify" ON storage.objects;
DROP POLICY IF EXISTS "student_prof_delete" ON storage.objects;

-- Drop categories policies
DROP POLICY IF EXISTS "CRUD_OPT lfwun0_0" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT lfwun0_1" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT lfwun0_2" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT lfwun0_3" ON storage.objects;
DROP POLICY IF EXISTS "categories_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "categories_storage_modify" ON storage.objects;

-- Drop vendors policies
DROP POLICY IF EXISTS "CRUD_OPT 5qvju3_0" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 5qvju3_1" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 5qvju3_2" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 5qvju3_3" ON storage.objects;
DROP POLICY IF EXISTS "vendors_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "vendors_storage_modify" ON storage.objects;

-- Drop Deals policies
DROP POLICY IF EXISTS "CRUD_OPT 138kmf_0" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 138kmf_1" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 138kmf_2" ON storage.objects;
DROP POLICY IF EXISTS "CRUD_OPT 138kmf_3" ON storage.objects;
DROP POLICY IF EXISTS "deals_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "deals_storage_modify" ON storage.objects;


-- ------------------------------------------------------------------------------
-- STEP 3: Create Secure Policies on storage.objects
-- ------------------------------------------------------------------------------

-- 1. Student_Verification Policies:
-- SELECT: Only Admins OR the authenticated owner
CREATE POLICY "student_verif_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'Student_Verification' 
        AND (
            public.is_admin() 
            OR auth.uid()::text = (storage.foldername(name))[1]
            OR name LIKE (auth.uid()::text || '%')
        )
    );

-- INSERT: Authenticated users can upload their verification documents
CREATE POLICY "student_verif_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'Student_Verification'
    );

-- UPDATE/DELETE: Only Admins can delete or alter verification documents
CREATE POLICY "student_verif_modify" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'Student_Verification' 
        AND public.is_admin()
    )
    WITH CHECK (
        bucket_id = 'Student_Verification' 
        AND public.is_admin()
    );


-- 2. Student_Profile Policies:
-- SELECT: Authenticated users can view avatars
CREATE POLICY "student_prof_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'Student_Profile');

-- INSERT/UPDATE: Authenticated users can upload/update their avatar
CREATE POLICY "student_prof_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'Student_Profile');

CREATE POLICY "student_prof_modify" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'Student_Profile' 
        AND (
            public.is_admin() 
            OR auth.uid()::text = (storage.foldername(name))[1]
            OR name LIKE (auth.uid()::text || '%')
        )
    );

CREATE POLICY "student_prof_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'Student_Profile' AND public.is_admin());


-- 3. Public Catalogs: Deals, categories, vendors
-- SELECT: Allowed to public for app display
CREATE POLICY "deals_storage_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'Deals');

CREATE POLICY "deals_storage_modify" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'Deals' AND (public.is_admin() OR public.is_vendor()))
    WITH CHECK (bucket_id = 'Deals' AND (public.is_admin() OR public.is_vendor()));

CREATE POLICY "categories_storage_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'categories');

CREATE POLICY "categories_storage_modify" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'categories' AND public.is_admin())
    WITH CHECK (bucket_id = 'categories' AND public.is_admin());

CREATE POLICY "vendors_storage_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'vendors');

CREATE POLICY "vendors_storage_modify" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'vendors' AND (public.is_admin() OR public.is_vendor()))
    WITH CHECK (bucket_id = 'vendors' AND (public.is_admin() OR public.is_vendor()));

-- ==============================================================================
-- End of Migration 37_secure_storage_buckets.sql
-- ==============================================================================
