import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Eye,
  Loader2,
  ClipboardList,
  Award,
  BarChart3
} from "lucide-react";

interface Assessment {
  id: string;
  status: string;
  overall_score: number | null;
  maturity_level: string | null;
  created_at: string;
  completed_at: string | null;
  responses_count?: number;
}

const maturityLabels: Record<string, { label: string; color: string }> = {
  beginner: { label: "ناشئ", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  developing: { label: "متوسط", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  advanced: { label: "متقدم", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  leading: { label: "رائد", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  in_progress: { label: "قيد التنفيذ", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [organizationName, setOrganizationName] = useState<string>("");

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
          .select("name")
          .eq("id", memberData.organization_id)
          .single();

        if (orgData) {
          setOrganizationName(orgData.name);
        }

        // Fetch all assessments with response counts
        const { data: assessmentData } = await supabase
          .from("assessments")
          .select("*")
          .eq("organization_id", memberData.organization_id)
          .order("created_at", { ascending: false });

        if (assessmentData) {
          // For each in-progress assessment, check if it has responses
          const assessmentsWithCounts = await Promise.all(
            assessmentData.map(async (assessment) => {
              if (assessment.status === "in_progress") {
                const { count } = await supabase
                  .from("assessment_responses")
                  .select("*", { count: "exact", head: true })
                  .eq("assessment_id", assessment.id);
                return { ...assessment, responses_count: count || 0 };
              }
              return assessment;
            })
          );
          setAssessments(assessmentsWithCounts);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [user]);

  const completedAssessments = assessments.filter(a => a.status === "completed");
  // Only show in-progress assessments that have at least one response (user has started answering)
  const inProgressAssessments = assessments.filter(a => a.status === "in_progress" && (a.responses_count || 0) > 0);

  // Calculate trend between last two assessments
  const getTrend = (index: number) => {
    if (index >= completedAssessments.length - 1) return null;
    const current = completedAssessments[index].overall_score || 0;
    const previous = completedAssessments[index + 1].overall_score || 0;
    const diff = current - previous;
    
    if (diff > 0) return { type: "up", value: diff };
    if (diff < 0) return { type: "down", value: Math.abs(diff) };
    return { type: "same", value: 0 };
  };

  // Calculate averages
  const avgScore = completedAssessments.length > 0
    ? completedAssessments.reduce((acc, a) => acc + (a.overall_score || 0), 0) / completedAssessments.length
    : 0;

  const latestScore = completedAssessments[0]?.overall_score || 0;
  const firstScore = completedAssessments[completedAssessments.length - 1]?.overall_score || 0;
  const overallImprovement = completedAssessments.length > 1 ? latestScore - firstScore : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">جارٍ تحميل التقارير...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            التقارير
          </h1>
          <p className="text-muted-foreground mt-1">
            {organizationName} - سجل جميع التقييمات
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                إجمالي التقييمات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assessments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedAssessments.length} مكتمل، {inProgressAssessments.length} قيد التنفيذ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                آخر نتيجة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {latestScore > 0 ? `${Math.round(latestScore)}%` : "—"}
              </div>
              {completedAssessments[0]?.maturity_level && (
                <Badge className={maturityLabels[completedAssessments[0].maturity_level]?.color}>
                  {maturityLabels[completedAssessments[0].maturity_level]?.label}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="h-4 w-4" />
                متوسط الدرجات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {avgScore > 0 ? `${Math.round(avgScore)}%` : "—"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {overallImprovement >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                التحسن الإجمالي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${overallImprovement >= 0 ? "text-green-600" : "text-red-600"}`}>
                {overallImprovement !== 0 
                  ? `${overallImprovement > 0 ? "+" : ""}${Math.round(overallImprovement)}%`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                منذ أول تقييم
              </p>
            </CardContent>
          </Card>
        </div>

        {/* In Progress Assessments */}
        {inProgressAssessments.length > 0 && (
          <Card className="border-2 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge className={statusLabels.in_progress.color}>
                  {inProgressAssessments.length}
                </Badge>
                تقييمات قيد التنفيذ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inProgressAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          بدأ في {new Date(assessment.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/assessment">متابعة التقييم</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Assessments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">التقييمات المكتملة</CardTitle>
            <CardDescription>
              سجل جميع التقييمات التي تم إكمالها
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completedAssessments.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">لا توجد تقييمات مكتملة بعد</p>
                <Button asChild>
                  <Link to="/assessment">ابدأ تقييمك الأول</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {completedAssessments.map((assessment, index) => {
                  const trend = getTrend(index);
                  const maturity = assessment.maturity_level 
                    ? maturityLabels[assessment.maturity_level] 
                    : null;

                  return (
                    <div
                      key={assessment.id}
                      className="p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Date & Maturity */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">
                              {completedAssessments.length - index}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {assessment.completed_at
                                  ? new Date(assessment.completed_at).toLocaleDateString("ar-SA", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })
                                  : "—"}
                              </span>
                            </div>
                            {maturity && (
                              <Badge className={`mt-1 ${maturity.color}`}>
                                {maturity.label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Score & Progress */}
                        <div className="flex-1 max-w-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">الدرجة</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">
                                {Math.round(assessment.overall_score || 0)}%
                              </span>
                              {trend && (
                                <span className={`flex items-center text-xs ${
                                  trend.type === "up" 
                                    ? "text-green-600" 
                                    : trend.type === "down"
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                                }`}>
                                  {trend.type === "up" && <TrendingUp className="h-3 w-3 ml-1" />}
                                  {trend.type === "down" && <TrendingDown className="h-3 w-3 ml-1" />}
                                  {trend.type === "same" && <Minus className="h-3 w-3 ml-1" />}
                                  {trend.type !== "same" && `${trend.type === "up" ? "+" : "-"}${Math.round(trend.value)}%`}
                                </span>
                              )}
                            </div>
                          </div>
                          <Progress value={assessment.overall_score || 0} className="h-2" />
                        </div>

                        {/* Action */}
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/results/${assessment.id}`}>
                            <Eye className="ml-2 h-4 w-4" />
                            عرض التفاصيل
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
