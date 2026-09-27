import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Purge any obsolete caches from previous app versions and handle service worker
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    // In development mode, unregister any service worker and clean caches to prevent stale module caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name.startsWith('registro-lectura-pwa-')) {
            caches.delete(name);
          }
        }
      }).catch(() => {});
    }
  } else {
    // In production, clean old caches and register latest service worker
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          if (name.startsWith('registro-lectura-pwa-v') && name !== 'registro-lectura-pwa-v10') {
            console.log('[App] Removing legacy cache:', name);
            caches.delete(name);
          }
        }
      }).catch(() => {});
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registrado con éxito:', registration.scope);
            registration.update();
          })
          .catch((err) => {
            console.log('Error registrando Service Worker:', err);
          });
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
