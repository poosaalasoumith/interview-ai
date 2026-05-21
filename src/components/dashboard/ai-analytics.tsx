"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { BrainCircuit, Target, TrendingUp, Award } from "lucide-react";

interface AIAnalyticsProps {
  feedback: any[];
  stats: any;
}

export function AIAnalytics({ feedback, stats }: AIAnalyticsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Format data for chart
  const chartData = feedback.map((f, i) => ({
    name: `Interview ${i + 1}`,
    Technical: f.technical_score || 0,
    Communication: f.communication_score || 0,
    Overall: f.overall_score || 0,
  }));

  const avgOverall = stats?.average_score || 0;
  const completed = stats?.completed_interviews || 0;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      {isMounted ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard 
            title="Average Score" 
            value={`${avgOverall}%`} 
            icon={<Award className="w-5 h-5 text-yellow-400" />} 
            trend="+5.2%"
          />
          <StatCard 
            title="Interviews Completed" 
            value={completed.toString()} 
            icon={<Target className="w-5 h-5 text-blue-400" />} 
          />
          <StatCard 
            title="Technical Avg" 
            value={`${feedback.length ? Math.round(feedback.reduce((a, b) => a + (b.technical_score || 0), 0) / feedback.length) : 0}%`} 
            icon={<BrainCircuit className="w-5 h-5 text-purple-400" />} 
          />
          <StatCard 
            title="Communication Avg" 
            value={`${feedback.length ? Math.round(feedback.reduce((a, b) => a + (b.communication_score || 0), 0) / feedback.length) : 0}%`} 
            icon={<TrendingUp className="w-5 h-5 text-green-400" />} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[120px] bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {isMounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Performance Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Performance Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                />
                <Legend />
                <Line type="monotone" dataKey="Overall" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="Technical" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Communication" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overall Score Area Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Overall Progression</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="Overall" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOverall)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] -mr-10 -mt-10 transition-all group-hover:bg-primary/10" />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-sm text-zinc-400 font-medium mb-1">{title}</p>
          <h4 className="text-3xl font-bold text-white">{value}</h4>
        </div>
        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-sm text-green-400 font-medium relative z-10">
          <TrendingUp className="w-4 h-4" />
          {trend} from last month
        </div>
      )}
    </div>
  );
}
