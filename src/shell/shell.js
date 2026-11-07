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

  // Close every open disclosure, not only the first one in DOM order. If the language menu
  // and the mobile menu were both open, one Escape must close both and leave focus on the
  // summary that belongs to the menu the reader was using.
  const closeAll = () => {
    const open = disclosures.filter((item) => item.open);
    if (!open.length) return null;
    const focused = document.activeElement;
    const target = open.find((item) => item.contains(focused)) || open[open.length - 1];
    for (const item of open) item.open = false;
    return target;
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const target = closeAll();
    if (!target) return;
    event.preventDefault();
    const summary = target.querySelector('summary');
    if (summary) summary.focus();
  });

  document.addEventListener('click', (event) => {
    const open = disclosures.filter((item) => item.open);
    if (open.length && !open.some((item) => item.contains(event.target))) {
      for (const item of open) item.open = false;
    }
  });

  for (const item of disclosures) {
    item.addEventListener('toggle', () => {
      if (item.open) closeOthers(item);
    });
  }
})();
