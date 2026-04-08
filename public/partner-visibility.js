// partner-visibility.js — owner-only invite + access panel
// Reads data-partner="key" from <body>. Self-hides for non-owners.
(function () {
  var key = document.body.getAttribute('data-partner');
  if (!key) return;

  var css = `
    #pv-widget{position:fixed;bottom:20px;right:20px;z-index:9999;font-family:'JetBrains Mono',monospace;font-size:12px}
    #pv-btn{background:#18181b;border:1px solid #3f3f46;color:#e4e4e7;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1px;padding:8px 14px;border-radius:6px;cursor:pointer;text-transform:uppercase}
    #pv-btn:hover{border-color:#7c3aed}
    #pv-panel{display:none;margin-bottom:8px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;min-width:320px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,.14);overflow:hidden}
    #pv-panel.open{display:block}
    .pv-tabs{display:flex;border-bottom:1px solid #f4f4f5}
    .pv-tab{flex:1;padding:10px;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;color:#a1a1aa;border-bottom:2px solid transparent}
    .pv-tab.active{color:#7c3aed;border-bottom-color:#7c3aed}
    .pv-body{padding:16px}
    .pv-section{display:none}.pv-section.active{display:block}
    .pv-label{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#71717a;margin-bottom:6px}
    .pv-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #f4f4f5;border-radius:6px;margin-bottom:6px;font-size:11px}
    .pv-row .em{flex:1;color:#18181b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pv-row .meta{color:#a1a1aa;font-size:10px;white-space:nowrap}
    .pv-badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;letter-spacing:.5px}
    .pv-badge.active{background:rgba(5,150,105,.08);border:1px solid rgba(5,150,105,.2);color:#059669}
    .pv-badge.revoked{background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);color:#dc2626}
    .pv-revoke{background:none;border:1px solid #fecaca;color:#dc2626;border-radius:4px;padding:2px 8px;font-size:9px;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:.5px}
    .pv-revoke:hover{background:#fef2f2}
    .pv-input-row{display:flex;gap:8px;margin-top:12px}
    .pv-input{flex:1;padding:7px 10px;border:1px solid #e4e4e7;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none}
    .pv-input:focus{border-color:#7c3aed}
    .pv-invite-btn{background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
    .pv-invite-btn:hover{background:#6d28d9}
    .pv-msg{font-size:10px;margin-top:8px;min-height:14px}
    .pv-msg.ok{color:#059669}.pv-msg.err{color:#dc2626}
    .pv-empty{color:#a1a1aa;font-size:11px;text-align:center;padding:16px 0}
    .pv-log-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f9fafb;font-size:10px}
    .pv-log-row .pv-path{color:#52525b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .pv-log-row .pv-time{color:#a1a1aa;white-space:nowrap;margin-left:8px}
  `;
  var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  var widget = document.createElement('div');
  widget.id = 'pv-widget';
  widget.innerHTML = `
    <div id="pv-panel">
      <div class="pv-tabs">
        <div class="pv-tab active" data-pv="invites">Invites</div>
        <div class="pv-tab" data-pv="log">Access log</div>
      </div>
      <div class="pv-body">
        <div class="pv-section active" id="pv-invites">
          <div class="pv-label">Who can view this page</div>
          <div id="pv-invite-list"><div class="pv-empty">Loading…</div></div>
          <div class="pv-input-row">
            <input class="pv-input" id="pv-email" type="email" placeholder="invite@email.com">
            <button class="pv-invite-btn" id="pv-grant">Invite</button>
          </div>
          <div class="pv-msg" id="pv-imsg"></div>
        </div>
        <div class="pv-section" id="pv-log">
          <div class="pv-label">Recent access</div>
          <div id="pv-log-list"><div class="pv-empty">Loading…</div></div>
        </div>
      </div>
    </div>
    <button id="pv-btn">&#128100; Sharing</button>
  `;
  document.body.appendChild(widget);

  var panel  = document.getElementById('pv-panel');
  var btn    = document.getElementById('pv-btn');
  var imsg   = document.getElementById('pv-imsg');
  var emailInput = document.getElementById('pv-email');
  var grantBtn   = document.getElementById('pv-grant');
  var loaded = false;
  var inviteData = [];

  btn.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !loaded) loadData();
  });

  // Tabs
  document.querySelectorAll('.pv-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.pv-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.pv-section').forEach(function (s) { s.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('pv-' + tab.dataset.pv).classList.add('active');
    });
  });

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }); }
    catch { return iso; }
  }

  function renderInvites(invites) {
    var list = document.getElementById('pv-invite-list');
    var active = invites.filter(function (i) { return i.active; });
    if (!active.length) { list.innerHTML = '<div class="pv-empty">No active invites</div>'; return; }
    list.innerHTML = active.map(function (i) {
      return `<div class="pv-row">
        <span class="em">${i.email}</span>
        <span class="meta">${fmtDate(i.grantedAt)}</span>
        <span class="pv-badge active">Active</span>
        <button class="pv-revoke" data-email="${i.email}">Revoke</button>
      </div>`;
    }).join('');
    list.querySelectorAll('.pv-revoke').forEach(function (rb) {
      rb.addEventListener('click', function () { revokeInvite(rb.dataset.email); });
    });
  }

  function renderLog(logs) {
    var list = document.getElementById('pv-log-list');
    if (!logs.length) { list.innerHTML = '<div class="pv-empty">No access recorded yet</div>'; return; }
    list.innerHTML = logs.slice(0, 30).map(function (l) {
      return `<div class="pv-log-row">
        <span class="pv-path">${l.email || '?'} — ${l.path}</span>
        <span class="pv-time">${fmtDate(l.ts)}</span>
      </div>`;
    }).join('');
  }

  function loadData() {
    fetch('/api/partner/invite?key=' + encodeURIComponent(key), { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) { widget.style.display = 'none'; return; }
        loaded = true;
        inviteData = data.invites || [];
        renderInvites(inviteData);
        renderLog(data.accessLog || []);
      })
      .catch(function () { widget.style.display = 'none'; });
  }

  grantBtn.addEventListener('click', function () {
    var email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) { showMsg('Enter a valid email', 'err'); return; }
    grantBtn.disabled = true;
    fetch('/api/partner/invite', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerKey: key, email: email }),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      grantBtn.disabled = false;
      if (d.granted) {
        showMsg('Invite sent to ' + email, 'ok');
        emailInput.value = '';
        inviteData.push(d.invite);
        renderInvites(inviteData);
      } else {
        showMsg(d.error || 'Failed', 'err');
      }
    })
    .catch(function () { grantBtn.disabled = false; showMsg('Network error', 'err'); });
  });

  function revokeInvite(email) {
    fetch('/api/partner/invite', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerKey: key, email: email }),
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.revoked) {
        inviteData = inviteData.map(function (i) {
          return i.email === email ? Object.assign({}, i, { active: false }) : i;
        });
        renderInvites(inviteData);
        showMsg(email + ' revoked', 'ok');
      }
    });
  }

  function showMsg(txt, cls) {
    imsg.textContent = txt;
    imsg.className = 'pv-msg ' + cls;
    setTimeout(function () { imsg.textContent = ''; imsg.className = 'pv-msg'; }, 4000);
  }
})();
