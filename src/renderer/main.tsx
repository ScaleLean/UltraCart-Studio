import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { App } from './app';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={350}>
      <App />
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  </React.StrictMode>
);
