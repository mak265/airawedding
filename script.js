const weddingDate = new Date('2027-01-05T14:00:00+08:00');
const $ = (selector) => document.querySelector(selector);

function updateCountdown() {
  const distance = weddingDate.getTime() - Date.now();
  const values = distance <= 0
    ? [0, 0, 0, 0]
    : [
        Math.floor(distance / 86400000),
        Math.floor((distance % 86400000) / 3600000),
        Math.floor((distance % 3600000) / 60000),
        Math.floor((distance % 60000) / 1000),
      ];
  ['days', 'hours', 'minutes', 'seconds'].forEach((id, index) => {
    document.getElementById(id).textContent = String(values[index]).padStart(index ? 2 : 1, '0');
  });
}
updateCountdown();
setInterval(updateCountdown, 1000);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const musicToggle = $('#musicToggle');
const musicLabel = musicToggle.querySelector('.music-label');
const music = $('#bgMusic');
const toast = $('#toast');
let toastTimer;
let musicPlaying = false;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}
async function startMusic() {
  try {
    await music.play();
    musicPlaying = true;
    musicToggle.classList.add('playing');
    musicToggle.setAttribute('aria-pressed', 'true');
    musicToggle.setAttribute('aria-label', 'Pause background music');
    musicLabel.textContent = 'Playing';
    return true;
  } catch {
    showToast('Tap Music once to allow audio on this browser.');
    return false;
  }
}
function stopMusic() {
  music.pause();
  musicPlaying = false;
  musicToggle.classList.remove('playing');
  musicToggle.setAttribute('aria-pressed', 'false');
  musicToggle.setAttribute('aria-label', 'Play background music');
  musicLabel.textContent = 'Music';
}
musicToggle.addEventListener('click', async () => {
  if (musicPlaying) stopMusic();
  else await startMusic();
});

const welcomeGate = $('#welcomeGate');
$('#enterInvitation').addEventListener('click', () => {
  const firstPage = new URL(window.location.href);
  firstPage.hash = '';
  window.history.replaceState(window.history.state, '', firstPage);
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  welcomeGate.classList.add('dismissed');
  setTimeout(() => { welcomeGate.hidden = true; }, 850);
  startMusic().then((playing) => {
    if (playing) showToast('Until I Found You · Violin cover');
  });
}, { once: true });

async function showGuestReservation() {
  const token = new URLSearchParams(window.location.search).get('invite');
  if (token === null) return;
  const reservation = $('#guestReservation');
  reservation.hidden = false;
  $('#reservedSeats').textContent = 'Loading reserved seats…';
  try {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('invalid link');
    const response = await fetch('/api/invites/' + token);
    if (!response.ok) throw new Error('reservation unavailable');
    const { name, seats } = await response.json();
    $('#invitedGuest').textContent = name;
    $('#reservedSeats').textContent = seats === 1
      ? 'We have reserved 1 seat for you.'
      : `We have reserved ${seats} seats for you.`;
  } catch {
    $('#reservedSeats').textContent = 'Reserved seats could not be loaded. Please check your invitation link.';
  }
}
showGuestReservation();

fetch('/api/entourage').then(async (response) => {
  if (!response.ok) return;
  const roster = await response.json();
  document.querySelectorAll('[data-entourage]').forEach((group) => {
    const names = roster[group.dataset.entourage];
    if (!Array.isArray(names)) return;
    if (group.matches('p')) {
      group.replaceChildren();
      names.forEach((name, index) => {
        if (index) group.append(document.createElement('br'));
        group.append(name);
      });
      return;
    }
    const tag = group.matches('.names') ? 'span' : 'strong';
    group.replaceChildren(...names.map((name) => {
      const item = document.createElement(tag);
      item.textContent = name;
      return item;
    }));
  });
}).catch(() => {
  // Keep the original invitation roster if the API is unavailable.
});
