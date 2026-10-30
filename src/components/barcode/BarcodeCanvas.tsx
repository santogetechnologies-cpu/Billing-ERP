import React from 'react';

interface BarcodeCanvasProps {
  value: string;
  type?: 'Code 128' | 'EAN-13' | 'EAN-8' | 'UPC' | 'QR Code';
  width?: number | string;
  height?: number;
  showText?: boolean;
  hasBorder?: boolean;
  className?: string;
}

export const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({
  value,
  type = 'Code 128',
  width,
  height = 42,
  showText = true,
  hasBorder = false,
  className = ''
}) => {
  const safeValue = (value || '').trim();
  const textLength = safeValue.length;

  // Responsive text styling based on length to guarantee it never wraps or overflows
  const textClass =
    textLength > 24
      ? 'text-[8px] font-mono tracking-tight font-medium'
      : textLength > 18
      ? 'text-[8.5px] font-mono tracking-tight font-semibold'
      : textLength > 13
      ? 'text-[9.5px] font-mono tracking-normal font-semibold'
      : 'text-[11px] font-mono tracking-wider font-bold';

  // If QR Code, generate a crisp matrix SVG
  if (type === 'QR Code') {
    const size = 21; // 21x21 standard QR grid
    const seed = safeValue.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 77);
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Position detection squares in 3 corners
    const drawFinderPattern = (r: number, c: number) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (
            i === 0 || i === 6 || j === 0 || j === 6 ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4)
          ) {
            grid[r + i][c + j] = true;
          }
        }
      }
    };

    drawFinderPattern(0, 0);
    drawFinderPattern(0, size - 7);
    drawFinderPattern(size - 7, 0);

    // Fill data area pseudorandomly based on seed
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= size - 8) ||
          (r >= size - 8 && c < 8)
        ) {
          continue;
        }
        const val = ((seed * (r + 1) * (c + 3) + r + c) % 3) === 0;
        grid[r][c] = val;
      }
    }

    const qrSize = height ? Math.min(height, 56) : 50;

    return (
      <div
        className={`flex flex-col items-center justify-center w-full max-w-full overflow-hidden print:overflow-visible ${
          hasBorder ? 'p-2 bg-white rounded-lg border border-slate-200 print:border-black' : 'p-0.5'
        } ${className}`}
      >
        <svg
          width={qrSize}
          height={qrSize}
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
          className="max-w-full h-auto shrink-0"
          style={{
            shapeRendering: 'crispEdges',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <rect width={size} height={size} fill="#ffffff" />
          {grid.map((row, r) =>
            row.map((active, c) =>
              active ? (
                <rect
                  key={`${r}-${c}`}
                  x={c}
                  y={r}
                  width={1}
                  height={1}
                  fill="#000000"
                  style={{
                    shapeRendering: 'crispEdges',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact'
                  }}
                />
              ) : null
            )
          )}
        </svg>
        {showText && (
          <span
            className={`w-full text-center truncate block text-slate-800 print:text-black mt-1 font-mono ${textClass}`}
            title={safeValue}
          >
            {safeValue}
          </span>
        )}
      </div>
    );
  }

  // 1D Barcode (Code 128, EAN-13, EAN-8, UPC)
  const barPattern: number[] = [];
  const hash = safeValue.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 42);

  // Guard bars at start
  barPattern.push(2, 1, 2, 1);

  const loopCount = Math.min(40, Math.max(14, safeValue.length * 2));
  for (let i = 0; i < loopCount; i++) {
    const barWidth = ((hash * (i + 3)) % 3) + 1;
    const spaceWidth = ((hash * (i + 7)) % 2) + 1;
    barPattern.push(barWidth, spaceWidth);
  }

  // Guard bars at end
  barPattern.push(2, 1, 2);

  let currentX = 6;
  const bars: { x: number; width: number }[] = [];
  barPattern.forEach((w, idx) => {
    if (idx % 2 === 0) {
      bars.push({ x: currentX, width: w * 1.3 });
    }
    currentX += w * 1.3;
  });

  const totalWidth = currentX + 6;

  return (
    <div
      className={`flex flex-col items-center justify-center w-full max-w-full overflow-hidden print:overflow-visible ${
        hasBorder ? 'p-2 bg-white rounded-lg border border-slate-200 print:border-black' : 'p-0'
      } ${className}`}
    >
      <svg
        viewBox={`0 0 ${totalWidth} 48`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="w-full max-w-full h-auto block"
        style={{
          maxHeight: height ? `${height}px` : '38px',
          height: height ? `${height}px` : '38px',
          shapeRendering: 'crispEdges',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <rect width={totalWidth} height="48" fill="#ffffff" />
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y="0"
            width={bar.width}
            height="48"
            fill="#000000"
            style={{
              shapeRendering: 'crispEdges',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          />
        ))}
      </svg>
      {showText && (
        <span
          className={`w-full text-center truncate block text-slate-800 print:text-black font-semibold mt-1 px-1 leading-none ${textClass}`}
          title={safeValue}
        >
          {safeValue}
        </span>
      )}
    </div>
  );
};
