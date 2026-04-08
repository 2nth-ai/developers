// Impi — Capital Raising Warrior chat widget

const impiHistory = [];
let impiOpen = false;
let impiBusy = false;

function impiToggle() {
  impiOpen = !impiOpen;
  document.getElementById('impi-panel').classList.toggle('open', impiOpen);
  if (impiOpen) {
    setTimeout(() => document.getElementById('impi-input').focus(), 100);
  }
}

function impiKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    impiSend();
  }
}

async function impiSend() {
  if (impiBusy) return;
  const input = document.getElementById('impi-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  impiAddMessage('user', text);
  impiHistory.push({ role: 'user', content: text });

  impiBusy = true;
  document.getElementById('impi-send').disabled = true;
  document.getElementById('impi-typing').classList.add('visible');
  impiScrollBottom();

  try {
    const res = await fetch('/api/impi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: impiHistory }),
    });
    const data = await res.json();
    const reply = data.reply || 'I was unable to respond. Please try again.';
    impiHistory.push({ role: 'assistant', content: reply });
    document.getElementById('impi-typing').classList.remove('visible');
    impiAddMessage('agent', reply);
  } catch (err) {
    document.getElementById('impi-typing').classList.remove('visible');
    impiAddMessage('agent', 'I am temporarily offline. Please try again shortly or contact Barry directly at gananda.net.');
  }

  impiBusy = false;
  document.getElementById('impi-send').disabled = false;
  input.focus();
}

function impiAddMessage(role, text) {
  const messages = document.getElementById('impi-messages');
  const div = document.createElement('div');
  div.className = `impi-msg ${role}`;
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  div.innerHTML = `<div class="impi-msg-label">${role === 'agent' ? 'Impi' : 'You'}</div><div class="impi-msg-bubble">${formatted}</div>`;
  messages.appendChild(div);
  impiScrollBottom();
}

function impiScrollBottom() {
  const messages = document.getElementById('impi-messages');
  messages.scrollTop = messages.scrollHeight;
}

// Wire up handlers once DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('impi-launcher').addEventListener('click', impiToggle);
  document.getElementById('impi-head-close').addEventListener('click', impiToggle);
  document.getElementById('impi-send').addEventListener('click', impiSend);
  document.getElementById('impi-input').addEventListener('keydown', impiKeydown);
  document.getElementById('impi-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
});
