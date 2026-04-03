// 2nth.ai Developer Portal — Early Access Gate
// Two-level access: platform access + partner-level access
//
// Level 1: Platform access — can see docs, portal, general pages
// Level 2: Partner access — each partner controls who sees their stack
//
// To add users: add to PLATFORM_ACCESS or PARTNER_ACCESS below

(function() {

  // ── Access control lists ──────────────────────────────────────

  // Platform admins — can see everything
  var ADMINS = [
    'craig@2nth.ai',
    'craig@imbila.ai',
    'craig@b2bs.co.za'
  ];

  // Platform access — can see general docs, portal, but NOT partner stacks
  var PLATFORM_ACCESS = ADMINS.concat([
    // Add general platform users here
  ]);

  // Partner access — each partner approves who can view their stack
  // Users listed here also get platform access automatically
  var PARTNER_ACCESS = {
    'proximity-green': [
      'craig@proximity.green',
      'mark@proximity.green'
    ],
    'dronescan': [
      // Add DroneScan approved users here
    ],
    'scanman': [
      'support@scanman.co.za'
    ],
    'agilex': [
      'craig@agilex.co.za',
      'mike@agilex.co.za'
    ]
  };

  // ── Derived lists ─────────────────────────────────────────────

  // All emails that have any access (for the initial gate)
  var ALL_ALLOWED = PLATFORM_ACCESS.slice();
  Object.keys(PARTNER_ACCESS).forEach(function(p) {
    PARTNER_ACCESS[p].forEach(function(email) {
      if (ALL_ALLOWED.indexOf(email) === -1) ALL_ALLOWED.push(email);
    });
  });

  var KEY = '2nth_dev_access';

  // ── Detect current page context ───────────────────────────────

  function getPartnerFromPath() {
    var path = window.location.pathname;
    // /partners/proximity-green.html → proximity-green
    var partnerPage = path.match(/\/partners\/([^/.]+)/);
    if (partnerPage) return partnerPage[1];
    // /preview/proximity-green/ → proximity-green
    var previewPage = path.match(/\/preview\/([^/.]+)/);
    if (previewPage) return previewPage[1];
    return null;
  }

  function canAccessPartner(email, partner) {
    if (!partner) return true; // not a partner page
    if (ADMINS.indexOf(email) !== -1) return true; // admins see everything
    var approved = PARTNER_ACCESS[partner] || [];
    return approved.indexOf(email) !== -1;
  }

  // ── Gate UI ───────────────────────────────────────────────────

  function showGate(isPartnerGate, partnerName) {
    var title = isPartnerGate ? 'Partner Access Required' : 'Developer Portal — Early Access';
    var message = isPartnerGate
      ? 'This partner stack requires approval from <strong>' + partnerName + '</strong>. Enter your authorised email to view.'
      : 'This portal is in early access preview. Enter your authorised email to continue.';
    var errorMsg = isPartnerGate
      ? 'You don\'t have access to this partner\'s stack. Contact the partner admin.'
      : 'This email is not authorised for early access.';

    var overlay = document.createElement('div');
    overlay.id = 'access-gate';
    overlay.style.cssText = 'position:fixed;inset:0;background:#faf9fc;z-index:1000;display:flex;align-items:center;justify-content:center;font-family:Barlow,sans-serif';
    overlay.innerHTML = [
      '<div style="background:#fff;border:1px solid #ede9f6;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.06)">',
      '  <div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:.04em;color:#18181b;margin-bottom:4px"><span style="color:#7c3aed">2</span>NTH</div>',
      '  <div style="font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa;margin-bottom:24px">' + title + '</div>',
      '  <p style="font-size:14px;color:#71717a;margin-bottom:24px;line-height:1.6">' + message + '</p>',
      '  <input type="email" id="gate-email" placeholder="you@company.com" style="width:100%;padding:12px 16px;border:1px solid #ede9f6;border-radius:8px;font-family:Barlow,sans-serif;font-size:14px;color:#18181b;outline:none;margin-bottom:8px;transition:border-color .15s" onfocus="this.style.borderColor=\'#7c3aed\'" onblur="this.style.borderColor=\'\'">',
      '  <div id="gate-error" style="font-size:12px;color:#dc2626;margin-bottom:12px;display:none">' + errorMsg + '</div>',
      '  <button onclick="window.__checkGate()" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;cursor:pointer;transition:background .15s">Access</button>',
      '  <p style="font-size:11px;color:#a1a1aa;margin-top:16px">Want access? <a href="mailto:craig@2nth.ai" style="color:#7c3aed">Request an invite</a></p>',
      '</div>'
    ].join('\n');
    document.body.appendChild(overlay);

    // Pre-fill if they already have platform access but need partner approval
    var stored = localStorage.getItem(KEY);
    if (stored && isPartnerGate) {
      document.getElementById('gate-email').value = stored;
    }

    var input = document.getElementById('gate-email');
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.__checkGate();
    });
    setTimeout(function() { input.focus(); }, 100);
  }

  // ── Check logic ───────────────────────────────────────────────

  var currentPartner = getPartnerFromPath();

  window.__checkGate = function() {
    var email = document.getElementById('gate-email').value.trim().toLowerCase();

    // Must have platform access
    if (ALL_ALLOWED.indexOf(email) === -1) {
      document.getElementById('gate-error').style.display = 'block';
      document.getElementById('gate-email').style.borderColor = '#dc2626';
      return;
    }

    // If on a partner page, must have partner access
    if (currentPartner && !canAccessPartner(email, currentPartner)) {
      document.getElementById('gate-error').textContent = 'You don\'t have access to this partner\'s stack. Contact the partner admin.';
      document.getElementById('gate-error').style.display = 'block';
      document.getElementById('gate-email').style.borderColor = '#dc2626';
      return;
    }

    localStorage.setItem(KEY, email);
    document.getElementById('access-gate').remove();
  };

  // ── Init ──────────────────────────────────────────────────────

  function init() {
    var stored = localStorage.getItem(KEY);
    var hasPlatformAccess = stored && ALL_ALLOWED.indexOf(stored) !== -1;

    if (!hasPlatformAccess) {
      // No platform access — show general gate
      showGate(false);
      return;
    }

    if (currentPartner && !canAccessPartner(stored, currentPartner)) {
      // Has platform access but not partner access — show partner gate
      var prettyName = currentPartner.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
      showGate(true, prettyName);
      return;
    }

    // Fully authorised — no gate needed
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
