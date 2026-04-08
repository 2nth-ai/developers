// Auth gate — validates session, redirects to sign-in if not authenticated.
// Include in any page that requires authentication.
// Fires `sso:ready` event with the current user once validated.

(async function () {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('return') || window.location.pathname;
  const signInUrl = '/?return=' + encodeURIComponent(returnTo);

  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });

    if (!res.ok) {
      window.location.replace(signInUrl);
      return;
    }

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
