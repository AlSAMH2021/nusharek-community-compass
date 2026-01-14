-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for organization types
CREATE TYPE public.organization_type AS ENUM ('government', 'non_profit', 'private_sector', 'other');

-- Create enum for maturity levels
CREATE TYPE public.maturity_level AS ENUM ('beginner', 'developing', 'advanced', 'leading');

-- Create enum for assessment status
CREATE TYPE public.assessment_status AS ENUM ('in_progress', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  type organization_type NOT NULL DEFAULT 'other',
  sector TEXT,
  description TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_members table (links users to organizations)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Create assessment_dimensions table
CREATE TABLE public.assessment_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessment_questions table
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id UUID REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE NOT NULL,
  question_ar TEXT NOT NULL,
  question_en TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'likert', -- likert, multiple_choice, text
  options JSONB, -- for multiple choice questions
  order_index INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status assessment_status NOT NULL DEFAULT 'in_progress',
  current_dimension_index INTEGER NOT NULL DEFAULT 0,
  overall_score DECIMAL(5,2),
  maturity_level maturity_level,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessment_responses table
CREATE TABLE public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
  response_value INTEGER, -- for likert scale
  response_text TEXT, -- for text responses
  response_options JSONB, -- for multiple choice
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);

-- Create dimension_scores table
CREATE TABLE public.dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  dimension_id UUID REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  max_possible_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, dimension_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimension_scores ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check organization membership
CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Organizations policies
CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT
  USING (public.is_organization_member(auth.uid(), id));

CREATE POLICY "Admins can view all organizations"
  ON public.organizations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Org members can update their organization"
  ON public.organizations FOR UPDATE
  USING (public.is_organization_member(auth.uid(), id));

-- Organization members policies
CREATE POLICY "Members can view their org members"
  ON public.organization_members FOR SELECT
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can view all org members"
  ON public.organization_members FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can join organizations"
  ON public.organization_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Assessment dimensions policies (public read for assessment)
CREATE POLICY "Anyone can view dimensions"
  ON public.assessment_dimensions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage dimensions"
  ON public.assessment_dimensions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Assessment questions policies (public read)
CREATE POLICY "Anyone can view questions"
  ON public.assessment_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage questions"
  ON public.assessment_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Assessments policies
CREATE POLICY "Org members can view their assessments"
  ON public.assessments FOR SELECT
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can view all assessments"
  ON public.assessments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can create assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update their assessments"
  ON public.assessments FOR UPDATE
  USING (public.is_organization_member(auth.uid(), organization_id));

-- Assessment responses policies
CREATE POLICY "Org members can view their responses"
  ON public.assessment_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id
    AND public.is_organization_member(auth.uid(), a.organization_id)
  ));

CREATE POLICY "Admins can view all responses"
  ON public.assessment_responses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can manage their responses"
  ON public.assessment_responses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id
    AND public.is_organization_member(auth.uid(), a.organization_id)
  ));

-- Dimension scores policies
CREATE POLICY "Org members can view their scores"
  ON public.dimension_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id
    AND public.is_organization_member(auth.uid(), a.organization_id)
  ));

CREATE POLICY "Admins can view all scores"
  ON public.dimension_scores FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage scores"
  ON public.dimension_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id
    AND public.is_organization_member(auth.uid(), a.organization_id)
  ));

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_responses_updated_at
  BEFORE UPDATE ON public.assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default assessment dimensions
INSERT INTO public.assessment_dimensions (name_ar, name_en, description_ar, description_en, icon, order_index, weight) VALUES
('الاستراتيجية والتخطيط', 'Strategy & Planning', 'تقييم مدى دمج المشاركة المجتمعية في رؤية واستراتيجية المنظمة', 'Evaluates how community engagement is integrated into the organization''s vision and strategy', 'Target', 1, 1.0),
('الشفافية والحوكمة', 'Transparency & Governance', 'تقييم مستوى الانفتاح والمساءلة والممارسات الأخلاقية', 'Evaluates openness, accountability, and ethical practices', 'Eye', 2, 1.0),
('الشمولية وسهولة الوصول', 'Inclusiveness & Accessibility', 'تقييم التنوع والمشاركة الخالية من العوائق', 'Evaluates diversity and barrier-free participation', 'Users', 3, 1.0),
('التواصل والمشاركة', 'Communication & Engagement', 'تقييم قنوات التواصل وحلقات التغذية الراجعة والاستجابة', 'Evaluates communication channels, feedback loops, and responsiveness', 'MessageCircle', 4, 1.0),
('التمكين والإبداع المشترك', 'Empowerment & Co-creation', 'تقييم مشاركة المجتمع في صنع القرار', 'Evaluates community involvement in decision-making', 'Lightbulb', 5, 1.0),
('قياس الأثر والتقييم', 'Impact Measurement & Evaluation', 'تقييم تتبع النتائج والتعلم من المخرجات', 'Evaluates tracking outcomes and learning from results', 'BarChart3', 6, 1.0);