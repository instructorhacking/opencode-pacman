// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, TIMID_CORNER.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Modo asustado (power pellets).
const FRIGHT_FRAMES = 360;       // 6 s a 60 fps
const FRIGHT_FLASH_FRAMES = 120; // ultimos 2 s parpadeando
const GHOST_RESPAWN_WAIT = 90;   // re-salida tras ser comido

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightTimer: 0, // frames restantes del modo asustado (0 = inactivo)
    frightEaten: 0, // fantasmas comidos con el pellet actual
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      wait: g.release,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot (10 pts) o power pellet (50 pts).
    const v = grid[ p.y ][ p.x ];
    if ( v === 2 || v === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += v === 2 ? 10 : 50;
      game.dotsRemaining--;
      // El pellet asusta: timer a tope, cadena a 0 y reversa inmediata de
      // direccion como senal visible del cambio de modo.
      if ( v === 4 ) {
        game.frightTimer = FRIGHT_FRAMES;
        game.frightEaten = 0;
        game.ghosts.forEach( ( g ) => { g.dir = OPPOSITE[ g.dir ]; } );
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Dentro de la perrera (interior + celdas de puerta)?
function inPen( x, y ) {
  if ( y >= 13 && y <= 15 && x >= 11 && x <= 16 ) return true;
  return y === 12 && x >= 13 && x <= 14;
}

// Celda objetivo de cada fantasma segun su personalidad. Solo se usa para
// distancia Manhattan: que caiga en pared o fuera del mapa no importa.
function ghostTarget( game, g ) {
  // En la perrera manda el guion de salida (como el arcade): objetivo fijo
  // sobre la puerta; la personalidad manda solo fuera.
  if ( inPen( Math.round( g.x ), Math.round( g.y ) ) ) return { x: 13, y: 11 };

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Modo asustado: la personalidad se anula; el objetivo pasa a ser Pac-Man
  // y decideGhost invierte el criterio (huir en vez de perseguir).
  if ( game.frightTimer > 0 ) return { x: px, y: py };

  const d = DIRS[ p.dir ];

  if ( g.kind === 'cazador' ) {
    return { x: px, y: py };
  }

  if ( g.kind === 'emboscador' ) {
    // 4 celdas delante de Pac-Man: le corta el paso.
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'flanqueador' ) {
    // punto = Pac-Man + 2*dir; objetivo = espejo del cazador respecto al punto.
    const hunter = game.ghosts.find( ( o ) => o.kind === 'cazador' );
    if ( !hunter ) return { x: px, y: py }; // sin cazador, degrada a perseguir
    const hx = Math.round( hunter.x );
    const hy = Math.round( hunter.y );
    const mx = px + d.x * 2;
    const my = py + d.y * 2;
    return { x: mx + ( mx - hx ), y: my + ( my - hy ) };
  }

  // timido: persigue de lejos; a 8 celdas o menos se retira a su esquina.
  const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
  if ( dist > 8 ) return { x: px, y: py };
  return { x: TIMID_CORNER.x, y: TIMID_CORNER.y };
}

// Decision voraz: en cada celda alineada elige la direccion (sin retroceder)
// que mas reduce la distancia Manhattan al objetivo de su personalidad.
// Con el modo asustado el criterio se invierte fuera de la perrera: huye de
// Pac-Man eligiendo la direccion que MAS distancia Manhattan le pone.
function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );
  // En la perrera manda el guion de salida (que minimiza): los fantasmas
  // re-salientes no quedan atrapados mientras dura el fright.
  const flee = game.frightTimer > 0 && !inPen( Math.round( g.x ), Math.round( g.y ) );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = flee ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( flee ? dist > bestDist : dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Perder una vida limpia el modo asustado: nada azul tras el reinicio.
  game.frightTimer = 0;
  game.frightEaten = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.wait = GHOST_STARTS[ i ].release; // re-escalonar salidas
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  // Reloj global del modo asustado: un frame menos por tick.
  if ( game.frightTimer > 0 ) game.frightTimer--;
  movePacman( game );
  // Salida escalonada: mientras wait > 0 el fantasma espera en la perrera.
  game.ghosts.forEach( ( g ) => {
    if ( g.wait > 0 ) {
      g.wait--;
      return;
    }
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHT_FLASH_FRAMES = FRIGHT_FLASH_FRAMES; // render.js: parpadeo final
