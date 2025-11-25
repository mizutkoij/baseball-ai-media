'use client';

export type PlayerViewMode = 'card' | 'fangraphs' | 'savant';

interface PlayerViewToggleProps {
  activeView: PlayerViewMode;
  onViewChange: (view: PlayerViewMode) => void;
  className?: string;
}

export default function PlayerViewToggle({ 
  activeView, 
  onViewChange, 
  className = "" 
}: PlayerViewToggleProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">表示モード選択</h3>
        <p className="text-sm text-slate-400">
          あなたのレベルに合わせて情報の詳細度を選択できます
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onViewChange('card')}
          className={`px-4 py-2 rounded ${
            activeView === 'card' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          ベースボールカード
        </button>
        <button
          onClick={() => onViewChange('fangraphs')}
          className={`px-4 py-2 rounded ${
            activeView === 'fangraphs' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          FanGraphs
        </button>
        <button
          onClick={() => onViewChange('savant')}
          className={`px-4 py-2 rounded ${
            activeView === 'savant' 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          Savant
        </button>
      </div>
    </div>
  );
}