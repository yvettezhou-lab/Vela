import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Home from './Home';

let root: Root | null = null;
let mounted: HTMLElement | null = null;

function mount() {
  const page = document.querySelector<HTMLElement>('.home-page');
  if (!page) {
    if (mounted) {
      root?.unmount();
      root = null;
      mounted = null;
      document.querySelector<HTMLElement>('.app > .bottom-nav')?.style.removeProperty('display');
    }
    return;
  }
  if (mounted?.isConnected && mounted.parentElement === page) return;
  if (mounted) root?.unmount();
  page.querySelectorAll(':scope > *').forEach(el => (el as HTMLElement).style.display = 'none');
  const host = document.createElement('div');
  host.id = 'vela-supplied-home';
  page.appendChild(host);
  mounted = host;
  document.querySelector<HTMLElement>('.app > .bottom-nav')?.style.setProperty('display', 'none', 'important');
  root = createRoot(host);
  root.render(<Home />);
}

const observer = new MutationObserver(mount);
const boot = () => {
  observer.observe(document.body, { childList: true, subtree: true });
  mount();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
