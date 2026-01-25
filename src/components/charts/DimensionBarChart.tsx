import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
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

interface DimensionBarChartProps {
  dimensionScores: DimensionScore[];
}

// Nusharek brand colors
const BRAND_COLORS = {
  primary: "#6C3AED",      // Vibrant purple
  secondary: "#1E3A5F",    // Navy
  teal: "#14B8A6",         // Teal
  coral: "#F97316",        // Coral
  gold: "#F59E0B",         // Gold
};

const getBarColor = (percentage: number) => {
  if (percentage >= 75) return BRAND_COLORS.teal;      // مثالي - Teal
  if (percentage >= 50) return BRAND_COLORS.gold;      // ناشئ - Gold
  return BRAND_COLORS.coral;                            // أساسي - Coral
};

const getMaturityLabel = (percentage: number) => {
  if (percentage >= 75) return "مثالي";
  if (percentage >= 50) return "ناشئ";
  return "أساسي";
};

export function DimensionBarChart({ dimensionScores }: DimensionBarChartProps) {
  const data = dimensionScores.map((ds) => ({
    name: `م${ds.dimension.order_index}`,
    fullName: ds.dimension.name_ar,
    value: Math.round(ds.percentage),
    orderIndex: ds.dimension.order_index,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 30, right: 20, left: 20, bottom: 80 }}
      >
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--border))" 
          vertical={false} 
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickFormatter={(value) => `${value}%`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            direction: "rtl",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(value: number) => [
            <span key="value" className="font-bold">{`${value}% - ${getMaturityLabel(value)}`}</span>,
            "النسبة"
          ]}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              return <span className="font-semibold">{payload[0].payload.fullName}</span>;
            }
            return label;
          }}
          cursor={{ fill: "hsl(var(--primary) / 0.1)" }}
        />
        <Bar 
          dataKey="value" 
          radius={[8, 8, 0, 0]} 
          maxBarSize={50}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={getBarColor(entry.value)}
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
            />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(value: number) => `${value}%`}
            style={{ 
              fill: "hsl(var(--foreground))", 
              fontSize: 11, 
              fontWeight: 600 
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
