// ── Admin Login ────────────────────────────────────────────
const ADMIN_PASSWORD = '4602';

function checkLogin() {
  const input = document.getElementById('adminPassword');
  const overlay = document.getElementById('loginOverlay');
  
  if (input.value === ADMIN_PASSWORD) {
    overlay.classList.add('hidden');
    input.value = '';
  } else {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 300);
    input.value = '';
    input.focus();
  }
}

// Allow Enter key to submit
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkLogin();
  });
});

function logout() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('adminPassword').focus();
}

// ── Firebase Configuration ─────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA-VDuKUAk57A1W58zj6M7ZQOii6WrrrB4",
  databaseURL: "https://embedded-system-dd5f2-default-rtdb.asia-southeast1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ── Clock ──────────────────────────────────────────────────
function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

function updateClock() {
  document.getElementById('clock').textContent = formatTime12h(new Date());
}
updateClock();
setInterval(updateClock, 1000);

// ── Log Feed ───────────────────────────────────────────────
const logHistory = [];

function addLog(msg, isEvent = false) {
  const feed = document.getElementById('logFeed');
  const ts   = formatTime12h(new Date());

  // Store in history
  logHistory.unshift({ ts, msg, isEvent });

  const line = document.createElement('div');
  line.className = 'log-line' + (isEvent ? ' event' : '');
  line.innerHTML = `<span class="ts">${ts}</span>${msg}`;
  feed.prepend(line);

  while (feed.children.length > 4) {
    feed.removeChild(feed.lastChild);
  }
}

// Initial boot log entries
addLog('System boot complete', true);
addLog('Firebase link: ACTIVE');
addLog('NodeMCU AP ready', true);

// ── Firebase Listeners (sync UI with database) ─────────────
database.ref('/living_room').on('value', (snapshot) => {
  const state = snapshot.val();
  if (state !== null) {
    const toggle = document.getElementById('toggle-living_room');
    if (toggle.checked !== state) {
      toggle.checked = state;
      const badge = document.getElementById('badge-living_room');
      const deviceRow = badge.closest('.device-row');
      badge.textContent = 'D1 // ' + (state ? 'ON' : 'OFF');
      badge.classList.toggle('active', state);
      deviceRow.classList.toggle('active', state);
      deviceRow.classList.toggle('dimmed', !state);
    }
  }
});

database.ref('/bedroom').on('value', (snapshot) => {
  const state = snapshot.val();
  if (state !== null) {
    const toggle = document.getElementById('toggle-bedroom');
    if (toggle.checked !== state) {
      toggle.checked = state;
      const badge = document.getElementById('badge-bedroom');
      const deviceRow = badge.closest('.device-row');
      badge.textContent = 'D2 // ' + (state ? 'ON' : 'OFF');
      badge.classList.toggle('active', state);
      deviceRow.classList.toggle('active', state);
      deviceRow.classList.toggle('dimmed', !state);
    }
  }
});

database.ref('/brightness').on('value', (snapshot) => {
  const val = snapshot.val();
  if (val !== null) {
    const slider = document.getElementById('brightSlider');
    if (parseInt(slider.value) !== val) {
      slider.value = val;
      const pct = Math.round((val / 255) * 100);
      document.getElementById('brightPct').textContent = pct;
      document.getElementById('brightRaw').textContent = 'PWM VALUE // ' + val + ' / 255';
      document.getElementById('brightBar').style.width = pct + '%';
      document.getElementById('brightMid').textContent = val;
    }
  }
});

// ── Device Toggles ─────────────────────────────────────────
let activeDevices = 0;

const pinMap = {
  'living_room': 'D1',
  'bedroom': 'D2'
};

function toggleDevice(pin, state) {
  const badge = document.getElementById('badge-' + pin);
  const gpioPin = pinMap[pin] || pin;
  const deviceRow = badge.closest('.device-row');

  // Write to Firebase
  database.ref('/' + pin).set(state)
    .then(() => {
      addLog('Firebase: /' + pin + ' → ' + state, true);
    })
    .catch((error) => {
      addLog('Firebase error: ' + error.message);
    });

  if (state) {
    badge.textContent = gpioPin + ' // ON';
    badge.classList.add('active');
    deviceRow.classList.remove('dimmed');
    deviceRow.classList.add('active');
    activeDevices++;
    addLog('PIN ' + gpioPin + ' → HIGH', true);
  } else {
    badge.textContent = gpioPin + ' // OFF';
    badge.classList.remove('active');
    deviceRow.classList.remove('active');
    deviceRow.classList.add('dimmed');
    activeDevices = Math.max(0, activeDevices - 1);
    addLog('PIN ' + gpioPin + ' → LOW');
  }

  document.getElementById('activeCount').textContent = activeDevices;
  document.getElementById('lastCmd').textContent =
    new Date().toTimeString().slice(0, 5);
}

// ── Brightness / PWM ───────────────────────────────────────
function updateBrightness(val) {
  const pct = Math.round((val / 255) * 100);

  document.getElementById('brightPct').textContent  = pct;
  document.getElementById('brightRaw').textContent  = 'PWM VALUE // ' + val + ' / 255';
  document.getElementById('brightBar').style.width  = pct + '%';
  document.getElementById('brightMid').textContent  = val;

  // Write brightness to Firebase
  database.ref('/brightness').set(parseInt(val))
    .then(() => {
      addLog('Firebase: /brightness → ' + val, true);
    })
    .catch((error) => {
      addLog('Firebase error: ' + error.message);
    });

  addLog('PWM → ' + val + ' (' + pct + '%)');
}

// ── Modal ──────────────────────────────────────────────────
function toggleModal() {
  document.getElementById('teamModal').classList.toggle('active');
}

function closeOutside(event) {
  if (event.target.id === 'teamModal') {
    toggleModal();
  }
}

// ── Log History Modal ──────────────────────────────────────
function toggleLogHistory() {
  const modal = document.getElementById('logHistoryModal');
  const feed = document.getElementById('logHistoryFeed');
  
  if (!modal.classList.contains('active')) {
    // Populate with full history
    feed.innerHTML = '';
    logHistory.forEach(log => {
      const line = document.createElement('div');
      line.className = 'log-line' + (log.isEvent ? ' event' : '');
      line.innerHTML = `<span class="ts">${log.ts}</span>${log.msg}`;
      feed.appendChild(line);
    });
  }
  
  modal.classList.toggle('active');
}

function closeLogHistoryOutside(event) {
  if (event.target.id === 'logHistoryModal') {
    toggleLogHistory();
  }
}