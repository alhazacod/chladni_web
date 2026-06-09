// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================
const MAX_MODE = 12; // Max m and n modes to sum (8x8 = 64 modes)

const state = {
    particles: [],
    sources: [{ x: 0.5, y: 0.5 }],
    freq: 19.0,
    damping: 0.10, // Internal damping for resonance denominator
    bc: 'dirichlet', // 'dirichlet' or 'neumann'
    friction: 0.02,
    forceScale: 0.25,
    jitter: 0.002
};

// ==========================================
// 2. WEBGL RENDERER
// ==========================================
const Renderer = {
    gl: null,
    program: null,
    particleBuffer: null,
    sourceBuffer: null,
    posData: null,

    init() {
        const canvas = document.getElementById('glCanvas');
        this.gl = canvas.getContext('webgl');
        if (!this.gl) { alert('WebGL not supported'); return; }

        // Resize canvas to display size
        const resize = () => {
            // canvas.width = canvas.clientWidth;
            // canvas.height = canvas.clientHeight;
            canvas.width = 500;
            canvas.height = 500;
            this.gl.viewport(0, 0, canvas.width, canvas.height);
        };
        window.addEventListener('resize', resize);
        resize();

        const gl = this.gl;

        // Shaders
        const vsSource = `
            attribute vec2 aPosition;
            uniform float uPointSize;
            void main() {
                // Map [0,1] to clip space [-1, 1], flip Y for screen coords
                vec2 clipSpace = aPosition * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = uPointSize;
            }
        `;
        const fsSource = `
            precision mediump float;
            uniform vec4 uColor;
            void main() {
                // Make points circular
                float dist = distance(gl_PointCoord, vec2(0.5));
                if (dist > 0.5) discard;
                gl_FragColor = uColor;
            }
        `;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        this.program = this.createProgram(vs, fs);

        // Buffers
        this.particleBuffer = gl.createBuffer();
        this.sourceBuffer = gl.createBuffer();

        // Initialize position data array
        this.posData = new Float32Array(state.particles.length * 2);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.posData.byteLength, gl.DYNAMIC_DRAW);
    },

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    },

    draw() {
        const gl = this.gl;
        gl.clearColor(0.067, 0.067, 0.067, 1.0); // #111111
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        const posLoc = gl.getAttribLocation(this.program, 'aPosition');
        const colorLoc = gl.getUniformLocation(this.program, 'uColor');
        const sizeLoc = gl.getUniformLocation(this.program, 'uPointSize');
        
        gl.enableVertexAttribArray(posLoc);

        // 1. Draw Particles
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(colorLoc, 0.88, 0.75, 0.4, 1.0); // Sand color
        gl.uniform1f(sizeLoc, 2.0);
        gl.drawArrays(gl.POINTS, 0, state.particles.length);

        // 2. Draw Sources
        const srcData = new Float32Array(state.sources.length * 2);
        for(let i=0; i<state.sources.length; i++) {
            srcData[i*2] = state.sources[i].x;
            srcData[i*2+1] = state.sources[i].y;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sourceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, srcData, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(colorLoc, 1.0, 0.2, 0.2, 1.0); // Red color
        gl.uniform1f(sizeLoc, 8.0);
        gl.drawArrays(gl.POINTS, 0, state.sources.length);
    }
};

// ==========================================
// 3. PHYSICS ENGINE
// ==========================================
const Physics = {
    update() {
        const N = state.particles.length;
        if (N === 0) return;

        // 1. Calculate Modal Amplitudes C_mn based on sources, freq, and BC
        const C = [];
        for (let m = 1; m <= MAX_MODE; m++) {
            C[m] = [];
            for (let n = 1; n <= MAX_MODE; n++) {
                let A_mn = 0;
                for (const s of state.sources) {
                    if (state.bc === 'dirichlet') {
                        A_mn += Math.sin(m * Math.PI * s.x) * Math.sin(n * Math.PI * s.y);
                    } else {
                        A_mn += Math.cos(m * Math.PI * s.x) * Math.cos(n * Math.PI * s.y);
                    }
                }

                // Dispersion relation for biharmonic plate: omega_mn ∝ (m^2 + n^2)
                const omega_mn_sq = Math.pow(m * m + n * n, 2);
                const freq_sq = state.freq * state.freq;
                const diff = omega_mn_sq - freq_sq;
                
                // Resonance denominator with damping
                const denom = Math.sqrt(diff * diff + Math.pow(state.damping * state.freq, 2));
                C[m][n] = denom > 0.0001 ? A_mn / denom : 0;
            }
        }

        // 2. Precompute Trig functions for performance
        const sinMX = [], cosMX = [], sinNY = [], cosNY = [];
        for (let m = 1; m <= MAX_MODE; m++) {
            sinMX[m] = new Float32Array(N);
            cosMX[m] = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                const mx = m * Math.PI * state.particles[i].x;
                sinMX[m][i] = Math.sin(mx);
                cosMX[m][i] = Math.cos(mx);
            }
        }
        for (let n = 1; n <= MAX_MODE; n++) {
            sinNY[n] = new Float32Array(N);
            cosNY[n] = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                const ny = n * Math.PI * state.particles[i].y;
                sinNY[n][i] = Math.sin(ny);
                cosNY[n][i] = Math.cos(ny);
            }
        }

        // 3. Update Particles
        for (let i = 0; i < N; i++) {
            let Z = 0, dZdx = 0, dZdy = 0;

            for (let m = 1; m <= MAX_MODE; m++) {
                for (let n = 1; n <= MAX_MODE; n++) {
                    if (Math.abs(C[m][n]) < 1e-6) continue;

                    if (state.bc === 'dirichlet') {
                        const phi = sinMX[m][i] * sinNY[n][i];
                        const dphidx = m * Math.PI * cosMX[m][i] * sinNY[n][i];
                        const dphidy = n * Math.PI * sinMX[m][i] * cosNY[n][i];
                        Z += C[m][n] * phi;
                        dZdx += C[m][n] * dphidx;
                        dZdy += C[m][n] * dphidy;
                    } else { // neumann
                        const phi = cosMX[m][i] * cosNY[n][i];
                        const dphidx = -m * Math.PI * sinMX[m][i] * cosNY[n][i];
                        const dphidy = -n * Math.PI * cosMX[m][i] * sinNY[n][i];
                        Z += C[m][n] * phi;
                        dZdx += C[m][n] * dphidx;
                        dZdy += C[m][n] * dphidy;
                    }
                }
            }

            // Force pushes sand towards nodal lines (where Z = 0)
            // F = -∇(Z^2) = -2Z * ∇Z
            let fx = -2 * Z * dZdx;
            let fy = -2 * Z * dZdy;

            // Clamp force to prevent explosions on exact resonance
            const mag = Math.hypot(fx, fy);
            const maxForce = 50.0;
            if (mag > maxForce) {
                fx = (fx / mag) * maxForce;
                fy = (fy / mag) * maxForce;
            }

            const p = state.particles[i];
            p.vx = p.vx * state.friction + fx * state.forceScale + (Math.random() - 0.5) * state.jitter;
            p.vy = p.vy * state.friction + fy * state.forceScale + (Math.random() - 0.5) * state.jitter;
            
            p.x += p.vx;
            p.y += p.vy;

            // Boundary constraints
            if (p.x < 0) { p.x = 0; p.vx = 0; }
            if (p.x > 1) { p.x = 1; p.vx = 0; }
            if (p.y < 0) { p.y = 0; p.vy = 0; }
            if (p.y > 1) { p.y = 1; p.vy = 0; }
        }
    }
};

// ==========================================
// 4. UI & INTERACTION MANAGER
// ==========================================
const UI = {
    init() {
        // Sliders
        const sliderParticles = document.getElementById('sliderParticles');
        const sliderFreq = document.getElementById('sliderFreq');
        const sliderSources = document.getElementById('sliderSources');
        const selectBC = document.getElementById('selectBC');
        const btnEven = document.getElementById('btnEvenSources');
        const btnRstPrtclPos = document.getElementById('btnRstPrtclPos')

        sliderParticles.addEventListener('input', (e) => {
            document.getElementById('valParticles').innerText = e.target.value;
            this.setParticleCount(parseInt(e.target.value));
        });

        btnRstPrtclPos.addEventListener('click', () => {
            particleValue = parseInt(document.getElementById('valParticles').innerText);
            console.log(particleValue);
            this.setParticleCount(0);
            this.setParticleCount(particleValue);
        });

        sliderFreq.addEventListener('input', (e) => {
            state.freq = parseFloat(e.target.value);
            document.getElementById('valFreq').innerText = state.freq.toFixed(1);
        });

        sliderSources.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            document.getElementById('valSources').innerText = count;
            this.setSourceCount(count);
            this.distributeSourcesEvenly();
        });

        selectBC.addEventListener('change', (e) => {
            state.bc = e.target.value;
        });

        btnEven.addEventListener('click', () => {
            this.distributeSourcesEvenly();
        });

        // Mouse Drag for Sources
        const canvas = document.getElementById('glCanvas');
        let draggingSourceIdx = -1;

        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            let minDist = Infinity;
            state.sources.forEach((s, idx) => {
                const dist = Math.hypot(s.x - pos.x, s.y - pos.y);
                if (dist < minDist) { minDist = dist; draggingSourceIdx = idx; }
            });
        });

        canvas.addEventListener('mousemove', (e) => {
            if (draggingSourceIdx === -1) return;
            const pos = getMousePos(e);
            state.sources[draggingSourceIdx].x = Math.max(0, Math.min(1, pos.x));
            state.sources[draggingSourceIdx].y = Math.max(0, Math.min(1, pos.y));
        });

        canvas.addEventListener('mouseup', () => draggingSourceIdx = -1);
        canvas.addEventListener('mouseleave', () => draggingSourceIdx = -1);

        this.setParticleCount(parseInt(sliderParticles.value));
    },

    setParticleCount(count) {
        if (count > state.particles.length) {
            for (let i = state.particles.length; i < count; i++) {
                state.particles.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 });
            }
        } else {
            state.particles.length = count;
        }
        // Re-allocate WebGL buffer
        const gl = Renderer.gl;
        Renderer.posData = new Float32Array(count * 2);
        gl.bindBuffer(gl.ARRAY_BUFFER, Renderer.particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Renderer.posData.byteLength, gl.DYNAMIC_DRAW);
    },

    setSourceCount(count) {
        while (state.sources.length < count) {
            state.sources.push({ x: Math.random(), y: Math.random() });
        }
        state.sources.length = count;
    },

    distributeSourcesEvenly() {
        const N = state.sources.length;
        if (N === 1) {
            state.sources[0] = { x: 0.5, y: 0.5 };
        } else if (N === 2) {
            state.sources[0] = { x: 0.33, y: 0.5 };
            state.sources[1] = { x: 0.67, y: 0.5 };
        } else if (N === 3) {
            state.sources[0] = { x: 0.25, y: 0.5 };
            state.sources[1] = { x: 0.5, y: 0.5 };
            state.sources[2] = { x: 0.75, y: 0.5 };
        } else {
            const cols = Math.ceil(Math.sqrt(N));
            const rows = Math.ceil(N / cols);
            let idx = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (idx >= N) break;
                    state.sources[idx] = {
                        x: (c + 1) / (cols + 1),
                        y: (r + 1) / (rows + 1)
                    };
                    idx++;
                }
            }
        }
    }
};

// ==========================================
// 5. MAIN LOOP
// ==========================================
function loop() {
    Physics.update();

    // Update WebGL Buffer Data
    const data = Renderer.posData;
    for (let i = 0; i < state.particles.length; i++) {
        data[i * 2] = state.particles[i].x;
        data[i * 2 + 1] = state.particles[i].y;
    }
    const gl = Renderer.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, Renderer.particleBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);

    Renderer.draw();
    requestAnimationFrame(loop);
}

// Boot
window.onload = () => {
    Renderer.init();
    UI.init();
    loop();
};
