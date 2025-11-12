// ====== Storage Helpers ======
function getQueue() {
  try { return JSON.parse(localStorage.getItem('queueList')) || []; }
  catch { return []; }
}
function saveQueue(queue) {
  localStorage.setItem('queueList', JSON.stringify(queue));
  localStorage.setItem('queueList:lastUpdate', String(Date.now())); // trigger sync
}

// ====== Normalisasi status + kelas CSS ======
function normalizeStatus(raw) {
  if (!raw) return 'Queue';
  const s = String(raw).trim().toLowerCase();
  if (['queue','antri','antre'].includes(s)) return 'Queue';
  if (['on progress','onprogress','on-progress','progress','serve','serving','proses','dipanggil'].includes(s)) return 'On Progress';
  if (['finishing','finish','done','selesai','completed'].includes(s)) return 'Finishing';
  return 'Queue';
}
function statusClass(status) {
  const s = normalizeStatus(status);
  if (s === 'On Progress') return 'status-onprogress';
  if (s === 'Finishing')  return 'status-finishing';
  return 'status-queue';
}

// ====== Render List (admin & display) ======
function displayQueue(container, isAdmin = false) {
  const queue = getQueue();
  container.innerHTML = '';

  if (queue.length === 0) {
    container.innerHTML = '<p>Belum ada antrean.</p>';
    return;
  }

  queue.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `queue-item ${statusClass(item.status)}`;

    const safe = (v) => String(v || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
    const status = normalizeStatus(item.status);

    div.innerHTML = `
      <div><strong>${safe(item.customer)}</strong> — ${safe(item.motor)} — ${safe(item.nopol)}</div>
      <div>Status: <em>${status}</em></div>
      ${isAdmin ? `
        <div style="margin-top:8px;">
          <button ${status==='Queue' ? 'disabled' : ''} onclick="setStatus(${index}, 'Queue')">Queue</button>
          <button ${status==='On Progress' ? 'disabled' : ''} onclick="setStatus(${index}, 'On Progress')">On&nbsp;Progress</button>
          <button ${status==='Finishing' ? 'disabled' : ''} onclick="setStatus(${index}, 'Finishing')">Finishing</button>
          <button onclick="speakCall(${index})">🔊 Panggil</button>
          <button class="danger" onclick="deleteQueue(${index})">Hapus</button>
        </div>
      ` : '' }
    `;
    container.appendChild(div);
  });
}

// ====== Actions ======
function addQueue(event) {
  event.preventDefault();
  const customer = document.getElementById('customer')?.value.trim();
  const motor    = document.getElementById('motor')?.value.trim();
  const nopol    = document.getElementById('nopol')?.value.trim();
  if (!customer || !motor || !nopol) return alert('Isi semua data!');

  const queue = getQueue();
  queue.push({ customer, motor, nopol, status: 'Queue' }); // default aktif Queue
  saveQueue(queue);

  const container = document.getElementById('queueContainer');
  if (container) displayQueue(container, true);
  event.target.reset();
}

function setStatus(index, toStatus) {
  const queue = getQueue();
  if (!queue[index]) return;
  queue[index].status = normalizeStatus(toStatus);
  saveQueue(queue);

  const container = document.getElementById('queueContainer');
  if (container) displayQueue(container, !!document.getElementById('queueForm'));
  beep();
}

function deleteQueue(index) {
  if (!confirm('Yakin ingin menghapus antrean ini?')) return;
  const queue = getQueue();
  queue.splice(index, 1);
  saveQueue(queue);

  const container = document.getElementById('queueContainer');
  if (container) displayQueue(container, !!document.getElementById('queueForm'));
}

// ====== Text-to-Speech (Tetun sentence) ======

// Ubah angka menjadi "satu dua tiga" bukan "seribu dua ratus"
function spellDigits(str) {
  const map = {
    '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
    '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
  };
  return str.replace(/\d/g, d => map[d] + ' ');
}

let cachedVoice = null;
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const prefer = [
    v => /id-ID/i.test(v.lang),
    v => /pt-(PT|BR)/i.test(v.lang),
    v => /en-(ID|GB|US)/i.test(v.lang),
  ];
  for (const test of prefer) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0];
}
function ensureVoiceReady(cb) {
  const tryPick = () => {
    if (!cachedVoice) cachedVoice = pickVoice();
    cb();
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    tryPick();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      tryPick();
    };
  }
}

function speakCall(index) {
  const queue = getQueue();
  const item = queue[index];
  if (!item) return;

  const nama  = String(item.customer || '').trim();
  const motor = String(item.motor || '').trim();
  const nopolRaw = String(item.nopol || '').trim();
  const nopol = spellDigits(nopolRaw); // ubah angka jadi "satu dua tiga empat"

  // Kalimat Tetun
  const sentence = `Panggilan kepada pemilik motor atas nama ${nama}, dengan motor ${motor}, dengan nomor polisi ${nopol}, silahkan melakukan pembayaran ke kasir, terima kasih telah melakukan servis motor di kaibete motor.`;

  // Hentikan speech lain yang mungkin masih jalan
  window.speechSynthesis.cancel();

  ensureVoiceReady(() => {
    const utter = new SpeechSynthesisUtterance(sentence);
    if (cachedVoice) utter.voice = cachedVoice;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    window.speechSynthesis.speak(utter);
  });
}

// ====== Clock (index.html) ======
function updateClock() {
  const clock = document.getElementById('clock');
  if (!clock) return;
  clock.textContent = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ====== Real-time Sync antar tab/halaman ======
window.addEventListener('storage', (e) => {
  if (e.key === 'queueList' || e.key === 'queueList:lastUpdate') {
    const container = document.getElementById('queueContainer');
    if (container) {
      const isAdmin = !!document.getElementById('queueForm');
      displayQueue(container, isAdmin);
    }
  }
});

// ====== Bootstrap per halaman ======
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('queueContainer');
  if (!container) return;

  const form = document.getElementById('queueForm');
  if (form) {
    form.addEventListener('submit', addQueue);
    displayQueue(container, true);
  } else {
    displayQueue(container, false);
  }
});

// ====== Beep kecil (opsional) ======
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start(); setTimeout(() => osc.stop(), 180);
  } catch { /* ignore */ }
}
