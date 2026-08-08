export async function onRequestGet(context) {
  const { env } = context;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({
      error: 'Notion integration is not configured',
      missing: [
        !env.NOTION_TOKEN ? 'NOTION_TOKEN' : null,
        !env.NOTION_DATABASE_ID ? 'NOTION_DATABASE_ID' : null,
      ].filter(Boolean),
    }, 500);
  }

  const url = `https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 100 }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return json({ error: 'Failed to fetch Notion database', status: response.status, detail }, 502);
  }

  const data = await response.json();
  const words = (data.results || [])
    .map(page => {
      const props = page.properties || {};
      const word = readText(props.Word);
      const meaning = readText(props.Meaning);
      if (!word || !meaning) return null;
      return { word: word.trim().toLowerCase(), clue: meaning.trim() };
    })
    .filter(Boolean)
    .filter(item => /^[a-z][a-z -]*$/i.test(item.word));

  return json({ words }, 200, {
    'Cache-Control': 'public, max-age=60, s-maxage=300',
  });
}

function readText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return (prop.title || []).map(x => x.plain_text || '').join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(x => x.plain_text || '').join('');
  if (prop.type === 'formula' && prop.formula?.type === 'string') return prop.formula.string || '';
  return '';
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}
