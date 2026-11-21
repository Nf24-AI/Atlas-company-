// Canvas2D isometric fallback for devices where WebGL is blocked. Draws the SAME primitives
// as the WebGL renderer (world-data.js), painter-sorted, so the two can never disagree.
const shade = (hex, f) => {
  const v = parseInt(hex.slice(1), 16), c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(n => Math.max(0, Math.min(255, Math.round(n * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

export function createCanvasRenderer(canvas, staticPrimitives) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let ox = 0, oy = 0, scale = 1;
  const pt = (x, z, h = 0) => [ox + (x - z) * 17 * scale, oy + (x + z) * 7.8 * scale - h * 16 * scale];
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const drawPrim = p => {
    if (p.shape === 'box') {
      const y0 = p.y - p.h / 2, y1 = p.y + p.h / 2, X = p.x - p.w / 2, x2 = p.x + p.w / 2, Z = p.z - p.d / 2, z2 = p.z + p.d / 2;
      poly([pt(X, z2, y0), pt(x2, z2, y0), pt(x2, z2, y1), pt(X, z2, y1)], shade(p.color, .72));
      poly([pt(x2, Z, y0), pt(x2, z2, y0), pt(x2, z2, y1), pt(x2, Z, y1)], shade(p.color, .86));
      poly([pt(X, Z, y1), pt(x2, Z, y1), pt(x2, z2, y1), pt(X, z2, y1)], p.color);
    } else {
      const r = p.r, top = p.shape === 'cyl' ? p.y + p.h / 2 : p.y, c = pt(p.x, p.z, top);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(c[0], c[1], r * 17 * scale * 1.1, r * 9 * scale * (p.shape === 'sphere' ? 1.8 : 1), 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  const depth = p => (p.x + p.z) + (p.shape === 'box' ? (p.w + p.d) / 4 : 0) + (p.y || 0) * .01 - (p.shape === 'box' && p.h < .08 && p.w > 4 ? 100 : 0);
  const sorted = [...staticPrimitives].sort((a, b) => depth(a) - depth(b));
  return {
    kind: 'canvas2d',
    render({dynamicPrimitives}) {
      const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
      scale = Math.min(1.12, Math.max(.47, Math.min(rect.width / 1450, rect.height / 850))); ox = rect.width * .51; oy = rect.height * .46;
      const all = dynamicPrimitives.length ? [...sorted, ...dynamicPrimitives].sort((a, b) => depth(a) - depth(b)) : sorted;
      for (const p of all) drawPrim(p);
      return {project: (x, y, z) => pt(x, z, y), width: rect.width, height: rect.height};
    },
  };
}
