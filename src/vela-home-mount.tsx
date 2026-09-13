import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home';

const mount = () => {
  const app = document.querySelector('.app');
  if (!app || app.querySelector('#vela-supplied-home')) return;
  const host = document.createElement('div');
  host.id = 'vela-supplied-home';
  const nav = app.querySelector(':scope > .bottom-nav');
  if (nav instanceof HTMLElement) nav.style.display = 'none';
  if (nav) app.insertBefore(host, nav);
  else app.appendChild(host);
  createRoot(host).render(<Home />);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
