"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

const data = [
  { name: "Mon", interviews: 2 },
  { name: "Tue", interviews: 3 },
  { name: "Wed", interviews: 1 },
  { name: "Thu", interviews: 4 },
  { name: "Fri", interviews: 2 },
];

export function InterviewerChart() {
  const { theme } = useTheme();
  const fill = theme === "dark" ? "#8b5cf6" : "#6366f1";

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis 
          dataKey="name" 
          stroke="#888888" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis 
          stroke="#888888" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => `${value}`} 
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }} 
          itemStyle={{ color: fill }}
          cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
        />
        <Bar
          dataKey="interviews"
          fill={fill}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
