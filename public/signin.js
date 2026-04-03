var currentEmail = '';

fetch('/api/auth/session', { credentials: 'include' })
  .then(function(r) { return r.json(); })
  .then(function(d) { if (d.user) window.location.href = '/portal.html'; })
  .catch(function() {});

function showMsg(text, type) {
  var msg = document.getElementById('msg');
  msg.className = 'msg show msg-' + type;
  msg.textContent = text;
}

function clearMsg() {
  var msg = document.getElementById('msg');
  msg.className = 'msg';
  msg.textContent = '';
}

function sendCode() {
  clearMsg();
  var email = document.getElementById('email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showMsg('Enter a valid email address.', 'err');
    return;
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email }),
  })
  .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
  .then(function(r) {
    if (!r.res.ok || !r.data.ok) throw new Error(r.data.error || 'Failed to send');
    currentEmail = email;
    document.getElementById('emailStep').style.display = 'none';
    document.getElementById('codeStep').classList.add('show');
    showMsg('Code sent — check your inbox.', 'ok');
    document.getElementById('code').focus();
  })
  .catch(function(e) { showMsg(e.message, 'err'); });
}

function verifyCode() {
  clearMsg();
  var code = document.getElementById('code').value.trim();
  if (code.length !== 6) {
    showMsg('Enter the 6-digit code from your email.', 'err');
    return;
  }

  var btn = document.getElementById('verifyBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying\u2026';

  fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentEmail, code: code }),
  })
  .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
  .then(function(r) {
    if (!r.res.ok || !r.data.ok) throw new Error(r.data.error || 'Invalid code');
    window.location.href = '/portal.html';
  })
  .catch(function(e) {
    showMsg(e.message, 'err');
    btn.disabled = false;
    btn.textContent = 'Verify code';
  });
}

function resendCode() {
  clearMsg();
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentEmail }),
  })
  .then(function() {
    showMsg('New code sent.', 'ok');
    document.getElementById('code').value = '';
    document.getElementById('code').focus();
  })
  .catch(function() {});
}

document.getElementById('sendBtn').addEventListener('click', sendCode);
document.getElementById('verifyBtn').addEventListener('click', verifyCode);
document.getElementById('resendBtn').addEventListener('click', resendCode);
document.getElementById('email').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendCode();
});
document.getElementById('code').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') verifyCode();
});
