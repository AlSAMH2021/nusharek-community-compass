import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardList, 
  TrendingUp, 
  Calendar, 
  ArrowLeft,
  BarChart3,
  Target,
  FileText
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface Assessment {
  id: string;
  status: string;
  overall_score: number | null;
  maturity_level: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      // Fetch organization
      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData?.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", memberData.organization_id)
          .single();

        if (orgData) {
          setOrganization(orgData);

          // Fetch assessments
          const { data: assessmentData } = await supabase
            .from("assessments")
            .select("*")
            .eq("organization_id", orgData.id)
            .order("created_at", { ascending: false });

          if (assessmentData) {
            setAssessments(assessmentData);
          }
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [user]);

  const latestAssessment = assessments[0];
  const completedCount = assessments.filter(a => a.status === "completed").length;

  const getMaturityLabel = (level: string | null) => {
    const labels: Record<string, string> = {
      beginner: "مبتدئ",
      developing: "نامٍ",
      advanced: "متقدم",
      leading: "رائد",
    };
    return level ? labels[level] || level : "—";
  };

  const getMaturityColor = (level: string | null) => {
    const colors: Record<string, string> = {
      beginner: "text-level-beginner",
      developing: "text-level-developing",
      advanced: "text-level-advanced",
      leading: "text-level-leading",
    };
    return level ? colors[level] || "" : "";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse text-muted-foreground">جارٍ التحميل...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">لم يتم تسجيل منظمة بعد</h2>
          <p className="text-muted-foreground mb-6">قم بتسجيل معلومات منظمتك للبدء في التقييم الذاتي</p>
          <Button asChild>
            <Link to="/organization/setup">تسجيل المنظمة</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">مرحباً بك في نُشارك</h1>
          <p className="text-muted-foreground text-lg">{organization.name}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                التقييمات المكتملة
              </CardTitle>
              <ClipboardList className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                آخر نتيجة
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {latestAssessment?.overall_score 
                  ? `${Math.round(latestAssessment.overall_score)}%` 
                  : "—"}
              </div>
              <p className={`text-sm ${getMaturityColor(latestAssessment?.maturity_level)}`}>
                {getMaturityLabel(latestAssessment?.maturity_level)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                آخر تقييم
              </CardTitle>
              <Calendar className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {latestAssessment 
                  ? new Date(latestAssessment.created_at).toLocaleDateString("ar-SA")
                  : "لم يتم التقييم بعد"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-primary" />
                ابدأ تقييماً جديداً
              </CardTitle>
              <CardDescription>
                قيّم مستوى نضج منظمتك في المشاركة المجتمعية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/assessment">
                  بدء التقييم
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                عرض التقارير
              </CardTitle>
              <CardDescription>
                راجع نتائج التقييمات السابقة والتوصيات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/reports">
                  عرض التقارير
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}