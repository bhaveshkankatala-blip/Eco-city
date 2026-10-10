/* EcoCity 3D: tiny WebGL2 engine (lit, flat-shaded, shadowed, fogged, instanced) */
(function (root) {
'use strict';

// ---------------- math (column-major) ----------------
const M4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, o) {
    o = o || new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; },
  ortho(l, r, b, t, n, f) { const m = M4.id(); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m; },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1;
    return m;
  },
  inv(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return M4.id(); d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
  // translate * rotY * rotX * rotZ * scale
  trs(x, y, z, ry, s, rx, rz, sy) {
    const m = M4.id(); s = s == null ? 1 : s; sy = sy == null ? s : sy;
    const cy = Math.cos(ry || 0), syn = Math.sin(ry || 0), cx = Math.cos(rx || 0), sx = Math.sin(rx || 0), cz = Math.cos(rz || 0), sz = Math.sin(rz || 0);
    // R = Ry * Rx * Rz
    const r00 = cy * cz + syn * sx * sz, r01 = -cy * sz + syn * sx * cz, r02 = syn * cx;
    const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
    const r20 = -syn * cz + cy * sx * sz, r21 = syn * sz + cy * sx * cz, r22 = cy * cx;
    m[0] = r00 * s; m[1] = r10 * s; m[2] = r20 * s;
    m[4] = r01 * sy; m[5] = r11 * sy; m[6] = r21 * sy;
    m[8] = r02 * s; m[9] = r12 * s; m[10] = r22 * s;
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  },
  xf(m, x, y, z) { const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w]; },
};

// ---------------- colour ----------------
const _cc = {};
function C(hex) {
  if (_cc[hex]) return _cc[hex];
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.pow(v / 255, 2.2);
  return (_cc[hex] = [f(n >> 16), f((n >> 8) & 255), f(n & 255)]);
}
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// ---------------- noise ----------------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------- geometry builder ----------------
const PRIM = {};
function cylTris(n, rt, rb, caps) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const b0 = [Math.cos(a0) * rb, 0, Math.sin(a0) * rb], b1 = [Math.cos(a1) * rb, 0, Math.sin(a1) * rb];
    const t0 = [Math.cos(a0) * rt, 1, Math.sin(a0) * rt], t1 = [Math.cos(a1) * rt, 1, Math.sin(a1) * rt];
    if (rt > 0) o.push(b0, b1, t1, b0, t1, t0); else o.push(b0, b1, [0, 1, 0]);
    if (caps !== false) { if (rb > 0) o.push([0, 0, 0], b1, b0); if (rt > 0) o.push([0, 1, 0], t0, t1); }
  }
  return o;
}
function prim(name) {
  if (PRIM[name]) return PRIM[name];
  let t = [];
  const parts = name.split(':');
  const k = parts[0];
  if (k === 'box') {
    const v = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 1, -.5], [-.5, 1, -.5], [-.5, 0, .5], [.5, 0, .5], [.5, 1, .5], [-.5, 1, .5]];
    [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].forEach(([a, b, c, d]) => t.push(v[a], v[b], v[c], v[a], v[c], v[d]));
  } else if (k === 'cyl') t = cylTris(+parts[1], 1, 1);
  else if (k === 'cone') t = cylTris(+parts[1], 0, 1);
  else if (k === 'fr') t = cylTris(+parts[1], +parts[2], 1);
  else if (k === 'prism') {
    const v = [[-.5, 0, -.5], [.5, 0, -.5], [0, 1, -.5], [-.5, 0, .5], [.5, 0, .5], [0, 1, .5]];
    t.push(v[0], v[1], v[2], v[3], v[5], v[4], v[0], v[2], v[5], v[0], v[5], v[3], v[1], v[4], v[5], v[1], v[5], v[2], v[0], v[3], v[4], v[0], v[4], v[1]);
  } else if (k === 'pyr') {
    const v = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5]], a = [0, 1, 0];
    for (let i = 0; i < 4; i++) t.push(v[i], v[(i + 1) % 4], a);
    t.push(v[0], v[2], v[1], v[0], v[3], v[2]);
  } else if (k === 'sph') {
    const n = +parts[1] || 7, m = Math.max(3, Math.round(n * 0.7));
    const P = (i, j) => { const th = j / m * Math.PI, ph = i / n * Math.PI * 2; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      if (j > 0) t.push(a, b, c); if (j < m - 1) t.push(a, c, d);
    }
  } else if (k === 'lathe') {
    // lathe:n:r0,y0;r1,y1;...
    const n = +parts[1], pr = parts[2].split(';').map(s => s.split(',').map(Number));
    for (let j = 0; j < pr.length - 1; j++) for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
      const A = p(pr[j][0], pr[j][1], a0), Bp = p(pr[j][0], pr[j][1], a1), Cc = p(pr[j + 1][0], pr[j + 1][1], a1), D = p(pr[j + 1][0], pr[j + 1][1], a0);
      t.push(A, Bp, Cc, A, Cc, D);
    }
  }
  const f = new Float32Array(t.length * 3);
  t.forEach((p, i) => { f[i * 3] = p[0]; f[i * 3 + 1] = p[1]; f[i * 3 + 2] = p[2]; });
  return (PRIM[name] = f);
}

function Geo() { this.p = []; this.c = []; }
// add(prim, colour, x,y,z, sx,sy,sz, ry, rx, rz)
Geo.prototype.add = function (name, hex, x, y, z, sx, sy, sz, ry, rx, rz) {
  const src = prim(name), col = typeof hex === 'string' ? C(hex) : hex;
  sx = sx == null ? 1 : sx; sy = sy == null ? sx : sy; sz = sz == null ? sx : sz;
  const cy = Math.cos(ry || 0), sny = Math.sin(ry || 0), cxr = Math.cos(rx || 0), sxr = Math.sin(rx || 0), czr = Math.cos(rz || 0), szr = Math.sin(rz || 0);
  const p = this.p, c = this.c;
  for (let i = 0; i < src.length; i += 3) {
    let vx = src[i] * sx, vy = src[i + 1] * sy, vz = src[i + 2] * sz;
    if (rz) { const nx = vx * czr - vy * szr; vy = vx * szr + vy * czr; vx = nx; }
    if (rx) { const ny = vy * cxr - vz * sxr; vz = vy * sxr + vz * cxr; vy = ny; }
    if (ry) { const nx = vx * cy + vz * sny; vz = -vx * sny + vz * cy; vx = nx; }
    p.push(vx + x, vy + y, vz + z); c.push(col[0], col[1], col[2]);
  }
  return this;
};
Geo.prototype.tri = function (a, b, d, col) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]); for (let i = 0; i < 3; i++) this.c.push(col[0], col[1], col[2]); return this; };
Geo.prototype.merge = function (g, x, y, z, ry) {
  const cy = Math.cos(ry || 0), sy = Math.sin(ry || 0);
  for (let i = 0; i < g.p.length; i += 3) { const vx = g.p[i], vz = g.p[i + 2]; this.p.push(vx * cy + vz * sy + (x || 0), g.p[i + 1] + (y || 0), -vx * sy + vz * cy + (z || 0)); }
  for (let i = 0; i < g.c.length; i++) this.c.push(g.c[i]);
  return this;
};

// ---------------- shaders ----------------
const VS_COMMON = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol;
layout(location=3) in vec4 iOff; layout(location=4) in vec4 iDat; layout(location=5) in vec3 iCol;
uniform mat4 uVP, uModel, uLVP; uniform float uTime; uniform int uMode;
vec4 worldPos(out vec3 n){
  float c=cos(iDat.x), s=sin(iDat.x);
  vec3 p=aPos; p.y*=iDat.y;
  if(uMode==7){ p.x += sin(uTime*1.3 + iOff.x*0.7 + iOff.z*0.5) * 0.04 * aPos.y; }
  p=vec3(p.x*c+p.z*s, p.y, -p.x*s+p.z*c)*iOff.w + iOff.xyz;
  n=vec3(aNor.x*c+aNor.z*s, aNor.y, -aNor.x*s+aNor.z*c);
  return uModel*vec4(p,1.0);
}`;
const VS = VS_COMMON + `
out vec3 vCol; out vec3 vNor; out vec3 vW; out vec4 vL;
void main(){ vec3 n; vec4 w=worldPos(n); vW=w.xyz; vNor=mat3(uModel)*n; vCol=aCol*iCol; vL=uLVP*w; gl_Position=uVP*w; }`;
const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
in vec3 vCol; in vec3 vNor; in vec3 vW; in vec4 vL; out vec4 o;
uniform vec3 uSun, uSunCol, uSky, uGnd, uFog, uCam, uTint, uWater, uWaterDeep;
uniform float uFogN, uFogF, uAlpha, uTime, uEmit, uShadowOn; uniform int uMode, uFlat;
uniform sampler2DShadow uShadow;
uniform vec4 uL[40]; uniform int uLN; uniform float uNight;
float shadowF(vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec3 p=vL.xyz/vL.w*0.5+0.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
  float b=0.0015+0.002*(1.0-max(dot(n,uSun),0.0));
  vec2 t=vec2(1.3/2048.0); float z=p.z-b;
  float s=texture(uShadow, vec3(p.xy,z))*2.0+texture(uShadow, vec3(p.xy+vec2(t.x,t.y),z))+texture(uShadow, vec3(p.xy+vec2(-t.x,t.y),z))+texture(uShadow, vec3(p.xy+vec2(t.x,-t.y),z))+texture(uShadow, vec3(p.xy-t,z));
  return s/6.0;
}
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm2(vec2 p){ return vn2(p)*0.55+vn2(p*2.03+3.1)*0.3+vn2(p*4.01+7.7)*0.15; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
void main(){
  vec3 n = uFlat==1 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vNor);
  if(uFlat==1 && dot(n, uCam - vW) < 0.0) n = -n;
  vec3 base=vCol*uTint; float a=uAlpha;
  if(uMode==3){ o=vec4(pow(aces(base*1.35),vec3(1.0/2.2)),a); return; }
  if(uMode==6){ vec3 lit=mix(uGnd,uSky,n.y*0.5+0.5)*0.95+uSunCol*max(dot(n,uSun),0.0); vec3 g=base*lit*0.78; float f=smoothstep(uFogN,uFogF,length(vW-uCam)); o=vec4(pow(aces(mix(g,uFog,f*0.6)*1.25),vec3(1.0/2.2)),a); return; }
  if(uMode==1){
    float w1=sin(vW.x*3.1+uTime*1.4)*0.5+sin(vW.z*2.7-uTime*1.1)*0.5;
    float w2=sin((vW.x+vW.z)*5.3+uTime*2.3);
    n=normalize(vec3(w1*0.08,1.0,w2*0.06));
    base=mix(uWaterDeep,uWater,0.55+0.25*w1);
  }
  if(uMode==2){
    float s=fract(vW.y*2.2+uTime*1.6+sin(vW.x*9.0+vW.z*7.0)*0.3);
    base=mix(uWater*1.4, vec3(0.92,0.97,1.0), smoothstep(0.55,0.95,s));
    a=uAlpha*0.92;
  }
  if(uMode==8){
    // River (look: a fast turquoise mountain river with white water). vCol.rg = flow direction * speed,
    // vCol.b = factory waste. Foam streaks are stretched along the flow and carried downstream; two copies
    // half a cycle apart are blended so the pattern never smears (flow-map trick).
    vec2 fl=vCol.rg*2.0-1.0; float sp=length(fl);
    vec2 fd= sp>0.02 ? fl/sp : vec2(0.0,1.0);
    float ax=fd.x*fd.x;                       // how much this stretch runs along x
    float k1=fract(uTime*0.18), k2=fract(uTime*0.18+0.5), wb=abs(1.0-2.0*k1);
    vec2 d=fl*3.0;
    vec2 p1=vW.xz-d*k1, p2=vW.xz-d*k2;
    float s1=mix(fbm2(p1*vec2(4.5,1.1)), fbm2(p1*vec2(1.1,4.5)+7.3), ax);
    float s2=mix(fbm2(p2*vec2(4.5,1.1)+3.1), fbm2(p2*vec2(1.1,4.5)+11.7), ax);
    float st=mix(s1,s2,wb);
    float c1=fbm2(p1*2.2+1.7), c2=fbm2(p2*2.2+5.9), ch=mix(c1,c2,wb);
    n=normalize(vec3((st-0.5)*0.35+(ch-0.5)*0.2, 1.0, (ch-0.5)*0.3-(st-0.5)*0.2));
    float dirt=clamp(vCol.b,0.0,1.0);
    vec3 deep=vec3(0.02,0.24,0.40), mid=vec3(0.06,0.50,0.66), shallow=vec3(0.36,0.80,0.84);
    vec3 turq=mix(deep,mid,smoothstep(0.25,0.65,ch));
    turq=mix(turq,shallow,smoothstep(0.62,0.9,ch)*0.6);
    turq=mix(turq, uWater, 0.18);           // pollution and drought tint from the sky
    vec3 mud=mix(vec3(0.20,0.11,0.03), vec3(0.38,0.24,0.08), ch);
    base=mix(turq,mud,smoothstep(0.0,0.7,dirt));
    float foamAmt=(0.35+0.65*sp)*(1.0-smoothstep(0.0,0.7,dirt)*0.8);
    float foam=smoothstep(0.62-0.08*sp,0.8,st)*foamAmt;
    float rapids=smoothstep(0.85,1.0,sp)*smoothstep(0.4,0.7,ch)*0.8;
    base=mix(base, vec3(0.92,0.97,1.0), clamp(max(foam,rapids),0.0,1.0));
    a=uAlpha;
  }
  float sh=shadowF(n);
  float ndl=max(dot(n,uSun),0.0);
  vec3 hemi=mix(uGnd,uSky,n.y*0.5+0.5);
  vec3 col=base*(hemi*0.95+uSunCol*ndl*sh)+base*uEmit;
  // night: warm light pools from street lamps and windows
  if(uNight>0.02 && uMode!=8 && uMode!=1){
    vec3 pl=vec3(0.0);
    for(int i=0;i<40;i++){ if(i>=uLN) break; vec3 d=uL[i].xyz-vW; float r=length(d); float att=uL[i].w*smoothstep(1.9,0.15,r)/(1.0+r*r*3.5); pl+=vec3(1.0,0.72,0.42)*att*(0.45+0.55*max(dot(n,d/max(r,0.001)),0.0)); }
    col+=base*pl*uNight*3.6;
  }
  if((uMode==1||uMode==8) && uNight>0.02){ vec3 pl=vec3(0.0); for(int i=0;i<40;i++){ if(i>=uLN) break; vec3 d=uL[i].xyz-vW; float r=length(d); pl+=vec3(1.0,0.75,0.45)*uL[i].w*smoothstep(1.8,0.2,r)/(1.0+r*r*3.0); } col+=pl*uNight*0.35; }
  if(uMode==1||uMode==8){ vec3 v=normalize(uCam-vW); vec3 h=normalize(v+uSun); col+=uSunCol*pow(max(dot(n,h),0.0),70.0)*0.55*sh; a=uAlpha; }
  float f=smoothstep(uFogN,uFogF,length(vW-uCam));
  col=mix(col,uFog,f);
  o=vec4(pow(aces(col*0.92),vec3(1.0/2.2)),a);
}`;
const VS_SH = VS_COMMON + `
void main(){ vec3 n; gl_Position=uLVP*worldPos(n); }`;
const FS_SH = `#version 300 es
precision mediump float; out vec4 o; void main(){ o=vec4(1.0); }`;
// sprites: quad corner + instance (center xyz, size) + colour rgba
const VS_SP = `#version 300 es
layout(location=0) in vec2 aC; layout(location=3) in vec4 iP; layout(location=5) in vec4 iC;
uniform mat4 uVP; uniform vec3 uRight, uUp; out vec2 vC; out vec4 vCol; out vec3 vW;
void main(){ vec3 w=iP.xyz+(uRight*aC.x+uUp*aC.y)*iP.w; vW=w; vC=aC; vCol=iC; gl_Position=uVP*vec4(w,1.0); }`;
const FS_SP = `#version 300 es
precision highp float; in vec2 vC; in vec4 vCol; in vec3 vW; out vec4 o; uniform vec3 uFog, uCam; uniform float uFogN, uFogF;
void main(){ float r=dot(vC,vC); if(r>1.0) discard; float a=pow(1.0-r,1.6)*vCol.a; float f=smoothstep(uFogN,uFogF,length(vW-uCam)); vec3 c=mix(vCol.rgb,uFog,f*0.8); o=vec4(pow(c,vec3(1.0/2.2)),a); }`;
const VS_SKY = `#version 300 es
layout(location=0) in vec2 aC; out float vY; void main(){ vY=aC.y*0.5+0.5; gl_Position=vec4(aC,0.9999,1.0); }`;
const FS_SKY = `#version 300 es
precision highp float; in float vY; out vec4 o; uniform vec3 uTop, uHor, uBot; uniform float uHorY;
void main(){ vec3 c = vY>uHorY ? mix(uHor,uTop,pow((vY-uHorY)/(1.0-uHorY),0.8)) : mix(uBot,uHor,pow(vY/uHorY,0.6)); o=vec4(pow(c,vec3(1.0/2.2)),1.0); }`;

// ---------------- engine ----------------
function Engine(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('webgl2');
  this.gl = gl; this.cv = canvas;
  const mk = (vs, fs) => {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, s]) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); });
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  };
  this.P = mk(VS, FS); this.PS = mk(VS_SH, FS_SH); this.PSP = mk(VS_SP, FS_SP); this.PSKY = mk(VS_SKY, FS_SKY);
  gl.vertexAttrib4f(3, 0, 0, 0, 1); gl.vertexAttrib4f(4, 0, 1, 0, 0); gl.vertexAttrib4f(5, 1, 1, 1, 1);
  // shadow map
  this.SM = 2048;
  this.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.SM, this.SM, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  this.shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // quad for sprites/sky
  this.quad = gl.createVertexArray(); gl.bindVertexArray(this.quad);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  this.skyVao = this.quad;
  // sprite instance buffer
  this.spVao = gl.createVertexArray(); gl.bindVertexArray(this.spVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  this.spBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.spBuf); gl.bufferData(gl.ARRAY_BUFFER, 8 * 4 * 600, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(5, 1);
  gl.bindVertexArray(null);
  this.spData = new Float32Array(8 * 600);
}
Engine.prototype.mesh = function (g, opt) {
  // g: Geo or {p,c,n}
  const gl = this.gl, o = Object.assign({ mode: 0, flat: 1, tint: [1, 1, 1], alpha: 1, emit: 0, cast: true, model: M4.id(), visible: true, prim: gl.TRIANGLES, blend: false, depthWrite: true, order: 0 }, opt || {});
  o.vao = gl.createVertexArray(); gl.bindVertexArray(o.vao);
  const pos = g.p instanceof Float32Array ? g.p : new Float32Array(g.p);
  const col = g.c instanceof Float32Array ? g.c : new Float32Array(g.c);
  const nor = g.n ? (g.n instanceof Float32Array ? g.n : new Float32Array(g.n)) : null;
  o.bufs = [];
  const put = (loc, arr, size) => { const b = gl.createBuffer(); o.bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return b; };
  put(0, pos, 3); if (nor) put(1, nor, 3); else { gl.disableVertexAttribArray(1); }
  o.colBuf = put(2, col, 3);
  o.count = pos.length / 3;
  if (o.instances) {
    o.iBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.iBuf);
    gl.bufferData(gl.ARRAY_BUFFER, o.instances * 11 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 44, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 44, 16); gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 3, gl.FLOAT, false, 44, 32); gl.vertexAttribDivisor(5, 1);
    o.iData = new Float32Array(o.instances * 11); o.n = 0;
  }
  gl.bindVertexArray(null);
  return o;
};
// instance: [x,y,z,scale, rotY, scaleY, 0,0, r,g,b]
Engine.prototype.setInst = function (m, list) {
  const gl = this.gl, n = Math.min(list.length, m.instances), d = m.iData;
  for (let i = 0; i < n; i++) { const L = list[i]; for (let k = 0; k < 11; k++) d[i * 11 + k] = L[k] == null ? (k === 3 || k === 5 || k >= 8 ? 1 : 0) : L[k]; }
  m.n = n; gl.bindBuffer(gl.ARRAY_BUFFER, m.iBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 11);
};
Engine.prototype.setColors = function (m, arr) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, m.colBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); };
Engine.prototype.free = function (m) { const gl = this.gl; if (!m) return; gl.deleteVertexArray(m.vao); m.bufs.forEach(b => gl.deleteBuffer(b)); if (m.iBuf) gl.deleteBuffer(m.iBuf); };

Engine.prototype.render = function (scene, cam, opt) {
  // scene: {meshes:[], sprites:[], env:{...}}  cam: {vp, eye, right, up, w, h}
  const gl = this.gl, env = scene.env, P = this.P;
  opt = opt || {};
  // light matrix
  const L = env.sun, lc = env.shadowCenter || [0, 0, 0], R = env.shadowRadius || 22;
  const leye = [lc[0] + L[0] * 40, lc[1] + L[1] * 40, lc[2] + L[2] * 40];
  const lvp = M4.mul(M4.ortho(-R, R, -R, R, 1, 90), M4.lookAt(leye, lc, [0, 1, 0]));
  // shadow pass
  if (opt.shadow !== false && scene.shadowDirty !== false) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo); gl.viewport(0, 0, this.SM, this.SM);
    gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
    gl.useProgram(this.PS.p); gl.uniformMatrix4fv(this.PS.u.uLVP, false, lvp); gl.uniform1f(this.PS.u.uTime, env.time);
    for (const m of scene.meshes) { if (!m.visible || !m.cast || m.blend) continue; gl.uniformMatrix4fv(this.PS.u.uModel, false, m.model); gl.uniform1i(this.PS.u.uMode, m.mode); this._draw(m); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    scene.shadowDirty = false;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, opt.fbo || null);
  gl.viewport(0, 0, cam.w, cam.h);
  if (opt.clear) { gl.clearColor(opt.clear[0], opt.clear[1], opt.clear[2], opt.clear[3]); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
  else {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.PSKY.p); const su = this.PSKY.u;
    gl.uniform3fv(su.uTop, env.skyTop); gl.uniform3fv(su.uHor, env.skyHor); gl.uniform3fv(su.uBot, env.skyBot); gl.uniform1f(su.uHorY, env.horY || 0.42);
    gl.bindVertexArray(this.skyVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE);
  gl.useProgram(P.p); const u = P.u;
  gl.uniformMatrix4fv(u.uVP, false, cam.vp); gl.uniformMatrix4fv(u.uLVP, false, lvp);
  gl.uniform3fv(u.uSun, env.sun); gl.uniform3fv(u.uSunCol, env.sunCol); gl.uniform3fv(u.uSky, env.sky); gl.uniform3fv(u.uGnd, env.gnd);
  gl.uniform3fv(u.uFog, env.fog); gl.uniform3fv(u.uCam, cam.eye); gl.uniform1f(u.uFogN, env.fogN); gl.uniform1f(u.uFogF, env.fogF);
  gl.uniform1f(u.uTime, env.time); gl.uniform3fv(u.uWater, env.water); gl.uniform3fv(u.uWaterDeep, env.waterDeep);
  gl.uniform1f(u.uShadowOn, opt.shadow === false ? 0 : 1);
  gl.uniform1f(u.uNight, env.night || 0); gl.uniform1i(u.uLN, env.lightN || 0); if (env.lightN) gl.uniform4fv(u.uL, env.lights);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(u.uShadow, 0);
  const opaque = scene.meshes.filter(m => m.visible && !m.blend), trans = scene.meshes.filter(m => m.visible && m.blend).sort((a, b) => a.order - b.order);
  gl.disable(gl.BLEND);
  for (const m of opaque) this._drawLit(m);
  gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  for (const m of trans) { gl.depthMask(!!m.depthWrite); this._drawLit(m); }
  gl.depthMask(true);
  // sprites
  const sp = scene.sprites;
  if (sp && sp.length) {
    const n = Math.min(600, sp.length), d = this.spData;
    for (let i = 0; i < n; i++) { const s = sp[i]; d.set(s, i * 8); }
    gl.useProgram(this.PSP.p); const v = this.PSP.u;
    gl.uniformMatrix4fv(v.uVP, false, cam.vp); gl.uniform3fv(v.uRight, cam.right); gl.uniform3fv(v.uUp, cam.up);
    gl.uniform3fv(v.uFog, env.fog); gl.uniform3fv(v.uCam, cam.eye); gl.uniform1f(v.uFogN, env.fogN); gl.uniform1f(v.uFogF, env.fogF);
    gl.bindVertexArray(this.spVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.spBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 8);
    gl.depthMask(false); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); gl.depthMask(true);
  }
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
};
Engine.prototype._drawLit = function (m) {
  const gl = this.gl, u = this.P.u;
  gl.uniformMatrix4fv(u.uModel, false, m.model); gl.uniform3fv(u.uTint, m.tint); gl.uniform1f(u.uAlpha, m.alpha);
  gl.uniform1i(u.uMode, m.mode); gl.uniform1i(u.uFlat, m.flat); gl.uniform1f(u.uEmit, m.emit);
  this._draw(m);
};
Engine.prototype._draw = function (m) {
  const gl = this.gl; gl.bindVertexArray(m.vao);
  if (m.instances) { if (m.n) gl.drawArraysInstanced(m.prim, 0, m.count, m.n); }
  else gl.drawArrays(m.prim, 0, m.count);
};
// offscreen render target for thumbnails
Engine.prototype.target = function (w, h) {
  const gl = this.gl, t = { w, h };
  t.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  t.depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  t.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return t;
};
Engine.prototype.read = function (t) {
  const gl = this.gl, px = new Uint8Array(t.w * t.h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return px;
};

root.GL3 = { M4, C, mixc, hash, vnoise, fbm, rng, Geo, prim, Engine };
})(window);
