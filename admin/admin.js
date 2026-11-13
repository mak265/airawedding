const form = document.querySelector('#createInvite');
const result = document.querySelector('#inviteResult');
const status = document.querySelector('#inviteStatus');
const linkField = document.querySelector('#inviteUrl');
const submit = form.querySelector('button');
const guestLinks = document.querySelector('#guestLinks');
const search = document.querySelector('#findInvite');
const linksStatus = document.querySelector('#linksStatus');
const linkTemplate = document.querySelector('#guestLinkTemplate');

function guestUrl(token) {
  return new URL('/i/' + token, 'https://karlandairawedding.duckdns.org').href;
}

async function inviteRequest(path = '', options) {
  const response = await fetch('/admin/api/invites' + path, options);
  if (response.status === 401) throw new Error('Sign in to the admin page again.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete the request.');
  return data;
}

function postJson(data) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function filterLinks() {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of guestLinks.children) {
    card.hidden = !card.dataset.guestName.includes(term);
    if (!card.hidden) visible++;
  }
  linksStatus.textContent = visible
    ? `${visible} of ${guestLinks.childElementCount} guest links`
    : guestLinks.childElementCount ? 'No matching guest links.' : 'No guest links yet.';
}

function makeLinkCard(invite) {
  const card = linkTemplate.content.firstElementChild.cloneNode(true);
  const { name, seats, active } = card.elements;
  const feedback = card.querySelector('.link-feedback');
  const save = card.querySelector('[type="submit"], .submit-btn');
  const preview = card.querySelector('a');
  const copy = card.querySelector('[data-copy]');
  const url = guestUrl(invite.token);
  name.value = invite.name;
  seats.value = invite.seats;
  active.checked = invite.active;
  card.dataset.guestName = invite.name.toLowerCase();
  preview.href = url;

  function updateActions(isActive) {
    preview.hidden = !isActive;
    copy.disabled = !isActive;
  }
  updateActions(invite.active);

  card.addEventListener('submit', async (event) => {
    event.preventDefault();
    const changes = { name: name.value.trim(), seats: Number(seats.value), active: active.checked };
    save.disabled = true;
    try {
      await inviteRequest('/' + invite.token, postJson(changes));
      card.dataset.guestName = changes.name.toLowerCase();
      updateActions(changes.active);
      feedback.textContent = changes.active ? 'Saved. The same link is active.' : 'Saved. This link is inactive.';
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      feedback.textContent = 'Link copied.';
    } catch {
      feedback.textContent = url;
    }
  });
  return card;
}

async function loadLinks() {
  submit.disabled = true;
  linksStatus.textContent = 'Loading guest links…';
  try {
    const invites = await inviteRequest();
    guestLinks.replaceChildren(...invites.map(makeLinkCard));
    filterLinks();
  } catch (error) {
    linksStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

search.addEventListener('input', filterLinks);
loadLinks();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  submit.disabled = true;
  result.hidden = true;
  status.textContent = 'Creating invitation…';
  try {
    const invite = { name: fields.get('name').trim(), seats: Number(fields.get('seats')), active: true };
    const { token } = await inviteRequest('', postJson(invite));
    const link = guestUrl(token);
    linkField.value = link;
    document.querySelector('#previewInvite').href = link;
    guestLinks.prepend(makeLinkCard({ ...invite, token }));
    search.value = '';
    filterLinks();
    result.hidden = false;
    status.textContent = 'Guest link ready.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#copyInvite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(linkField.value);
    status.textContent = 'Link copied.';
  } catch {
    linkField.select();
    status.textContent = 'Copy the selected link.';
  }
});
