# 🎵 Figuras de Chladni: Haciendo visible el sonido

[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](https://alhazacod.github.io/chladni_web/)
[![License: MIT](https://img.shields.io/badge/License-GPL-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-1e3a8a?style=flat&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Uses WebGL](https://img.shields.io/badge/Uses-WebGL-990000?style=flat&logo=webgl)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

> **🌍 Live Demo: [https://alhazacod.github.io/chladni_web/](https://alhazacod.github.io/chladni_web/)**

##  ¿Qué son las figuras de Chladni?

Cuando una placa metálica cubierta con arena vibra a ciertas frecuencias, la arena se organiza espontáneamente en patrones geométricos como cuadrados, cruces, estrellas. Estos patrones, conocidos como **figuras de Chladni**, revelan las **líneas nodales** de la placa: los puntos donde la vibración es nula. Son la **huella visible del sonido**.

## 🧪 Herramienta educativa interactiva

Este proyecto es una **plataforma web educativa** diseñada para explorar este fenómeno de forma intuitiva, combinando explicaciones matemáticas accesibles con simulaciones en tiempo real. Está dirigido a estudiantes, profesores y cualquier curioso que quiera **ver cómo se comportan las ondas**.

### 🔧 Simulaciones incluidas

#### 1. **Cuerda vibrante (1D)**
- **Descripción:** Una cuerda fija en ambos extremos vibra en tiempo real. Las partículas amarillas (granos de arena) migran hacia los **nodos** (líneas punteadas).
- **Parámetros:**
  - `Modo (n)`: controla el número de semi‑longitudes de onda (1–4).
- **Método:** La fuerza sobre cada partícula es proporcional al gradiente negativo del cuadrado de la amplitud:  
  `F = -2·y·dy/dx`.  
  Con rozamiento y un pequeño ruido (jitter), las partículas se estabilizan en los nodos.

#### 2. **Visualizador de líneas nodales (2D)**
- **Descripción:** Dibuja las líneas donde la placa no vibra para modos puros `(m, n)` con bordes fijos (Dirichlet).
- **Parámetros:**
  - `m` (modo horizontal)
  - `n` (modo vertical)
- **Método:** Las líneas nodales son rectas dadas por `x = i/m` e `y = j/n`. Se dibujan mediante un barrido de la cuadrícula.

#### 3. **Líneas nodales curvas (superposición de modos)**
- **Descripción:** Muestra cómo la combinación de dos modos produce líneas curvas (hipérbolas, arcos, patrones complejos).
- **Parámetros:**
  - Modo 1 `(m1, n1)`
  - Modo 2 `(m2, n2)`
  - `Mezcla (k)`: coeficiente que pondera la contribución del segundo modo.
- **Método:** Se resuelve la ecuación implícita `sin(m1πx)sin(n1πy) + k·sin(m2πx)sin(n2πy) = 0` mediante un algoritmo de *marching squares*.

#### 4. **Simulación completa de placa 2D (interactiva)**
- **Descripción:** Simulación en tiempo real de hasta 30.000 partículas sobre una placa cuadrada. Las fuentes rojas (excitadores) se pueden arrastrar.
- **Parámetros:**
  - `Particles`: número de granos de arena.
  - `Frequency (ω)`: frecuencia de excitación (10–100).
  - `Boundary Condition`: bordes fijos (Dirichlet) o libres (Neumann).
  - `Sources`: número de fuentes puntuales (1–10).
  - `Distribute Sources Evenly`: distribuye las fuentes uniformemente.
- **Método:** Se utiliza **superposición de modos** (hasta 12×12). La amplitud instantánea `Z(x, y)` se calcula como suma de senos/cosenos ponderados por coeficientes resonantes. La fuerza sobre cada partícula es `F = -2·Z·∇Z`, que la empuja hacia los nodos. La integración es explícita con rozamiento y jitter, optimizada con WebGL para mantener la fluidez.

## 🚀 Tecnologías utilizadas

- **HTML5, CSS3, JavaScript (ES6)**
- **WebGL** (renderizado de partículas)
- **Canvas 2D** 

## 📚 Uso educativo

Esta herramienta es ideal para:
- **Clases de física** (ondas, resonancia, modos normales).
- **Talleres de divulgación científica** (aprender jugando).
- **Autoaprendizaje** para estudiantes de secundaria y universidad.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si deseas mejorar las simulaciones, agregar nuevos modos o traducir el contenido, abre un *issue* o un *pull request*.

## 📄 Licencia

GPL-3.0-or-later - see LICENSE file for details
