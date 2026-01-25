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

export function DimensionRadarChart({ dimensionScores }: DimensionRadarChartProps) {
  const data = dimensionScores.map((ds) => ({
    name: ds.dimension.name_ar,
    value: Math.round(ds.percentage),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="name"
          tick={{ 
            fill: "hsl(var(--foreground))", 
            fontSize: 11,
            textAnchor: "middle"
          }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          tickCount={5}
        />
        <Radar
          name="النسبة المئوية"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            direction: "rtl",
          }}
          formatter={(value: number) => [`${value}%`, "النسبة"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
