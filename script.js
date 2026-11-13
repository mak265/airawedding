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
let initialMusicSeekDone = false;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}
async function startMusic() {
  if (!initialMusicSeekDone) {
    if (music.readyState < 1) {
      await new Promise((resolve) => music.addEventListener('loadedmetadata', resolve, { once: true }));
    }
    if (music.duration > 82) music.currentTime = 82;
    initialMusicSeekDone = true;
  }
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
$('#enterInvitation').addEventListener('click', async () => {
  await startMusic();
  welcomeGate.classList.add('dismissed');
  setTimeout(() => { welcomeGate.hidden = true; }, 850);
  showToast('Celeste is playing · Tap Music anytime to pause.');
});

const countInput = $('#attendeeCount');
const guestNamesWrap = $('#guestNamesWrap');
document.querySelectorAll('#guestCount button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('#guestCount button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    countInput.value = button.dataset.count;
    guestNamesWrap.hidden = Number(button.dataset.count) === 1;
  });
});

const form = $('#rsvpForm');
const success = $('#rsvpSuccess');
function displaySavedResponse() {
  if (localStorage.getItem('karl-aira-rsvp')) {
    form.hidden = true;
    success.hidden = false;
  }
}
displaySavedResponse();
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const response = Object.fromEntries(new FormData(form));
  response.submittedAt = new Date().toISOString();
  localStorage.setItem('karl-aira-rsvp', JSON.stringify(response));
  form.hidden = true;
  success.hidden = false;
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#editResponse').addEventListener('click', () => {
  localStorage.removeItem('karl-aira-rsvp');
  success.hidden = true;
  form.hidden = false;
});
