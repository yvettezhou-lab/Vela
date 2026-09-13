(() => {
  const moneyValue = (text) => {
    const m = text.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*$/);
    return m ? Number(m[1]) : 0;
  };

  const categoryData = (section) => Array.from(section.querySelectorAll('.balance-row')).map(row => {
    const cells = row.querySelectorAll('span,b');
    return { name: cells[0]?.textContent?.trim() || '', value: moneyValue(cells[1]?.textContent || '') };
  }).filter(x => x.name && x.value > 0);

  const renderPie = (host, data) => {
    const total = data.reduce((s, x) => s + x.value, 0);
    if (!total) return;
    let angle = 0;
    const stops = data.map((x, i) => {
      const next = angle + x.value / total * 360;
      const stop = `var(--chart-${i % 8}) ${angle}deg ${next}deg`;
      angle = next;
      return stop;
    }).join(', ');
    host.innerHTML = `<div class="vela-chart-pie-wrap"><div class="vela-chart-pie" style="background:conic-gradient(${stops})" aria-label="Category spending pie chart"></div><div class="vela-chart-legend">${data.map((x,i)=>`<div class="vela-chart-legend-row"><i style="background:var(--chart-${i % 8})"></i><span>${x.name}</span><b>${x.value.toFixed(2)}</b></div>`).join('')}</div></div>`;
  };

  const renderBars = (host, data) => {
    const max = Math.max(...data.map(x => x.value), 1);
    host.innerHTML = `<div class="vela-chart-bars">${data.map((x,i)=>`<div class="vela-chart-bar-row"><div class="vela-chart-bar-label"><span>${x.name}</span><b>${x.value.toFixed(2)}</b></div><div class="vela-chart-bar-track"><i style="width:${Math.max(3, x.value / max * 100)}%;background:var(--chart-${i % 8})"></i></div></div>`).join('')}</div>`;
  };

  const enhance = () => {
    const page = Array.from(document.querySelectorAll('.page')).find(p => p.querySelector('.topbar h1')?.textContent?.trim() === 'Logbook');
    if (!page || page.dataset.logbookEnhanced === '1') return;
    page.dataset.logbookEnhanced = '1';

    const tabs = page.querySelector('.category-tabs');
    if (tabs) tabs.remove();

    const sections = Array.from(page.querySelectorAll('.section'));
    const category = sections.find(s => s.querySelector('h3')?.textContent?.trim() === 'Category');
    if (!category) return;

    const data = categoryData(category);
    const original = category.innerHTML;
    category.classList.add('vela-chart-section');
    category.innerHTML = `<div class="vela-chart-head"><h3>Category</h3><div class="vela-chart-toggle" role="group" aria-label="Category chart type"><button type="button" data-chart="pie" class="active">Pie</button><button type="button" data-chart="bar">Bars</button></div></div><div class="vela-chart-host"></div><div class="vela-chart-data"></div>`;
    const host = category.querySelector('.vela-chart-host');
    const dataHost = category.querySelector('.vela-chart-data');
    dataHost.innerHTML = original.replace(/<div class="section-head">[\s\S]*?<\/div>/, '');

    const setMode = (mode) => {
      category.querySelectorAll('.vela-chart-toggle button').forEach(b => b.classList.toggle('active', b.dataset.chart === mode));
      if (mode === 'pie') renderPie(host, data); else renderBars(host, data);
    };
    category.querySelector('[data-chart="pie"]').addEventListener('click', () => setMode('pie'));
    category.querySelector('[data-chart="bar"]').addEventListener('click', () => setMode('bar'));
    setMode('pie');
  };

  const observe = () => {
    enhance();
    new MutationObserver(enhance).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
