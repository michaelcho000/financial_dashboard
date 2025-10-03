import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import DatabaseService from './services/DatabaseService';

const container = document.getElementById('root');
const startApp = async () => {
    try {
        await DatabaseService.init();
    } catch (error) {
        console.error('Failed to initialize application data store', error);
    }

    if (container) {
        const root = createRoot(container);
        root.render(
            <React.StrictMode>
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </BrowserRouter>
            </React.StrictMode>
        );
    }
};

startApp();
