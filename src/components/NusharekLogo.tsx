import { cn } from "@/lib/utils";

interface NusharekLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "text";
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
  variant = "full" 
}: NusharekLogoProps) {
  const iconSize = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  }[size];

  const textSize = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-4xl",
  }[size];

  const Icon = () => (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Portal/Gateway shape inspired by Nusharek brand */}
      <defs>
        <linearGradient id="portalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(262, 84%, 58%)" />
          <stop offset="100%" stopColor="hsl(262, 84%, 45%)" />
        </linearGradient>
      </defs>
      {/* Outer arc */}
      <path
        d="M50 10C27.9 10 10 27.9 10 50s17.9 40 40 40 40-17.9 40-40S72.1 10 50 10zm0 70c-16.5 0-30-13.5-30-30s13.5-30 30-30 30 13.5 30 30-13.5 30-30 30z"
        fill="url(#portalGradient)"
      />
      {/* Inner N shape */}
      <path
        d="M35 35h8v30h-8V35zm22 0h8v30h-8V35zm-22 0l30 30"
        stroke="url(#portalGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Center dot */}
      <circle cx="50" cy="50" r="6" fill="url(#portalGradient)" />
    </svg>
  );

  const TextContent = () => (
    <div className={cn("flex flex-col items-start leading-none", textSize)}>
      <span className="font-bold text-primary">نُشارك</span>
      <span className="font-medium text-muted-foreground text-[0.6em] tracking-wider">
        NUSHAREK
      </span>
    </div>
  );

  if (variant === "icon") {
    return (
      <div className={cn("flex items-center", sizeClasses[size], className)}>
        <Icon />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("flex items-center", sizeClasses[size], className)}>
        <TextContent />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", sizeClasses[size], className)}>
      <Icon />
      <TextContent />
    </div>
  );
}