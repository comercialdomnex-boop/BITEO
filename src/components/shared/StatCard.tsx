import React from 'react';

interface StatCardProps {
  label: string;
  count: number;
  highlightColor?: 'orange' | 'amber' | 'sky' | 'emerald' | 'zinc';
  icon?: React.ReactNode;
  subtext?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  count,
  highlightColor = 'zinc',
  icon,
  subtext,
  isActive = false,
  onClick,
}) => {
  const colorMap = {
    orange: {
      activeBorder: 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-950/20',
      text: 'text-orange-400',
      badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      dot: 'bg-orange-500',
    },
    amber: {
      activeBorder: 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-950/20',
      text: 'text-amber-400',
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-400',
    },
    sky: {
      activeBorder: 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-950/20',
      text: 'text-sky-400',
      badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      dot: 'bg-sky-400',
    },
    emerald: {
      activeBorder: 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-950/20',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    zinc: {
      activeBorder: 'border-zinc-500 bg-zinc-800/40 shadow-lg shadow-black/20',
      text: 'text-zinc-200',
      badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      dot: 'bg-zinc-400',
    },
  };

  const scheme = colorMap[highlightColor];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative w-full text-left p-3.5 rounded-2xl border transition-all duration-200 select-none ${
        isActive
          ? scheme.activeBorder
          : 'bg-[#13161C] hover:bg-[#181C24] border-zinc-800/80 hover:border-zinc-700/80'
      } ${onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-xs font-medium text-zinc-400 truncate tracking-tight">{label}</span>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight tabular-nums ${scheme.text}`}>
          {count}
        </span>
        {subtext && <span className="text-[11px] text-zinc-500 truncate">{subtext}</span>}
      </div>

      {isActive && (
        <span className="absolute bottom-1 right-3 w-1 h-1 rounded-full bg-orange-500" />
      )}
    </button>
  );
};
