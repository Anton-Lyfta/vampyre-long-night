import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createDemoPort, isDemoPlayerKey } from './screen/demo';
import './styles.css';

// Utveckling: demokampanjen körs lokalt. Välj spelare med ?player=innerCircle|prince|baron|hiddenArchbishop|untitled.
const key = new URLSearchParams(window.location.search).get('player');
const port = createDemoPort(isDemoPlayerKey(key) ? key : 'prince');

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App port={port} />
  </StrictMode>,
);
