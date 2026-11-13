const entourageForm = document.querySelector('#editEntourage');
const entourageFields = document.querySelector('#entourageFields');
const entourageStatus = document.querySelector('#entourageStatus');
const saveEntourage = entourageForm.querySelector('button');

async function loadEntourage() {
  const [page, saved] = await Promise.all([fetch('/'), fetch('/api/entourage')]);
  if (!page.ok || !saved.ok) throw new Error('Could not load the entourage. Reload the page to retry.');
  const invitation = new DOMParser().parseFromString(await page.text(), 'text/html');
  const roster = await saved.json();
  const groups = invitation.querySelectorAll('[data-entourage]');
  if (!groups.length) throw new Error('Could not find the entourage roles.');
  groups.forEach((group) => {
    const role = group.dataset.entourage;
    const defaults = group.matches('p')
      ? group.innerHTML.split(/<br\s*\/?\s*>/i).map((line) => {
        const fragment = document.createElement('template');
        fragment.innerHTML = line;
        return fragment.content.textContent;
      })
      : Array.from(group.children, (name) => name.textContent);
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.htmlFor = 'role-' + role;
    label.textContent = group.previousElementSibling.textContent;
    const input = document.createElement('textarea');
    input.id = label.htmlFor;
    input.name = role;
    const names = roster[role] ?? defaults;
    input.rows = Math.max(2, Math.min(names.length, 9));
    input.value = names.join('\n');
    field.append(label, input);
    entourageFields.append(field);
  });
  entourageStatus.textContent = '';
  saveEntourage.disabled = false;
}

loadEntourage().catch((error) => { entourageStatus.textContent = error.message; });

entourageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveEntourage.disabled = true;
  entourageStatus.textContent = 'Saving…';
  const roster = Object.fromEntries(Array.from(new FormData(entourageForm), ([role, text]) => [
    role, text.split(/\r?\n/).map((name) => name.trim()).filter(Boolean),
  ]));
  try {
    const response = await fetch('/admin/api/entourage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roster),
    });
    if (response.status === 401) throw new Error('Sign in to the admin page again.');
    if (!response.ok) throw new Error((await response.json()).error || 'Could not save the entourage.');
    entourageStatus.textContent = 'Saved. The invitation now uses these names.';
  } catch (error) {
    entourageStatus.textContent = error.message;
  } finally {
    saveEntourage.disabled = false;
  }
});
