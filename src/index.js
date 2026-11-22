import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './modern.css'; // the modern look ("Graphite & Champagne"); scoped to <html data-look="modern">, set in public/index.html
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

// scripts/prerender.mjs puts static text for crawlers inside #root. Remove it as the app starts so it is never shown twice.
document.querySelectorAll('[data-seo-static]').forEach((node) => node.remove());

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
