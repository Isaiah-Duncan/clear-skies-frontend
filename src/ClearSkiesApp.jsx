import React, { useState, useEffect, useRef } from 'react';
import { Plane, Headphones, CheckCircle2, ChevronDown, ChevronUp, Sun, Moon, Bell, ArrowLeft, Maximize, ShieldCheck, Coffee, Wind } from 'lucide-react';

const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&display=swap');
  
  :root {
    --bg-light: #FCFBF8;
    --ink-dark: #1a1814;
  }

  body {
    font-family: 'Figtree', system-ui, sans-serif;
    background-color: var(--bg-light);
    color: var(--ink-dark);
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Shared Animations */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes breatheGently {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.05); opacity: 1; }
  }
  @keyframes flowRight {
    to { stroke-dashoffset: -11; } 
  }

  .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .animate-fade-in { animation: fadeIn 0.8s ease both; }
  .animate-breathe { animation: breatheGently 4s ease-in-out infinite; }
  
  /* Range Slider */
  input[type=range].sim-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 4px; border-radius: 4px;
    outline: none; cursor: pointer;
  }
  input[type=range].sim-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px; border-radius: 50%;
    cursor: pointer; transition: transform 0.2s, background 0.3s;
  }
  input[type=range].sim-slider::-webkit-slider-thumb:active {
    transform: scale(1.2);
  }

  /* Scrubber Desktop Hover Logic */
  .scrubber-ui { transition: opacity 0.4s ease; }
  @media (hover: hover) {
    .graph-container:not(:hover) .scrubber-ui:not(.force-show) { opacity: 0; }
  }
`;

// ─── FLIGHT DATA MOCKS ────────────────────────────────────────────────────────
const MOCK_FLIGHTS = {
  AMBER: {
    flightId: "UA 442", origin: "SFO", destination: "ORD", durationMin: 180, bumpStart: 90, bumpEnd: 135,
    state: 'amber',
    altitudeCurve: [
      { t: 0.00, alt: 0 }, { t: 0.10, alt: 22000 }, { t: 0.20, alt: 35000 },
      { t: 0.80, alt: 35000 }, { t: 0.90, alt: 18000 }, { t: 1.00, alt: 0 },
    ],
    turbulenceCurve: [
      { t: 0.00, intensity: 0.00 }, { t: 0.08, intensity: 0.02 }, { t: 0.20, intensity: 0.03 },
      { t: 0.38, intensity: 0.05 }, { t: 0.46, intensity: 0.35 }, { t: 0.52, intensity: 0.85 }, // Truthful peak
      { t: 0.58, intensity: 0.55 }, { t: 0.65, intensity: 0.18 }, { t: 0.72, intensity: 0.04 },
      { t: 0.85, intensity: 0.02 }, { t: 1.00, intensity: 0.00 },
    ]
  },
  GREEN: {
    flightId: "DL 123", origin: "JFK", destination: "LHR", durationMin: 420, bumpStart: 0, bumpEnd: 0,
    state: 'green',
    altitudeCurve: [
      { t: 0.00, alt: 0 }, { t: 0.10, alt: 36000 }, { t: 0.90, alt: 36000 }, { t: 1.00, alt: 0 },
    ],
    turbulenceCurve: [
      { t: 0.00, intensity: 0.00 }, { t: 0.20, intensity: 0.05 }, { t: 0.50, intensity: 0.10 },
      { t: 0.80, intensity: 0.04 }, { t: 1.00, intensity: 0.00 },
    ]
  },
  GRAY: {
    flightId: "AA 999", origin: "MIA", destination: "DFW", durationMin: 150, bumpStart: 0, bumpEnd: 0,
    state: 'gray',
    altitudeCurve: [{ t: 0, alt: 0 }, { t: 1, alt: 0 }],
    turbulenceCurve: [{ t: 0, intensity: 0 }, { t: 1, intensity: 0 }]
  }
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sampleCurve(curve, t, key = "intensity") {
  if (!curve || curve.length === 0) return 0;
  if (t <= curve[0].t) return curve[0][key];
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1][key];
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t);
      const s = local * local * (3 - 2 * local);
      return a[key] + (b[key] - a[key]) * s;
    }
  }
  return 0;
}

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function lerpColor(intensity) {
  const t = Math.min(intensity, 0.65) / 0.65;
  const r = Math.round(109 + (200 - 109) * t);
  const g = Math.round(186 + (168 - 186) * t);
  const b = Math.round(138 + (56  - 138) * t);
  return { css: `rgb(${r},${g},${b})`, r, g, b };
}

function getAltitudePhase(progress) {
  if (progress < 0.15) return "climbing";
  if (progress > 0.82) return "descending";
  return "cruising";
}

function getAltitudeText(alt, phase) {
  if (phase === "climbing") {
    if (alt < 5000)  return { label: "Just lifted off",       sub: "Settling into the climb." };
    if (alt < 18000) return { label: "Climbing comfortably",  sub: "Reaching cruising altitude soon." };
    return                { label: "Almost at cruise height", sub: "Level flight just ahead." };
  }
  if (phase === "descending") {
    if (alt > 20000) return { label: "Beginning the descent", sub: "A gradual, controlled glide down." };
    if (alt > 8000)  return { label: "On approach",           sub: "Getting closer to the destination." };
    return                { label: "Almost there",            sub: "A few minutes to landing." };
  }
  return { label: "Cruising smoothly", sub: "Level flight at a comfortable height." };
}

function getStatusText(intensity) {
  if (intensity < 0.08) return { line1: "Smooth air.",            line2: "Settle in and enjoy the ride." };
  if (intensity < 0.20) return { line1: "Very light movement.",   line2: "Nothing to notice." };
  if (intensity < 0.38) return { line1: "Gentle bumping.",        line2: "The plane is handling it easily." };
  if (intensity < 0.55) return { line1: "A bumpy stretch.",       line2: "It passes in a few minutes." };
  return                       { line1: "Noticeable bumps.",      line2: "The crew is aware. You are safe." };
}

const getTokens = (isDark) => ({
  bg:      isDark ? "#0e131f" : "#FCFBF8",
  ink:     isDark ? "#f3f4f6" : "#1a1814",
  inkMid:  isDark ? "#9ca3af" : "#7d8a7a",
  inkDim:  isDark ? "#6b7280" : "#b5b0aa",
  border:  isDark ? "rgba(255,255,255,0.08)" : "rgba(26,24,20,0.07)",
  card:    isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
  shadow:  isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 1px 10px rgba(0,0,0,0.03)",
});

// ─── 1. PRE-FLIGHT TOPOGRAPHICAL GRAPH ────────────────────────────────────────
function TurbulenceGraph({ flightData, isDark, t, progress = 0 }) {
  const [visible, setVisible] = useState(false);
  const [flowing, setFlowing] = useState(false);
  const [scrubT, setScrubT] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [autoPlayState, setAutoPlayState] = useState('waiting');
  
  const interactingRef = useRef(false);
  const svgRef = useRef(null);

  const { durationMin, bumpStart, bumpEnd, turbulenceCurve, state, origin, destination } = flightData;
  const isGray = state === 'gray' || !Array.isArray(turbulenceCurve) || turbulenceCurve.length < 2;

  // ── Gray guard — bail out before any SVG math ──────────────────────────────
  if (isGray) {
    const W = 600, H = 220;
    const t = getTokens(isDark);
    const baseline = H - 44;
    return (
      <div className="graph-container w-full">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", overflow: "visible" }}>
          <rect x={W/2 - 60} y={baseline - 14} width={120} height={28} rx="14" fill={t.card} stroke={t.border} strokeWidth="1" />
          <text x={W/2} y={baseline + 4} textAnchor="middle" fill={t.inkMid} fontSize="12" fontWeight="700" letterSpacing="0.5">
            DATA SYNCING...
          </text>
        </svg>
      </div>
    );
  }

  const W = 600, H = 220; 
  const PAD = { top: 40, bottom: 44, left: 16, right: 16 };
  const gW = W - PAD.left - PAD.right;
  const gH = H - PAD.top - PAD.bottom;

  const yLight = PAD.top + gH - 0.1 * gH * 0.88;
  const yNoticeable = PAD.top + gH - 0.5 * gH * 0.88;
  const yBumpy = PAD.top + gH - 0.9 * gH * 0.88;

  const STEPS = 120;
  const points = Array.from({ length: STEPS + 1 }, (_, i) => {
    const ptT = i / STEPS;
    const intensity = isGray ? 0 : sampleCurve(turbulenceCurve, ptT);
    return {
      x: PAD.left + ptT * gW,
      y: PAD.top + gH - intensity * gH * 0.88,
      intensity, t: ptT,
    };
  });

  const peak = isGray ? points[0] : points.reduce((best, p) => p.intensity > best.intensity ? p : best, points[0]);
  const hasBump = peak.intensity > 0.15;

  useEffect(() => {
    setVisible(false); setFlowing(false); setAutoPlayState('waiting'); setScrubT(0);
    const t1 = setTimeout(() => setVisible(true), 150);
    const t2 = setTimeout(() => setFlowing(true), 1650); 
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [flightData]);

  // Scrubber Auto-Travel Sequence
  useEffect(() => {
    if (isGray) return; 

    let rafId;
    let autoDelay, pauseDelay;

    const runAutoPlay = () => {
      let startTime;
      const duration = 1800;
      const targetT = hasBump ? peak.t : 0.5;

      const animate = (time) => {
        if (interactingRef.current) { setAutoPlayState('finished'); return; }
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setScrubT(ease * targetT);

        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        } else {
          pauseDelay = setTimeout(() => {
            if (!interactingRef.current) setAutoPlayState('finished');
          }, 1200);
        }
      };
      rafId = requestAnimationFrame(animate);
    };

    autoDelay = setTimeout(() => {
      if (!interactingRef.current) {
        setAutoPlayState('playing');
        runAutoPlay();
      }
    }, 1650);

    return () => {
      clearTimeout(autoDelay); clearTimeout(pauseDelay);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [peak.t, isGray, hasBump]);

  const updateScrub = (clientX) => {
    if (!svgRef.current || isGray) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const svgX = (x / rect.width) * W; 
    const tVal = Math.max(0, Math.min(1, (svgX - PAD.left) / gW));
    setScrubT(tVal);
  };

  const handlePointerDown = (e) => {
    if (isGray) return;
    interactingRef.current = true;
    setIsInteracting(true); setAutoPlayState('finished');
    e.target.setPointerCapture(e.pointerId);
    updateScrub(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isInteracting || isGray) return;
    updateScrub(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (isGray) return;
    e.target.releasePointerCapture(e.pointerId);
    setIsInteracting(false);
  };

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = points[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return acc + ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const baseline = PAD.top + gH;
  const fillD = pathD + ` L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  const bumpStartT = bumpStart / durationMin;
  const bumpEndT   = bumpEnd   / durationMin;
  const bumpX1 = PAD.left + bumpStartT * gW;
  const bumpX2 = PAD.left + bumpEndT   * gW;

  const annotX = Math.min(Math.max(peak.x, PAD.left + 70), W - PAD.right - 70);
  const annotY = peak.y - 24;

  const DASH = "5 6";
  const fade = { transition: "opacity 0.7s ease", opacity: visible ? 1 : 0 };

  const currentIntensity = isGray ? 0 : sampleCurve(turbulenceCurve, scrubT);
  const scrubX = PAD.left + scrubT * gW;
  const scrubY = PAD.top + gH - currentIntensity * gH * 0.88;
  const currentMin = Math.round(scrubT * durationMin);
  const timeStr = formatMinutes(currentMin) + " in";

  let descriptor = "Calm";
  let activeColor = "#5cb87a";
  if (currentIntensity >= 0.15 && currentIntensity <= 0.45) {
    descriptor = "Light movement"; activeColor = "#f59e0b";
  } else if (currentIntensity > 0.45) {
    descriptor = "Bumpy"; activeColor = "#f59e0b";
  }

  const tooltipW = 140;
  const tooltipX = Math.max(0, Math.min(W - tooltipW, scrubX - tooltipW / 2));

  return (
    <div className="graph-container w-full" style={{ touchAction: 'pan-y' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="intensity-gradient" x1="0" y1={yBumpy} x2="0" y2={baseline} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? "0.3" : "0.20"} />
            <stop offset="40%" stopColor="#eab308" stopOpacity={isDark ? "0.2" : "0.15"} />
            <stop offset="75%" stopColor="#5cb87a" stopOpacity={isDark ? "0.15" : "0.12"} />
            <stop offset="100%" stopColor="#5cb87a" stopOpacity={isDark ? "0.15" : "0.12"} />
          </linearGradient>

          <clipPath id="draw-reveal">
            <rect x="0" y="0" height={H} style={{ width: visible ? W : 0, transition: 'width 1.5s ease-in-out' }} />
          </clipPath>
          <clipPath id="bump-region">
            <rect x={bumpX1 - 2} y={0} width={bumpX2 - bumpX1 + 4} height={H} />
          </clipPath>
        </defs>

        {/* Y-Axis Gridlines */}
        {!isGray && (
          <>
            <text x="0" y={yBumpy - 8} fill={t.inkDim} className="text-[13px] font-extrabold uppercase tracking-widest">Bumpy</text>
            <line x1="0" y1={yBumpy} x2={W} y2={yBumpy} stroke={t.border} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="0" y={yNoticeable - 8} fill={t.inkDim} className="text-[13px] font-extrabold uppercase tracking-widest">Noticeable</text>
            <line x1="0" y1={yNoticeable} x2={W} y2={yNoticeable} stroke={t.border} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="0" y={yLight - 8} fill={t.inkDim} className="text-[13px] font-extrabold uppercase tracking-widest">Light</text>
            <line x1="0" y1={yLight} x2={W} y2={yLight} stroke={t.border} strokeWidth="1.5" strokeDasharray="3 3" />
          </>
        )}

        <line x1={PAD.left} y1={baseline} x2={W - PAD.right} y2={baseline} stroke={t.border} strokeWidth="1.5" />

        {/* Gradient Fill */}
        {!isGray && (
          <path d={fillD} fill="url(#intensity-gradient)" style={{ opacity: visible ? 1 : 0, transition: 'opacity 1.5s ease-in-out' }} />
        )}

        {/* Animated Line */}
        <g clipPath="url(#draw-reveal)">
          <path
            d={pathD} fill="none" stroke={isGray ? t.border : "#5cb87a"} strokeWidth="2.5"
            strokeDasharray={DASH} strokeLinecap="round"
            style={{ ...fade, transitionDelay: "0.05s", animation: flowing && !isGray ? "flowRight 2.5s linear infinite" : "none" }}
          />
          {hasBump && !isGray && (
            <path
              d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5"
              strokeDasharray={DASH} strokeLinecap="round" clipPath="url(#bump-region)"
              style={{ ...fade, transitionDelay: "0.25s", animation: flowing ? "flowRight 2.5s linear infinite" : "none" }}
            />
          )}
        </g>

        {/* Gray State "Syncing" Pill */}
        {isGray && (
          <g style={fade}>
             <rect x={W/2 - 60} y={baseline - 14} width={120} height={28} rx="14" fill={t.card} stroke={t.border} strokeWidth="1" />
             <text x={W/2} y={baseline + 4} textAnchor="middle" fill={t.inkMid} fontSize="12" fontWeight="700" letterSpacing="0.5">
               DATA SYNCING...
             </text>
          </g>
        )}

        {/* Peak Annotation (Static) */}
        {hasBump && !isGray && (
          <g style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.85)', transformOrigin: `${peak.x}px ${peak.y}px`, transition: 'opacity 0.4s ease-out 1.5s, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.5s' }}>
            <circle cx={peak.x} cy={peak.y} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
            <rect x={annotX - 70} y={annotY - 16} width={140} height={32} rx="16" fill={t.card} stroke="#f59e0b" strokeWidth="1.5" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))" }} />
            <text x={annotX} y={annotY + 4.5} textAnchor="middle" fill="#f59e0b" fontSize="12.5" fontWeight="800" letterSpacing="0.3">
              {formatMinutes(bumpStart)}–{formatMinutes(bumpEnd)} in
            </text>
          </g>
        )}

        {/* X-axis Labels */}
        {[
          { label: origin || "TAKEOFF",   anchor: "start", x: PAD.left },
          { label: destination || "LANDING", anchor: "end",   x: W - PAD.right },
        ].map(({ label, anchor, x }) => (
          <text key={label + x} x={x} y={H - 8} textAnchor={anchor} fill={t.inkDim} fontSize="13" fontWeight="800" letterSpacing="0.8">
            {label}
          </text>
        ))}

        <circle cx={PAD.left} cy={baseline} r="3.5" fill={isGray ? t.border : "#5cb87a"} opacity="0.6" />
        <circle cx={W - PAD.right} cy={baseline} r="3.5" fill={isGray ? t.border : "#5cb87a"} opacity="0.6" />

        {/* FIXED FLIGHT POSITION INDICATOR */}
        {/* Shows where the plane currently is on the route — not draggable */}
        {!isGray && progress > 0 && (
          (() => {
            const posX = PAD.left + Math.min(Math.max(progress, 0), 1) * gW;
            const posIntensity = sampleCurve(turbulenceCurve, progress);
            const posY = PAD.top + gH - posIntensity * gH * 0.88;
            const planeColor = isDark ? '#e5e7eb' : '#374151';
            return (
              <g style={{ pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
                {/* Vertical dashed guide from curve down to baseline */}
                <line
                  x1={posX} y1={posY + 10} x2={posX} y2={baseline - 10}
                  stroke={planeColor} strokeWidth={1} strokeDasharray="2 4" opacity={0.3}
                />
                {/* Small dot on the curve at current progress */}
                <circle cx={posX} cy={posY} r={3.5} fill={planeColor} opacity={0.55} />
                {/* Plane icon on baseline — top-down view, pointing right */}
                <g transform={`translate(${posX}, ${baseline})`} opacity={0.72}>
                  {/* Fuselage */}
                  <path d="M-9,0 L-3,-1.5 L8,0 L-3,1.5 Z" fill={planeColor} />
                  {/* Top wing */}
                  <path d="M-3,-6 L1,-6 L2,0 L-4,0 Z" fill={planeColor} opacity={0.75} />
                  {/* Bottom wing */}
                  <path d="M-3,6 L1,6 L2,0 L-4,0 Z" fill={planeColor} opacity={0.75} />
                  {/* Tail fin */}
                  <path d="M-8,-3.5 L-6,0 L-8,3.5 Z" fill={planeColor} opacity={0.6} />
                </g>
              </g>
            );
          })()
        )}

        {/* INTERACTIVE SCRUBBER LAYER */}
        {!isGray && (
          <>
            <rect
              x={0} y={0} width={W} height={H} fill="transparent"
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp}
              className="cursor-grab active:cursor-grabbing"
            />
            <g className={`scrubber-ui ${autoPlayState !== 'finished' || isInteracting ? 'force-show opacity-100' : ''}`} style={{ pointerEvents: 'none' }}>
              <line x1={scrubX} y1={scrubY + 11} x2={scrubX} y2={baseline} stroke={activeColor} strokeWidth={1.5} strokeDasharray="4 4" style={{ transition: 'stroke 0.3s ease' }} />
              <circle cx={scrubX} cy={scrubY} r={11} fill={t.bg} stroke={activeColor} strokeWidth={3.5} style={{ transition: 'stroke 0.3s ease', filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }} />
              <foreignObject x={tooltipX} y={scrubY - 58} width={tooltipW} height={46} style={{ overflow: 'visible' }}>
                <div className="w-full h-full flex justify-center items-end pb-1">
                  <div className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full text-white shadow-md" style={{ backgroundColor: activeColor, transition: 'background-color 0.3s ease' }}>
                    <span className="text-[10px] font-bold opacity-90 leading-none mb-1">{timeStr}</span>
                    <span className="text-[12px] font-extrabold tracking-wide leading-none">{descriptor}</span>
                  </div>
                </div>
              </foreignObject>
            </g>
          </>
        )}
      </svg>

      {/* Legend */}
      {!isGray && (
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
          {[{ color: "#5cb87a", label: "Clear air" }, { color: "#f59e0b", label: "Routine bumps" }].map(({ color, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: t.inkMid, fontWeight: 700 }}>
              <svg width="20" height="6" viewBox="0 0 20 6">
                <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 2. IN-FLIGHT ATMOSPHERE ORB ──────────────────────────────────────────────
function ParticleOrb({ intensity, color }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ particles: [], frame: 0, t: 0 });
  const SIZE = 220;
  const CX = SIZE / 2, CY = SIZE / 2;
  const PARTICLE_COUNT = 28;

  useEffect(() => {
    stateRef.current.particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      baseRadius: 64 + (i % 3) * 10,
      speed: 0.004 + (i % 5) * 0.0008,
      size: 2.2 + (i % 4) * 0.6,
      phase: Math.random() * Math.PI * 2,
      layer: i % 3,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let rafId;

    const draw = () => {
      const { r, g, b } = color;
      const s = stateRef.current;
      s.t += 0.016;
      ctx.clearRect(0, 0, SIZE, SIZE);

      const coreRadius = 38 + intensity * 12;
      const coreGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreRadius * 2);
      coreGrad.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
      coreGrad.addColorStop(0.5, `rgba(${r},${g},${b},0.10)`);
      coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      
      ctx.beginPath(); ctx.arc(CX, CY, coreRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad; ctx.fill();

      ctx.beginPath(); ctx.arc(CX, CY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},0.18)`; ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`; ctx.lineWidth = 1.2; ctx.stroke();

      [72, 88, 104].forEach((rad, i) => {
        ctx.beginPath(); ctx.arc(CX, CY, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.06 - i * 0.015})`;
        ctx.lineWidth = 0.8; ctx.stroke();
      });

      s.particles.forEach((p) => {
        p.angle += p.speed * (1 + intensity * 0.6);
        const turbDisplace = intensity * 22 * Math.sin(s.t * (3 + p.layer) + p.phase);
        const breathDisplace = 4 * Math.sin(s.t * 0.6 + p.phase);
        const radius = p.baseRadius + turbDisplace + breathDisplace;
        const x = CX + Math.cos(p.angle) * radius;
        const y = CY + Math.sin(p.angle) * radius;

        const opacityBase = 0.55 + intensity * 0.3;
        const opacityVar  = 0.25 * Math.sin(p.angle * 2 + s.t * 0.4);
        const opacity     = Math.max(0.15, opacityBase + opacityVar);
        const size = p.size * (1 + intensity * 0.5 * Math.abs(Math.sin(s.t * 4 + p.phase)));

        const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        grad.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${opacity * 0.4})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        
        ctx.beginPath(); ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity * 0.9})`; ctx.fill();
      });

      const outerGrad = ctx.createRadialGradient(CX, CY, 88, CX, CY, SIZE / 2);
      outerGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      outerGrad.addColorStop(0.7, `rgba(${r},${g},${b},${0.04 + intensity * 0.06})`);
      outerGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(CX, CY, SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad; ctx.fill();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [intensity, color]);

  return <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: "block", margin: "0 auto" }} />;
}

// ─── 3. REALISTIC PLANE ICON ──────────────────────────────────────────────────
function PlaneIcon({ progress, intensity, color }) {
  const phase = getAltitudePhase(progress);
  const baseTilt = phase === "climbing" ? 10 : phase === "descending" ? -10 : 0;
  const wobble = intensity * 3 * Math.sin(Date.now() * 0.001);
  const tilt   = baseTilt + wobble * 0.3;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg 
        width="76" height="32" viewBox="0 0 76 32" 
        style={{ transform: `rotate(${-tilt}deg)`, transition: "transform 2.5s ease", filter: `drop-shadow(0 0 8px ${color.css}40)` }}
      >
        <path d="M 12 16 L 4 2 L 12 2 L 20 16 Z" fill={color.css} opacity="0.6" />
        <path d="M 6 16 C 6 11, 14 10, 28 10 L 60 10 C 72 10, 76 13, 76 16 C 76 19, 72 22, 60 22 L 28 22 C 14 22, 6 21, 6 16 Z" fill={color.css} opacity="0.9" />
        <path d="M 50 18 L 34 30 L 26 30 L 42 18 Z" fill={color.css} opacity="0.85" />
        <rect x="38" y="20" width="8" height="4" rx="2" fill={color.css} />
        <path d="M 64 12 Q 70 12 72 15 L 64 15 Z" fill="#ffffff" opacity="0.5" />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 800, color: color.css, letterSpacing: "0.8px", textTransform: "uppercase", opacity: 0.8, transition: "color 3s ease" }}>
        {phase === "climbing" ? "Climbing" : phase === "descending" ? "Descending" : "Cruising"}
      </span>
    </div>
  );
}

// ─── 4. EXPANDED ALTITUDE BAR ─────────────────────────────────────────────────
function ExpandedAltitudeVisualizer({ altitude, progress, color, tokens }) {
  const safeAlt = altitude ?? 0;
  const phase = getAltitudePhase(progress);
  const { label, sub } = getAltitudeText(safeAlt, phase);
  const fill = Math.min(safeAlt / 35000, 1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full animate-fade-in px-4">
      <div className="flex w-full max-w-[280px] gap-8 items-center h-full max-h-[320px]">
        <div style={{ width: 14, height: "100%", maxHeight: 280, borderRadius: 14, background: tokens.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${fill * 100}%`, borderRadius: 14, background: color.css, opacity: 0.6, transition: "height 4s ease, background 3s ease" }} />
          <div style={{ position: "absolute", bottom: `${fill * 100}%`, left: "50%", transform: "translate(-50%, 50%)", width: 26, height: 26, borderRadius: "50%", background: color.css, border: `3px solid ${tokens.bg}`, boxShadow: `0 0 14px ${color.css}80`, transition: "bottom 4s ease, background 3s ease" }} />
          
          <div style={{ position: "absolute", top: 0, left: 26, fontSize: 10, color: tokens.inkDim, fontWeight: 800, letterSpacing: "1px" }}>35K</div>
          <div style={{ position: "absolute", bottom: 0, left: 26, fontSize: 10, color: tokens.inkDim, fontWeight: 800, letterSpacing: "1px" }}>0</div>
        </div>
        <div className="flex flex-col justify-center">
          <div style={{ fontSize: 11, fontWeight: 800, color: tokens.inkDim, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
            Current Altitude
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: tokens.ink, letterSpacing: "-1.5px", lineHeight: 1 }}>
              {Math.round(safeAlt).toLocaleString()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: tokens.inkMid }}>FT</span>
          </div>
          
          <div style={{ padding: "18px 20px", borderRadius: 20, background: tokens.card, border: `1px solid ${tokens.border}`, boxShadow: tokens.shadow }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: tokens.ink, letterSpacing: "-0.4px", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 13, color: tokens.inkMid, lineHeight: 1.5, fontWeight: 500 }}>{sub}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 5. FLIGHT PROGRESS ───────────────────────────────────────────────────────
function FlightProgress({ progress, flight, color, tokens }) {
  const bumpStart   = flight?.bumpStart ?? 0;
  const bumpEnd     = flight?.bumpEnd   ?? 0;
  const currentMin  = Math.round(progress * (flight?.durationMin ?? 0));
  const minutesLeft = (flight?.durationMin ?? 0) - currentMin;
  const inBump      = currentMin >= bumpStart && currentMin <= bumpEnd;
  const nearBump    = !inBump && (bumpStart - currentMin) <= 35 && currentMin < bumpStart;
  const bumpLeft    = bumpEnd - currentMin;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: tokens.inkMid, letterSpacing: "0.3px" }}>
        <span>{flight.origin}</span>
        <span style={{ color: tokens.inkDim, fontWeight: 600, fontSize: 11 }}>{formatMinutes(minutesLeft)} remaining</span>
        <span>{flight.destination}</span>
      </div>
      <div style={{ position: "relative", height: 5, borderRadius: 5, background: tokens.border }}>
        <div style={{ position: "absolute", left: `${(bumpStart / (flight?.durationMin || 1)) * 100}%`, width: `${((bumpEnd - bumpStart) / (flight?.durationMin || 1)) * 100}%`, top: -1, bottom: -1, background: "rgba(245, 158, 11, 0.2)", borderRadius: 3 }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, background: color.css, borderRadius: 5, opacity: 0.55, transition: "width 0.8s ease, background 3s ease" }} />
        <div style={{ position: "absolute", left: `${progress * 100}%`, top: "50%", transform: "translate(-50%, -50%)", width: 11, height: 11, borderRadius: "50%", background: color.css, border: `2px solid ${tokens.bg}`, boxShadow: `0 0 7px ${color.css}55`, transition: "left 0.8s ease, background 3s ease", zIndex: 2 }} />
      </div>
      {nearBump && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontSize: 12, color: tokens.inkMid, lineHeight: 1.55, animation: "fadeUp 0.6s ease both" }}>
          Good time to get comfortable. Put something on to listen to.
        </div>
      )}
      {inBump && bumpLeft > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontSize: 12, color: tokens.inkMid, lineHeight: 1.55, animation: "fadeUp 0.6s ease both" }}>
          Smooth air returns in about {formatMinutes(bumpLeft)}.
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ORCHESTRATOR ────────────────────────────────────────────────────
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewState, setViewState] = useState('search'); 
  const [flightData, setFlightData] = useState({
    state: 'gray',
    turbulenceCurve: [{ t: 0, intensity: 0 }, { t: 1, intensity: 0 }],
    altitudeCurve:   [{ t: 0, alt: 0 },       { t: 1, alt: 0 }],
    bumpStart: 0,
    bumpEnd:   0,
    durationMin: 0,
  });
  const [searchInput, setSearchInput] = useState('');
  const [showProofOfWork, setShowProofOfWork] = useState(false);
  const [liveTab, setLiveTab] = useState('altitude');
  const [progress,  setProgress]  = useState(0.18);
  const [intensity, setIntensity] = useState(0.02);
  const [smoothInt, setSmoothInt] = useState(0.02);
  const [altitude,  setAltitude]  = useState(18000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingText, setLoadingText] = useState("Connecting to live radar...");
  const [liveAltitude, setLiveAltitude] = useState(null); // null = use curve fallback

  const rafRef      = useRef(null);
  const intervalRef = useRef(null);
  const pollRef     = useRef(null);

 const handleSearchSubmit = async (e) => {
  e.preventDefault();
  if (!searchInput.trim()) return;

  setViewState('loading');
  setShowProofOfWork(false);

  setTimeout(() => setLoadingText("Analyzing route conditions..."), 1200);
  setTimeout(() => setLoadingText("Preparing your timeline..."), 2400);

  try {
    const res = await fetch(
      `https://clear-skies-backend.vercel.app/api/flight/${searchInput.trim().replace(/\s+/g, '')}`
    );
    const data = await res.json();

    setTimeout(() => {
      if (!data) {
        setViewState('error');
      } else if (data.state === 'out_of_scope' || data.reason === 'flight_not_found') {
        setViewState('not_found');
      } else {
        setLiveAltitude(null);
        setFlightData(data);
        setViewState('result');
      }
      setLoadingText("Connecting to live radar...");
    }, 3200);

  } catch (err) {
    setTimeout(() => {
      setViewState('error');
      setLoadingText("Connecting to live radar...");
    }, 3200);
  }
};

  useEffect(() => {
    if (viewState !== 'live') return;
    if (flightData.turbulenceCurve?.length > 1) {
      setIntensity(sampleCurve(flightData.turbulenceCurve, progress));
    }
  }, [progress, viewState, flightData]);

  useEffect(() => {
    if (viewState !== 'live') return;
    const tick = () => {
      setSmoothInt(prev => {
        const diff = intensity - prev;
        return Math.abs(diff) < 0.001 ? intensity : prev + diff * 0.03;
      });
      // Use real aircraft altitude when available; fall back to curve
      if (liveAltitude != null) {
        setAltitude(liveAltitude);
      } else if (flightData.altitudeCurve?.length > 1) {
        setAltitude(sampleCurve(flightData.altitudeCurve, progress, "alt"));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [intensity, progress, viewState, flightData, liveAltitude]);

  // ── Live position polling — every 30 s when in live mode ──────────────────
  useEffect(() => {
    if (viewState !== 'live' || !flightData.icao24) return;

    const poll = async () => {
      try {
        const res  = await fetch(
          `https://clear-skies-backend.vercel.app/api/live/${flightData.icao24}`
        );
        const data = await res.json();
        if (data.altitude != null) setLiveAltitude(data.altitude);
      } catch (_err) {
        // Silently ignore — altitude falls back to curve
      }
    };

    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, 30_000);
    return () => clearInterval(pollRef.current);
  }, [viewState, flightData.icao24]);

  useEffect(() => {
    if (!isPlaying) return;
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 1) { setIsPlaying(false); return 1; }
        return p + 0.0007;
      });
    }, 80);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying]);

  const isDark = isDarkMode;
  const t = getTokens(isDark);
  const color = lerpColor(smoothInt);
  const status = getStatusText(smoothInt);

  const getResultHeader = () => {
    if (flightData.state === 'amber') return { 
      title: "Some movement mid-flight.", desc: "Your flight has a patch of routine bumps halfway through the journey. The air before and after this section is completely clear.", 
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50/60", border: isDark ? "border-amber-500/20" : "border-amber-100/50",
      titleColor: isDark ? "text-amber-50" : "text-stone-800", descColor: isDark ? "text-amber-200/70" : "text-stone-600"
    };
    if (flightData.state === 'green') return { 
      title: "Standard, clear air.", desc: "Your route shows standard, calm conditions today. You will feel a few normal spring breezes, but the rest of the way is completely clear.", 
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50/60", border: isDark ? "border-emerald-500/20" : "border-emerald-100/50",
      titleColor: isDark ? "text-emerald-50" : "text-stone-800", descColor: isDark ? "text-emerald-200/70" : "text-stone-600"
    };
    return { 
      title: "Route data is updating.", desc: "We don't have the full picture right now. This just means the radar hasn't synced for this flight yet. Your pilots have the live route ready to go.", 
      bg: isDark ? "bg-stone-500/10" : "bg-stone-50", border: isDark ? "border-stone-500/20" : "border-stone-100",
      titleColor: isDark ? "text-stone-100" : "text-stone-800", descColor: isDark ? "text-stone-400" : "text-stone-600"
    };
  };
  const resultHeader = getResultHeader();

  return (
    <div className="min-h-screen relative flex flex-col items-center py-8 px-4 transition-colors duration-500 overflow-hidden" style={{ background: t.bg, color: t.ink }}>
      <style>{fontStyles}</style>

      {isDark && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] pointer-events-none transition-colors duration-500 from-stone-900 via-stone-950 to-black" />
      )}

      <div className="w-full max-w-[420px] relative z-10 flex flex-col transition-all duration-500">
        
        {/* ============================================================== */}
        {/* 1. PREMIUM SEARCH SCREEN                                       */}
        {/* ============================================================== */}
        {viewState === 'search' && (
          <div className="animate-fade-up w-full mt-12 flex flex-col">
            <div className="flex flex-col items-center mb-12 mt-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-16 h-16 rounded-full shadow-sm flex items-center justify-center mb-6 border transition-all hover:scale-105 active:scale-95" 
                style={{ background: t.card, borderColor: t.border, color: isDark ? '#9ca3af' : '#f59e0b' }}
                title="Toggle Light/Dark Mode"
              >
                {isDark ? <Moon size={32} strokeWidth={2.5} /> : <Sun size={32} strokeWidth={2.5} />}
              </button>
              <h1 className="text-3xl font-extrabold tracking-tight text-center" style={{ color: t.ink }}>Clear Skies</h1>
              <p className="font-medium mt-2" style={{ color: t.inkMid }}>Aviation analysis made calming.</p>
            </div>

            <div className="rounded-[2rem] p-8 border" style={{ background: t.card, borderColor: t.border, boxShadow: t.shadow }}>
              <h2 className="text-[22px] font-extrabold mb-2" style={{ color: t.ink }}>Where are we flying today?</h2>
              <p className="text-[15px] leading-relaxed mb-6" style={{ color: t.inkMid }}>
                Enter your flight number to get an honest, clear preview of your journey.
              </p>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g. DL 123"
                  className="w-full border text-lg rounded-2xl px-6 py-5 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all font-extrabold text-center shadow-inner"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: t.ink }}
                />
                
                <button
                  type="submit"
                  disabled={!searchInput.trim()}
                  className="w-full disabled:opacity-50 font-extrabold text-[16px] py-4 rounded-2xl transition-colors duration-300 shadow-lg"
                  style={{ background: isDark ? '#f3f4f6' : '#1a1814', color: isDark ? '#1a1814' : '#fff' }}
                >
                  Check my flight
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. CALMING LOADING STATE                                       */}
        {/* ============================================================== */}
        {viewState === 'loading' && (
          <>
            <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full transition-colors opacity-60 hover:opacity-100" style={{ color: t.ink }}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <div className="animate-fade-in w-full h-[600px] flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full shadow-lg border flex items-center justify-center text-amber-500 mb-8 animate-breathe" style={{ background: t.card, borderColor: t.border }}>
                <ShieldCheck size={40} strokeWidth={2} />
              </div>
              <p className="font-bold text-[15px] tracking-wide animate-fade-in" style={{ color: t.inkMid }} key={loadingText}>
                {loadingText}
              </p>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* 3. CALM ERROR STATE (Network / API Failure)                    */}
        {/* ============================================================== */}
        {viewState === 'error' && (
          <>
            <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full transition-colors opacity-60 hover:opacity-100" style={{ color: t.ink }}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            
            <div className="animate-fade-up w-full mt-16 flex flex-col items-center text-center px-6">
              <div className="w-20 h-20 rounded-full shadow-sm border flex items-center justify-center mb-6" style={{ background: t.card, borderColor: t.border, color: t.inkDim }}>
                <Wind size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-[22px] font-extrabold mb-3 tracking-tight" style={{ color: t.ink }}>
                Just a quick radar delay.
              </h2>
              <p className="text-[15px] leading-relaxed mb-8" style={{ color: t.inkMid }}>
                We hit a tiny snag connecting to the aviation database. Your flight is completely fine, our servers just need a second to catch up.
              </p>
              <button 
                onClick={() => {
                  setSearchInput('');
                  setViewState('search');
                }}
                className="w-full max-w-[240px] font-extrabold text-[15px] py-4 rounded-2xl transition-all shadow-sm border"
                style={{ background: t.card, color: t.ink, borderColor: t.border }}
              >
                Try searching again
              </button>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* 3b. UNSUPPORTED ROUTE (Not in database / Out of scope)         */}
        {/* ============================================================== */}
        {viewState === 'not_found' && (
          <>
            <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full transition-colors opacity-60 hover:opacity-100" style={{ color: t.ink }}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>

            <div className="animate-fade-up w-full mt-16 flex flex-col items-center text-center px-6">
              <div className="w-20 h-20 rounded-full shadow-sm border flex items-center justify-center mb-6" style={{ background: t.card, borderColor: t.border, color: t.inkDim }}>
                <Plane size={28} strokeWidth={2} className="transform -rotate-45" />
              </div>
              <h2 className="text-[22px] font-extrabold mb-3 tracking-tight" style={{ color: t.ink }}>
                We don't have data for this route yet.
              </h2>
              <p className="text-[15px] leading-relaxed mb-4" style={{ color: t.inkMid }}>
                We're working on expanding our coverage every day.
              </p>
              <p className="text-[15px] leading-relaxed mb-8" style={{ color: t.inkMid }}>
                In the meantime, rest assured. The vast majority of flights are completely smooth, and your pilots have full visibility of conditions ahead.
              </p>
              <button
                onClick={() => { setSearchInput(''); setViewState('search'); }}
                className="w-full max-w-[240px] font-extrabold text-[15px] py-4 rounded-2xl transition-all shadow-sm border"
                style={{ background: t.card, color: t.ink, borderColor: t.border }}
              >
                Try another flight
              </button>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* 4. THE RESULT CARD (Green, Amber, Gray)                        */}
        {/* ============================================================== */}
        {viewState === 'result' && (
          <div className="animate-fade-up w-full flex flex-col">
            <div className="flex justify-between items-center mb-6 px-2">
              <h1 className="text-xl font-extrabold tracking-tight cursor-pointer" style={{ color: t.ink }} onClick={() => { setViewState('search'); setSearchInput(''); }}>Clear Skies</h1>
              <div className="flex items-center gap-3">
                {flightData.flightId && (
                  <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
                    {flightData.flightId}
                  </div>
                )}
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-full transition-colors opacity-60 hover:opacity-100" style={{ color: t.ink }}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>

            <div className="w-full rounded-[2rem] border overflow-hidden" style={{ background: t.card, borderColor: t.border, boxShadow: t.shadow }}>
              <div className={`${resultHeader.bg} p-6 border-b ${resultHeader.border} text-center transition-colors duration-500`}>
                <h2 className={`text-[24px] font-extrabold leading-tight mb-3 ${resultHeader.titleColor}`}>
                  {resultHeader.title}
                </h2>
                <p className={`text-[15px] font-medium leading-relaxed px-2 ${resultHeader.descColor}`}>
                  {resultHeader.desc}
                </p>
              </div>

              <div className="p-6">
                <div className="mb-2 -mx-1">
                  <TurbulenceGraph flightData={flightData} isDark={isDark} t={t} progress={progress} />
                </div>
                {flightData.state !== 'gray' && (
                  <p className="text-center text-[11px] font-medium mb-6 px-2" style={{ color: t.inkDim }}>
                    Forecast reflects current corridor conditions. Exact timing may shift by a few minutes.
                  </p>
                )}

                {flightData.state !== 'gray' && (
                  <div className="mb-8">
                    <button 
                      onClick={() => setShowProofOfWork(!showProofOfWork)}
                      className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider transition-colors"
                      style={{ color: t.inkDim }}
                    >
                      How do we know this?
                      {showProofOfWork ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {showProofOfWork && (
                      <div className="mt-4 flex flex-col gap-2 animate-fade-in">
                        <div className="flex items-center gap-2 border text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: t.inkMid }}>
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Live reports from planes ahead of you
                        </div>
                        <div className="flex items-center gap-2 border text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: t.inkMid }}>
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Current radar and wind data
                        </div>
                        <div className="flex items-center gap-2 border text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: t.inkMid }}>
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> Factored for Boeing 737 aircraft weight
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: t.inkDim }}>Flight Conditions</h3>
                  <div className="space-y-4">
                    {/* Weather status — dynamic by state */}
                    <div className="flex items-start gap-3">
                      <div className="border p-2.5 rounded-xl shrink-0 shadow-sm" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: flightData.state === 'amber' ? '#f59e0b' : '#5cb87a' }}>
                        <Wind size={18} />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold" style={{ color: t.ink }}>
                          {flightData.state === 'amber' ? 'Light activity mid-route' : flightData.state === 'green' ? 'Clear air end to end' : 'Conditions syncing'}
                        </p>
                        <p className="text-[13px] font-medium leading-snug mt-0.5" style={{ color: t.inkMid }}>
                          {flightData.state === 'amber'
                            ? `Pilot reports show a brief patch of routine movement around the ${formatMinutes(flightData.bumpStart)}–${formatMinutes(flightData.bumpEnd)} mark. Completely normal and handled daily.`
                            : flightData.state === 'green'
                            ? 'Pilots flying this corridor recently reported smooth air throughout. No significant activity detected along your route today.'
                            : 'Live radar data is still catching up for this route. Your crew has full situational awareness onboard.'}
                        </p>
                      </div>
                    </div>
                    {/* Pilot fact — always shown */}
                    <div className="flex items-start gap-3">
                      <div className="border p-2.5 rounded-xl shrink-0 shadow-sm" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: t.border, color: t.inkMid }}>
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold" style={{ color: t.ink }}>Pilots reroute in real time</p>
                        <p className="text-[13px] font-medium leading-snug mt-0.5" style={{ color: t.inkMid }}>
                          Your crew actively monitors turbulence on onboard radar and can adjust altitude or heading to smooth out the ride, often before you would ever feel it.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t flex flex-col gap-2" style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', borderColor: t.border }}>
                <button onClick={() => setViewState('nudge')} className="w-full font-extrabold text-[14px] py-4 rounded-xl transition-colors" style={{ background: isDark ? '#f3f4f6' : '#1a1814', color: isDark ? '#1a1814' : '#fff' }}>
                  Enter In-Flight Companion
                </button>
                <button onClick={() => setViewState('search')} className="text-[12px] font-bold transition-colors py-2" style={{ color: t.inkDim }}>
                  Check another flight
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. PRE-NUDGE SCREEN (Start of Live Companion Flow)             */}
        {/* ============================================================== */}
        {viewState === 'nudge' && (
          <div className="animate-fade-up w-full flex flex-col h-[750px] max-h-[90vh] rounded-[2.5rem] border overflow-hidden transition-all duration-500" style={{ background: t.card, borderColor: t.border, boxShadow: t.shadow }}>
            <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: t.border }}>
              <button onClick={() => setViewState('result')} className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: t.ink }}><ArrowLeft size={22} /></button>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
                  {flightData.flightId}
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-full transition-colors opacity-60 hover:opacity-100" style={{ color: t.ink }}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>

            {(() => {
              const hasBumps = (flightData?.bumpStart ?? 0) > 0 && (flightData?.bumpEnd ?? 0) > 0;
              const currentMinNudge = Math.round(progress * (flightData?.durationMin ?? 0));
              const minsLeft = Math.max(0, (flightData?.bumpStart ?? 0) - currentMinNudge);
              const countdownLabel = minsLeft === 0 ? "Bumpy patch approaching now." : `${formatMinutes(minsLeft)} to bumps.`;

              return (
                <div className="flex-1 p-6 flex flex-col justify-center">
                  {hasBumps ? (
                    <>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto bg-amber-500/10 text-amber-500">
                        <Bell size={28} />
                      </div>
                      <h2 className="text-2xl font-extrabold text-center mb-3" style={{ color: t.ink }}>
                        {countdownLabel}
                      </h2>
                      <p className="text-center text-[15px] leading-relaxed mb-10 px-2" style={{ color: t.inkMid }}>
                        We're approaching that routine bumpy patch mapped out earlier. The crew is preparing the cabin. A great time to set up your space.
                      </p>
                      <div className="space-y-3 mb-10">
                        <div className="p-4 rounded-2xl flex items-center gap-4 border" style={{ background: t.bg, borderColor: t.border }}>
                          <div className="p-2.5 rounded-xl opacity-80" style={{ background: t.card, color: t.inkMid }}><Headphones size={20} /></div>
                          <div>
                            <p className="font-bold text-sm" style={{ color: t.ink }}>Put headphones on</p>
                            <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>Block engine noise changes.</p>
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl flex items-center gap-4 border" style={{ background: t.bg, borderColor: t.border }}>
                          <div className="p-2.5 rounded-xl opacity-80" style={{ background: t.card, color: t.inkMid }}><Coffee size={20} /></div>
                          <div>
                            <p className="font-bold text-sm" style={{ color: t.ink }}>Secure hot drinks</p>
                            <p className="text-xs mt-0.5" style={{ color: t.inkDim }}>Put lids on cups or stow them.</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto bg-emerald-500/10 text-emerald-500">
                        <ShieldCheck size={28} />
                      </div>
                      <h2 className="text-2xl font-extrabold text-center mb-3" style={{ color: t.ink }}>
                        Smooth skies ahead.
                      </h2>
                      <p className="text-center text-[15px] leading-relaxed mb-10 px-2" style={{ color: t.inkMid }}>
                        No turbulence expected on this route. Sit back, get comfortable, and enjoy the ride. It should be a calm one.
                      </p>
                      <div className="mb-10" />
                    </>
                  )}

                  <button
                    onClick={() => setViewState('live')}
                    className="w-full font-extrabold text-[15px] py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                    style={{ background: isDarkMode ? '#f3f4f6' : '#1a1814', color: isDarkMode ? '#1a1814' : '#fff' }}
                  >
                    <Maximize size={18} /> Enter Live Mode
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. LIVE COMPANION (Altitude / Atmosphere)                      */}
        {/* ============================================================== */}
        {viewState === 'live' && (
          <div className="animate-fade-up w-full flex flex-col h-[750px] max-h-[90vh] rounded-[2.5rem] border overflow-hidden transition-all duration-500" style={{ background: t.card, borderColor: t.border, boxShadow: t.shadow }}>
            
            <div className="p-6 pb-2 shrink-0 z-20 flex flex-col items-center relative">
              <div className="w-full flex items-center justify-between mb-4">
                <button onClick={() => setViewState('nudge')} className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: t.ink }}><ArrowLeft size={22} /></button>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-500">
                  <ShieldCheck size={14} strokeWidth={2.5} /> {liveTab === 'altitude' ? 'Altitude' : 'Atmosphere'}
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: t.ink }}>
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>

              <div className="flex items-center gap-1 mt-6 p-1 rounded-xl w-full max-w-[240px]" style={{ background: t.border }}>
                <button onClick={() => setLiveTab('altitude')} className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors" style={{ background: liveTab === 'altitude' ? t.card : 'transparent', color: liveTab === 'altitude' ? t.ink : t.inkDim, boxShadow: liveTab === 'altitude' ? t.shadow : 'none' }}>Altitude</button>
                <button onClick={() => setLiveTab('atmosphere')} className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors" style={{ background: liveTab === 'atmosphere' ? t.card : 'transparent', color: liveTab === 'atmosphere' ? t.ink : t.inkDim, boxShadow: liveTab === 'atmosphere' ? t.shadow : 'none' }}>Atmosphere</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
              {/* TAB 1: ALTITUDE */}
              {liveTab === 'altitude' && (
                <ExpandedAltitudeVisualizer altitude={altitude} progress={progress} color={color} tokens={t} />
              )}

              {/* TAB 2: ATMOSPHERE */}
              {liveTab === 'atmosphere' && (
                <div className="flex-1 flex flex-col p-6 pb-8 animate-fade-in overflow-y-auto">
                  <div className="flex-1 flex flex-col items-center mb-8">
                    <div className="mb-4"><ParticleOrb intensity={smoothInt} color={color} /></div>
                    <div className="mb-6"><PlaneIcon progress={progress} intensity={smoothInt} color={color} /></div>
                    <div className="text-center px-4">
                      <p className="text-[22px] font-extrabold mb-1" style={{ color: t.ink }}>{status.line1}</p>
                      <p className="text-[14px] font-medium" style={{ color: t.inkMid }}>{status.line2}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 shrink-0">
                    <div className="p-5 rounded-2xl border" style={{ background: t.card, borderColor: t.border, boxShadow: t.shadow }}>
                      <FlightProgress progress={progress} flight={flightData} color={color} tokens={t} />
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Anchor (Only outside Live immersive states) */}
        {viewState !== 'live' && viewState !== 'nudge' && (
          <div className="pt-8 w-full text-center">
            <p className="text-[14px] font-bold tracking-wide" style={{ color: t.inkDim }}>Take a deep breath. You are safe.</p>
          </div>
        )}
      </div>

    </div>
  );
}