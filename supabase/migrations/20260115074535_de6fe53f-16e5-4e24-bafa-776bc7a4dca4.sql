-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Org members can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can view all organizations" ON public.organizations;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can create organizations" 
ON public.organizations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can view their organization" 
ON public.organizations 
FOR SELECT 
TO authenticated
USING (is_organization_member(auth.uid(), id));

CREATE POLICY "Org members can update their organization" 
ON public.organizations 
FOR UPDATE 
TO authenticated
USING (is_organization_member(auth.uid(), id));

CREATE POLICY "Admins can view all organizations" 
ON public.organizations 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Also fix organization_members policies
DROP POLICY IF EXISTS "Users can join organizations" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view their org members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can view all org members" ON public.organization_members;

CREATE POLICY "Users can join organizations" 
ON public.organization_members 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can view their org members" 
ON public.organization_members 
FOR SELECT 
TO authenticated
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can view all org members" 
ON public.organization_members 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'));