'use client';

import { useMemo, useState } from 'react';

type ZoneRow = {
  pitchType: string;
  batSide: 'LEFT' | 'RIGHT';
  zone_y: 'high' | 'mid' | 'low';
  zone_x: 'in_R' | 'center' | 'in_L';
  n: number;
  hits: number;
};

const PITCH_TYPES = ['FF', 'FT', 'SL', 'FC', 'CH', 'CU'];
const Y_ZONES = ['high', 'mid', 'low'] as const;
const X_ZONES = ['in_L', 'center', 'in_R'] as const;
// X labels swap meaning by side: in_L = inside to L = outside to R
const X_LABEL_BY_SIDE = {
  LEFT: { in_L: '内角', center: '中', in_R: '外角' },
  RIGHT: { in_L: '外角', center: '中', in_R: '内角' },
};
const Y_LABEL = { high: '高', mid: '中', low: '低' };

function heatColor(rate: number, n: number): string {
  // Pitch density blue gradient; saturation indicates volume
  if (n === 0) return 'bg-gray-50';
  if (rate >= 0.3) return 'bg-red-500 text-white';
  if (rate >= 0.2) return 'bg-orange-400 text-white';
  if (rate >= 0.1) return 'bg-yellow-300';
  if (rate > 0) return 'bg-yellow-100';
  // Pure usage with no hits — blue scale
  if (n >= 30) return 'bg-blue-700 text-white';
  if (n >= 15) return 'bg-blue-500 text-white';
  if (n >= 5) return 'bg-blue-300';
  return 'bg-blue-100';
}

export default function PitchZoneHeatmap({ zones }: { zones: ZoneRow[] }) {
  const [activePitch, setActivePitch] = useState<string>(
    PITCH_TYPES.find((p) => zones.some((z) => z.pitchType === p)) ?? 'FF',
  );

  const lookup = useMemo(() => {
    const map = new Map<string, ZoneRow>();
    for (const z of zones) {
      map.set(`${z.pitchType}|${z.batSide}|${z.zone_y}|${z.zone_x}`, z);
    }
    return map;
  }, [zones]);

  const pitchesAvailable = useMemo(() => {
    const s = new Set(zones.map((z) => z.pitchType));
    return PITCH_TYPES.filter((p) => s.has(p));
  }, [zones]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {pitchesAvailable.map((p) => (
          <button
            key={p}
            onClick={() => setActivePitch(p)}
            className={`px-3 py-1 rounded text-sm transition ${
              activePitch === p
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['LEFT', 'RIGHT'] as const).map((side) => (
          <div key={side}>
            <h3 className="text-sm font-medium mb-2 text-gray-700">
              vs {side === 'LEFT' ? '左打者' : '右打者'}
            </h3>
            <div className="inline-block border border-gray-300">
              {Y_ZONES.map((yz) => (
                <div key={yz} className="flex">
                  {X_ZONES.map((xz) => {
                    const row = lookup.get(`${activePitch}|${side}|${yz}|${xz}`);
                    const n = row?.n ?? 0;
                    const hits = row?.hits ?? 0;
                    const rate = n > 0 ? hits / n : 0;
                    return (
                      <div
                        key={`${yz}-${xz}`}
                        className={`w-20 h-20 flex flex-col items-center justify-center text-xs border ${heatColor(rate, n)}`}
                        title={`${activePitch} ${side} ${Y_LABEL[yz]}${X_LABEL_BY_SIDE[side][xz]} — ${n}球 / ${hits}安打`}
                      >
                        <div className="font-semibold">{n}球</div>
                        {hits > 0 && (
                          <div className="text-[10px] mt-0.5">
                            {hits}H ({(rate * 100).toFixed(0)}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2 grid grid-cols-3 w-60 text-center">
              <span>{X_LABEL_BY_SIDE[side].in_L}</span>
              <span>中</span>
              <span>{X_LABEL_BY_SIDE[side].in_R}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
        <span>被打率:</span>
        <span className="px-2 py-0.5 bg-yellow-100">~10%</span>
        <span className="px-2 py-0.5 bg-yellow-300">10-20%</span>
        <span className="px-2 py-0.5 bg-orange-400 text-white">20-30%</span>
        <span className="px-2 py-0.5 bg-red-500 text-white">30%+</span>
      </div>
    </div>
  );
}
