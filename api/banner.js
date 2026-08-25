// GET /api/banner -> a JPEG banner for the latest Starke Perspective essay.
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const PUB = 'https://thestarkeperspective.substack.com';
const FEED = PUB + '/feed';
const W = 1200, H = 312;
const GOLD = '#B49B5F', CREAM = '#F7F6F2', CHAR = '#1E1E24';

let fontsReady = false;
async function ensureFonts() {
  if (fontsReady) return;
  const files = { PoppinsBold: 'Poppins-Bold.ttf', PoppinsMedium: 'Poppins-Medium.ttf' };
  const bases = [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/',
  ];
  try {
    for (const [alias, file] of Object.entries(files)) {
      let done = false;
      for (const base of bases) {
        try {
          const r = await fetch(base + file);
          if (!r.ok) continue;
          GlobalFonts.register(Buffer.from(await r.arrayBuffer()), alias);
          done = true;
          break;
        } catch (e) { /* try next base */ }
      }
      if (!done) throw new Error('font fetch failed: ' + file);
    }
  } catch (e) {
    // Fall back to the default sans if the font host is unreachable.
  }
  fontsReady = true;
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“').replace(/&#8221;/g, '”').replace(/&#8230;/g, '…')
    .replace(/\s+/g, ' ').trim();
}

async function fetchLatest() {
  const res = await fetch(FEED, { headers: { 'user-agent': 'starke-banner' } });
  const xml = await res.text();
  const item = (xml.match(/<item>([\s\S]*?)<\/item>/) || [])[1] || '';
  const titleM = item.match(/<title>([\s\S]*?)<\/title>/);
  const encM = item.match(/<enclosure[^>]*\burl="([^"]+)"/);
  return {
    title: titleM ? decodeEntities(titleM[1]) : 'The Starke Perspective',
    cover: encM ? encM[1] : null,
  };
}

function wrapAt(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitTitle(ctx, title, maxWidth, maxHeight) {
  for (const size of [48, 44, 40, 36, 32, 28]) {
    ctx.font = size + 'px PoppinsBold';
    const lh = Math.round(size * 1.16);
    const lines = wrapAt(ctx, title, maxWidth);
    if (lines.length <= 3 && lines.length * lh <= maxHeight) return { size, lh, lines };
  }
  const size = 28, lh = Math.round(size * 1.16);
  ctx.font = size + 'px PoppinsBold';
  let lines = wrapAt(ctx, title, maxWidth);
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    let last = lines[2];
    while (ctx.measureText(last + ' ...').width > maxWidth && last.includes(' ')) last = last.replace(/\s+\S+$/, '');
    lines[2] = last + ' ...';
  }
  return { size, lh, lines };
}

function drawTracked(ctx, text, x, y, tracking) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + tracking; }
}

function renderBanner(title, image) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = CHAR; ctx.fillRect(0, 0, W, H);

  if (image) {
    const ir = image.width / image.height, br = W / H;
    let dw, dh, dx, dy;
    if (ir > br) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(image, dx, dy, dw, dh);
  }

  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0.0, 'rgba(30,30,36,0.97)');
  g.addColorStop(0.42, 'rgba(30,30,36,0.86)');
  g.addColorStop(0.68, 'rgba(30,30,36,0.32)');
  g.addColorStop(1.0, 'rgba(30,30,36,0.0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const gb = ctx.createLinearGradient(0, H * 0.4, 0, H);
  gb.addColorStop(0, 'rgba(30,30,36,0.0)');
  gb.addColorStop(1, 'rgba(30,30,36,0.5)');
  ctx.fillStyle = gb; ctx.fillRect(0, 0, W, H);

  const PAD = 64, maxTextW = 672;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD; ctx.font = '22px PoppinsBold';
  drawTracked(ctx, 'NEW ARTICLE', PAD, 76, 6);

  const bandTop = 96, bandBottom = 236;
  const { size, lh, lines } = fitTitle(ctx, title, maxTextW, bandBottom - bandTop);
  ctx.fillStyle = CREAM; ctx.font = size + 'px PoppinsBold';
  let y = bandTop + (bandBottom - bandTop - lines.length * lh) / 2 + size;
  for (const ln of lines) { ctx.fillText(ln, PAD, y); y += lh; }

  const ctaY = H - 40;
  ctx.fillStyle = GOLD; ctx.font = '24px PoppinsMedium';
  const cta = 'Read on The Starke Perspective';
  ctx.fillText(cta, PAD, ctaY);
  const cw = ctx.measureText(cta).width;
  const ax = PAD + cw + 16, ay = ctaY - 8;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(ax + 22, ay);
  ctx.moveTo(ax + 13, ay - 7); ctx.lineTo(ax + 22, ay); ctx.lineTo(ax + 13, ay + 7);
  ctx.stroke();
  return canvas;
}

module.exports = async (req, res) => {
  await ensureFonts();
  let title = 'The Starke Perspective', cover = null;
  try { const d = await fetchLatest(); title = d.title; cover = d.cover; } catch (e) {}

  async function loadBytes(url) {
    const r = await fetch(url, { headers: { 'user-agent': 'starke-banner' } });
    if (!r.ok) throw new Error('status ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }

  let image = null;
  if (cover) {
    const cdn = 'https://substackcdn.com/image/fetch/w_' + W + ',h_' + H +
      ',c_fill,f_auto,q_auto:good/' + encodeURIComponent(cover);
    try { image = await loadImage(await loadBytes(cdn)); }
    catch (e) { try { image = await loadImage(await loadBytes(cover)); } catch (e2) { image = null; } }
  }

  const buf = await renderBanner(title, image).encode('jpeg', 90);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400');
  res.status(200).send(buf);
};
