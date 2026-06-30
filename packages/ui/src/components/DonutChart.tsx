import React from 'react';

interface DonutChartProps {
  passed: number;
  failed: number;
  pending: number;
  total: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({ passed, failed, pending, total }) => {
  // If there's no data, default to a neutral gray circle
  const isEmpty = total === 0;
  
  // Percentages
  const passedPercent = isEmpty ? 0 : (passed / total) * 100;
  const failedPercent = isEmpty ? 0 : (failed / total) * 100;
  const pendingPercent = isEmpty ? 0 : (pending / total) * 100;

  // SVG parameters
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // Offsets for cumulative segments
  const passedOffset = 0;
  const failedOffset = (passedPercent / 100) * circumference;
  const pendingOffset = ((passedPercent + failedPercent) / 100) * circumference;

  return (
    <div className="flex items-center gap-8 bg-appSurface p-6 select-none">
      <div className="relative h-32 w-32 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          {/* Base track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {isEmpty ? (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#cbd5e1"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={0}
              className="transition-all duration-1000 ease-out"
            />
          ) : (
            <>
              {/* Passed segment (Green) */}
              {passedPercent > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#10b981" // emerald-500
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (passedPercent / 100) * circumference}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out origin-center"
                  style={{
                    transform: `rotate(${ (passedOffset / circumference) * 360 }deg)`
                  }}
                />
              )}

              {/* Failed segment (Red) */}
              {failedPercent > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#f43f5e" // rose-500
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (failedPercent / 100) * circumference}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out origin-center"
                  style={{
                    transform: `rotate(${ (failedOffset / circumference) * 360 }deg)`
                  }}
                />
              )}

              {/* Pending segment (Yellow) */}
              {pendingPercent > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#fbbf24" // amber-400
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (pendingPercent / 100) * circumference}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out origin-center"
                  style={{
                    transform: `rotate(${ (pendingOffset / circumference) * 360 }deg)`
                  }}
                />
              )}
            </>
          )}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight text-slate-800">{total}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-2.5 text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span>Passed ({passed})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-rose-500" />
          <span>Failed ({failed})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <span>Pending ({pending})</span>
        </div>
      </div>
    </div>
  );
};
