(() => {
  const STORAGE_KEY = 'vela.home.memory.v1';
  const MAX_EDGE = 1400;
  const QUALITY = 0.82;

  const readStored = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveImage = (file, planName, done) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', QUALITY);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ planName, data, updatedAt: Date.now() }));
          done(data);
        } catch {
          window.alert('This photo is too large to keep locally. Please choose a smaller image.');
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const enhance = (map) => {
    if (!map || map.dataset.memoryReady === '1') return;
    map.dataset.memoryReady = '1';

    const planName = map.closest('.home-page')?.querySelector('.home-topbar h1')?.textContent?.trim() || 'New Journey';
    const stored = readStored();
    const matching = stored?.planName === planName ? stored : null;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('aria-label', 'Choose journey photo');
    input.hidden = true;

    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'home-memory-entry';
    control.setAttribute('aria-label', matching ? 'Replace journey photo' : 'Add a journey photo');
    control.innerHTML = matching ? '<span class="home-memory-thumb"></span><span class="home-memory-copy"><b>Replace memory</b><small>Change this journey photo</small></span>' : '<span class="home-memory-mark">⌁</span><span class="home-memory-copy"><b>Add a memory</b><small>Optional · pin a photo to the map</small></span>';

    const renderPhoto = (data) => {
      control.classList.add('has-photo');
      control.setAttribute('aria-label', 'Replace journey photo');
      control.innerHTML = '<span class="home-memory-thumb"></span><span class="home-memory-copy"><b>Replace memory</b><small>Change this journey photo</small></span>';
      const thumb = control.querySelector('.home-memory-thumb');
      if (thumb) thumb.style.backgroundImage = `url("${data}")`;
      map.classList.add('has-memory-photo');
      let photo = map.querySelector('.home-memory-photo');
      if (!photo) {
        photo = document.createElement('div');
        photo.className = 'home-memory-photo';
        map.appendChild(photo);
      }
      photo.style.backgroundImage = `url("${data}")`;
      photo.setAttribute('aria-label', 'Journey photo');
    };

    control.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      saveImage(file, planName, renderPhoto);
      input.value = '';
    });

    map.appendChild(input);
    map.appendChild(control);
    if (matching?.data) renderPhoto(matching.data);
  };

  const scan = () => document.querySelectorAll('.home-map').forEach(enhance);
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
