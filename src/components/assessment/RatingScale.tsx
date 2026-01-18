import { cn } from "@/lib/utils";
import { ratingOptions } from "@/hooks/useAssessment";

interface RatingScaleProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RatingScale({ value, onChange, disabled }: RatingScaleProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {ratingOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium",
            "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground shadow-lg"
              : "border-border bg-card hover:border-primary/50 text-foreground",
            disabled && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-3 h-3 rounded-full",
                option.color
              )}
            />
            <span>{option.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
