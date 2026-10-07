/**
 * Custom GLSL background shaders + a minimal WebGL runtime.
 *
 * Each shader is a full-screen fragment program receiving the same uniforms
 * the vanta-style options map onto: uTime, uRes, uMouse, uColorA/B/C,
 * uSpeed, uZoom. The runtime compiles one program per canvas, animates with
 * requestAnimationFrame and honors prefers-reduced-motion.
 */

export interface ShaderDef {
  id: string;
  fragment: string;
}

const COMMON_HEAD = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uSpeed;
uniform float uZoom;
#define PI 3.141592653589793
`;

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*snoise(p);p*=2.03;a*=0.5;}return v;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
`;

export const SHADER_DEFS: ShaderDef[] = [
  {
    id: "aurora",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*0.25*uSpeed;
  float h=fbm(vec3(uv.x*uZoom*2.0, t*0.8, uZoom));
  float curtain=sin(uv.x*8.0*uZoom+h*4.0+t*2.0)*0.5+0.5;
  float band=exp(-pow((uv.y-0.55-curtain*0.22-h*0.18)*4.0,2.0));
  vec3 sky=mix(uColorC*0.4, uColorC, uv.y);
  vec3 aurora=mix(uColorA,uColorB,curtain)*band;
  float stars=step(0.9985,hash(floor(gl_FragCoord.xy/2.0)))*smoothstep(0.0,0.4,uv.y);
  gl_FragColor=vec4(sky+aurora*1.6+stars,1.0);
}`,
  },
  {
    id: "plasma",
    fragment: `${COMMON_HEAD}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*uSpeed;
  float v=sin(uv.x*3.0+t)+sin(uv.y*3.0-t*1.3)+sin((uv.x+uv.y)*2.5+t*0.7)+sin(length(uv)*4.0-t*1.7);
  vec3 col=uColorA*0.5+uColorB*0.5*sin(v*PI*0.5)+uColorC*0.35*sin(v*PI*0.5+2.1);
  gl_FragColor=vec4(col*0.8,1.0);
}`,
  },
  {
    id: "nebula",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*0.15*uSpeed;
  vec2 p=(uv-0.5)*uZoom; p.x*=uRes.x/uRes.y;
  float n1=fbm(vec3(p*2.2,t,1.7)); float n2=fbm(vec3(p*3.5+4.0,-t,9.2));
  vec3 col=uColorC*0.04;
  col+=uColorA*smoothstep(0.1,0.9,n1)*0.9;
  col+=uColorB*smoothstep(0.15,0.95,n2)*0.8;
  float stars=step(0.998,hash(floor(gl_FragCoord.xy/1.5)));
  col+=stars*(0.5+0.5*sin(uTime*3.0+hash(gl_FragCoord.xy)*20.0));
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "lava",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.4*uSpeed;
  float n=fbm(vec3(uv*1.6,t*0.6,3.1));
  float blobs=smoothstep(0.25,0.65,abs(n));
  vec3 col=mix(uColorC,uColorA,1.0-blobs);
  col=mix(col,uColorB,smoothstep(0.45,0.8,n)*0.85);
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "grid",
    fragment: `${COMMON_HEAD}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*uSpeed;
  vec3 sky=mix(uColorC*0.35,uColorC*1.4,uv.y);
  float sun=smoothstep(0.30,0.26,abs(uv.y-0.52));
  float horizon=step(0.5,uv.y);
  vec2 g=vec2((uv.x-0.5)*uRes.x/uRes.y,1.0/(uv.y-0.5+0.002));
  vec2 cell=abs(fract(g*0.35*uZoom+vec2(0.0,-t*0.6))-0.5);
  float line=1.0-smoothstep(0.0,0.06,min(cell.x,cell.y));
  vec3 col=mix(uColorC*0.15,sky*0.25,horizon)+uColorB*sun*(1.0-horizon)*0.9;
  col+=uColorA*line*horizon*0.9;
  float fade=smoothstep(0.5,0.62,uv.y);
  gl_FragColor=vec4(mix(col,col*0.25+uColorC*0.1,1.0-fade),1.0);
}`,
  },
  {
    id: "oceanwire",
    fragment: `${COMMON_HEAD}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*0.5*uSpeed;
  float persp=1.0/(uv.y+0.08);
  vec2 p=vec2((uv.x-0.5)*persp*3.0*uZoom, persp*2.0*uZoom+t*2.0);
  vec2 cell=abs(fract(p)-0.5);
  float line=1.0-smoothstep(0.0,0.10,min(cell.x,cell.y));
  float glow=sin(p.y*0.9+t)*0.5+0.5;
  vec3 col=uColorB*(0.35+0.3*persp*0.3)+uColorA*line*(0.25+0.55*glow)*smoothstep(0.0,0.25,uv.y);
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "wormhole",
    fragment: `${COMMON_HEAD}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y);
  float r=length(uv)*uZoom; float a=atan(uv.y,uv.x);
  float t=uTime*uSpeed;
  float spiral=sin(a*3.0+log(max(r,0.05))*6.0-t*3.0)*0.5+0.5;
  float rings=sin(r*18.0-t*6.0)*0.5+0.5;
  vec3 col=mix(uColorA*0.12,uColorA,spiral*rings);
  col+=uColorB*exp(-r*2.4)*1.4;
  gl_FragColor=vec4(col*smoothstep(2.2,0.4,r),1.0);
}`,
  },
  {
    id: "liquidsky",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.3*uSpeed;
  float n1=fbm(vec3(uv*1.4,t,0.0)); float n2=fbm(vec3(uv*1.4+7.3,t*1.3,5.0));
  vec3 col=mix(uColorA,uColorB,smoothstep(-0.4,0.6,n1));
  col=mix(col,uColorC,smoothstep(0.0,0.8,n2)*0.7);
  col*=0.85+0.3*n1;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "starfield",
    fragment: `${COMMON_HEAD}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float star(vec2 uv, float t){
  vec2 g=floor(uv*40.0); vec2 f=fract(uv*40.0);
  float h=hash(g); vec2 pos=vec2(fract(h*7.7),fract(h*13.3));
  float d=length(f-pos-0.5);
  float tw=0.6+0.4*sin(t*3.0+h*40.0);
  return smoothstep(0.08,0.0,d)*tw*step(0.5,h);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*uSpeed;
  vec2 c=uv-0.5-uMouse*0.06; float r=length(c);
  vec3 col=uColorB;
  col+=uColorA*star(c*1.0/(0.3+r*0.5),t)*(0.3+r);
  col+=uColorA*star(c*2.3/(0.3+r*0.5)+13.1,t*1.3)*(0.2+r*0.8);
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "snow",
    fragment: `${COMMON_HEAD}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float flake(vec2 uv,float seed,float t){
  vec2 g=floor(uv); vec2 f=fract(uv);
  float h=hash(g+seed);
  vec2 pos=vec2(fract(h*9.1)+sin(t*0.7+h*20.0)*0.3, fract(h*5.7+t*0.25*(0.4+h)));
  return smoothstep(0.09,0.0,length(f-pos));
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*uSpeed;
  vec2 drift=vec2(uMouse.x*0.02,0.0);
  vec3 col=uColorB*(0.85+0.15*uv.y);
  col+=uColorA*flake((uv+drift)*vec2(28.0*uZoom,20.0*uZoom),0.0,t)*0.9;
  col+=uColorA*flake((uv+drift)*vec2(50.0*uZoom,36.0*uZoom),7.3,t)*0.6;
  col+=uColorA*flake((uv+drift)*vec2(90.0*uZoom,60.0*uZoom),3.1,t)*0.35;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "embers",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float t=uTime*uSpeed;
  vec3 col=uColorB;
  float glow=exp(-length(uv-vec2(0.5+uMouse.x*0.03,-0.15))*2.6);
  col+=uColorA*glow*0.5;
  for(float i=0.0;i<3.0;i++){
    vec2 g=vec2(uv.x*(26.0+i*18.0)*uZoom, uv.y*(20.0+i*14.0)*uZoom);
    vec2 cell=floor(g); vec2 f=fract(g);
    float h=hash(cell+vec2(i*13.7,0.0));
    float speed=0.35+h*0.55;
    vec2 pos=vec2(fract(h*11.3)+sin(t*speed*2.0+h*30.0)*0.35, fract(h*7.9+t*speed));
    float d=length(f-pos);
    col+=mix(uColorA,vec3(1.0,0.9,0.6),h*0.5)*smoothstep(0.06,0.0,d)*(0.5-h*0.25);
  }
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "caustics",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.5*uSpeed;
  float c1=fbm(vec3(uv*1.8+vec2(t*0.4,0.0),t*0.3));
  float c2=fbm(vec3(uv*2.4-vec2(t*0.3,t*0.2),t*0.4+3.0));
  float caustic=pow(smoothstep(0.3,0.9,c1*c2+0.3),2.2);
  vec3 col=uColorB*(0.55+0.25*c1);
  col+=uColorA*caustic*1.1;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "metaballs",
    fragment: `${COMMON_HEAD}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.6*uSpeed;
  float field=0.0;
  for(float i=0.0;i<5.0;i++){
    vec2 c=vec2(sin(t*(0.5+i*0.21)+i*1.7)*0.9, cos(t*(0.4+i*0.17)+i*2.3)*0.6);
    field+=0.16/ (0.01+length(uv-c));
  }
  float body=smoothstep(1.6,1.9,field);
  float edge=smoothstep(1.45,1.6,field)-body;
  vec3 col=mix(uColorB,uColorA,body);
  col+=uColorA*edge*0.7;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "silk",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.35*uSpeed;
  float w1=fbm(vec3(uv*1.2+vec2(t*0.5,0.0),t*0.2));
  float w2=fbm(vec3(uv*1.2+vec2(0.0,t*0.4),t*0.25+5.0));
  float sheen=0.5+0.5*sin(w1*4.0+w2*3.0+t);
  vec3 col=mix(uColorB,uColorA,sheen*smoothstep(-0.3,0.7,w1));
  col*=0.75+0.45*sheen;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "kaleido",
    fragment: `${COMMON_HEAD}${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.3*uSpeed;
  float a=atan(uv.y,uv.x)+t*0.4; float r=length(uv);
  float seg=PI/3.0; a=abs(mod(a,seg*2.0)-seg);
  vec2 p=vec2(cos(a),sin(a))*r;
  float n=fbm(vec3(p*2.5,t,4.0));
  float petals=0.5+0.5*sin(r*10.0-t*2.0+n*3.0);
  vec3 col=mix(uColorA,uColorB,petals);
  col*=smoothstep(1.8,0.15,r)*1.4;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    id: "voronoi",
    fragment: `${COMMON_HEAD}${NOISE}
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y)*uZoom;
  float t=uTime*0.4*uSpeed;
  vec2 g=floor(uv*3.5); vec2 f=fract(uv*3.5);
  float md=8.0; vec2 mb=vec2(0.0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 o=vec2(float(x),float(y));
    vec2 c=o+hash2(g+o)+0.35*vec2(sin(t+hash2(g+o).x*6.28),cos(t+hash2(g+o).y*6.28));
    float d=length(c-f);
    if(d<md){md=d;mb=hash2(g+o);}
  }
  vec3 col=mix(uColorB,uColorA,mb.x)* (0.55+0.45*smoothstep(0.0,0.7,md));
  col+=uColorA*smoothstep(0.05,0.0,md)*0.6;
  gl_FragColor=vec4(col,1.0);
}`,
  },
];

const BY_ID = new Map(SHADER_DEFS.map((s) => [s.id, s]));

export function getShaderDef(id: string): ShaderDef | undefined {
  return BY_ID.get(id);
}

/* ------------------------------------------------------------------ */
/* Minimal WebGL fullscreen-quad runtime                               */
/* ------------------------------------------------------------------ */

function hexToVec(hex: string): [number, number, number] {
  const clean = (hex || "#888888").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16) || 0x888888;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export interface ShaderMount {
  setOptions: (o: Record<string, unknown>) => void;
  setMouse: (x: number, y: number) => void;
  dispose: () => void;
}

/**
 * Mounts a GLSL background into `host` as a canvas. Options use the same
 * parameter keys as Effect3DPreset (colorA/colorB/colorC/speed/zoom).
 */
export function mountShaderBackground(
  host: HTMLElement,
  shaderId: string,
  params: Record<string, unknown> | undefined,
): ShaderMount | null {
  const def = getShaderDef(shaderId);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  host.appendChild(canvas);
  if (!def || !gl) {
    return null;
  }

  const compile = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      console.warn("[Frontel shader] compile failed:", gl!.getShaderInfoLog(s));
      gl!.deleteShader(s);
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, def.fragment);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl!.getUniformLocation(prog, n);
  const uniforms = {
    res: U("uRes"),
    time: U("uTime"),
    mouse: U("uMouse"),
    a: U("uColorA"),
    b: U("uColorB"),
    c: U("uColorC"),
    speed: U("uSpeed"),
    zoom: U("uZoom"),
  };

  const opts = params ?? {};
  const colorA = hexToVec(String(opts.colorA ?? "#2dd4bf"));
  const colorB = hexToVec(String(opts.colorB ?? "#0396ff"));
  const colorC = hexToVec(String(opts.colorC ?? "#020014"));
  const speed = Number(opts.speed ?? 1) || 0;
  const zoom = Number(opts.zoom ?? 1) || 1;

  gl.uniform2f(uniforms.res, host.clientWidth || 600, host.clientHeight || 400);
  gl.uniform3fv(uniforms.a, colorA);
  gl.uniform3fv(uniforms.b, colorB);
  gl.uniform3fv(uniforms.c, colorC);
  gl.uniform1f(uniforms.speed, speed);
  gl.uniform1f(uniforms.zoom, zoom);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mouse: [number, number] = [0.5, 0.5];
  let raf = 0;
  let disposed = false;
  const start = performance.now();

  const frame = () => {
    if (disposed) return;
    const t = (performance.now() - start) / 1000;
    gl!.uniform1f(uniforms.time, t);
    gl!.uniform2f(uniforms.mouse, mouse[0], mouse[1]);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    if (!reduced) raf = requestAnimationFrame(frame);
  };
  frame();

  const resize = () => {
    const w = host.clientWidth || 600;
    const h = host.clientHeight || 400;
    canvas.width = w;
    canvas.height = h;
    gl!.viewport(0, 0, w, h);
    gl!.uniform2f(uniforms.res, w, h);
    if (reduced) frame();
  };
  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(host);

  return {
    setOptions(next) {
      const o = next ?? {};
      if (typeof o.colorA === "string") gl!.uniform3fv(uniforms.a, hexToVec(o.colorA));
      if (typeof o.colorB === "string") gl!.uniform3fv(uniforms.b, hexToVec(o.colorB));
      if (typeof o.colorC === "string") gl!.uniform3fv(uniforms.c, hexToVec(o.colorC));
      if (o.speed !== undefined) gl!.uniform1f(uniforms.speed, Number(o.speed) || 0);
      if (o.zoom !== undefined) gl!.uniform1f(uniforms.zoom, Number(o.zoom) || 1);
      if (reduced) frame();
    },
    setMouse(x, y) {
      mouse = [x, y];
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      gl!.deleteProgram(prog);
      gl!.deleteBuffer(buf);
      canvas.remove();
    },
  };
}
