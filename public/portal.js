// portal.js — wired via addEventListener, no inline handlers

// Auth is handled by gate.js which runs before this script.
// When gate.js completes, it fires sso:ready with the user object.
document.addEventListener('sso:ready', function(e) {
  var user = e.detail;
  var name = user.name || user.email.split('@')[0];

  // Header user bar
  var avatar = user.avatar
    ? '<img src="' + user.avatar + '" class="avatar" alt="">'
    : '<div class="avatar" style="background:rgba(8,145,178,.15);display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#0891b2">' + name[0].toUpperCase() + '</div>';

  document.getElementById('user-area').innerHTML =
    '<div class="user-bar">' +
    avatar +
    '<span class="user-name">' + name + '</span>' +
    '<a href="/api/auth/logout" class="btn btn-outline btn-sm">Sign out</a>' +
    '</div>';

  // Welcome name
  var wn = document.getElementById('welcome-name');
  if (wn) wn.textContent = name;

  // Resources username placeholder
  var ru = document.getElementById('res-username');
  if (ru) ru.textContent = user.email.split('@')[0];
});

// Tabs
function showTab(name, tabEl) {
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  tabEl.classList.add('active');
}

document.querySelectorAll('.tab[data-tab]').forEach(function(el) {
  el.addEventListener('click', function() { showTab(el.dataset.tab, el); });
});

// Submit idea
var ideaForm = document.getElementById('idea-form');
if (ideaForm) {
  ideaForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var msg = document.getElementById('idea-msg');
    var btn = document.getElementById('idea-submit');
    msg.className = 'msg';
    btn.disabled = true;
    btn.textContent = 'Submitting\u2026';

    fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('idea-title').value,
        type: document.getElementById('idea-type').value,
        description: document.getElementById('idea-desc').value,
      }),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        msg.className = 'msg show msg-success';
        msg.innerHTML = 'Idea submitted! <a href="' + data.issue_url + '" target="_blank">View on GitHub &rarr;</a>';
        ideaForm.reset();
      } else {
        msg.className = 'msg show msg-error';
        msg.textContent = data.error || 'Failed to submit.';
      }
      btn.disabled = false;
      btn.textContent = 'Submit idea';
    })
    .catch(function() {
      msg.className = 'msg show msg-error';
      msg.textContent = 'Network error. Try again.';
      btn.disabled = false;
      btn.textContent = 'Submit idea';
    });
  });
}
