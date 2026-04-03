// POST /api/ideas — submit an idea as a GitHub issue in code-review repo
export async function onRequestPost(context) {
  const { request, env } = context;

  // Check session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/dev_session=([^\s;]+)/);
  if (!match) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  let user;
  try { user = JSON.parse(atob(match[1])); } catch {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, type, description } = body;
  if (!title || !description) {
    return Response.json({ error: 'Title and description required' }, { status: 400 });
  }

  const validTypes = ['feature', 'skill', 'integration', 'improvement', 'other'];
  const ideaType = validTypes.includes(type) ? type : 'other';

  // Create issue in code-review repo via GitHub API
  const issueBody = `## Idea submitted via Developer Portal

**Type:** ${ideaType}
**Submitted by:** @${user.login}

---

${description}

---
*Submitted from [developers.2nth.ai](${env.SITE_URL})*`;

  const res = await fetch('https://api.github.com/repos/2nth-ai/code-review/issues', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': '2nth-developers',
    },
    body: JSON.stringify({
      title: `[Idea] ${title}`,
      body: issueBody,
      labels: ['idea', ideaType],
    }),
  });

  if (!res.ok) {
    return Response.json({ error: 'Failed to submit idea' }, { status: 502 });
  }

  const issue = await res.json();
  return Response.json({
    success: true,
    issue_url: issue.html_url,
    issue_number: issue.number,
  });
}
