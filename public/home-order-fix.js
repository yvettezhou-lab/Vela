(() => {
  function arrange() {
    const shell = document.querySelector('.vela-clean-home');
    if (!shell || shell.dataset.velaOrderFixed === '1') return;
    const hero = shell.querySelector('.vela-clean-map');
    const recent = shell.querySelector('.vela-clean-recent');
    const start = shell.querySelector('.vela-clean-new');
    const tabs = shell.querySelector('.vela-clean-tabs');
    const current = shell.querySelector('.vela-clean-current');
    if (!hero || !recent || !start || !tabs || !current) return;

    // Keep the map purely as the visual opening. The index tabs belong below Start.
    hero.appendChild(tabs);
    shell.append(recent, start, tabs, current);
    shell.dataset.velaOrderFixed = '1';
  }
  const tick = () => arrange();
  tick();
  new MutationObserver(tick).observe(document.body, { childList: true, subtree: true });
  setInterval(tick, 500);
})();
