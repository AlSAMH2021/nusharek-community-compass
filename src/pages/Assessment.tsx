import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useAssessment } from "@/hooks/useAssessment";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { DimensionProgress } from "@/components/assessment/DimensionProgress";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Loader2,
  Target,
  ClipboardList,
  Play,
  Clock,
  ListChecks,
  Info
} from "lucide-react";

export default function Assessment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const {
    loading,
    saving,
    dimensions,
    questions,
    responses,
    currentDimensionIndex,
    currentDimension,
    currentQuestions,
    isDimensionComplete,
    progress,
    totalQuestions,
    answeredQuestions,
    initAssessment,
    saveResponse,
    saveProgress,
    completeAssessment,
    setCurrentDimensionIndex,
  } = useAssessment(organizationId);

  // Fetch organization
  useEffect(() => {
    async function fetchOrganization() {
      if (!user) return;

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData?.organization_id) {
        setOrganizationId(memberData.organization_id);
      } else {
        navigate("/organization/setup");
      }
    }

    fetchOrganization();
  }, [user, navigate]);

  // Initialize assessment when organization is ready
  useEffect(() => {
    async function init() {
      if (organizationId && !loading) {
        await initAssessment();
        setInitializing(false);
        // If there are already answered questions, skip the welcome screen
        if (answeredQuestions > 0) {
          setHasStarted(true);
        }
      }
    }
    init();
  }, [organizationId, loading, initAssessment]);

  // Update hasStarted when answeredQuestions changes (for resuming)
  useEffect(() => {
    if (!initializing && answeredQuestions > 0) {
      setHasStarted(true);
    }
  }, [initializing, answeredQuestions]);

  const handleStartAssessment = () => {
    setHasStarted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    if (currentDimensionIndex < dimensions.length - 1) {
      const newIndex = currentDimensionIndex + 1;
      setCurrentDimensionIndex(newIndex);
      saveProgress(newIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentDimensionIndex > 0) {
      const newIndex = currentDimensionIndex - 1;
      setCurrentDimensionIndex(newIndex);
      saveProgress(newIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDimensionClick = (index: number) => {
    setCurrentDimensionIndex(index);
    saveProgress(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleComplete = async () => {
    const result = await completeAssessment();
    if (result) {
      navigate(`/results/${result.assessmentId}`);
    }
  };

  const isLastDimension = currentDimensionIndex === dimensions.length - 1;
  const allQuestionsAnswered = answeredQuestions === totalQuestions;

  if (loading || initializing) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">جارٍ تحميل التقييم...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentDimension) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">لا توجد معايير للتقييم</h2>
          <p className="text-muted-foreground mb-6">يرجى التواصل مع الإدارة</p>
        </div>
      </DashboardLayout>
    );
  }

  // Welcome Screen
  if (!hasStarted) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-8 py-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">التقييم الذاتي للمشاركة المجتمعية</h1>
            <p className="text-lg text-muted-foreground">
              قيّم مستوى نضج منظمتك في المشاركة المجتمعية من خلال الإجابة على مجموعة من الأسئلة
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                <ListChecks className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-1">{dimensions.length} معايير</h3>
              <p className="text-sm text-muted-foreground">معايير شاملة للتقييم</p>
            </Card>

            <Card className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold mb-1">{totalQuestions} سؤال</h3>
              <p className="text-sm text-muted-foreground">إجمالي الأسئلة</p>
            </Card>

            <Card className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold mb-1">15-30 دقيقة</h3>
              <p className="text-sm text-muted-foreground">الوقت المتوقع</p>
            </Card>
          </div>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-end flex-row-reverse">
                <Info className="h-5 w-5 text-primary" />
                تعليمات قبل البدء
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-right">
              <p className="text-muted-foreground">
                • اقرأ كل سؤال بعناية واختر الإجابة التي تعكس الوضع الحالي لمنظمتك
              </p>
              <p className="text-muted-foreground">
                • يتم حفظ إجاباتك تلقائياً، يمكنك التوقف والعودة لاحقاً
              </p>
              <p className="text-muted-foreground">
                • يمكنك التنقل بين المعايير والعودة لتعديل إجاباتك
              </p>
              <p className="text-muted-foreground">
                • عند الانتهاء ستحصل على تقرير شامل بمستوى النضج
              </p>
            </CardContent>
          </Card>

          {/* Start Button */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={handleStartAssessment}
              className="px-12 py-6 text-lg gap-3"
            >
              <Play className="h-5 w-5" />
              ابدأ التقييم
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ClipboardList className="h-7 w-7 text-primary" />
              التقييم الذاتي للمشاركة المجتمعية
            </h1>
            <p className="text-muted-foreground mt-1">
              أجب على الأسئلة لتقييم مستوى نضج منظمتك
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {answeredQuestions} / {totalQuestions} سؤال
            </div>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        {/* Dimension Navigation */}
        <DimensionProgress
          dimensions={dimensions}
          currentIndex={currentDimensionIndex}
          responses={responses}
          questions={questions}
          onDimensionClick={handleDimensionClick}
        />

        {/* Current Dimension */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  المعيار ({currentDimension.order_index}): {currentDimension.name_ar}
                </CardTitle>
                {currentDimension.description_ar && (
                  <CardDescription className="mt-2 text-base">
                    {currentDimension.description_ar}
                  </CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {isDimensionComplete ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    مكتمل
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {currentQuestions.filter(q => responses[q.id] !== null && responses[q.id] !== undefined).length} / {currentQuestions.length}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {currentQuestions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  value={responses[question.id]}
                  onChange={saveResponse}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentDimensionIndex === 0}
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            المعيار السابق
          </Button>

          <div className="flex gap-3">
            {isLastDimension ? (
              <Button
                onClick={handleComplete}
                disabled={!allQuestionsAnswered || saving}
                className="min-w-[150px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                    إنهاء التقييم
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                المعيار التالي
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Completion Message */}
        {isLastDimension && !allQuestionsAnswered && (
          <p className="text-center text-muted-foreground text-sm">
            يرجى الإجابة على جميع الأسئلة لإتمام التقييم
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
