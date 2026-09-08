(() => {
  const PLAN_KEY = 'vela.plan.v1';
  const readPlan = () => { try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; } };
  const inclusiveDays = (start, end) => {
    if (!start || !end) return '';
    const a = new Date(`${start}T00:00:00Z`), b = new Date(`${end}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  };
  const formatDate = value => {
    if (!value) return 'Dates not set';
    const d = new Date(`${value}T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const enhance = () => {
    const home = document.querySelector('.home-page');
    if (!home) return;
    const plan = readPlan();
    const hero = home.querySelector('.hero');
    const map = home.querySelector('.home-map');
    if (map) map.hidden = true;
    if (hero && plan) {
      const eyebrow = hero.querySelector('.eyebrow');
      const title = hero.querySelector('h2');
      const copy = hero.querySelector('p');
      if (eyebrow) eyebrow.textContent = 'CURRENT TRIP';
      if (title) title.textContent = plan.name || 'New Journey';
      if (copy) {
        const days = inclusiveDays(plan.startDate, plan.endDate);
        copy.textContent = plan.startDate && plan.endDate
          ? `${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}${days ? `   (${days} days)` : ''}`
          : 'Dates not set';
      }
      hero.dataset.referenceReady = '1';
    }
    const quick = home.querySelector('.home-quick');
    if (quick) quick.classList.add('reference-quick');
  };
  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
