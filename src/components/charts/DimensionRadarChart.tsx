import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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

interface DimensionRadarChartProps {
  dimensionScores: DimensionScore[];
}

// Nusharek brand colors
const BRAND_COLORS = {
  primary: "#6C3AED",      // Vibrant purple
  secondary: "#1E3A5F",    // Navy
  teal: "#14B8A6",         // Teal
};

export function DimensionRadarChart({ dimensionScores }: DimensionRadarChartProps) {
  const data = dimensionScores.map((ds) => ({
    name: `م${ds.dimension.order_index}`,
    fullName: ds.dimension.name_ar,
    value: Math.round(ds.percentage),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="name"
          tick={{ 
            fill: "hsl(var(--foreground))", 
            fontSize: 12,
            fontWeight: 500,
          }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          tickCount={5}
          tickFormatter={(value) => `${value}%`}
        />
        <Radar
          name="النسبة المئوية"
          dataKey="value"
          stroke={BRAND_COLORS.primary}
          fill={BRAND_COLORS.primary}
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            direction: "rtl",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(value: number) => [`${value}%`, "النسبة"]}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              return payload[0].payload.fullName;
            }
            return label;
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
