import { cn } from "@/lib/utils";
import logoImage from "@/assets/nusharek-logo.png";

interface NusharekLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

export function NusharekLogo({ 
  className, 
  size = "md", 
}: NusharekLogoProps) {
  return (
    <img 
      src={logoImage} 
      alt="نُشارك - Nusharek" 
      className={cn(sizeClasses[size], "w-auto object-contain", className)}
    />
  );
}
