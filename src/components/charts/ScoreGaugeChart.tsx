import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface ScoreGaugeChartProps {
  score: number;
  size?: number;
}

export function ScoreGaugeChart({ score, size = 200 }: ScoreGaugeChartProps) {
  const data = [
    { name: "Score", value: score },
    { name: "Remaining", value: 100 - score },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 75) return "hsl(var(--chart-2))"; // green
    if (score >= 50) return "hsl(var(--chart-4))"; // yellow
    return "hsl(var(--chart-5))"; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius="70%"
            outerRadius="90%"
            paddingAngle={0}
            dataKey="value"
          >
            <Cell fill={getScoreColor(score)} />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(score)}%</span>
        <span className="text-xs text-muted-foreground">الدرجة الإجمالية</span>
      </div>
    </div>
  );
}
