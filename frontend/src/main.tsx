import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App_v2';

// Tailwind-like utility classes are handled by MUI sx prop + className
// No global CSS framework needed — MUI handles everything

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
