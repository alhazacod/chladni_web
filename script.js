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
        // Mapeamos a coordenadas del canvas: y=0 en la parte superior? Mejor usamos un rango centrado.
        // Devolvemos valor entre -amplitude y +amplitude, donde 0 es la posición de reposo.
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
            let Fy = gravity;  // positiva hacia abajo (recordar que en canvas y++ es abajo)
            
            // Aplicar fuerzas (masa = 1)
            p.vx += Fx * dt;
            p.vy += Fy * dt;
            
            // Rozamiento
            p.vx *= friction;
            p.vy *= verticalFriction;
            
            // Pequeño ruido
            p.vx += (Math.random() - 0.5) * noise;
            p.vy += (Math.random() - 0.5) * noise;
            
            // Actualizar posición
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // Límites horizontales (bordes de la cuerda: x entre 0 y 1)
            if (p.x < 0) { p.x = 0; p.vx = 0; }
            if (p.x > 1) { p.x = 1; p.vx = 0; }
            
            // Obtener la altura de la cuerda en el punto x actual
            let stringY = getStringY(p.x, time, modeN);
            // Convertir a coordenada en el canvas: la cuerda en reposo está en yCanvas = centerY
            // Pero para simplificar la física, trabajamos con la misma escala: la cuerda tiene valor stringY (rango -0.4 a 0.4)
            // La partícula tiene p.y (también en las mismas unidades relativas). La superficie de la cuerda está en stringY.
            // Si la partícula está por debajo de la cuerda (p.y > stringY), la cuerda la empuja hacia arriba.
            if (p.y > stringY) {
                // Colisión: la partícula toca o atraviesa la cuerda
                p.y = stringY; // la ponemos justo encima
                // Rebote vertical con pérdida
                p.vy = -p.vy * bounceRestitution;
                // Pequeño empuje horizontal para simular fricción
                p.vx *= 0.99;
            }
            
            // No dejar que se vaya demasiado arriba (opcional)
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
