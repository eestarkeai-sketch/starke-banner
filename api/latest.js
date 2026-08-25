// GET /api/latest -> 302 redirect to the latest essay (keeps the signature link evergreen).
const PUB = 'https://thestarkeperspective.substack.com';
const FEED = PUB + '/feed';

module.exports = async (req, res) => {
  let link = PUB;
  try {
    const xml = await (await fetch(FEED, { headers: { 'user-agent': 'starke-banner' } })).text();
    const item = (xml.match(/<item>([\s\S]*?)<\/item>/) || [])[1] || '';
    const m = item.match(/<link>([\s\S]*?)<\/link>/);
    if (m) link = m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() || PUB;
  } catch (e) { link = PUB; }
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400');
  res.writeHead(302, { Location: link });
  res.end();
};
