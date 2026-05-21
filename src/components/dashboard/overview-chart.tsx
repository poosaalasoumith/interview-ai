"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

const data = [
  { name: "Mon", total: 12 },
  { name: "Tue", total: 18 },
  { name: "Wed", total: 15 },
  { name: "Thu", total: 25 },
  { name: "Fri", total: 32 },
  { name: "Sat", total: 40 },
  { name: "Sun", total: 45 },
];

export function OverviewChart() {
  const { theme } = useTheme();
  
  const strokeColor = theme === "dark" ? "#8b5cf6" : "#6366f1"; // Violet-500 to Indigo-500
  const fillColor = theme === "dark" ? "url(#colorGradientDark)" : "url(#colorGradientLight)";

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorGradientDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorGradientLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          itemStyle={{ color: strokeColor }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={strokeColor}
          strokeWidth={3}
          fill={fillColor}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
