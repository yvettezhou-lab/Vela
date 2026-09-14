import React from 'react';
import { createRoot } from 'react-dom/client';
import V2Sandbox from './V2Sandbox';

if (window.location.pathname === '/v2-test' || window.location.pathname === '/v2-test/') {
  const legacyRoot = document.getElementById('root');
  if (legacyRoot) legacyRoot.style.display = 'none';

  const sandboxRoot = document.createElement('div');
  sandboxRoot.id = 'v2-sandbox-root';
  document.body.appendChild(sandboxRoot);
  createRoot(sandboxRoot).render(<V2Sandbox />);
}
