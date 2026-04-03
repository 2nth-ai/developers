// 2nth.ai Developer Portal — Early Access Gate
// Shared across all pages. Checks localStorage for authorised email.

(function() {
  var ALLOWED = [
    'craig@2nth.ai',
    'craig@imbila.ai',
    'craig@proximity.green',
    'mark@proximity.green',
    'support@scanman.co.za',
    'craig@agilex.co.za',
    'mike@agilex.co.za'
  ];

  var KEY = '2nth_dev_access';

  function isAuthorised() {
    var stored = localStorage.getItem(KEY);
    return stored && ALLOWED.indexOf(stored) !== -1;
  }

  function showGate() {
    var overlay = document.createElement('div');
    overlay.id = 'access-gate';
    overlay.style.cssText = 'position:fixed;inset:0;background:#faf9fc;z-index:1000;display:flex;align-items:center;justify-content:center;font-family:Barlow,sans-serif';
    overlay.innerHTML = [
      '<div style="background:#fff;border:1px solid #ede9f6;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.06)">',
      '  <div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:.04em;color:#18181b;margin-bottom:4px"><span style="color:#7c3aed">2</span>NTH</div>',
      '  <div style="font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa;margin-bottom:24px">Developer Portal — Early Access</div>',
      '  <p style="font-size:14px;color:#71717a;margin-bottom:24px;line-height:1.6">This portal is in early access preview. Enter your authorised email to continue.</p>',
      '  <input type="email" id="gate-email" placeholder="you@company.com" style="width:100%;padding:12px 16px;border:1px solid #ede9f6;border-radius:8px;font-family:Barlow,sans-serif;font-size:14px;color:#18181b;outline:none;margin-bottom:8px;transition:border-color .15s" onfocus="this.style.borderColor=\'#7c3aed\'" onblur="this.style.borderColor=\'\'">',
      '  <div id="gate-error" style="font-size:12px;color:#dc2626;margin-bottom:12px;display:none">This email is not authorised for early access.</div>',
      '  <button onclick="window.__checkGate()" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;cursor:pointer;transition:background .15s">Access portal</button>',
      '  <p style="font-size:11px;color:#a1a1aa;margin-top:16px">Want access? <a href="mailto:craig@2nth.ai" style="color:#7c3aed">Request an invite</a></p>',
      '</div>'
    ].join('\n');
    document.body.appendChild(overlay);

    var input = document.getElementById('gate-email');
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.__checkGate();
    });
    setTimeout(function() { input.focus(); }, 100);
  }

  window.__checkGate = function() {
    var email = document.getElementById('gate-email').value.trim().toLowerCase();
    if (ALLOWED.indexOf(email) !== -1) {
      localStorage.setItem(KEY, email);
      document.getElementById('access-gate').remove();
    } else {
      document.getElementById('gate-error').style.display = 'block';
      document.getElementById('gate-email').style.borderColor = '#dc2626';
    }
  };

  if (!isAuthorised()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showGate);
    } else {
      showGate();
    }
  }
})();
