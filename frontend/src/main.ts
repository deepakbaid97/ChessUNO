import './app.css';
import App from './App.svelte';
import PawnCharacterPlayground from './lib/components/characters/PawnCharacterPlayground.svelte';
import KnightCharacterPlayground from './lib/components/characters/KnightCharacterPlayground.svelte';
import RookCharacterPlayground from './lib/components/characters/RookCharacterPlayground.svelte';
import BishopCharacterPlayground from './lib/components/characters/BishopCharacterPlayground.svelte';
import QueenCharacterPlayground from './lib/components/characters/QueenCharacterPlayground.svelte';
import KingCharacterPlayground from './lib/components/characters/KingCharacterPlayground.svelte';

// A standalone development surface: no game stores, network services, or board state mount here.
const path = window.location.pathname;
const RootComponent = path.endsWith('/king-playground')
  ? KingCharacterPlayground
  : path.endsWith('/queen-playground')
    ? QueenCharacterPlayground
    : path.endsWith('/bishop-playground')
      ? BishopCharacterPlayground
      : path.endsWith('/rook-playground')
        ? RookCharacterPlayground
        : (path.endsWith('/knight-playground') || path.endsWith('/character-playground'))
          ? KnightCharacterPlayground
          : path.endsWith('/pawn-playground')
            ? PawnCharacterPlayground
            : App;

const app = new RootComponent({
  target: document.getElementById('app')!
});

export default app;

