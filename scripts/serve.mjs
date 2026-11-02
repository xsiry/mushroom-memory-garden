import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { qrSvg } from '../src/qr.js';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const lan = Object.values(networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
const address = `http://${lan[0] || '127.0.0.1'}:${port}/`;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || relative.split('/').some(part => part.startsWith('.')) || !/^(index\.html|styles\.css|src\/[a-z-]+\.js|assets\/[a-z0-9/.-]+|outputs\/扫码游玩\.svg)$/.test(relative)) { response.writeHead(404); response.end('Not found'); return; }
    let body = await readFile(path);
    if (relative === 'index.html') body = Buffer.from(body.toString().replace('<meta name="theme-color"', `<meta name="game-address" content="${address}"><meta name="theme-color"`));
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-cache' }); response.end(body);
  } catch (error) {
    if (error instanceof URIError) { response.writeHead(400); response.end('Bad request'); return; }
    if (error instanceof Error && 'code' in error && ['ENOENT', 'EISDIR'].includes(error.code)) { response.writeHead(404); response.end('Not found'); return; }
    console.error('静态资源读取失败', error); response.writeHead(500); response.end('Server error');
  }
});
server.listen(port, '0.0.0.0', async () => {
  await mkdir('outputs', { recursive: true });
  await writeFile('outputs/扫码游玩.svg', qrSvg(address));
  await writeFile('outputs/本机访问地址.txt', `电脑预览：http://localhost:${port}/\n同 Wi-Fi 手机扫码地址：${address}\n电脑睡眠期间无法访问，请唤醒后继续。\n`);
  console.log(`蘑菇家族已启动\n电脑预览：http://localhost:${port}/\n手机同 Wi-Fi：${address}\n二维码：outputs/扫码游玩.svg\n电脑睡眠后服务将暂停响应。`);
});
