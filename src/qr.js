// QR Model 2，固定 Version 5-L、字节模式与 Mask 0；最多 106 UTF-8 字节。
export function qrMatrix(text) {
  const input = new TextEncoder().encode(text);
  if (input.length > 106) throw new RangeError('地址太长，请使用不超过 106 字节的短网址。');
  const bits = [];
  const append = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  append(4, 4); append(input.length, 8);
  input.forEach(b => append(b, 8)); append(0, Math.min(4, 864 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => n * 2 + bit, 0));
  for (let i = 0; data.length < 108; i++) data.push(i % 2 ? 0x11 : 0xec);
  const multiply = (x, y) => {
    let result = 0;
    for (let i = 7; i >= 0; i--) { result = (result << 1) ^ ((result >>> 7) * 0x11d); result ^= ((y >>> i) & 1) * x; }
    return result;
  };
  const divisor = Array(26).fill(0); divisor[25] = 1;
  let root = 1;
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) { divisor[j] = multiply(divisor[j], root); if (j + 1 < 26) divisor[j] ^= divisor[j + 1]; }
    root = multiply(root, 2);
  }
  const remainder = Array(26).fill(0);
  for (const b of data) {
    const factor = b ^ remainder.shift(); remainder.push(0);
    divisor.forEach((value, i) => { remainder[i] ^= multiply(value, factor); });
  }
  const stream = [...data, ...remainder].flatMap(b => Array.from({ length: 8 }, (_, i) => (b >>> (7 - i)) & 1));
  const size = 37;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = matrix.map(row => row.map(() => false));
  const set = (x, y, value) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = Boolean(value); reserved[y][x] = true; } };
  for (const [cx, cy] of [[3, 3], [33, 3], [3, 33]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, distance !== 2 && distance !== 4);
    }
  }
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(30 + dx, 30 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const format = 0x77c4;
  const bit = i => (format >>> i) & 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (!reserved[y][x]) { matrix[y][x] = Boolean((stream[index++] ?? 0) ^ ((x + y) % 2 === 0 ? 1 : 0)); }
      }
    }
  }
  return matrix;
}
export function qrSvg(text) {
  const matrix = qrMatrix(text);
  const path = matrix.flatMap((row, y) => row.flatMap((value, x) => value ? [`M${x + 4},${y + 4}h1v1h-1z`] : [])).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" role="img" aria-label="手机扫码打开游戏" shape-rendering="crispEdges"><path fill="white" d="M0 0h45v45H0z"/><path fill="#183921" d="${path}"/></svg>`;
}
export function qrPngDataUrl(text) {
  const matrix = qrMatrix(text);
  const moduleSize = 20;
  const quietZone = 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = (matrix.length + quietZone * 2) * moduleSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器暂时无法生成二维码图片');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#183921';
  matrix.forEach((row, y) => row.forEach((value, x) => {
    if (value) context.fillRect((x + quietZone) * moduleSize, (y + quietZone) * moduleSize, moduleSize, moduleSize);
  }));
  return canvas.toDataURL('image/png');
}
export function parseAddress(raw) {
  const address = new URL(raw);
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password) throw new TypeError('请输入完整的 HTTP 或 HTTPS 游戏网址。');
  if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(address.hostname)) throw new TypeError('手机无法打开电脑的 localhost，请填写局域网 IP 或正式网址。');
  if (new TextEncoder().encode(address.href).length > 106) throw new RangeError('网址过长，请改用较短的游戏地址。');
  return address.href;
}
