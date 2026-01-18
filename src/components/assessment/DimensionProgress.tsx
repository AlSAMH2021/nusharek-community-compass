import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Dimension, Question } from "@/hooks/useAssessment";

interface DimensionProgressProps {
  dimensions: Dimension[];
  currentIndex: number;
  responses: Record<string, number | null>;
  questions: Question[];
  onDimensionClick: (index: number) => void;
}

export function DimensionProgress({
  dimensions,
  currentIndex,
  responses,
  questions,
  onDimensionClick,
}: DimensionProgressProps) {
  const getDimensionStatus = (dimension: Dimension) => {
    const dimQuestions = questions.filter((q) => q.dimension_id === dimension.id);
    const answered = dimQuestions.filter(
      (q) => responses[q.id] !== null && responses[q.id] !== undefined
    ).length;
    
    if (answered === dimQuestions.length) return "complete";
    if (answered > 0) return "partial";
    return "empty";
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-2 min-w-max px-1">
        {dimensions.map((dimension, index) => {
          const status = getDimensionStatus(dimension);
          const isCurrent = index === currentIndex;

          return (
            <button
              key={dimension.id}
              onClick={() => onDimensionClick(index)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all",
                "text-sm font-medium whitespace-nowrap",
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : status === "complete"
                  ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : status === "partial"
                  ? "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              {status === "complete" && !isCurrent && (
                <Check className="h-4 w-4" />
              )}
              <span>المعيار {dimension.order_index}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
