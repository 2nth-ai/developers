var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/auth/callback.js
async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return Response.redirect(`${env.SITE_URL}/?error=no_code`, 302);
  }
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI
    })
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    return Response.redirect(`${env.SITE_URL}/?error=auth_failed`, 302);
  }
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "2nth-developers"
    }
  });
  const user = await userRes.json();
  const session = JSON.stringify({
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
    id: user.id
  });
  const sessionB64 = btoa(session);
  const maxAge = 60 * 60 * 24 * 7;
  const headers = new Headers({ Location: `${env.SITE_URL}/portal.html` });
  headers.append("Set-Cookie", `dev_session=${sessionB64}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  headers.append("Set-Cookie", `dev_user=${sessionB64}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  headers.append("Set-Cookie", `dev_gh_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
  return new Response(null, { status: 302, headers });
}
__name(onRequestGet, "onRequestGet");

// api/auth/login.js
async function onRequestGet2(context) {
  const { env } = context;
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: "read:user user:email public_repo",
    state
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `gh_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}
__name(onRequestGet2, "onRequestGet");

// api/auth/logout.js
async function onRequestGet3(context) {
  const { env } = context;
  const headers = new Headers({ Location: env.SITE_URL || "/" });
  headers.append("Set-Cookie", "dev_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "dev_user=; Path=/; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "dev_gh_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 302, headers });
}
__name(onRequestGet3, "onRequestGet");

// api/auth/session.js
function b64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
__name(b64urlDecode, "b64urlDecode");
async function validateSSOToken(cookieHeader, jwtSecret) {
  const match2 = (cookieHeader || "").match(/2nth_session=([^\s;]+)/);
  if (!match2) return null;
  const [h, p, s] = match2[1].split(".");
  if (!h || !p || !s) return null;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(s),
      enc.encode(`${h}.${p}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(validateSSOToken, "validateSSOToken");
async function onRequestGet4(context) {
  const { request, env } = context;
  const payload = await validateSSOToken(
    request.headers.get("Cookie"),
    env.JWT_SECRET
  );
  if (!payload) return Response.json({ user: null }, { status: 401 });
  return Response.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.email.split("@")[0],
      role: payload.role || "user",
      tier: payload.tier || "explorer"
    }
  });
}
__name(onRequestGet4, "onRequestGet");

// api/enquiry.js
async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, company, email, interest, space_type, message, partner } = body;
  if (!name || !email || !company) {
    return Response.json({ error: "Name, company, and email are required" }, { status: 400 });
  }
  const emailHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin-bottom:16px;font-weight:700">2NTH.AI \u2014 NEW ENQUIRY</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#71717a;width:100px">Name</td><td style="padding:8px 0;color:#18181b;font-weight:600">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Company</td><td style="padding:8px 0;color:#18181b;font-weight:600">${escapeHtml(company)}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(email)}" style="color:#7c3aed">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Interest</td><td style="padding:8px 0;color:#18181b">${escapeHtml(interest || "Not specified")}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a">Space type</td><td style="padding:8px 0;color:#18181b">${escapeHtml(space_type || "Not specified")}</td></tr>
        ${partner ? `<tr><td style="padding:8px 0;color:#71717a">Partner</td><td style="padding:8px 0;color:#18181b">${escapeHtml(partner)}</td></tr>` : ""}
      </table>
      ${message ? `<div style="margin-top:16px;padding:16px;background:#f5f3ff;border-radius:8px;font-size:14px;color:#44403c;line-height:1.6">${escapeHtml(message)}</div>` : ""}
      <div style="margin-top:24px;font-size:11px;color:#a1a1aa">Sent from developers.2nth.ai</div>
    </div>
  `;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "2nth.ai <hello@2nth.ai>",
        to: ["craig@2nth.ai"],
        reply_to: email,
        subject: `[2NTH] Enquiry: ${company} \u2014 ${interest || "general"}`,
        html: emailHtml
      })
    });
    if (!res.ok) {
      return Response.json({ error: "Failed to send enquiry" }, { status: 502 });
    }
  } catch {
    return Response.json({ error: "Failed to send enquiry" }, { status: 502 });
  }
  return Response.json({ success: true });
}
__name(onRequestPost, "onRequestPost");
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml, "escapeHtml");

// api/ideas.js
async function onRequestPost2(context) {
  const { request, env } = context;
  const cookie = request.headers.get("Cookie") || "";
  const match2 = cookie.match(/dev_session=([^\s;]+)/);
  if (!match2) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  let user;
  try {
    user = JSON.parse(atob(match2[1]));
  } catch {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, type, description } = body;
  if (!title || !description) {
    return Response.json({ error: "Title and description required" }, { status: 400 });
  }
  const validTypes = ["feature", "skill", "integration", "improvement", "other"];
  const ideaType = validTypes.includes(type) ? type : "other";
  const issueBody = `## Idea submitted via Developer Portal

**Type:** ${ideaType}
**Submitted by:** @${user.login}

---

${description}

---
*Submitted from [developers.2nth.ai](${env.SITE_URL})*`;
  const res = await fetch("https://api.github.com/repos/2nth-ai/code-review/issues", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "2nth-developers"
    },
    body: JSON.stringify({
      title: `[Idea] ${title}`,
      body: issueBody,
      labels: ["idea", ideaType]
    })
  });
  if (!res.ok) {
    return Response.json({ error: "Failed to submit idea" }, { status: 502 });
  }
  const issue = await res.json();
  return Response.json({
    success: true,
    issue_url: issue.html_url,
    issue_number: issue.number
  });
}
__name(onRequestPost2, "onRequestPost");

// api/register.js
async function onRequestPost3(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, company, email, phone, space_type, sites, country, needs, partner } = body;
  if (!name || !email || !company) {
    return Response.json({ error: "Name, company, and email are required" }, { status: 400 });
  }
  const partners = {
    "proximity-green": {
      resendKey: env.RESEND_API_KEY_PG,
      from: "Proximity Green <hello@proximity.green>",
      brandName: "Proximity Green",
      brandColor: "#059669",
      portalUrl: "https://proximity.green",
      notifyTo: ["craig@proximity.green", "craig@2nth.ai"]
    }
  };
  const config = partners[partner];
  if (!config || !config.resendKey) {
    return forwardTo2nth(env, body);
  }
  const welcomeHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:0">
      <div style="background:${config.brandColor};padding:24px 28px;border-radius:12px 12px 0 0">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em">${config.brandName}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px">AI Skills Hub</div>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #e7e5e4;border-top:none;border-radius:0 0 12px 12px">
        <div style="font-size:18px;font-weight:700;color:#1c1917;margin-bottom:12px">Welcome, ${escapeHtml2(name)}</div>
        <p style="font-size:14px;color:#57534e;line-height:1.6;margin-bottom:16px">
          Thanks for registering with ${config.brandName}. Your AI-powered workspace is ready \u2014 you have <strong>50,000 free tokens</strong> to explore our skills.
        </p>
        <div style="background:#f5f5f4;border-radius:8px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin-bottom:8px">Your registration</div>
          <table style="font-size:13px;color:#44403c;width:100%">
            <tr><td style="padding:3px 0;color:#78716c;width:90px">Company</td><td style="padding:3px 0;font-weight:600">${escapeHtml2(company)}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Space type</td><td style="padding:3px 0">${escapeHtml2(space_type || "Not specified")}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Sites</td><td style="padding:3px 0">${escapeHtml2(sites || "Not specified")}</td></tr>
            <tr><td style="padding:3px 0;color:#78716c">Country</td><td style="padding:3px 0">${escapeHtml2(country || "Not specified")}</td></tr>
          </table>
        </div>
        <a href="https://2nth.ai/join.html" style="display:inline-block;background:${config.brandColor};color:#fff;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.5px">Explore skills &rarr;</a>
        <p style="font-size:12px;color:#a8a29e;margin-top:20px;line-height:1.5">
          A member of our team will reach out within 24 hours to schedule a discovery call and help configure your workspace.
        </p>
      </div>
    </div>
  `;
  const welcomeRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: `Welcome to ${config.brandName} \u2014 your AI workspace is ready`,
      html: welcomeHtml
    })
  });
  const notifyHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${config.brandColor};margin-bottom:16px;font-weight:700">${config.brandName} \u2014 NEW REGISTRATION</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#78716c;width:100px">Name</td><td style="padding:8px 0;color:#1c1917;font-weight:600">${escapeHtml2(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Company</td><td style="padding:8px 0;color:#1c1917;font-weight:600">${escapeHtml2(company)}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml2(email)}" style="color:${config.brandColor}">${escapeHtml2(email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${escapeHtml2(phone || "\u2014")}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Space type</td><td style="padding:8px 0;color:#1c1917">${escapeHtml2(space_type || "\u2014")}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Sites</td><td style="padding:8px 0;color:#1c1917">${escapeHtml2(sites || "\u2014")}</td></tr>
        <tr><td style="padding:8px 0;color:#78716c">Country</td><td style="padding:8px 0;color:#1c1917">${escapeHtml2(country || "\u2014")}</td></tr>
      </table>
      ${needs ? `<div style="margin-top:16px;padding:16px;background:#f5f5f4;border-radius:8px;font-size:14px;color:#44403c;line-height:1.6"><strong>What they need:</strong><br>${escapeHtml2(needs)}</div>` : ""}
      <div style="margin-top:20px;font-size:12px;color:#a8a29e">Lead stage: <strong>Registered</strong> &rarr; Schedule discovery call</div>
    </div>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: config.notifyTo,
      reply_to: email,
      subject: `[Lead] ${company} \u2014 ${space_type || "new registration"}`,
      html: notifyHtml
    })
  });
  return Response.json({ success: true });
}
__name(onRequestPost3, "onRequestPost");
async function forwardTo2nth(env, body) {
  if (!env.RESEND_API_KEY) {
    return Response.json({ success: true });
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "2nth.ai <hello@2nth.ai>",
      to: ["craig@2nth.ai"],
      reply_to: body.email,
      subject: `[Registration] ${body.company} \u2014 ${body.partner || "direct"}`,
      html: `<pre>${JSON.stringify(body, null, 2)}</pre>`
    })
  });
  return Response.json({ success: true });
}
__name(forwardTo2nth, "forwardTo2nth");
function escapeHtml2(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml2, "escapeHtml");

// ../.wrangler/tmp/pages-TbNM6A/functionsRoutes-0.9919163660865771.mjs
var routes = [
  {
    routePath: "/api/auth/callback",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/auth/session",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/enquiry",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/ideas",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/register",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  }
];

// ../../../.nvm/versions/node/v20.19.5/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../.nvm/versions/node/v20.19.5/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
