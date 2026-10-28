import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/app.css';
import './styles/editor.css';
import './styles/database.css';
import './styles/views.css';
import App from './App';
import { hydrate, useStore } from './store/store';

if (import.meta.env.DEV) (window as any).__moving = useStore;

hydrate().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
