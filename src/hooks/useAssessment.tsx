import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Dimension {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  order_index: number;
  weight: number;
  icon: string | null;
}

export interface Question {
  id: string;
  dimension_id: string;
  question_ar: string;
  question_en: string;
  question_type: string;
  max_score: number;
  order_index: number;
}

export interface Response {
  question_id: string;
  response_value: number | null;
}

export interface DimensionScore {
  dimension_id: string;
  score: number;
  max_possible_score: number;
  percentage: number;
}

// Rating scale options
export const ratingOptions = [
  { value: 0, label: "غير مطبق", color: "bg-gray-400" },
  { value: 1, label: "مطبق بشكل ضعيف", color: "bg-red-500" },
  { value: 2, label: "مطبق جزئيًا", color: "bg-orange-500" },
  { value: 3, label: "مطبق بشكل جيد", color: "bg-yellow-500" },
  { value: 4, label: "مطبق بشكل متكامل (مؤسسي)", color: "bg-green-500" },
];

export function useAssessment(organizationId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, number | null>>({});
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0);

  // Fetch dimensions and questions
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const { data: dimensionsData, error: dimError } = await supabase
        .from("assessment_dimensions")
        .select("*")
        .order("order_index");

      if (dimError) {
        console.error("Error fetching dimensions:", dimError);
        toast({
          title: "خطأ في تحميل البيانات",
          description: dimError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: questionsData, error: qError } = await supabase
        .from("assessment_questions")
        .select("*")
        .order("order_index");

      if (qError) {
        console.error("Error fetching questions:", qError);
        toast({
          title: "خطأ في تحميل الأسئلة",
          description: qError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setDimensions(dimensionsData || []);
      setQuestions(questionsData || []);
      setLoading(false);
    }

    fetchData();
  }, [toast]);

  // Create or resume assessment
  const initAssessment = useCallback(async () => {
    if (!organizationId || !user) return null;

    // Check for existing in-progress assessment
    const { data: existingAssessment } = await supabase
      .from("assessments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "in_progress")
      .maybeSingle();

    if (existingAssessment) {
      setAssessmentId(existingAssessment.id);
      setCurrentDimensionIndex(existingAssessment.current_dimension_index || 0);

      // Load existing responses
      const { data: existingResponses } = await supabase
        .from("assessment_responses")
        .select("question_id, response_value")
        .eq("assessment_id", existingAssessment.id);

      if (existingResponses) {
        const responseMap: Record<string, number | null> = {};
        existingResponses.forEach((r) => {
          responseMap[r.question_id] = r.response_value;
        });
        setResponses(responseMap);
      }

      return existingAssessment.id;
    }

    // Create new assessment
    const { data: newAssessment, error } = await supabase
      .from("assessments")
      .insert({
        organization_id: organizationId,
        started_by: user.id,
        status: "in_progress",
        current_dimension_index: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating assessment:", error);
      toast({
        title: "خطأ في إنشاء التقييم",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    setAssessmentId(newAssessment.id);
    return newAssessment.id;
  }, [organizationId, user, toast]);

  // Save a single response
  const saveResponse = useCallback(async (questionId: string, value: number) => {
    if (!assessmentId) return;

    setResponses((prev) => ({ ...prev, [questionId]: value }));

    const { error } = await supabase
      .from("assessment_responses")
      .upsert({
        assessment_id: assessmentId,
        question_id: questionId,
        response_value: value,
      }, {
        onConflict: "assessment_id,question_id",
      });

    if (error) {
      // If upsert fails due to missing unique constraint, try insert/update manually
      const { data: existing } = await supabase
        .from("assessment_responses")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("question_id", questionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("assessment_responses")
          .update({ response_value: value })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("assessment_responses")
          .insert({
            assessment_id: assessmentId,
            question_id: questionId,
            response_value: value,
          });
      }
    }
  }, [assessmentId]);

  // Save progress (current dimension index)
  const saveProgress = useCallback(async (dimensionIndex: number) => {
    if (!assessmentId) return;

    setCurrentDimensionIndex(dimensionIndex);

    await supabase
      .from("assessments")
      .update({ current_dimension_index: dimensionIndex })
      .eq("id", assessmentId);
  }, [assessmentId]);

  // Calculate scores and complete assessment
  const completeAssessment = useCallback(async () => {
    if (!assessmentId) return null;

    setSaving(true);

    // Calculate dimension scores
    const dimensionScores: DimensionScore[] = [];
    let totalScore = 0;
    let totalMaxScore = 0;

    for (const dimension of dimensions) {
      const dimQuestions = questions.filter((q) => q.dimension_id === dimension.id);
      let dimScore = 0;
      let dimMaxScore = 0;

      for (const question of dimQuestions) {
        const responseValue = responses[question.id];
        if (responseValue !== null && responseValue !== undefined) {
          dimScore += responseValue;
        }
        dimMaxScore += 4; // Max is 4 (مطبق بشكل متكامل)
      }

      const percentage = dimMaxScore > 0 ? (dimScore / dimMaxScore) * 100 : 0;

      dimensionScores.push({
        dimension_id: dimension.id,
        score: dimScore,
        max_possible_score: dimMaxScore,
        percentage,
      });

      totalScore += dimScore * dimension.weight;
      totalMaxScore += dimMaxScore * dimension.weight;
    }

    // Insert dimension scores
    for (const score of dimensionScores) {
      await supabase
        .from("dimension_scores")
        .insert({
          assessment_id: assessmentId,
          dimension_id: score.dimension_id,
          score: score.score,
          max_possible_score: score.max_possible_score,
          percentage: score.percentage,
        });
    }

    // Calculate overall score and maturity level
    const overallScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    
    let maturityLevel: "beginner" | "developing" | "advanced" | "leading";
    if (overallScore < 40) {
      maturityLevel = "beginner";
    } else if (overallScore < 60) {
      maturityLevel = "developing";
    } else if (overallScore < 80) {
      maturityLevel = "advanced";
    } else {
      maturityLevel = "leading";
    }

    // Update assessment status
    const { error } = await supabase
      .from("assessments")
      .update({
        status: "completed",
        overall_score: overallScore,
        maturity_level: maturityLevel,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    setSaving(false);

    if (error) {
      toast({
        title: "خطأ في حفظ النتائج",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return {
      assessmentId,
      overallScore,
      maturityLevel,
      dimensionScores,
    };
  }, [assessmentId, dimensions, questions, responses, toast]);

  // Get questions for current dimension
  const currentDimension = dimensions[currentDimensionIndex];
  const currentQuestions = currentDimension
    ? questions.filter((q) => q.dimension_id === currentDimension.id)
    : [];

  // Check if current dimension is complete
  const isDimensionComplete = currentQuestions.every(
    (q) => responses[q.id] !== null && responses[q.id] !== undefined
  );

  // Calculate progress
  const totalQuestions = questions.length;
  const answeredQuestions = Object.values(responses).filter(
    (v) => v !== null && v !== undefined
  ).length;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  return {
    loading,
    saving,
    dimensions,
    questions,
    responses,
    assessmentId,
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
  };
}
