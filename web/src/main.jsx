import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ResultPage from './ResultPage.jsx';

const Component = window.location.pathname.startsWith('/result') ? ResultPage : App;
createRoot(document.getElementById('root')).render(<Component />);
