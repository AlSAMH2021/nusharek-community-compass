import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { exportResultsToPDF } from "@/utils/pdfExport";
import { toast } from "sonner";
import { DimensionRadarChart } from "@/components/charts/DimensionRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import {
  BarChart3,
  TrendingUp,
  Target,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Download,
  Loader2,
  Award,
  FileDown,
  PieChart,
  BarChart2,
  Printer
} from "lucide-react";

interface Assessment {
  id: string;
  overall_score: number | null;
  maturity_level: string | null;
  completed_at: string | null;
  organization_id: string;
}

interface DimensionScore {
  id: string;
  dimension_id: string;
  score: number;
  max_possible_score: number;
  percentage: number;
  dimension: {
    name_ar: string;
    name_en: string;
    order_index: number;
  };
}

// المستويات الثلاثة: أساسي (0-49%) - ناشئ (50-74%) - مثالي (75-100%)
const maturityLabels: Record<string, { label: string; color: string; description: string }> = {
  beginner: {
    label: "أساسي",
    color: "text-level-beginner",
    description: "المستوى الأول في رحلة المشاركة المجتمعية، يتطلب بناء الأسس والقدرات",
  },
  developing: {
    label: "ناشئ",
    color: "text-level-developing",
    description: "مرحلة النمو والتطور في ممارسات المشاركة المجتمعية",
  },
  leading: {
    label: "مثالي",
    color: "text-level-leading",
    description: "نموذج متميز ورائد في تطبيق أفضل ممارسات المشاركة المجتمعية",
  },
};

function generateRecommendations(dimensionScores: DimensionScore[]) {
  const strengths: string[] = [];
  const opportunities: string[] = [];
  const recommendations: string[] = [];

  dimensionScores.forEach((ds) => {
    const name = ds.dimension.name_ar;
    const percentage = ds.percentage;

    if (percentage >= 75) {
      strengths.push(`أداء متميز في "${name}" بنسبة ${Math.round(percentage)}%`);
    } else if (percentage >= 50) {
      opportunities.push(`تحسين "${name}" من ${Math.round(percentage)}% إلى مستوى أعلى`);
      recommendations.push(`وضع خطة تطويرية لمعيار "${name}" تتضمن أهدافًا واضحة ومؤشرات قياس`);
    } else if (percentage >= 25) {
      opportunities.push(`تطوير ممارسات "${name}" الحالية (${Math.round(percentage)}%)`);
      recommendations.push(`إجراء تقييم تفصيلي للفجوات في "${name}" ووضع برنامج تدريبي مكثف`);
    } else {
      opportunities.push(`بناء أساسيات "${name}" (${Math.round(percentage)}%)`);
      recommendations.push(`البدء بتأسيس إطار عمل واضح لـ "${name}" مع الاستفادة من الممارسات الناجحة`);
    }
  });

  // Add general recommendations based on overall performance
  // المستويات الثلاثة: أساسي (0-49%) - ناشئ (50-74%) - مثالي (75-100%)
  const avgScore = dimensionScores.reduce((acc, ds) => acc + ds.percentage, 0) / dimensionScores.length;
  
  if (avgScore < 50) {
    // أساسي
    recommendations.push("تشكيل فريق متخصص للمشاركة المجتمعية مع صلاحيات واضحة");
    recommendations.push("إعداد استراتيجية شاملة للمشاركة المجتمعية على مستوى المنظمة");
    recommendations.push("بناء القدرات الأساسية وتدريب الفريق على ممارسات المشاركة");
  } else if (avgScore < 75) {
    // ناشئ
    recommendations.push("تعزيز آليات المتابعة والتقييم للممارسات الحالية");
    recommendations.push("بناء شراكات استراتيجية مع أصحاب المصلحة الرئيسيين");
    recommendations.push("توثيق أفضل الممارسات ومشاركتها داخل المنظمة");
  } else {
    // مثالي
    recommendations.push("مشاركة التجارب الناجحة مع المنظمات الأخرى كنموذج يُحتذى به");
    recommendations.push("الاستثمار في الابتكار والتقنيات الحديثة لتعزيز المشاركة المجتمعية");
  }

  return { strengths, opportunities, recommendations };
}

export default function Results() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [dimensionScores, setDimensionScores] = useState<DimensionScore[]>([]);
  const [organization, setOrganization] = useState<{ name: string; name_en?: string | null; sector?: string | null } | null>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!assessmentId) return;

      const { data: assessmentData, error: aError } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", assessmentId)
        .single();

      if (aError) {
        console.error("Error fetching assessment:", aError);
        setLoading(false);
        return;
      }

      setAssessment(assessmentData);

      // Fetch organization details
      if (assessmentData.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name, name_en, sector")
          .eq("id", assessmentData.organization_id)
          .single();
        
        if (orgData) {
          setOrganization(orgData);
        }
      }

      const { data: scoresData, error: sError } = await supabase
        .from("dimension_scores")
        .select(`
          *,
          dimension:assessment_dimensions(name_ar, name_en, order_index)
        `)
        .eq("assessment_id", assessmentId)
        .order("dimension(order_index)");

      if (sError) {
        console.error("Error fetching scores:", sError);
      } else {
        setDimensionScores(scoresData || []);
      }

      setLoading(false);
    }

    fetchResults();
  }, [assessmentId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">جارٍ تحميل النتائج...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!assessment) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">لم يتم العثور على التقييم</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard">العودة للوحة التحكم</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const maturity = assessment.maturity_level 
    ? maturityLabels[assessment.maturity_level] 
    : null;

  const { strengths, opportunities, recommendations } = generateRecommendations(dimensionScores);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-primary" />
              نتائج التقييم
            </h1>
            <p className="text-muted-foreground mt-1">
              تاريخ التقييم: {assessment.completed_at 
                ? new Date(assessment.completed_at).toLocaleDateString("ar-SA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="default"
              onClick={async () => {
                setExporting(true);
                try {
                  await exportResultsToPDF(
                    assessment,
                    dimensionScores,
                    strengths,
                    opportunities,
                    recommendations,
                    organization
                  );
                  toast.success("تم تنزيل ملف PDF بنجاح");
                } catch (err) {
                  console.error("PDF export failed:", err);
                  toast.error("تعذر تصدير ملف PDF. افتح وحدة التحكم لمعرفة السبب.");
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="ml-2 h-4 w-4" />
              )}
              تصدير PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="ml-2 h-4 w-4" />
              طباعة الصفحة
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة
              </Link>
            </Button>
          </div>
        </div>

        {/* Overall Score Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col md:flex-row items-center justify-around gap-8">
              {/* Score Circle */}
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-muted"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * (assessment.overall_score || 0)) / 100}
                      strokeLinecap="round"
                      className="text-primary transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">
                      {Math.round(assessment.overall_score || 0)}%
                    </span>
                    <span className="text-sm text-muted-foreground">الدرجة الإجمالية</span>
                  </div>
                </div>
              </div>

              {/* Maturity Level */}
              <div className="text-center">
                <Award className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  مستوى النضج
                </h3>
                <p className={`text-3xl font-bold ${maturity?.color || ""}`}>
                  {maturity?.label || "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  {maturity?.description || ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              الرسوم البيانية
            </CardTitle>
            <CardDescription>
              عرض مرئي لنتائج المعايير
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="bar" dir="rtl">
              <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
                <TabsTrigger value="bar" className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  رسم أعمدة
                </TabsTrigger>
                <TabsTrigger value="radar" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  رسم راداري
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bar">
                <DimensionBarChart dimensionScores={dimensionScores} />
              </TabsContent>
              <TabsContent value="radar">
                <DimensionRadarChart dimensionScores={dimensionScores} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Dimension Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              نتائج المعايير
            </CardTitle>
            <CardDescription>
              درجة كل معيار من معايير التقييم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {dimensionScores.map((ds) => (
                <div key={ds.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {ds.dimension.order_index}. {ds.dimension.name_ar}
                    </span>
                    <span className="text-sm font-bold">
                      {Math.round(ds.percentage)}%
                    </span>
                  </div>
                  <Progress
                    value={ds.percentage}
                    className="h-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{ds.score} / {ds.max_possible_score} نقطة</span>
                    <span>
                      {ds.percentage >= 75
                        ? "ممتاز"
                        : ds.percentage >= 50
                        ? "جيد"
                        : ds.percentage >= 25
                        ? "يحتاج تحسين"
                        : "ضعيف"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Strengths, Opportunities, Recommendations */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Strengths */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                نقاط القوة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {strengths.length > 0 ? (
                <ul className="space-y-3">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  لم يتم تحديد نقاط قوة بارزة بعد
                </p>
              )}
            </CardContent>
          </Card>

          {/* Opportunities */}
          <Card className="border-2 border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                فرص التحسين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {opportunities.slice(0, 5).map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Lightbulb className="h-5 w-5" />
                توصيات عملية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {recommendations.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Button asChild>
            <Link to="/assessment">
              بدء تقييم جديد
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports">
              عرض جميع التقارير
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
