import './app.css';
import App from './App.svelte';
import PawnCharacterPlayground from './lib/components/characters/PawnCharacterPlayground.svelte';

// A standalone development surface: no game stores, network services, or board state mount here.
const RootComponent = window.location.pathname.endsWith('/pawn-playground')
  ? PawnCharacterPlayground
  : App;

const app = new RootComponent({
  target: document.getElementById('app')!
});

export default app;

