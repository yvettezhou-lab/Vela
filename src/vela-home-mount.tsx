import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './Home';

class HomeErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Vela Home render error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="vela-app-container">
          <header className="vela-header">
            <div className="vela-brand">
              <h1>Vela <span>/ JOURNEYS</span></h1>
              <div className="vela-subtitle">TRAVEL · RECORD · BELONG</div>
            </div>
          </header>
          <section className="vela-empty">
            <p>YOUR NEXT JOURNEY AWAITS.</p>
          </section>
        </div>
      );
    }
    return this.props.children;
  }
}

const installHomeChrome = () => {
  if (document.getElementById('vela-home-structural-fix')) return;
  const style = document.createElement('style');
  style.id = 'vela-home-structural-fix';
  style.textContent = `
    #vela-supplied-home{width:100%;min-height:100vh;position:relative;transform:none;filter:none;will-change:auto;}
    #vela-supplied-home .vela-header{position:sticky;top:0;z-index:80;background:rgba(247,244,235,.95);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding-top:max(env(safe-area-inset-top),20px);}
    #vela-supplied-home .vela-compact-card,#vela-supplied-home .vela-hero-card{z-index:31;}
    body>.vela-ufo-wrapper{position:fixed!important;right:24px!important;bottom:90px!important;z-index:100!important;transform:none!important;filter:none!important;will-change:auto!important;}
    body>.vela-ufo-wrapper .vela-celestial-star path:first-child{stroke:#FAF9F5!important;stroke-width:2.5!important;}
    body>.vela-ufo-wrapper .vela-celestial-star path:last-child{fill:#FAF9F5!important;opacity:.28!important;}
  `;
  document.head.appendChild(style);
};

const mount = () => {
  const app = document.querySelector('.app');
  if (!app || document.getElementById('vela-supplied-home')) return false;

  const host = document.createElement('div');
  host.id = 'vela-supplied-home';

  // Hide the legacy navigation, but mount the new Home outside .app so no
  // page-level scrolling/transform/overflow container can trap fixed children.
  const nav = app.querySelector(':scope > .bottom-nav');
  if (nav instanceof HTMLElement) nav.style.display = 'none';
  document.body.appendChild(host);

  installHomeChrome();

  createRoot(host).render(
    <HomeErrorBoundary>
      <Home />
    </HomeErrorBoundary>,
  );
  return true;
};

if (!mount()) {
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
