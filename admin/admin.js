const form = document.querySelector('#createInvite');
const result = document.querySelector('#inviteResult');
const status = document.querySelector('#inviteStatus');
const linkField = document.querySelector('#inviteUrl');
const submit = form.querySelector('button');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  submit.disabled = true;
  result.hidden = true;
  status.textContent = 'Creating invitation…';
  try {
    const response = await fetch('/admin/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fields.get('name').trim(), seats: Number(fields.get('seats')) }),
    });
    if (response.status === 401) throw new Error('Sign in to the admin page again.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not create the invitation.');
    const link = new URL('/', window.location.origin);
    link.searchParams.set('invite', data.token);
    linkField.value = link.href;
    document.querySelector('#previewInvite').href = link.href;
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
