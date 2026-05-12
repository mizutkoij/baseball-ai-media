'use client';

import {
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

type BarrelRow = {
  batter_name: string;
  bat_side: 'LEFT' | 'RIGHT' | null;
  pitch_type: string;
  x: number | null;
  y: number | null;
  ev: number;
  la: number;
  dist: number;
  ball_event_type: string;
};

export default function EvLaScatter({ barrels }: { barrels: BarrelRow[] }) {
  const left = barrels.filter((b) => b.bat_side === 'LEFT' && b.ev && b.la !== null);
  const right = barrels.filter((b) => b.bat_side === 'RIGHT' && b.ev && b.la !== null);

  if (left.length === 0 && right.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-gray-500 text-sm">
        トラッキングデータ不足（2025+のみ）
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            type="number"
            dataKey="ev"
            name="Exit Velocity"
            unit=" km/h"
            domain={[60, 200]}
            label={{ value: 'EV (km/h)', position: 'insideBottom', offset: -15 }}
          />
          <YAxis
            type="number"
            dataKey="la"
            name="Launch Angle"
            unit="°"
            domain={[-60, 60]}
            label={{ value: 'LA (°)', angle: -90, position: 'insideLeft' }}
          />
          <ZAxis range={[40, 200]} dataKey="dist" name="Distance" unit=" m" />
          {/* Barrel zone */}
          <ReferenceArea
            x1={145}
            x2={200}
            y1={8}
            y2={32}
            fill="#fecaca"
            fillOpacity={0.4}
            stroke="#dc2626"
            strokeOpacity={0.3}
            strokeDasharray="4 4"
            label={{ value: 'バレル', position: 'insideTopRight', fill: '#dc2626', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as BarrelRow;
              return (
                <div className="bg-white border rounded p-2 shadow text-xs">
                  <div className="font-semibold">{d.batter_name}</div>
                  <div>{d.pitch_type} → {d.ball_event_type}</div>
                  <div>EV {d.ev} km/h · LA {d.la}° · {d.dist}m</div>
                </div>
              );
            }}
          />
          <Legend />
          <Scatter
            name="vs LEFT"
            data={left}
            fill="#3b82f6"
            shape="circle"
          />
          <Scatter
            name="vs RIGHT"
            data={right}
            fill="#f97316"
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
