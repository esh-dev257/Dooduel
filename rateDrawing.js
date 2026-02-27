const CANVAS_W = 800;
const CANVAS_H = 560;

const LABELS = [
  { min: 0, label: 'Barely a Sketch' },
  { min: 2, label: 'A Humble Start' },
  { min: 3.5, label: 'Getting There' },
  { min: 5, label: 'Not Bad!' },
  { min: 6.5, label: 'Solid Drawing' },
  { min: 7.5, label: 'Nice Work!' },
  { min: 8.5, label: 'Great Art!' },
  { min: 9.2, label: 'Masterpiece!' }
];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function rateDrawing(strokes) {
  if (!strokes || strokes.length === 0) {
    return {
      score: 0,
      label: 'Nothing Here',
      breakdown: { effort: 0, coverage: 0, colorVariety: 0, detail: 0 }
    };
  }

  // --- Effort: stroke count + total points ---
  const totalPoints = strokes.reduce((sum, s) => sum + (s.points?.length || 0), 0);
  const strokeCount = strokes.length;

  // More strokes and points = more effort
  const strokeScore = clamp(strokeCount / 3, 0, 10);     // 30 strokes = max
  const pointScore = clamp(totalPoints / 80, 0, 10);     // 800 points = max
  const effort = strokeScore * 0.4 + pointScore * 0.6;

  // --- Coverage: bounding box area vs canvas area ---
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of (stroke.points || [])) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const canvasArea = CANVAS_W * CANVAS_H;
  const boxW = Math.max(0, maxX - minX);
  const boxH = Math.max(0, maxY - minY);
  const boxArea = boxW * boxH;
  const coverageRatio = boxArea / canvasArea;
  const coverage = clamp(coverageRatio * 15, 0, 10); // ~67% coverage = max

  // --- Color variety: unique colors used ---
  const uniqueColors = new Set(strokes.map(s => s.color));
  const colorCount = uniqueColors.size;
  const colorVariety = clamp((colorCount / 4) * 10, 0, 10); // 4+ colors = max

  // --- Detail: average points per stroke (smoother = more detailed) ---
  const avgPointsPerStroke = totalPoints / strokeCount;
  const detail = clamp(avgPointsPerStroke / 15, 0, 10); // 150+ avg points = max

  // --- Overall score (weighted) ---
  const raw = effort * 0.35 + coverage * 0.25 + colorVariety * 0.2 + detail * 0.2;
  const score = Math.round(clamp(raw, 0, 10) * 10) / 10;

  // Pick label
  let label = LABELS[0].label;
  for (const l of LABELS) {
    if (score >= l.min) label = l.label;
  }

  return {
    score,
    label,
    breakdown: {
      effort: Math.round(clamp(effort, 0, 10) * 10) / 10,
      coverage: Math.round(clamp(coverage, 0, 10) * 10) / 10,
      colorVariety: Math.round(clamp(colorVariety, 0, 10) * 10) / 10,
      detail: Math.round(clamp(detail, 0, 10) * 10) / 10
    }
  };
}

module.exports = { rateDrawing };
