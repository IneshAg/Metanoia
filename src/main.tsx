import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import FloatingTimerApp from './FloatingTimerApp';
import './style.css';
import './workspace.css';
import './insights.css';

const isOverlay = window.location.search.includes('overlay=1') || window.location.hash.includes('overlay');
if (isOverlay) {
  document.body.classList.add('floating-overlay-body');
  document.documentElement.classList.add('floating-overlay-html');
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <FloatingTimerApp /> : <App />}
  </React.StrictMode>
);
