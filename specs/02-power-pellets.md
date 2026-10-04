# SPEC 02 — Power pellets: fantasmas asustados y comestibles

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-03
> **Objetivo:** Añadir 4 power pellets en las esquinas que asustan a los fantasmas
> durante 6 s, volviéndolos azules, haciéndoles huir de Pac-Man y permitiendo
> comérselos por 200/400/800/1600 puntos.

## Alcance

**Dentro:**

- Codificación nueva en `src/js/maze.js`: `o` = power pellet (valor 4) en las 4
  esquinas clásicas (1,3), (26,3), (1,23), (26,23).
- Comer pellet en `movePacman()` (`src/js/game.js`): 50 puntos, cuenta para
  `dotsRemaining` (hay que comerlos para ganar).
- Modo asustado (`frightTimer` = 360 frames): los fantasmas invierten dirección al
  activarse y huyen greedy de Pac-Man (maximizar Manhattan), sin cambio de velocidad.
- Comer fantasma asustado en `update()`: 200 · 2^`frightEaten` puntos y el fantasma
  vuelve a su `GHOST_START` con `wait` fijo de 90 frames.
- Visual en `src/js/render.js`: pellet = círculo grande (radio ~7 px), fantasma
  asustado azul con ojos blancos y parpadeo azul/blanco en los últimos 120 frames.
- Reset del modo asustado al perder una vida (`resetPositions()`).

**Fuera de alcance (specs futuros):**

- Modo scatter (alternancia cíclica persecución/dispersión).
- Fantasmas "ojos" que navegan solos de vuelta a la perrera.
- Frutas/bonus, niveles con duración decreciente del fright, sonido.
- Cambios en `src/index.html` o `src/js/main.js` (no hacen falta).

## Modelo de datos

Sin archivos nuevos ni globals extra: todo vive en el estado de `game`. Se amplían
los mismos 3 archivos de SPEC 01.

```js
// src/js/maze.js — parseTile gana un valor
if ( ch === 'o' ) return 4;
// MAZE_STR: filas 3 y 23, cols 1 y 26 pasan de '.' a 'o'

// src/js/game.js — constantes
const FRIGHT_FRAMES = 360;       // 6 s a 60 fps
const FRIGHT_FLASH_FRAMES = 120; // ultimos 2 s parpadeando
const GHOST_RESPAWN_WAIT = 90;   // re-salida tras ser comido

// createGame() añade al estado: frightTimer: 0, frightEaten: 0
// comer pellet: score += 50; frightTimer = FRIGHT_FRAMES;
//               frightEaten = 0; ghosts invierten su dir
// comer fantasma: score += 200 * 2 ** frightEaten; frightEaten++;
//                 g vuelve a su GHOST_START con wait = GHOST_RESPAWN_WAIT
```

`frightTimer` es el reloj global del modo (frames que quedan); `frightEaten` cuenta
fantasmas comidos con el pellet actual y resetea a 0 al comer otro pellet.

## Plan de implementación

1. Pellet comible y visible: `maze.js` (`o`→4 en `parseTile` + 4 esquinas en
   `MAZE_STR`), `game.js` (`dotsRemaining` cuenta `v === 2 || v === 4`, comer valor 4
   da 50 puntos) y `render.js` (`drawDots` pinta valor 4 con radio ~7 px). Test
   manual: 4 círculos grandes en las esquinas; comer uno da +50 y desaparece; no se
   gana sin comer los 4.
2. Modo asustado: `game.js` — `frightTimer`/`frightEaten` en `createGame`,
   activación al comer pellet (360, cadena a 0, reversa con `OPPOSITE`), decremento
   en `update`, huida greedy en `ghostTarget`/`decideGhost` (rama que maximiza
   Manhattan a Pac-Man) y limpieza del modo en `resetPositions`. Test manual: al
   comer pellet invierten y huyen ~6 s, luego vuelven a sus personalidades.
3. Comer fantasmas: rama de colisión en `update` con `frightTimer > 0` — puntos
   `200 * 2 ** frightEaten`, fantasma a su `GHOST_START` con `dir: 'up'` y
   `wait: 90`. Test manual: comer 2 con el mismo pellet da +200 y +400.
4. Render del fright: `render.js` — azul `#2121de` con ojos blancos mientras
   `frightTimer > 0`, parpadeo a blanco cuando `frightTimer <= FRIGHT_FLASH_FRAMES`.
   Test manual: parpadea justo antes de expirar y recupera colores al acabar.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola con `src/index.html`.
- [ ] Se ven 4 círculos grandes en (1,3), (26,3), (1,23), (26,23) al iniciar.
- [ ] Comer un pellet suma 50 puntos y lo borra del tablero.
- [ ] Tras comerlo, todos los fantasmas invierten su dirección y se vuelven azules.
- [ ] Los fantasmas azules huyen de Pac-Man (nunca van hacia él) durante 6 s.
- [ ] En los últimos ~2 s parpadean entre azul y blanco.
- [ ] Al expirar el timer recuperan color y personalidad (el cazador vuelve a perseguir).
- [ ] Comer fantasmas con el mismo pellet da 200, 400, 800 y 1600 (los 4 = 3000).
- [ ] El fantasma comido reaparece en la perrera y re-sale ~1,5 s después.
- [ ] Un segundo pellet con fright activo re-anima el timer a 6 s y la cadena vuelve a 200.
- [ ] Perder una vida con fright activo lo limpia: nada azul tras el reinicio.
- [ ] No se gana la partida hasta comer también los 4 pellets.
- [ ] Túnel lateral y salidas escalonadas siguen funcionando igual.

## Decisiones

- **Sí:** `o` (valor 4) en el grid — sigue el patrón de `parseTile`; `isWall` no lo
  toca porque no es muro para nadie.
- **No:** pellets fuera del grid — rompería el patrón dots-en-grid y `drawDots`.
- **Sí:** cuentan en `dotsRemaining` — como el arcade, sin contador paralelo.
- **Sí:** 360 frames (6 s) — duración aproximada del nivel 1 del arcade.
- **Sí:** cadena 200·2^n — clásica; los 4 fantasmas con un pellet = 3000.
- **No:** fijo 200 — pierde la emoción de encadenarlos y no cuesta menos.
- **Sí:** huir greedy reutilizando `decideGhost` invertido (maximizar Manhattan) —
  cero estructuras nuevas sobre lo ya probado en SPEC 01.
- **No:** aleatorio o correr a esquinas — el greedy ya funciona y es determinista.
- **Sí:** reversa de dirección al activarse — señal clara del cambio de modo, como
  en el arcade.
- **Sí:** comido → `GHOST_START` + `wait` fijo 90 — reutiliza la maquinaria de
  salidas escalonadas de SPEC 01 sin inventar estados.
- **No:** ojos caminando solos a la perrera — otro modo de IA para poco valor en un
  MVP.
- **Sí:** velocidad asustada sin cambio (1/10) — AGENTS.md avisa que solo 1/n
  realinea; no tocar lo que funciona, y huir ya los hace vulnerables.
- **No:** bajar a 1/12 — válido pero multiplica estados de velocidad para poca ganancia.
- **Sí:** azul con ojos blancos + parpadeo final — el aviso visual del arcade de que
  el modo se acaba.
- **Sí:** 50 puntos por pellet — valor clásico del arcade.
- **Sí:** segundo pellet re-anima timer y cadena — comportamiento arcade.
- **Sí:** sin tocar `index.html`/`main.js` — todo cabe en el estado de `game`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La huida greedy acorrala al fantasma en esquinas | Es intencional: así se les caza en el arcade; ser comido lo libera, no hay deadlock. |
| Reversa con fantasma a mitad de celda | Mover no exige alineación (solo decidir); llega alineado a la siguiente celda y decide normal. |
| Fantasma re-saliente con fright aún activo | Aparece azul mientras `frightTimer > 0`, como en el arcade; al expirar recupera color. |
| Pellet y colisión en el mismo frame | `movePacman` corre antes del chequeo de colisiones: el fright ya está activo y cuenta como comido. |

## Qué **NO** entra en este spec

- Modo scatter (alternancia persecución/dispersión).
- Ojos navegando a la perrera, frutas, niveles con fright decreciente, sonido.
- Cambios en `src/index.html` o `src/js/main.js`.

Cada uno de esos puntos, si llega algún día, va en su propio spec.
