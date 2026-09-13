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

const mount = () => {
  const app = document.querySelector('.app');
  if (!app || app.querySelector('#vela-supplied-home')) return false;

  const host = document.createElement('div');
  host.id = 'vela-supplied-home';
  const nav = app.querySelector(':scope > .bottom-nav');
  if (nav instanceof HTMLElement) nav.style.display = 'none';
  if (nav) app.insertBefore(host, nav);
  else app.appendChild(host);

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
