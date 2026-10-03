# Pac-Man MVP — JS puro

Juego tipo Pac-Man en vanilla JS/HTML/CSS. No hay `package.json`, build, bundler, tests, lint ni CI: no los busques ni los inventes. Este repo existe para aprender Spec Driven Development.

## Ejecutar y verificar

- Ejecutar = abrir `src/index.html` en el navegador (funciona con `file://`; no hay fetch ni módulos, no hace falta dev server).
- No hay suite de tests: la verificación es manual en el navegador (mover, comer dots, perder vidas, ganar, túnel lateral, fantasmas saliendo de la perrera).

## Flujo de trabajo: Spec Driven Development

Las features nuevas se definen e implementan con los skills `spec` y `spec-impl` (definición completa en `.agents/skills/*/SKILL.md`, versiones fijadas en `skills-lock.json`), no codeando directo:

1. `/spec <descripción>` → crea `specs/NN-slug.md` en estado `Draft` (numeración secuencial; si `specs/` no existe, la primera es `01-`).
2. El humano revisa y cambia el estado a `Approved`/`Aprobado`; el agente nunca lo hace solo.
3. `/spec-impl NN-slug` → crea la branch `spec-NN-slug` e implementa paso a paso con pausas para revisar diffs.

- El agente no commitea por su cuenta; los commits son siempre decisión del usuario.

## Arquitectura

- 4 scripts planos cargados por tags `<script>` en `src/index.html`, en este orden: `maze.js` → `game.js` → `render.js` → `main.js`. No hay ES modules: la comunicación es por globals de `window` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`, `createGame`, `update`, `DIRS`, `draw`). Un archivo nuevo necesita su tag `<script>` en la posición correcta o nada funcionará.
- `MAZE` (maze.js) es la plantilla prístina del laberinto: nunca mutarla. `createGame()` copia sus filas a `game.grid`, que es el estado mutable de cada partida (dots comidos, posiciones, score). El render también dibuja desde `game.grid`, no desde `MAZE`.
- Codificación del laberinto (31 strings de 28 chars): `#` pared(1) · `.` dot(2) · ` ` transitable(0) · `-` puerta de la perrera(3). La puerta bloquea a Pac-Man pero NO a los fantasmas (parámetro `actor` en `isWall`).
- Túnel: solo en `TUNNEL_ROW = 14`; salir por un borde lateral en esa fila hace wrap al lado opuesto (`wrapTunnel`).
- Posiciones fraccionarias en celdas: velocidades de 1/8 (Pac-Man) y 1/10 (fantasmas) celdas/frame. Los giros y decisiones solo se aplican cuando el actor está alineado a la celda (`aligned()`, tolerancia 1e-3). Trampa: una velocidad que no sea 1/n rompe la realineación y los giros dejan de funcionar.
- Canvas en `index.html`: 560×620 = 28×31 celdas × `TILE = 20`; si cambias el laberinto, actualiza el tamaño del canvas.

## Convenciones

- Todo en español: README, comentarios, textos de UI y specs. Responder al usuario en el idioma de su prompt.
- Estilo del código existente: comillas simples, 2 espacios de indentación, punto y coma, y espacios dentro de los paréntesis — `foo( x )` — imítalo.
