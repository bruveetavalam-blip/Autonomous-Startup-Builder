import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { Toaster } from 'react-hot-toast';
import { StartupProvider } from './context/StartupContext';
createRoot(document.getElementById('root')!).render(<StrictMode><StartupProvider><App /><Toaster position="top-right" /></StartupProvider></StrictMode>);
