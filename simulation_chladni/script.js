// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================
const MAX_MODE = 12;

const state = {
    particles: [],
    sources: [{ x: 0.5, y: 0.5 }],
    freq: 19.0,
    targetFreq: 19.0,     // smooth transitions
    lastStableFreq: 19.0, // tracks last freq we settled at, for jump detection
    damping: 0.10,
    bc: 'dirichlet',
    friction: 0.02,
    forceScale: 0.25,
    jitter: 0.002,

    // Scatter system: instead of hard-resetting all particles at once,
    // we scatter a batch per frame so the plate looks like it's being shaken.
    scatter: {
        remaining: 0,       // how many particles still need to be scattered
        perFrame: 150,      // particles to teleport per frame during a scatter event
    }
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

        const resize = () => {
            canvas.width = 500;
            canvas.height = 500;
            this.gl.viewport(0, 0, canvas.width, canvas.height);
        };
        window.addEventListener('resize', resize);
        resize();

        const gl = this.gl;

        const vsSource = `
            attribute vec2 aPosition;
            uniform float uPointSize;
            void main() {
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
                float dist = distance(gl_PointCoord, vec2(0.5));
                if (dist > 0.5) discard;
                gl_FragColor = uColor;
            }
        `;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        this.program = this.createProgram(vs, fs);

        this.particleBuffer = gl.createBuffer();
        this.sourceBuffer = gl.createBuffer();

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
        gl.clearColor(0.067, 0.067, 0.067, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        const posLoc = gl.getAttribLocation(this.program, 'aPosition');
        const colorLoc = gl.getUniformLocation(this.program, 'uColor');
        const sizeLoc = gl.getUniformLocation(this.program, 'uPointSize');

        gl.enableVertexAttribArray(posLoc);

        // Draw Particles
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(colorLoc, 0.88, 0.75, 0.4, 1.0);
        gl.uniform1f(sizeLoc, 2.0);
        gl.drawArrays(gl.POINTS, 0, state.particles.length);

        // Draw Sources
        const srcData = new Float32Array(state.sources.length * 2);
        for (let i = 0; i < state.sources.length; i++) {
            srcData[i * 2] = state.sources[i].x;
            srcData[i * 2 + 1] = state.sources[i].y;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sourceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, srcData, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(colorLoc, 1.0, 0.2, 0.2, 1.0);
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

        // Smooth freq transitions so patterns morph gracefully
        state.freq += (state.targetFreq - state.freq) * 0.04;

        // Auto-scatter: if the target freq jumped far from where we last settled,
        // queue a partial scatter (smaller than a full reset, just enough to unstick borders)
        const freqJump = Math.abs(state.targetFreq - state.lastStableFreq);
        if (freqJump > 4 && state.scatter.remaining === 0) {
            state.scatter.remaining = Math.floor(N * 0.6); // scatter 60% of particles
            state.lastStableFreq = state.targetFreq;
        }
        // Update lastStableFreq once we've settled near the target
        if (freqJump < 0.5) state.lastStableFreq = state.freq;

        // Execute scatter: randomly teleport a batch of particles this frame
        if (state.scatter.remaining > 0) {
            const batch = Math.min(state.scatter.perFrame, state.scatter.remaining);
            for (let b = 0; b < batch; b++) {
                const i = Math.floor(Math.random() * N);
                state.particles[i].x = Math.random();
                state.particles[i].y = Math.random();
                state.particles[i].vx = 0;
                state.particles[i].vy = 0;
            }
            state.scatter.remaining -= batch;
        }

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
                const omega_mn_sq = Math.pow(m * m + n * n, 2);
                const freq_sq = state.freq * state.freq;
                const diff = omega_mn_sq - freq_sq;
                const denom = Math.sqrt(diff * diff + Math.pow(state.damping * state.freq, 2));
                C[m][n] = denom > 0.0001 ? A_mn / denom : 0;
            }
        }

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
                    } else {
                        const phi = cosMX[m][i] * cosNY[n][i];
                        const dphidx = -m * Math.PI * sinMX[m][i] * cosNY[n][i];
                        const dphidy = -n * Math.PI * cosMX[m][i] * sinNY[n][i];
                        Z += C[m][n] * phi;
                        dZdx += C[m][n] * dphidx;
                        dZdy += C[m][n] * dphidy;
                    }
                }
            }

            let fx = -2 * Z * dZdx;
            let fy = -2 * Z * dZdy;

            const mag = Math.hypot(fx, fy);
            const maxForce = 50.0;
            if (mag > maxForce) { fx = (fx / mag) * maxForce; fy = (fy / mag) * maxForce; }

            const p = state.particles[i];
            p.vx = p.vx * state.friction + fx * state.forceScale + (Math.random() - 0.5) * state.jitter;
            p.vy = p.vy * state.friction + fy * state.forceScale + (Math.random() - 0.5) * state.jitter;
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) { p.x = 0; p.vx = 0; }
            if (p.x > 1) { p.x = 1; p.vx = 0; }
            if (p.y < 0) { p.y = 0; p.vy = 0; }
            if (p.y > 1) { p.y = 1; p.vy = 0; }
        }
    }
};

// ==========================================
// 4. AUDIO ENGINE
// ==========================================
const Audio = {
    ctx: null,
    analyser: null,
    freqData: null,
    sourceNode: null,       // current audio source (mic stream or file buffer)
    micStream: null,        // MediaStream ref for cleanup
    active: false,

    // Snap pitch to nearest "interesting" simulation frequency
    // Maps ~80-1200 Hz real pitch → 10-100 sim freq using log scale
    pitchToSimFreq(hz) {
        const minHz = 80, maxHz = 1200;
        const minSim = 10, maxSim = 100;
        const clamped = Math.max(minHz, Math.min(maxHz, hz));
        const t = Math.log(clamped / minHz) / Math.log(maxHz / minHz); // 0..1 log
        return minSim + t * (maxSim - minSim);
    },

    // Get loudest frequency bin from analyser (dominant pitch)
    getDominantHz() {
        if (!this.analyser) return null;
        this.analyser.getByteFrequencyData(this.freqData);

        // Find bin with highest amplitude (above a silence threshold)
        let maxAmp = 30, maxBin = -1;
        for (let i = 1; i < this.freqData.length; i++) {
            if (this.freqData[i] > maxAmp) { maxAmp = this.freqData[i]; maxBin = i; }
        }
        if (maxBin < 0) return null;

        const sampleRate = this.ctx.sampleRate;
        return maxBin * sampleRate / (this.analyser.fftSize);
    },

    // Get overall amplitude (0-1) for the VU meter
    getAmplitude() {
        if (!this.analyser || !this.freqData) return 0;
        let sum = 0;
        for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
        return sum / (this.freqData.length * 255);
    },

    _createAnalyser() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    },

    stopAll() {
        if (this.sourceNode) { try { this.sourceNode.stop(); } catch(e){} this.sourceNode = null; }
        if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
        if (this.ctx) { this.ctx.close(); this.ctx = null; this.analyser = null; }
        this.active = false;
    },

    async startMic() {
        this.stopAll();
        this._createAnalyser();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = stream;
        const src = this.ctx.createMediaStreamSource(stream);
        src.connect(this.analyser);
        this.active = true;
    },

    async startFile(file) {
        this.stopAll();
        this._createAnalyser();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        const src = this.ctx.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(this.analyser);
        this.analyser.connect(this.ctx.destination); // play audio out loud for files
        src.loop = true;
        src.start();
        this.sourceNode = src;
        this.active = true;
    },

    // Called every frame: reads audio, updates sim freq
    tick() {
        if (!this.active) return;
        const hz = this.getDominantHz();
        if (hz) state.targetFreq = this.pitchToSimFreq(hz);
        VU.update(this.getAmplitude());
    }
};

// ==========================================
// 5. VU METER (mini visualizer)
// ==========================================
const VU = {
    canvas: null,
    ctx: null,
    level: 0,

    init() {
        this.canvas = document.getElementById('vuCanvas');
        this.ctx = this.canvas.getContext('2d');
    },

    update(amp) {
        this.level += (amp - this.level) * 0.15; // smooth
        const c = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        c.clearRect(0, 0, w, h);

        // Draw frequency bars using analyser data
        if (Audio.analyser && Audio.freqData) {
            const bars = 48;
            const step = Math.floor(Audio.freqData.length / bars);
            const barW = w / bars - 1;
            for (let i = 0; i < bars; i++) {
                let sum = 0;
                for (let j = 0; j < step; j++) sum += Audio.freqData[i * step + j];
                const barH = (sum / (step * 255)) * h;
                const hue = 35 + (i / bars) * 30; // warm gold to orange
                c.fillStyle = `hsl(${hue}, 80%, 55%)`;
                c.fillRect(i * (barW + 1), h - barH, barW, barH);
            }
        }
    }
};

// ==========================================
// 6. UI & INTERACTION MANAGER
// ==========================================
const UI = {
    init() {
        const sliderParticles = document.getElementById('sliderParticles');
        const sliderFreq = document.getElementById('sliderFreq');
        const sliderSources = document.getElementById('sliderSources');
        const selectBC = document.getElementById('selectBC');
        const btnEven = document.getElementById('btnEvenSources');
        const btnRstPrtclPos = document.getElementById('btnRstPrtclPos');
        const btnMic = document.getElementById('btnMic');
        const btnFile = document.getElementById('inputFile');
        const btnStopAudio = document.getElementById('btnStopAudio');
        const audioStatus = document.getElementById('audioStatus');

        sliderParticles.addEventListener('input', (e) => {
            document.getElementById('valParticles').innerText = e.target.value;
            this.setParticleCount(parseInt(e.target.value));
        });

        btnRstPrtclPos.addEventListener('click', () => {
            const v = parseInt(document.getElementById('valParticles').innerText);
            this.setParticleCount(0);
            this.setParticleCount(v);
        });

        sliderFreq.addEventListener('input', (e) => {
            // Only allow manual freq when audio is not active
            if (!Audio.active) {
                state.targetFreq = parseFloat(e.target.value);
                document.getElementById('valFreq').innerText = state.targetFreq.toFixed(1);
            }
        });

        sliderSources.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            document.getElementById('valSources').innerText = count;
            this.setSourceCount(count);
            this.distributeSourcesEvenly();
        });

        selectBC.addEventListener('change', (e) => { state.bc = e.target.value; });
        btnEven.addEventListener('click', () => this.distributeSourcesEvenly());

        // --- Mic Button ---
        btnMic.addEventListener('click', async () => {
            if (Audio.active && Audio.micStream) {
                Audio.stopAll();
                btnMic.classList.remove('active');
                audioStatus.textContent = '';
                return;
            }
            try {
                await Audio.startMic();
                UI.scatterAll();
                btnMic.classList.add('active');
                audioStatus.textContent = '🎙 Mic active';
            } catch (err) {
                audioStatus.textContent = '⚠ Mic access denied';
            }
        });

        // --- File Input ---
        btnFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await Audio.startFile(file);
                UI.scatterAll();
                btnMic.classList.remove('active');
                audioStatus.textContent = `♪ ${file.name}`;
            } catch (err) {
                audioStatus.textContent = '⚠ Could not decode audio';
            }
        });

        // --- Stop Audio ---
        btnStopAudio.addEventListener('click', () => {
            Audio.stopAll();
            btnMic.classList.remove('active');
            audioStatus.textContent = '';
            VU.update(0);
        });

        // Mouse Drag for Sources
        const canvas = document.getElementById('glCanvas');
        let draggingSourceIdx = -1;

        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
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
        VU.init();
    },

    // Queue a full scatter of all particles (used on mic/file start)
    scatterAll() {
        state.scatter.remaining = state.particles.length;
        state.lastStableFreq = state.targetFreq; // prevent double-trigger
    },

    setParticleCount(count) {
        if (count > state.particles.length) {
            for (let i = state.particles.length; i < count; i++) {
                state.particles.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 });
            }
        } else {
            state.particles.length = count;
        }
        const gl = Renderer.gl;
        Renderer.posData = new Float32Array(count * 2);
        gl.bindBuffer(gl.ARRAY_BUFFER, Renderer.particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Renderer.posData.byteLength, gl.DYNAMIC_DRAW);
    },

    setSourceCount(count) {
        while (state.sources.length < count) state.sources.push({ x: Math.random(), y: Math.random() });
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
            for (let r = 0; r < rows && idx < N; r++) {
                for (let c = 0; c < cols && idx < N; c++, idx++) {
                    state.sources[idx] = { x: (c + 1) / (cols + 1), y: (r + 1) / (rows + 1) };
                }
            }
        }
    }
};

// ==========================================
// 7. MAIN LOOP
// ==========================================
function loop() {
    Audio.tick(); // read audio & update targetFreq

    Physics.update();

    // Update freq slider display when audio is driving it
    if (Audio.active) {
        document.getElementById('valFreq').innerText = state.freq.toFixed(1);
        document.getElementById('sliderFreq').value = state.freq;
    }

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

window.onload = () => {
    Renderer.init();
    UI.init();
    loop();
};
