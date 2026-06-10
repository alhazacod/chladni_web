// =====================================================
// 1. SIMULACIÓN 1D: CUERDA VIBRANTE CON PARTÍCULAS SOBRE ELLA
// =====================================================
(function() {
    const canvas = document.getElementById('canvas1D');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width, height;
    function resizeCanvas() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Parámetros de la onda
    let modeN = 2;              // número de medio ciclos (modo)
    let frequency = 2.0;       // frecuencia de vibración (Hz)
    let time = 0;
    let lastTimestamp = 0;
    
    // Partículas: cada una tiene x (0..1), y (posición vertical relativa a la cuerda), vx, vy
    let particles = [];
    const NUM_PARTICLES = 60;
    
    // Parámetros físicos
    const friction = 0.98;      // rozamiento horizontal
    const verticalFriction = 0.95;
    const forceStrength = 0.12;  // fuerza hacia nodos
    const gravity = 0.2;         // gravedad (para que las partículas caigan sobre la cuerda)
    const bounceRestitution = 0.3; // rebote contra la cuerda
    const noise = 0.002;
    
    function resetParticles() {
        particles = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            particles.push({
                x: Math.random(),           // posición horizontal
                y: 0.5 + (Math.random() - 0.5) * 0.3, // altura inicial cerca de la cuerda
                vx: (Math.random() - 0.5) * 0.02,
                vy: (Math.random() - 0.5) * 0.02
            });
        }
    }
    
    // Obtener altura de la cuerda en un punto x y tiempo t
    function getStringY(x, t, n) {
        // Modo de vibración: sin(n * pi * x) * cos(2*pi*freq*t)
        const amplitude = 0.4; // altura máxima normalizada (0..1)
        const envelope = Math.sin(n * Math.PI * x);
        const oscillation = Math.cos(2 * Math.PI * frequency * t);
        return envelope * oscillation * amplitude;
    }
    
    // Fuerza horizontal: gradiente de (amplitud^2) -> empuja hacia nodos
    function getHorizontalForce(x, t, n) {
        // La amplitud instantánea es A(x,t) = sin(nπx) * cos(2πft)
        // Pero la fuerza efectiva que mueve partículas hacia nodos es -∂/∂x (A^2)
        // A^2 = sin^2(nπx) * cos^2(2πft)
        const envelope = Math.sin(n * Math.PI * x);
        const osc = Math.cos(2 * Math.PI * frequency * t);
        const A2 = envelope * envelope * osc * osc;
        // Derivada: d(A2)/dx = 2 * sin(nπx) * cos(nπx) * nπ * osc^2
        const gradA2 = 2 * envelope * Math.cos(n * Math.PI * x) * n * Math.PI * osc * osc;
        // La fuerza es negativa del gradiente (hacia mínimos de A2)
        let Fx = -gradA2 * forceStrength;
        // Clamping
        const maxForce = 0.5;
        if (Fx > maxForce) Fx = maxForce;
        if (Fx < -maxForce) Fx = -maxForce;
        return Fx;
    }
    
    function update1D(dt) {
        // Actualizar tiempo
        time += dt;
        
        for (let p of particles) {
            // 1. Fuerza horizontal hacia nodos
            let Fx = getHorizontalForce(p.x, time, modeN);
            // 2. Gravedad siempre hacia abajo (en unidades relativas, hacia y=0 que es la cuerda en reposo)
            let Fy = gravity;
            
            // Aplicar fuerzas (masa = 1)
            p.vx += Fx * dt;
            p.vy += Fy * dt;
            
            // Rozamiento
            p.vx *= friction;
            p.vy *= verticalFriction;
            
            // Jitter (ruido) - aumentado para que se note más el movimiento aleatorio
            const jitterAmount = 0.014;  // valor ajustable, antes era noise=0.002
            p.vx += (Math.random() - 0.5) * jitterAmount;
            p.vy += (Math.random() - 0.5) * jitterAmount;
            
            // Actualizar posición
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // Límites horizontales (bordes de la cuerda: x entre 0 y 1)
            if (p.x < 0) { p.x = 0; p.vx = 0; }
            if (p.x > 1) { p.x = 1; p.vx = 0; }
            
            // Obtener la altura de la cuerda en el punto x actual
            let stringY = getStringY(p.x, time, modeN);
            
            // Colisión con la cuerda: si la partícula está por debajo de la cuerda, rebota
            if (p.y > stringY) {
                p.y = stringY;
                p.vy = -p.vy * bounceRestitution;
                p.vx *= 0.99;
            }
            
            // No dejar que se vaya demasiado arriba
            if (p.y < -0.6) p.y = -0.6;
            if (p.y > 0.6) p.y = 0.6;
        }
    }
    
    // Dibujo
    function draw1D() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        
        // Centro vertical de la cuerda en reposo
        const centerY = height / 2;
        const scaleY = height * 0.35; // para que la amplitud se vea bien
        
        // Dibujar cuerda vibrante
        ctx.beginPath();
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 3;
        for (let i = 0; i <= width; i++) {
            let x = i / width;
            let yVal = getStringY(x, time, modeN);
            let yPixel = centerY - yVal * scaleY;
            if (i === 0) ctx.moveTo(i, yPixel);
            else ctx.lineTo(i, yPixel);
        }
        ctx.stroke();
        
        // Dibujar líneas nodales (posiciones donde sin(nπx)=0)
        ctx.beginPath();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        for (let k = 0; k <= modeN; k++) {
            let xNode = k / modeN;
            let xPixel = xNode * width;
            ctx.beginPath();
            ctx.moveTo(xPixel, 0);
            ctx.lineTo(xPixel, height);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        
        // Dibujar partículas
        for (let p of particles) {
            let xPixel = p.x * width;
            // La posición vertical se compone de: la cuerda en reposo + el desplazamiento de la partícula respecto a la cuerda
            let stringY = getStringY(p.x, time, modeN);
            let yPixel = centerY - stringY * scaleY + (p.y - stringY) * scaleY;
            ctx.beginPath();
            ctx.arc(xPixel, yPixel, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#facc15";
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Texto
        ctx.font = "bold 14px 'Segoe UI'";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`Modo n = ${modeN}`, 12, 30);
    }
    
    // Loop de animación
    let lastFrameTime = 0;
    function animate1D(now) {
        if (!lastFrameTime) lastFrameTime = now;
        let dt = Math.min(0.033, (now - lastFrameTime) / 1000);
        if (dt > 0.001) {
            update1D(dt);
            lastFrameTime = now;
        }
        draw1D();
        requestAnimationFrame(animate1D);
    }
    
    // UI
    const modeSlider = document.getElementById('modeSlider');
    const modeValueDisplay = document.getElementById('modeValueDisplay');
    const resetBtn = document.getElementById('resetParticles1D');
    
    if (modeSlider) {
        modeSlider.addEventListener('input', (e) => {
            modeN = parseInt(e.target.value);
            modeValueDisplay.innerText = modeN;
            resetParticles();   // reiniciar para ver cómo migran al nuevo modo
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetParticles();
        });
    }
    
    resetParticles();
    animate1D();
})();

// =====================================================
// 2. DIBUJO DE LÍNEAS NODALES EN 2D
// =====================================================
(function() {
    const canvas = document.getElementById('canvas2DNodal');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    
    function resize2D() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
        drawNodalLines();
    }
    window.addEventListener('resize', resize2D);
    
    let m = 2, n = 2;
    const mSlider = document.getElementById('modeM');
    const nSlider = document.getElementById('modeN');
    const mSpan = document.getElementById('mValue');
    const nSpan = document.getElementById('nValue');
    
    function drawNodalLines() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#0f1222";
        ctx.fillRect(0, 0, width, height);
        
        // Borde de la placa
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, width-4, height-4);
        
        // Líneas nodales verticales (x = i/m)
        ctx.beginPath();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        for (let i = 1; i < m; i++) {
            let xPos = (i / m) * width;
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, height);
            ctx.stroke();
        }
        // Líneas horizontales (y = j/n)
        for (let j = 1; j < n; j++) {
            let yPos = (j / n) * height;
            ctx.beginPath();
            ctx.moveTo(0, yPos);
            ctx.lineTo(width, yPos);
            ctx.stroke();
        }
        
        ctx.font = "12px 'Segoe UI'";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`m = ${m} , n = ${n}`, 12, 25);
        ctx.fillText(`Nodos: x = i/${m}, y = j/${n}`, 12, 45);
    }
    
    if (mSlider && nSlider) {
        mSlider.addEventListener('input', (e) => {
            m = parseInt(e.target.value);
            mSpan.innerText = m;
            drawNodalLines();
        });
        nSlider.addEventListener('input', (e) => {
            n = parseInt(e.target.value);
            nSpan.innerText = n;
            drawNodalLines();
        });
    }
    
    resize2D();
    drawNodalLines();
})();


// =====================================================
// 3. LÍNEAS NODALES CURVAS (superposición de modos)
// =====================================================
(function() {
    const canvas = document.getElementById('canvasCurvedNodal');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    
    function resizeCurved() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
        drawCurvedNodal();
    }
    window.addEventListener('resize', resizeCurved);
    
    // Parámetros de los dos modos
    let m1 = 5, n1 = 3;
    let m2 = 3, n2 = 5;
    let mix = 0.8;  // coeficiente b/a (a=1 fijo)
    
    // Elementos UI
    const m1Slider = document.getElementById('modeM1');
    const n1Slider = document.getElementById('modeN1');
    const m2Slider = document.getElementById('modeM2');
    const n2Slider = document.getElementById('modeN2');
    const mixSlider = document.getElementById('mixFactor');
    const m1Span = document.getElementById('m1Val');
    const n1Span = document.getElementById('n1Val');
    const m2Span = document.getElementById('m2Val');
    const n2Span = document.getElementById('n2Val');
    const mixSpan = document.getElementById('mixVal');
    
    // Función que define la amplitud total: F(x,y) = sin(m1πx)sin(n1πy) + mix * sin(m2πx)sin(n2πy)
    function totalAmplitude(x, y) {
        const term1 = Math.sin(m1 * Math.PI * x) * Math.sin(n1 * Math.PI * y);
        const term2 = Math.sin(m2 * Math.PI * x) * Math.sin(n2 * Math.PI * y);
        return term1 + mix * term2;
    }
    
    // Dibuja las líneas nodales usando un algoritmo de marching squares simplificado
    // Para rendimiento, evaluamos en una cuadrícula y luego trazamos contorno donde valor ≈ 0
    function drawCurvedNodal() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#0f1222";
        ctx.fillRect(0, 0, width, height);
        
        // Borde de la placa
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, width-4, height-4);
        
        // Resolución de la cuadrícula (ajustable para rendimiento)
        const gridSize = 150;
        const stepX = 1 / gridSize;
        const stepY = 1 / gridSize;
        
        // Crear array de valores escalares
        const values = new Array(gridSize + 1);
        for (let i = 0; i <= gridSize; i++) {
            values[i] = new Array(gridSize + 1);
            const x = i * stepX;
            for (let j = 0; j <= gridSize; j++) {
                const y = j * stepY;
                values[i][j] = totalAmplitude(x, y);
            }
        }
        
        // Umbral para considerar "cerca de cero"
        const epsilon = 0.05;
        
        // Función para interpolar linealmente la posición del nodo
        function interpolate(p1, p2, v1, v2) {
            if (Math.abs(v1 - v2) < 1e-8) return 0.5;
            const t = -v1 / (v2 - v1);
            return t;
        }
        
        ctx.beginPath();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        
        // Recorrer cada celda de la cuadrícula
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const x0 = i * stepX;
                const y0 = j * stepY;
                const v00 = values[i][j];
                const v10 = values[i+1][j];
                const v01 = values[i][j+1];
                const v11 = values[i+1][j+1];
                
                // Casilla: 4 vértices, determinamos qué bordes cruzan el nivel 0
                const edges = [];
                // Borde inferior (entre (i,j) y (i+1,j))
                if (v00 * v10 < 0) {
                    const t = interpolate(x0, x0+stepX, v00, v10);
                    edges.push({x: x0 + t*stepX, y: y0, type: 'bottom'});
                }
                // Borde derecho (entre (i+1,j) y (i+1,j+1))
                if (v10 * v11 < 0) {
                    const t = interpolate(y0, y0+stepY, v10, v11);
                    edges.push({x: x0+stepX, y: y0 + t*stepY, type: 'right'});
                }
                // Borde superior (entre (i,j+1) y (i+1,j+1))
                if (v01 * v11 < 0) {
                    const t = interpolate(x0, x0+stepX, v01, v11);
                    edges.push({x: x0 + t*stepX, y: y0+stepY, type: 'top'});
                }
                // Borde izquierdo (entre (i,j) y (i,j+1))
                if (v00 * v01 < 0) {
                    const t = interpolate(y0, y0+stepY, v00, v01);
                    edges.push({x: x0, y: y0 + t*stepY, type: 'left'});
                }
                
                // Dibujar segmentos conectando pares de puntos
                if (edges.length === 2) {
                    const p1 = edges[0];
                    const p2 = edges[1];
                    const x1 = p1.x * width;
                    const y1 = p1.y * height;
                    const x2 = p2.x * width;
                    const y2 = p2.y * height;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                } else if (edges.length === 4) {
                    // caso especial: conectar en dos líneas (silla de montar)
                    // conectar (bottom-left) y (top-right) y (bottom-right) con (top-left)
                    const bottom = edges.find(e => e.type === 'bottom');
                    const top = edges.find(e => e.type === 'top');
                    const left = edges.find(e => e.type === 'left');
                    const right = edges.find(e => e.type === 'right');
                    if (bottom && top && left && right) {
                        const xb = bottom.x * width, yb = bottom.y * height;
                        const xt = top.x * width, yt = top.y * height;
                        const xl = left.x * width, yl = left.y * height;
                        const xr = right.x * width, yr = right.y * height;
                        ctx.beginPath();
                        ctx.moveTo(xb, yb);
                        ctx.lineTo(xt, yt);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(xl, yl);
                        ctx.lineTo(xr, yr);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // Texto explicativo
        ctx.font = "12px 'Segoe UI'";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Modos: (${m1},${n1}) + k·(${m2},${n2}) , k = ${mix.toFixed(2)}`, 12, 25);
        ctx.fillText("Líneas nodales curvas por superposición", 12, 45);
    }
    
    // Actualizar y redibujar cuando cambian los parámetros
    function updateAndDraw() {
        drawCurvedNodal();
    }
    
    if (m1Slider && n1Slider && m2Slider && n2Slider && mixSlider) {
        m1Slider.addEventListener('input', (e) => { m1 = parseInt(e.target.value); m1Span.innerText = m1; updateAndDraw(); });
        n1Slider.addEventListener('input', (e) => { n1 = parseInt(e.target.value); n1Span.innerText = n1; updateAndDraw(); });
        m2Slider.addEventListener('input', (e) => { m2 = parseInt(e.target.value); m2Span.innerText = m2; updateAndDraw(); });
        n2Slider.addEventListener('input', (e) => { n2 = parseInt(e.target.value); n2Span.innerText = n2; updateAndDraw(); });
        mixSlider.addEventListener('input', (e) => { mix = parseFloat(e.target.value); mixSpan.innerText = mix.toFixed(2); updateAndDraw(); });
    }
    
    resizeCurved();
})();
