import { TILE_COUNT, cellAtVector, grid } from '../world/sphere.js';
import { colorsFor } from './layers.js';

// The board, drawn as the sphere it is.
//
// Every cell's geometry goes to the GPU once and stays there: 114,492 cells
// fanned into 686,940 triangles, a little over two million vertices. Colour is
// not in that buffer — each vertex carries only its cell number, and looks the
// colour up in a small texture holding one pixel per cell. Changing layer, or
// handing a province to someone else, therefore costs one upload of half a
// megabyte rather than a rebuild of the geometry.
//
// That is the whole reason for WebGL here. The flat board could cache its way
// out of trouble because the view was axis-aligned and could be baked into
// tiles; a globe turning under the cursor has no such luxury, and two million
// vertices a frame is not something canvas can do.

const COLOR_TEX_W = 512;
const COLOR_TEX_H = Math.ceil(TILE_COUNT / COLOR_TEX_W);

const VERT = `#version 300 es
in vec3 aPos;
in float aCell;
uniform mat4 uMVP;
uniform mat3 uRot;
uniform sampler2D uColor;
out vec3 vColor;
out float vLight;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  int id = int(aCell);
  vColor = texelFetch(uColor, ivec2(id % ${COLOR_TEX_W}, id / ${COLOR_TEX_W}), 0).rgb;
  // On a unit sphere the position is the surface normal, so the globe can be
  // lit without a normal buffer.
  vec3 n = uRot * aPos;
  vLight = 0.60 + 0.40 * max(0.0, dot(n, normalize(vec3(-0.35, 0.42, 0.84))));
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vLight;
out vec4 fragColor;
void main() {
  fragColor = vec4(vColor * vLight, 1.0);
}`;

const LINE_VERT = `#version 300 es
in vec3 aPos;
uniform mat4 uMVP;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const LINE_FRAG = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function program(gl, vert, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

/**
 * Fan every cell into triangles.
 *
 * Corners are shared by three cells but their colours are not, so the vertices
 * cannot be shared either — each cell gets its own copy, which is what lets a
 * border be a hard edge rather than a gradient.
 */
function buildSurface(sphere) {
  let triangles = 0;
  for (let i = 0; i < sphere.count; i += 1) triangles += sphere.valence[i];
  const pos = new Float32Array(triangles * 3 * 3);
  const cell = new Float32Array(triangles * 3);

  let v = 0;
  for (let i = 0; i < sphere.count; i += 1) {
    const deg = sphere.valence[i];
    const cx = sphere.center[i * 3];
    const cy = sphere.center[i * 3 + 1];
    const cz = sphere.center[i * 3 + 2];
    for (let k = 0; k < deg; k += 1) {
      const a = sphere.cornerAt[i * 6 + k] * 3;
      const b = sphere.cornerAt[i * 6 + ((k + 1) % deg)] * 3;
      pos[v * 3] = cx;
      pos[v * 3 + 1] = cy;
      pos[v * 3 + 2] = cz;
      cell[v] = i;
      v += 1;
      pos[v * 3] = sphere.cornerXYZ[a];
      pos[v * 3 + 1] = sphere.cornerXYZ[a + 1];
      pos[v * 3 + 2] = sphere.cornerXYZ[a + 2];
      cell[v] = i;
      v += 1;
      pos[v * 3] = sphere.cornerXYZ[b];
      pos[v * 3 + 1] = sphere.cornerXYZ[b + 1];
      pos[v * 3 + 2] = sphere.cornerXYZ[b + 2];
      cell[v] = i;
      v += 1;
    }
  }
  return { pos, cell, vertices: v };
}

/**
 * Cell edges, each drawn once.
 *
 * Every edge belongs to two cells; taking it only from the lower-numbered of
 * the pair halves the work and stops the line being drawn twice over itself.
 * Pushed a hair off the surface so it does not fight with it for depth.
 */
function buildEdges(sphere) {
  const lift = 1.0015;
  const out = [];
  for (let i = 0; i < sphere.count; i += 1) {
    const deg = sphere.valence[i];
    for (let k = 0; k < deg; k += 1) {
      if (sphere.neighbour[i * 6 + k] < i) continue;
      const a = sphere.cornerAt[i * 6 + k] * 3;
      const b = sphere.cornerAt[i * 6 + ((k + 1) % deg)] * 3;
      out.push(
        sphere.cornerXYZ[a] * lift, sphere.cornerXYZ[a + 1] * lift, sphere.cornerXYZ[a + 2] * lift,
        sphere.cornerXYZ[b] * lift, sphere.cornerXYZ[b + 1] * lift, sphere.cornerXYZ[b + 2] * lift,
      );
    }
  }
  return new Float32Array(out);
}

export class Globe {
  constructor(canvas, world) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('This board needs WebGL 2, which this browser did not provide.');

    this.canvas = canvas;
    this.gl = gl;
    this.world = world;
    this.sphere = world.sphere ?? grid();
    this.layer = null;
    this.viewer = null;
    this.showGrid = true;

    this.surfaceProgram = program(gl, VERT, FRAG);
    this.lineProgram = program(gl, LINE_VERT, LINE_FRAG);

    const surface = buildSurface(this.sphere);
    this.vertexCount = surface.vertices;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.posBuffer = this.arrayBuffer(surface.pos);
    const posLoc = gl.getAttribLocation(this.surfaceProgram, 'aPos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    this.cellBuffer = this.arrayBuffer(surface.cell);
    const cellLoc = gl.getAttribLocation(this.surfaceProgram, 'aCell');
    gl.enableVertexAttribArray(cellLoc);
    gl.vertexAttribPointer(cellLoc, 1, gl.FLOAT, false, 0, 0);

    const edges = buildEdges(this.sphere);
    this.edgeCount = edges.length / 3;
    this.edgeVao = gl.createVertexArray();
    gl.bindVertexArray(this.edgeVao);
    this.edgeBuffer = this.arrayBuffer(edges);
    const edgeLoc = gl.getAttribLocation(this.lineProgram, 'aPos');
    gl.enableVertexAttribArray(edgeLoc);
    gl.vertexAttribPointer(edgeLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // One texel per cell. Nearest filtering, because these are identities and
    // not a picture: blending two of them would invent a colour no cell has.
    this.colorBytes = new Uint8Array(COLOR_TEX_W * COLOR_TEX_H * 4);
    this.colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, COLOR_TEX_W, COLOR_TEX_H, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, this.colorBytes);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.024, 0.043, 0.071, 1);

    this.uniforms = {
      mvp: gl.getUniformLocation(this.surfaceProgram, 'uMVP'),
      rot: gl.getUniformLocation(this.surfaceProgram, 'uRot'),
      color: gl.getUniformLocation(this.surfaceProgram, 'uColor'),
      lineMvp: gl.getUniformLocation(this.lineProgram, 'uMVP'),
      lineColor: gl.getUniformLocation(this.lineProgram, 'uColor'),
    };

    this.mvp = new Float32Array(16);
    this.rot = new Float32Array(9);
    this.setLayer(null);
  }

  arrayBuffer(data) {
    const { gl } = this;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }

  /** Whose eyes the board is drawn for. Changes what the Forces layer shows. */
  setViewer(viewer) {
    this.viewer = viewer;
    this.refresh();
  }

  /** Swap which layer is on show. One texture upload, no geometry touched. */
  setLayer(layer) {
    this.layer = layer;
    this.refresh();
  }

  /** Re-read the world's colours — after territory changes hands, say. */
  refresh() {
    colorsFor(this.world, this.layer, this.colorBytes, this.viewer);
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLOR_TEX_W, COLOR_TEX_H, gl.RGBA,
      gl.UNSIGNED_BYTE, this.colorBytes);
  }

  setShowGrid(on) {
    this.showGrid = on;
  }

  resize(width, height, dpr) {
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  draw(camera) {
    const { gl } = this;
    camera.matrices(this.mvp, this.rot, this.canvas.width / this.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.surfaceProgram);
    gl.uniformMatrix4fv(this.uniforms.mvp, false, this.mvp);
    gl.uniformMatrix3fv(this.uniforms.rot, false, this.rot);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);
    gl.uniform1i(this.uniforms.color, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

    // Cell edges only once they are wide enough on screen to be a grid rather
    // than a grey wash over the whole globe.
    const pixels = camera.pixelsPerCell(this.canvas.height);
    if (this.showGrid && pixels > 7) {
      const fade = Math.min(0.34, (pixels - 7) * 0.03);
      gl.useProgram(this.lineProgram);
      gl.uniformMatrix4fv(this.uniforms.lineMvp, false, this.mvp);
      gl.uniform4f(this.uniforms.lineColor, 0, 0, 0, fade);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.edgeVao);
      gl.drawArrays(gl.LINES, 0, this.edgeCount);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }

  /** Which cell is under a point on the canvas? -1 for a miss. */
  pick(screenX, screenY, camera) {
    const dir = camera.rayThrough(screenX, screenY, this.canvas.clientWidth,
      this.canvas.clientHeight);
    const hit = camera.hitSphere(dir);
    if (!hit) return -1;
    return cellAtVector(this.sphere, hit[0], hit[1], hit[2]);
  }

  destroy() {
    const { gl } = this;
    for (const b of [this.posBuffer, this.cellBuffer, this.edgeBuffer]) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.edgeVao);
    gl.deleteTexture(this.colorTexture);
    gl.deleteProgram(this.surfaceProgram);
    gl.deleteProgram(this.lineProgram);
  }
}
