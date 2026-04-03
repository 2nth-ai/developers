// SSO gate — validates 2nth_session via server, redirects to 2nth.ai if not signed in
// Include this script in any page that requires authentication.
// Set window.GATE_RETURN_PATH before including, or it defaults to the current page.

(async function () {
  const signInUrl = '/?return=' + encodeURIComponent(window.location.pathname);

  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    const data = await res.json();

    if (!data.user) {
      window.location.replace(signInUrl);
      return;
    }

    // Expose current user globally for page scripts
    window.CURRENT_USER = data.user;

    // Dispatch event so pages can react
    document.dispatchEvent(new CustomEvent('sso:ready', { detail: data.user }));

  } catch {
    window.location.replace(signInUrl);
  }
})();
