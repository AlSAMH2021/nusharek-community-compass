import { Card, CardContent } from "@/components/ui/card";
import { RatingScale } from "./RatingScale";
import { Question } from "@/hooks/useAssessment";

interface QuestionCardProps {
  question: Question;
  index: number;
  value: number | null | undefined;
  onChange: (questionId: string, value: number) => void;
}

export function QuestionCard({ question, index, value, onChange }: QuestionCardProps) {
  return (
    <Card className="border-2 border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Question */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {index + 1}
            </div>
            <p className="text-lg leading-relaxed">{question.question_ar}</p>
          </div>

          {/* Rating Scale */}
          <RatingScale
            value={value}
            onChange={(val) => onChange(question.id, val)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
