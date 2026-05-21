"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "next-themes";

const data = [
  { name: "Algorithms", value: 85 },
  { name: "Data Structures", value: 70 },
  { name: "System Design", value: 65 },
  { name: "Frontend", value: 95 },
];

export function CandidateChart() {
  const { theme } = useTheme();
  const COLORS = theme === "dark" 
    ? ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9"] 
    : ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9"];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }} 
          itemStyle={{ color: COLORS[0] }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
