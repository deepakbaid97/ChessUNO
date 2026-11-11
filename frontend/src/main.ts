import './app.css';
import App from './App.svelte';
import PawnCharacterPlayground from './lib/components/characters/PawnCharacterPlayground.svelte';
import KnightCharacterPlayground from './lib/components/characters/KnightCharacterPlayground.svelte';

// A standalone development surface: no game stores, network services, or board state mount here.
const path = window.location.pathname;
const RootComponent = (path.endsWith('/knight-playground') || path.endsWith('/character-playground'))
  ? KnightCharacterPlayground
  : path.endsWith('/pawn-playground')
    ? PawnCharacterPlayground
    : App;

const app = new RootComponent({
  target: document.getElementById('app')!
});

export default app;

