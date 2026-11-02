import { mushrooms } from './game.js';
import { icon } from './icons.js';
import { picture } from './views.js';
import { parseAddress, qrSvg, qrPngDataUrl } from './qr.js';
const sheet = document.querySelector('#sheet');
let opener;
export function closeSheet() { sheet.close(); opener?.focus(); }
export function showSheet(title, content) {
  opener = document.activeElement;
  sheet.innerHTML = `<div class="sheet-header"><h2 id="sheet-title">${title}</h2><button class="icon-button" data-close aria-label="关闭">${icon('close')}</button></div><div class="sheet-body">${content}</div>`;
  if (!sheet.open) sheet.showModal();
  sheet.querySelector('[data-close]').addEventListener('click', closeSheet);
}
sheet.addEventListener('click', event => { if (event.target === sheet) closeSheet(); });
sheet.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
export function help() {
  showSheet('跟小蘑菇一起玩', `<div class="help-steps"><div><b>1</b><section><h3>先记一记</h3><p>选择 3–7 位伙伴，记住它们从左到右、从上到下的顺序。</p></section></div><div><b>2</b><section><h3>再排一排</h3><p>时间到了，卡片会打乱。按记忆依次点击；再点已选卡可以撤回，选齐后确认。</p></section></div><div><b>3</b><section><h3>带走小礼物</h3><p>通关后打开领取凭证，交给现场工作人员核验。每台设备每天一份。</p></section></div></div><p class="fine-print">游玩记录保存在当前浏览器，请在领完礼物前保留它。游戏图片用于趣味记忆，不作为野生菌辨识或食用依据。</p><button class="primary" data-understood>我知道啦</button>`);
  sheet.querySelector('[data-understood]').addEventListener('click', closeSheet);
}
export function collection() {
  showSheet('认识蘑菇家族', `<p class="sheet-intro">七位伙伴，都有自己的小模样。</p><div class="collection-grid">${mushrooms.map(m => `<article class="collection-item ${m.color}"><img src="${picture(m.id)}" alt="" width="100" height="100"><h3>${m.name}</h3><p>${m.note}</p></article>`).join('')}</div>`);
}
export function share() {
  showSheet('把森林装进手机', `<p class="sheet-intro">手机扫一扫，就能和小蘑菇一起玩。</p><div id="qr-preview" class="qr-preview"><span>${icon('qr')}</span><p>正在准备扫码入口…</p></div><button class="primary" id="download-qr" hidden>保存二维码 PNG</button><p class="field-error" id="qr-save-error" role="alert" hidden></p>`);
  const configured = document.querySelector('meta[name="game-address"]')?.content;
  const raw = configured || (/localhost|127\.0\.0\.1/.test(location.hostname) ? '' : `${location.origin}${location.pathname}`);
  let qrAddress = '';
  try {
    const address = parseAddress(raw);
    qrAddress = address;
    sheet.querySelector('#qr-preview').innerHTML = qrSvg(address);
    sheet.querySelector('#download-qr').hidden = false;
  } catch {
    const img = new Image();
    img.alt = '手机扫码打开游戏';
    img.onload = () => {
      const preview = sheet.querySelector('#qr-preview');
      if (preview) { preview.innerHTML = ''; preview.appendChild(img); }
    };
    img.src = 'outputs/扫码游玩.svg';
  }
  sheet.querySelector('#download-qr').addEventListener('click', () => {
    const message = sheet.querySelector('#qr-save-error');
    try {
      const link = document.createElement('a');
      link.href = qrPngDataUrl(qrAddress);
      link.download = '蘑菇家族-扫码游玩.png';
      link.click();
      message.hidden = true;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      message.textContent = '图片暂时无法保存，请重试或更换浏览器。';
      message.hidden = false;
    }
  });
}
export function confirmLeave(onConfirm) {
  showSheet('先离开这一局吗？', '<p>回到设置后，这一局的进度会结束。已经获得的礼物凭证会保留。</p><button class="primary" data-stay>继续这一局</button><button class="secondary" data-leave>结束本局，返回设置</button>');
  sheet.querySelector('[data-stay]').addEventListener('click', closeSheet);
  sheet.querySelector('[data-leave]').addEventListener('click', () => { closeSheet(); onConfirm(); });
}
export function verify(reward, onRedeem) {
  const codePart1 = reward.code.slice(0, 5);
  const codePart2 = reward.code.slice(5);
  const dayFormatted = reward.day ? reward.day.replaceAll('-', '.') : '';
  showSheet('工作人员现场核验', `<div class="verify-wrap">
    <div class="staff-note">
      <span class="staff-badge">工作人员操作</span>
      <span>请将手机交给现场工作人员，核对凭证后发放礼品</span>
    </div>
    <div class="verify-card">
      <div class="verify-card-header">
        <span class="verify-card-title">${icon('gift')} 现场通关礼遇凭证</span>
        <span class="verify-card-day">有效日期 ${dayFormatted}</span>
      </div>
      <div class="verify-code-wrap">
        <span class="verify-code-label">凭证核销码</span>
        <p class="verify-code">${codePart1} <span>·</span> ${codePart2}</p>
      </div>
      <p class="verify-hint">请核对游客手机端凭证编号与有效日期一致</p>
    </div>
    <label class="confirm-checkbox" for="gift-delivered">
      <input type="checkbox" id="gift-delivered">
      <span class="confirm-box" aria-hidden="true">${icon('check')}</span>
      <span class="confirm-desc">
        <strong>我已核对凭证，并已向游客发放小礼品</strong>
        <small>确认礼品已交付游客，完成今日核销</small>
      </span>
    </label>
    <button class="primary" data-redeem disabled>${icon('check')} 确认已发放，完成核销</button>
    <p class="fine-print">${icon('leaf')} 确认后，本机今日凭证将标记为已领取，不可撤回。</p>
  </div>`);
  sheet.querySelector('#gift-delivered').addEventListener('change', event => {
    const btn = sheet.querySelector('[data-redeem]');
    if (btn) btn.disabled = !event.target.checked;
  });
  sheet.querySelector('[data-redeem]').addEventListener('click', () => { closeSheet(); onRedeem(); }, { once: true });
}
