/* Progressive enhancement for the shell disclosures.
   The menus are native <details> elements and work without this file; this only adds
   Escape-to-close, click-outside-to-close and one-open-menu-at-a-time. */
(() => {
  const disclosures = Array.from(document.querySelectorAll('details.sc-lang, details.sc-menu'));
  if (!disclosures.length) return;

  const closeOthers = (current) => {
    for (const item of disclosures) {
      if (item !== current) item.open = false;
    }
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = disclosures.find((item) => item.open);
    if (!open) return;
    event.preventDefault();
    open.open = false;
    const summary = open.querySelector('summary');
    if (summary) summary.focus();
  });

  document.addEventListener('click', (event) => {
    const open = disclosures.find((item) => item.open);
    if (open && !open.contains(event.target)) open.open = false;
  });

  for (const item of disclosures) {
    item.addEventListener('toggle', () => {
      if (item.open) closeOthers(item);
    });
  }
})();
