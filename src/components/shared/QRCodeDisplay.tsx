import React from 'react';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  className?: string;
  logoText?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  size = 180,
  className = '',
  logoText = 'B',
}) => {
  // Generate deterministic QR-like pattern based on url
  const matrixSize = 25;
  const cells: boolean[][] = Array.from({ length: matrixSize }, () =>
    Array(matrixSize).fill(false)
  );

  // Position detection patterns (corners)
  const drawCornerPattern = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          cells[startY + r][startX + c] = true;
        }
      }
    }
  };

  drawCornerPattern(0, 0); // Top-left
  drawCornerPattern(matrixSize - 7, 0); // Top-right
  drawCornerPattern(0, matrixSize - 7); // Bottom-left

  // Deterministic seed fill
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Skip corners
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= matrixSize - 8) ||
        (r >= matrixSize - 8 && c < 8) ||
        (r >= 10 && r <= 14 && c >= 10 && c <= 14) // Center hole for logo
      ) {
        continue;
      }
      const val = Math.sin(hash + r * 31 + c * 17);
      if (val > 0.05) {
        cells[r][c] = true;
      }
    }
  }

  const cellSize = size / matrixSize;

  return (
    <div
      className={`relative inline-block bg-white p-3 rounded-2xl shadow-xl border border-zinc-200 ${className}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize - 0.4}
                height={cellSize - 0.4}
                rx={1}
                fill="#111827"
              />
            ) : null
          )
        )}
      </svg>

      {/* Center Logo Badge */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-bold text-base shadow-md border-2 border-white">
          {logoText}
        </div>
      </div>
    </div>
  );
};
