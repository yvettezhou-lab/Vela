(() => {
  const id = 'vela-global-quick';
  const isQuickPage = () => [...document.querySelectorAll('.topbar h1')].some(el => el.textContent?.trim() === 'Quick Entry');
  const openQuick = () => {
    const existing = document.querySelector('.home-page .home-quick');
    if (existing) { existing.click(); return; }
    const home = [...document.querySelectorAll('.bottom-nav button')].find(b => b.textContent?.trim() === 'Home');
    if (!home) return;
    home.click();
    let tries = 0;
    const timer = setInterval(() => {
      const trigger = document.querySelector('.home-page .home-quick');
      if (trigger) { clearInterval(timer); trigger.click(); }
      else if (++tries > 20) clearInterval(timer);
    }, 50);
  };
  const sync = () => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.setAttribute('aria-label','Quick Entry');
      button.title = 'Quick Entry';
      button.addEventListener('click', openQuick);
      document.body.appendChild(button);
    }
    button.hidden = isQuickPage();
  };
  new MutationObserver(sync).observe(document.body, {childList:true,subtree:true});
  sync();
})();
