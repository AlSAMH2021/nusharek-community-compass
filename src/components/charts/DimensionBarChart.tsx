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

const getBarColor = (percentage: number) => {
  if (percentage >= 75) return "hsl(var(--chart-2))"; // green
  if (percentage >= 50) return "hsl(var(--chart-4))"; // yellow/orange
  return "hsl(var(--chart-5))"; // red
};

export function DimensionBarChart({ dimensionScores }: DimensionBarChartProps) {
  const data = dimensionScores.map((ds) => ({
    name: `${ds.dimension.order_index}. ${ds.dimension.name_ar}`,
    shortName: `م${ds.dimension.order_index}`,
    value: Math.round(ds.percentage),
    fullName: ds.dimension.name_ar,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          width={40}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            direction: "rtl",
          }}
          formatter={(value: number) => [`${value}%`, "النسبة"]}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              return payload[0].payload.fullName;
            }
            return label;
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: number) => `${value}%`}
            style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
