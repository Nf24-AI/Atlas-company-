// Native WebGL renderer. Static world geometry is uploaded ONCE (the prototype rebuilt and
// re-uploaded every vertex each frame); only characters are streamed per frame.
import {mat4Perspective, mat4LookAt, mat4Mul} from '../core/math3d.js';

const VERT = `attribute vec3 a_position;attribute vec3 a_normal;attribute vec3 a_color;uniform mat4 u_viewProjection;varying vec3 v_color;varying float v_light;
void main(){gl_Position=u_viewProjection*vec4(a_position,1.0);v_color=a_color;vec3 light=normalize(vec3(-0.55,0.86,0.52));v_light=0.55+max(dot(a_normal,light),0.0)*0.42;}`;
const FRAG = `precision mediump float;varying vec3 v_color;varying float v_light;void main(){gl_FragColor=vec4(v_color*v_light,1.0);}`;

const rgb = hex => { const v = parseInt(hex.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };

/** Primitive list → interleaved Float32Array (position, normal, colour). Pure; exported for tests. */
export function tessellate(primitives) {
  const out = [];
  const tri = (a, b, c, n, col) => { for (const p of [a, b, c]) out.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2]); };
  const quad = (a, b, c, d, n, col) => { tri(a, b, c, n, col); tri(a, c, d, n, col); };
  for (const p of primitives) {
    const col = rgb(p.color);
    if (p.shape === 'box') {
      const X = p.x - p.w / 2, Y = p.y - p.h / 2, Z = p.z - p.d / 2, x2 = p.x + p.w / 2, y2 = p.y + p.h / 2, z2 = p.z + p.d / 2;
      quad([X, y2, Z], [X, y2, z2], [x2, y2, z2], [x2, y2, Z], [0, 1, 0], col); quad([X, Y, z2], [X, Y, Z], [x2, Y, Z], [x2, Y, z2], [0, -1, 0], col);
      quad([X, Y, Z], [X, y2, Z], [x2, y2, Z], [x2, Y, Z], [0, 0, -1], col); quad([x2, Y, z2], [x2, y2, z2], [X, y2, z2], [X, Y, z2], [0, 0, 1], col);
      quad([X, Y, z2], [X, y2, z2], [X, y2, Z], [X, Y, Z], [-1, 0, 0], col); quad([x2, Y, Z], [x2, y2, Z], [x2, y2, z2], [x2, Y, z2], [1, 0, 0], col);
    } else if (p.shape === 'cyl') {
      const seg = 10, yy = p.y - p.h / 2, yt = p.y + p.h / 2, {x, z, r} = p;
      for (let i = 0; i < seg; i++) {
        const a = i / seg * 2 * Math.PI, b = (i + 1) / seg * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        tri([x, yt, z], [x + r * ca, yt, z + r * sa], [x + r * cb, yt, z + r * sb], [0, 1, 0], col);
        tri([x, yy, z], [x + r * cb, yy, z + r * sb], [x + r * ca, yy, z + r * sa], [0, -1, 0], col);
        quad([x + r * ca, yy, z + r * sa], [x + r * ca, yt, z + r * sa], [x + r * cb, yt, z + r * sb], [x + r * cb, yy, z + r * sb], [(ca + cb) / 2, 0, (sa + sb) / 2], col);
      }
    } else if (p.shape === 'sphere') {
      const rings = 7, seg = 10, {x, y, z, r} = p;
      const pt = (e, q) => [x + r * Math.cos(e) * Math.cos(q), y + r * Math.sin(e), z + r * Math.cos(e) * Math.sin(q)];
      for (let j = 0; j < rings; j++) {
        const a = -Math.PI / 2 + j * Math.PI / rings, b = -Math.PI / 2 + (j + 1) * Math.PI / rings;
        for (let i = 0; i < seg; i++) {
          const t = i * 2 * Math.PI / seg, u = (i + 1) * 2 * Math.PI / seg;
          const n = [Math.cos((a + b) / 2) * Math.cos((t + u) / 2), Math.sin((a + b) / 2), Math.cos((a + b) / 2) * Math.sin((t + u) / 2)];
          quad(pt(a, t), pt(b, t), pt(b, u), pt(a, u), n, col);
        }
      }
    }
  }
  return new Float32Array(out);
}

export function createWebGLRenderer(canvas, staticPrimitives) {
  const gl = canvas.getContext('webgl', {antialias: true, alpha: true, powerPreference: 'high-performance'});
  if (!gl) return null;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const locs = {pos: gl.getAttribLocation(program, 'a_position'), normal: gl.getAttribLocation(program, 'a_normal'), color: gl.getAttribLocation(program, 'a_color'), vp: gl.getUniformLocation(program, 'u_viewProjection')};
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);
  const staticData = tessellate(staticPrimitives);
  const staticBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf); gl.bufferData(gl.ARRAY_BUFFER, staticData, gl.STATIC_DRAW);
  const dynBuf = gl.createBuffer();
  const draw = (buf, count) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (const [loc, off] of [[locs.pos, 0], [locs.normal, 12], [locs.color, 24]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, off); }
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };
  return {
    kind: 'webgl',
    /** Renders the frame and returns the view-projection matrix (used to place DOM labels). */
    render({eye, target, dynamicPrimitives}) {
      const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr)), h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      const m = mat4Mul(mat4Perspective(Math.PI / 4, w / h, .1, 150), mat4LookAt(eye, target));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(locs.vp, false, new Float32Array(m));
      draw(staticBuf, staticData.length / 9);
      const dyn = tessellate(dynamicPrimitives);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW); draw(dynBuf, dyn.length / 9);
      return {matrix: m, width: rect.width, height: rect.height};
    },
  };
}
