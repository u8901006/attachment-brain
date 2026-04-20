#!/usr/bin/env node
import { writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DOCS_DIR = resolve(process.cwd(), 'docs');

function generateIndex() {
  let files = [];
  try {
    files = readdirSync(DOCS_DIR)
      .filter(f => f.startsWith('attachment-') && f.endsWith('.html'))
      .sort()
      .reverse();
  } catch {}

  const links = files.slice(0, 30).map(name => {
    const date = name.replace('attachment-', '').replace('.html', '');
    let dateDisplay = date;
    let weekday = '';
    try {
      const d = new Date(date);
      dateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      weekday = '週' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    } catch {}
    return `<li><a href="${name}">📅 ${dateDisplay}（${weekday}）</a></li>`;
  }).join('\n');

  const total = files.length;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Attachment Brain · 依附關係文獻日報</title>
<meta name="description" content="依附關係文獻日報，每日自動更新，由 AI 分析 PubMed 最新論文"/>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-section { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); }
  .link-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
  .link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 13px; font-weight: 600; transition: all 0.2s; }
  .link-btn:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateY(-2px); }
  .link-btn.coffee { background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%); border-color: #f59e0b40; }
  footer { margin-top: 40px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🔗</div>
  <h1>Attachment Brain</h1>
  <p class="subtitle">依附關係文獻日報 · 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>

  <div class="links-section">
    <div class="link-row">
      <a href="https://www.leepsyclinic.com/" class="link-btn" target="_blank">🏥 李政洋身心診所</a>
      <a href="https://blog.leepsyclinic.com/" class="link-btn" target="_blank">📬 訂閱電子報</a>
      <a href="https://buymeacoffee.com/CYlee" class="link-btn coffee" target="_blank">☕ Buy Me a Coffee</a>
    </div>
  </div>

  <footer>
    <p>Powered by PubMed + Zhipu AI &middot; <a href="https://github.com/u8901006/attachment-brain">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

  writeFileSync(resolve(DOCS_DIR, 'index.html'), html, 'utf8');
  console.error(`[INFO] Index page generated with ${total} reports`);
}

generateIndex();
