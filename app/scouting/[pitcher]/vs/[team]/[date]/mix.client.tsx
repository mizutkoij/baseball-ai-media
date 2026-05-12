'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Row = {
  batSide: string;
  pitchType: string;
  pct: string;
  avg_speed: string;
};

export default function PitchMixChart({ byBatSide }: { byBatSide: Row[] }) {
  const data = useMemo(() => {
    const pivot = new Map<string, { pitch: string; LEFT: number; RIGHT: number }>();
    for (const r of byBatSide) {
      const key = r.pitchType;
      const entry = pivot.get(key) ?? { pitch: key, LEFT: 0, RIGHT: 0 };
      if (r.batSide === 'LEFT') entry.LEFT = parseFloat(r.pct);
      else if (r.batSide === 'RIGHT') entry.RIGHT = parseFloat(r.pct);
      pivot.set(key, entry);
    }
    return Array.from(pivot.values()).sort(
      (a, b) => b.LEFT + b.RIGHT - a.LEFT - a.RIGHT,
    );
  }, [byBatSide]);

  if (!data.length) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-gray-500 text-sm">
        配球データ不足
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-medium mb-3 text-gray-700">対打席別 配球使用率 (%)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="pitch" />
          <YAxis unit="%" />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Legend />
          <Bar dataKey="LEFT" name="vs LEFT" fill="#3b82f6" />
          <Bar dataKey="RIGHT" name="vs RIGHT" fill="#f97316" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
