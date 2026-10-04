# SPEC 01 — Cuatro fantasmas con personalidades distintas

> **Estado:** Implemented
> **Depende de:** ninguna
> **Fecha:** 2026-10-03
> **Objetivo:** Sustituir los 2 fantasmas actuales por 4 con personalidades clásicas del arcade y salida escalonada de la perrera, donde el cazador persigue agresivamente a Pac-Man.

## Alcance

**Dentro:**

- 4 fantasmas en `GHOST_STARTS` (`src/js/maze.js`) con kinds: `cazador`, `emboscador`,
  `flanqueador` y `timido`.
- Un objetivo de persecución distinto por kind en `decideGhost()` (`src/js/game.js`).
- Salida escalonada de la perrera: contador `wait` por fantasma con retardos
  0/90/180/270 frames; también se re-escalona tras perder una vida.
- Color fijo por kind en `src/js/render.js`: rojo, rosa, cian y naranja.
- Esquina de retirada del tímido: `TIMID_CORNER` en `src/js/maze.js`.

**Fuera de alcance (specs futuros):**

- Modos scatter/frightened y power pellets (no existen aún en el juego).
- Comer fantasmas y puntuarlos.
- Velocidades distintas por fantasma (todos siguen a 1/10).
- Laberintos o niveles nuevos.
- Cambios en `src/index.html` o `src/js/main.js`.

## Modelo de datos

No hay archivos nuevos; se amplían los 3 existentes. Sin nuevos `<script>` ni globals
extra aparte de `TIMID_CORNER`.

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'cazador',     release: 0 },
  { x: 13, y: 14, kind: 'emboscador',  release: 90 },
  { x: 14, y: 14, kind: 'flanqueador', release: 180 },
  { x: 15, y: 14, kind: 'timido',      release: 270 },
];
const TIMID_CORNER = { x: 1, y: 29 }; // esquina inferior izquierda

// src/js/game.js — cada fantasma en createGame()
{ x, y, dir: 'up', speed: GHOST_SPEED, kind, wait: release }

// src/js/render.js
const GHOST_COLORS = {
  cazador: '#ff0000',     // rojo
  emboscador: '#ffb8ff',  // rosa
  flanqueador: '#00ffff', // cian
  timido: '#ffb852',      // naranja
};
```

Objetivo de persecución por kind (celdas, distancia Manhattan):

- `cazador`: la celda de Pac-Man.
- `emboscador`: Pac-Man + 4 celdas en `pacman.dir`.
- `flanqueador`: `punto = Pac-Man + 2·dir`; objetivo = `punto + (punto − cazador)`.
- `timido`: si distancia Manhattan > 8 → Pac-Man; si ≤ 8 → `TIMID_CORNER`.

## Plan de implementación

1. `src/js/maze.js` + `src/js/game.js`: sustituir `GHOST_STARTS` por las 4 entradas,
   añadir `TIMID_CORNER` (con su `window.TIMID_CORNER`) y renombrar la rama `hunter`
   de `decideGhost` a `cazador`. Test manual: 4 fantasmas en la perrera, el cazador
   persigue y los otros 3 van aleatorios, sin errores en consola.
2. `src/js/game.js`: salida escalonada — `wait` en `createGame`, decremento y bloqueo
   de movimiento en `update` mientras `wait > 0`, reset de `wait` en `resetPositions`.
   Test manual: solo el cazador sale al inicio; cada ~1,5 s sale otro.
3. `src/js/game.js`: extraer `ghostTarget( game, g )` con las 4 fórmulas y que
   `decideGhost` elija con ellas (voraz, sin retroceder, callejón permite 180).
   Test manual: rosa corta el paso, cian flanquea, naranja se retira al acercarte.
4. `src/js/render.js`: `GHOST_COLORS` como objeto por kind y lookup en `draw`.
   Test manual: cada personalidad conserva su color tras reiniciar.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola con `src/index.html`.
- [ ] Se ven 4 fantasmas simultáneos con 4 colores distintos: rojo, rosa, cian y naranja.
- [ ] Al iniciar solo sale el cazador; los demás salen escalonados cada ~1,5 s.
- [ ] El cazador (rojo) navega directamente hacia Pac-Man de forma agresiva.
- [ ] El emboscador (rosa) se dirige delante de Pac-Man y le corta el paso.
- [ ] El flanqueador (cian) se aproxima por un lado distinto al del cazador.
- [ ] El tímido (naranja) persigue de lejos y se aleja a su esquina si está a ≤ 8 celdas.
- [ ] Ningún fantasma retrocede en bifurcaciones (salvo callejón sin salida).
- [ ] El túnel lateral sigue funcionando para los 4 fantasmas.
- [ ] Perder una vida reinicia posiciones y las salidas se re-escalonan.

## Decisiones

- **Sí:** personalidades clásicas del arcade — los 4 colores de `GHOST_COLORS` ya son
  los clásicos y el comportamiento original es conocido.
- **No:** conjunto simplificado con un aleatorio — el aleatorio no "piensa" y no cumple
  el requisito de que cada uno actúe distinto.
- **Sí:** decisión voraz por distancia Manhattan en cada celda alineada — ya existía para
  `hunter` y es lo que hace el arcade original.
- **No:** BFS de camino más corto — más código y una letalidad excesiva para un MVP.
- **Sí:** salida escalonada con contador `wait` por fantasma — evita la emboscada 4
  contra 1 al aparecer y se reinicia sola en `resetPositions` sin tocar `main.js`.
- **No:** reloj global de frames para el escalonado — acoplaría `main.js` al asunto.
- **Sí:** guion de salida de perrera (añadido en implementación) — el voraz por
  Manhattan solo no saca a nadie mientras el objetivo esté debajo de la puerta:
  rondan dentro y saldrían los 4 en masa al subir Pac-Man. Dentro de la perrera
  el objetivo es fijo la celda sobre la puerta; la personalidad manda solo
  fuera, como en el arcade original.
- **Sí:** kinds en español con color por kind — el repo es todo en español.
- **No:** nombres `blinky`/`pinky`/`inky`/`clyde` — en inglés, rompen la convención.
- **Sí:** esquina fija para el tímido — es su personalidad clásica, no un modo scatter.
- **No:** modos scatter/frightened — no hay power pellets; van en specs futuros.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| 4 cazadores efectivos disparan la dificultad | Salida escalonada y tímido que se retira cerca suavizan el ritmo. |
| El flanqueador depende de que exista un `cazador` | `find` por kind; si no aparece, su objetivo degrada a Pac-Man. |
| El objetivo calculado cae en pared o fuera del mapa | No importa: solo se usa para distancia Manhattan, nunca como celda a pisar. |

## Qué **NO** entra en este spec

- Modos scatter/frightened y power pellets.
- Comer fantasmas y puntuarlos.
- Velocidades por fantasma, niveles nuevos ni cambios en `index.html`/`main.js`.

Cada uno de esos puntos, si llega algún día, va en su propio spec.
