// ============================================================================
// （5章体験型）公開鍵暗号とデジタル署名 〜南京錠カフェと怪盗シャドウの密書実験〜
// main.js（文字数ダイエット＋全マシマシ6大進化版）
// ============================================================================

const bgmTitle = new Audio('bgm_title.mp3');
bgmTitle.loop = true;
bgmTitle.volume = 0.32;

const bgmMain = new Audio('bgm_main.mp3');
bgmMain.loop = true;
bgmMain.volume = 0.28;

let isBgmOn = false;
let currentScreen = 'title';
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playTone(freq, type, duration, delay = 0, gainVal = 0.14) {
  if (!isBgmOn) return;
  try {
    ensureAudioCtx();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration);
  } catch (e) {}
}

function sfxClick() { playTone(660, 'sine', 0.08, 0, 0.12); }
function sfxLock() {
  playTone(520, 'triangle', 0.09, 0, 0.15);
  playTone(780, 'triangle', 0.12, 0.08, 0.16);
}
function sfxSuccess() {
  playTone(523.25, 'triangle', 0.11, 0, 0.16);
  playTone(659.25, 'triangle', 0.11, 0.09, 0.16);
  playTone(783.99, 'triangle', 0.14, 0.18, 0.16);
  playTone(1046.5, 'triangle', 0.28, 0.27, 0.18);
}
function sfxTrap() {
  playTone(310, 'sawtooth', 0.14, 0, 0.15);
  playTone(220, 'sawtooth', 0.24, 0.12, 0.16);
}
function sfxStamp() {
  playTone(150, 'square', 0.12, 0, 0.22);
  playTone(880, 'triangle', 0.25, 0.1, 0.18);
}

function syncBgm() {
  [document.getElementById('btn-title-bgm'), document.getElementById('btn-game-bgm')].forEach(btn => {
    if (btn) btn.textContent = isBgmOn ? '🔊 BGM: ON' : '🔇 BGM: OFF';
  });
  bgmTitle.pause();
  bgmMain.pause();
  if (!isBgmOn) return;
  if (currentScreen === 'title') bgmTitle.play().catch(() => {});
  else bgmMain.play().catch(() => {});
}

function toggleBgm() {
  isBgmOn = !isBgmOn;
  if (isBgmOn) sfxClick();
  syncBgm();
}

// --- ⑤ 0.8秒ロック＆バウンス演出エフェクト ---
function triggerFx(targetSide, text, styleClass = '') {
  const el = document.getElementById(`${targetSide}-fx`);
  if (!el) return;
  el.textContent = text;
  el.className = `fx-burst ${styleClass}`;
  void el.offsetWidth;
  el.classList.add('fx-show');
}

// --- ② ライブ・ハッシュ関数（決定論的4桁16進コード） ---
function computeHexHash(text) {
  const clean = (text || '').trim();
  if (clean === 'マカロン10個') return '#A9F2';
  if (clean === 'マカロン11個') return '#7C01';
  if (clean === 'マカロン10個。') return '#E48B';
  if (clean === 'マカロン9999個') return '#DEAD';
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = ((h >>> 0) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return `#${hex}`;
}

// --- 状態管理 ---
const state = {
  currentStep: 0,
  score: 100,
  missCount: 0,
  clearedSteps: [false, false, false, false, false],
  urlPopupOpen: false,
  step1: { triedPlain: false, boxLocked: false, triedKeySend: false, peopleCount: 10 },
  step2: { phase: 0, triedSecretSend: false, triedSenderPub: false },
  step3: {
    phase: 0,
    tampered: false,
    triedNoSig: false,
    docText: 'マカロン10個',
    doubleLocked: false
  },
  step4: { phase: 0, triedFakeKey: false },
  step5: { phase: 0, triedPubOnly: false }
};

// --- 5ステップ定義（CIAタグ付き・スッキリ短文） ---
const STEPS_DATA = [
  {
    stepNum: 1,
    title: '共通鍵暗号方式と「鍵配送問題」',
    goal: '🎯 合鍵をネットで送るとどうなる？',
    keypointTitle: '🔑 共通鍵暗号の2大弱点',
    keypointHtml: `
      <div><span class="cia-tag cia-c">🛡️ 機密性(C)：盗聴防止</span></div>
      <div>① <strong>鍵配送問題</strong>：<span class="k-pill k-common">🔑 共通鍵</span>を送ると途中でコピーされる！</div>
      <div>② <strong>鍵の爆発</strong>：<code>n</code>人で通信すると <strong><code>n(n-1)÷2</code> 個</strong>の鍵が必要！</div>
    `,
    hint: '「閉める鍵＝開ける鍵」なので、合鍵をネットで送ると怪盗にもコピーされてしまいます。',
    compassHighlight: 'none',
    quiz: {
      question: '暗号化と復号に「同じ鍵」を使う『共通鍵暗号方式』の特徴と課題として、最も適切なものはどれか？',
      options: [
        '鍵をインターネット上に誰でも使える形で公開するため、鍵の受け渡しが不要である',
        '暗号化する鍵と復号する鍵が異なるため、処理速度が非常に遅い',
        '暗号化・復号の処理は高速だが、通信相手ごとに鍵が必要（n人ならn(n-1)÷2個）で、鍵を安全に受け渡す（共有する）ことが難しい',
        'メッセージの改ざん検知にしか使えず、本文の暗号化には使えない'
      ],
      answerIndex: 2,
      explanation: '共通鍵暗号方式は処理が高速な反面、相手ごとに共通鍵が必要（10人なら10×9÷2＝45個）で、「どうやって他人に盗まれずに共通鍵を相手に渡すか（鍵配送問題）」が課題となります。'
    }
  },
  {
    stepNum: 2,
    title: '公開鍵暗号方式（南京錠の魔法',
    goal: '🎯 秘密鍵を外に出さずにレシピを届けよう！',
    keypointTitle: '🔓 公開鍵暗号の鉄則',
    keypointHtml: `
      <div><span class="cia-tag cia-c">🛡️ 機密性(C)：盗聴防止</span></div>
      <div>・閉める：<span class="k-pill k-pub">🔓 受信者の公開鍵</span>（開いた南京錠）</div>
      <div>・開ける：<span class="k-pill k-priv">🗝️ 受信者の秘密鍵</span>（金庫から出さない！）</div>
    `,
    hint: '受け取る人（受信者＝店長）が開けるので、「店長の公開鍵（南京錠）」で閉めて送ります。',
    compassHighlight: 'enc',
    quiz: {
      question: 'Aさん（送信者）からBさん（受信者）へ「公開鍵暗号方式」で秘密のメッセージを送る場合、使う鍵の正しい組み合わせはどれか？',
      options: [
        '暗号化：Bさんの公開鍵 ／ 復号：Bさんの秘密鍵',
        '暗号化：Aさんの秘密鍵 ／ 復号：Aさんの公開鍵',
        '暗号化：Aさんの公開鍵 ／ 復号：Bさんの秘密鍵',
        '暗号化：Bさんの秘密鍵 ／ 復号：Bさんの公開鍵'
      ],
      answerIndex: 0,
      explanation: '受け取って開けるのは受信者Bさんです。誰でも使える「Bさん（受信者）の公開鍵」でロックし、Bさん本人しか持たない「Bさん（受信者）の秘密鍵」で復号します。'
    }
  },
  {
    stepNum: 3,
    title: 'デジタル署名とハッシュ値',
    goal: '🎯 送信者の秘密鍵スタンプで偽装を見破れ！',
    keypointTitle: '💮 デジタル署名は鍵の向きが逆！',
    keypointHtml: `
      <div><span class="cia-tag cia-i">💮 完全性(I)：改ざん検知</span> <span class="cia-tag cia-a">👤 真正性</span></div>
      <div>・署名：<span class="k-pill k-priv">💮 送信者の秘密鍵</span>でハッシュ値を暗号化</div>
      <div>・検証：<span class="k-pill k-pub">🔍 送信者の公開鍵</span>で復号してハッシュ照合</div>
    `,
    hint: '「本当にチョコ本人が書いたか」を証明するため、送信者チョコの秘密鍵で署名します。',
    compassHighlight: 'sig',
    quiz: {
      question: '送信者Aさんが文書に「デジタル署名」を付けて受信者Bさんに送るとき、使う鍵と確認できることの組み合わせとして正しいものはどれか？',
      options: [
        '作成：Bさんの公開鍵 ／ 検証：Bさんの秘密鍵（本文の盗聴防止',
        '作成：Aさんの公開鍵 ／ 検証：Aさんの秘密鍵（なりすましと改ざん検知',
        '作成：Bさんの秘密鍵 ／ 検証：Aさんの公開鍵（通信速度の向上',
        '作成：Aさんの秘密鍵 ／ 検証：Aさんの公開鍵（なりすまし防止と改ざん検知'
      ],
      answerIndex: 3,
      explanation: '送信者Aさん本人しか作れない証拠にするため、「Aさん（送信者）の秘密鍵」で署名を作成し、受信者は「Aさん（送信者）の公開鍵」で検証します。'
    }
  },
  {
    stepNum: 4,
    title: '中間者攻撃と認証局(CA)・電子証明書',
    goal: '🎯 怪盗がすり替えた「偽の公開鍵」を見破れ！',
    keypointTitle: '📜 公開鍵の本物証明＝電子証明書',
    keypointHtml: `
      <div><span class="cia-tag cia-a">👤 真正性：公開鍵の持ち主証明</span></div>
      <div>・<strong>中間者攻撃</strong>：怪盗が<span class="k-pill k-fake">💀 偽公開鍵</span>にすり替える攻撃</div>
      <div>・<strong>電子証明書</strong>：第三者機関の<strong>認証局(CA)</strong>が本物と署名保証！</div>
    `,
    hint: '届いた公開鍵が本当に店長のものか確かめるため、認証局(CA)の電子証明書を検査します。',
    compassHighlight: 'sig',
    quiz: {
      question: '公開鍵のすり替え（中間者攻撃）を防ぐため、第三者機関である認証局（CA）が発行する「電子証明書」には誰のデジタル署名が付与されているか？',
      options: [
        '通信相手の受信者自身のデジタル署名',
        '認証局（CA）の秘密鍵によるデジタル署名',
        'インターネットプロバイダ（ISP）の共通鍵',
        '送信者自身の秘密鍵によるデジタル署名'
      ],
      answerIndex: 1,
      explanation: '信頼できる第三者機関「認証局（CA）」が、CA自身の秘密鍵でデジタル署名を付けた「電子証明書」を発行し、利用者はCAの公開鍵で検証します。'
    }
  },
  {
    stepNum: 5,
    title: 'TLS（SSL/TLS）とHTTPSの実践（公開鍵×共通鍵の合体',
    goal: '🎯 公開鍵の「安全」×共通鍵の「爆速」を合体！',
    keypointTitle: '🚀 HTTPS（TLS）を支える暗号技術',
    keypointHtml: `
      <div><span class="cia-tag cia-c">🛡️ 機密性(C)</span> ＋ <span class="cia-tag cia-a">⚡ 超高速通信</span></div>
      <div>① <span class="k-pill k-common">🔑 共通鍵</span>を<span class="k-pill k-pub">🔓 受信者の公開鍵</span>で包んで安全に送る</div>
      <div>② 共有した<span class="k-pill k-common">🔑 共通鍵</span>で大きな本文を<strong>超高速通信🐇</strong>！</div>
    `,
    hint: '小さな「共通鍵」だけを公開鍵（南京錠）で安全に送り、100MBの動画は共通鍵で高速通信します。',
    compassHighlight: 'enc',
    quiz: {
      question: 'URLが「https://」から始まるWebページで利用されている「TLS（SSL/TLS）」の仕組みとして、最も適切なものはどれか？',
      options: [
        '本文を共通鍵で暗号化し、その共通鍵を暗号化せずに平文のまま一緒に送信する',
        '電子証明書で相手の正当性を確認した上で、公開鍵暗号方式で「共通鍵」を安全に共有し、本文の通信には高速な「共通鍵暗号方式」を使う',
        '大容量の動画データもすべて処理の遅い公開鍵暗号方式だけで暗号化して送信する',
        '最初に秘密鍵を相手にメールで送り、以後はパリティビットだけで暗号化する'
      ],
      answerIndex: 1,
      explanation: '通り、HTTPS（TLS / SSL）通信では「電子認証（電子証明書）」と「公開鍵暗号方式」で安全に共通鍵を受け渡し、実際のデータ通信は高速な「共通鍵暗号方式」で行います。'
    }
  }
];

// --- 画面切り替え ---
function showScreen(screenName) {
  currentScreen = screenName;
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');
  syncBgm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startGame() {
  sfxClick();
  showScreen('game');
  loadStep(0);
}

function backToTitle() {
  sfxClick();
  showScreen('title');
}

function jumpToStep(stepIdx) {
  sfxClick();
  loadStep(stepIdx);
}

function jumpToStepFromClear(stepIdx) {
  sfxClick();
  showScreen('game');
  loadStep(stepIdx);
}

function updateStatsUI() {
  const scoreEl = document.getElementById('score-val');
  const missEl = document.getElementById('miss-val');
  if (scoreEl) scoreEl.textContent = state.score;
  if (missEl) missEl.textContent = state.missCount;

  document.querySelectorAll('#step-nav .step-pill').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === state.currentStep);
    btn.classList.toggle('cleared', state.clearedSteps[idx]);
  });
}

function addPenalty(points = 5) {
  state.missCount += 1;
  state.score = Math.max(50, state.score - points);
  updateStatsUI();
}

function addBonus(points = 10) {
  state.score = Math.min(150, state.score + points);
  updateStatsUI();
}

function setGuide(speaker, emotion, badgeText, msgHtml) {
  const card = document.getElementById('guide-card');
  const avatar = document.getElementById('guide-avatar');
  const roleEl = document.getElementById('speaker-role');
  const badgeEl = document.getElementById('emotion-badge');
  const msgEl = document.getElementById('guide-msg');

  if (card) card.setAttribute('data-emotion', emotion);
  if (avatar) {
    avatar.src = speaker === 'thief' ? 'thief_cat.png' : 'cafe_cat.png';
    avatar.alt = speaker === 'thief' ? '怪盗シャドウ' : 'ミルキィ店長';
  }
  if (roleEl) {
    roleEl.textContent = speaker === 'thief' ? '🎩 怪盗シャドウ' : '🔓 ミルキィ店長';
  }
  if (badgeEl) badgeEl.textContent = badgeText;
  if (msgEl) msgEl.innerHTML = msgHtml;
}

function animateWire(direction, emoji, caption, labelText) {
  const label = document.getElementById('wire-label');
  const pkt = document.getElementById('wire-packet');
  const pEmoji = document.getElementById('packet-emoji');
  const pCap = document.getElementById('packet-caption');

  if (label) label.textContent = labelText;
  if (pEmoji) pEmoji.textContent = emoji;
  if (pCap) pCap.textContent = caption;

  if (pkt) {
    pkt.className = 'wire-packet';
    void pkt.offsetWidth;
    if (direction === 'right') pkt.classList.add('anim-send-right');
    if (direction === 'left') pkt.classList.add('anim-send-left');
    if (direction === 'intercept') pkt.classList.add('anim-intercept');
  }
}

function updateThiefUI(thiefState, badgeText, speechHtml, lootHtml) {
  const lair = document.getElementById('thief-lair');
  const badge = document.getElementById('thief-status-badge');
  const speech = document.getElementById('thief-speech');
  const loot = document.getElementById('thief-loot');

  if (lair) lair.setAttribute('data-thief-state', thiefState);
  if (badge) badge.textContent = badgeText;
  if (speech) speech.innerHTML = speechHtml;
  if (loot) loot.innerHTML = lootHtml;
}

function updateBoxUI(side, styleClass, icon, tagText, contentHtml, keysHtml) {
  const box = document.getElementById(`${side}-box`);
  const bIcon = document.getElementById(`${side}-box-icon`);
  const bTag = document.getElementById(`${side}-box-tag`);
  const bText = document.getElementById(`${side}-box-text`);
  const kList = document.getElementById(`${side}-keys`);

  if (box) box.className = `data-box-card ${styleClass || ''}`;
  if (bIcon) bIcon.textContent = icon;
  if (bTag) bTag.textContent = tagText;
  if (bText) bText.innerHTML = contentHtml;
  if (kList && keysHtml !== null) kList.innerHTML = keysHtml;
}

// --- ③ スマホブラウザURLバー実演（STEP 4 & 5） ---
function renderBrowserBar(isVerified, modeText, detailHtml) {
  const wrap = document.getElementById('browser-bar-wrap');
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="browser-bar-inner">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-size:0.78rem; font-weight:900; color:#94A3B8;">📱 スマホブラウザ表示：</span>
        <button type="button" class="url-pill ${isVerified ? 'url-safe' : 'url-warn'}" onclick="toggleUrlPopup()">
          <span>${isVerified ? '🔒 https://nankinjo-cafe.jp' : '⚠️ http://nankinjo-cafe.jp'}</span>
          <span style="font-size:0.75rem; opacity:0.9;">（${modeText}・クリックで確認）</span>
        </button>
      </div>
      <span style="font-size:0.76rem; font-weight:800; color:#E2E8F0;">👆 鍵マークをタップすると証明書が見られます</span>
    </div>
    <div id="url-popup-detail" class="url-popup-detail ${state.urlPopupOpen ? 'open' : ''}">
      ${detailHtml}
    </div>
  `;
}

function hideBrowserBar() {
  const wrap = document.getElementById('browser-bar-wrap');
  if (wrap) wrap.style.display = 'none';
}

function toggleUrlPopup() {
  sfxClick();
  state.urlPopupOpen = !state.urlPopupOpen;
  const pop = document.getElementById('url-popup-detail');
  if (pop) pop.classList.toggle('open', state.urlPopupOpen);
}

// --- ステップ読み込み ---
function loadStep(stepIdx) {
  state.currentStep = stepIdx;
  state.urlPopupOpen = false;
  const data = STEPS_DATA[stepIdx];
  updateStatsUI();

  document.getElementById('banner-step-badge').textContent = `STEP ${data.stepNum} / 5`;
  document.getElementById('banner-title').textContent = data.title;
  document.getElementById('banner-goal').textContent = data.goal;

  document.getElementById('keypoint-step-tag').textContent = `STEP ${data.stepNum}`;
  document.getElementById('keypoint-title').textContent = data.keypointTitle;
  document.getElementById('keypoint-body').innerHTML = data.keypointHtml;
  document.getElementById('hint-text').textContent = data.hint;

  document.getElementById('compass-enc').classList.toggle('highlight-compass', data.compassHighlight === 'enc');
  document.getElementById('compass-sig').classList.toggle('highlight-compass', data.compassHighlight === 'sig');

  if (stepIdx === 0) {
    hideBrowserBar();
    state.step1 = { triedPlain: false, boxLocked: false, triedKeySend: false, peopleCount: 10 };
    renderStep1();
  } else if (stepIdx === 1) {
    hideBrowserBar();
    state.step2 = { phase: 0, triedSecretSend: false, triedSenderPub: false };
    renderStep2();
  } else if (stepIdx === 2) {
    hideBrowserBar();
    state.step3 = { phase: 0, tampered: false, triedNoSig: false, docText: 'マカロン10個', doubleLocked: false };
    renderStep3();
  } else if (stepIdx === 3) {
    state.step4 = { phase: 0, triedFakeKey: false };
    renderStep4();
  } else if (stepIdx === 4) {
    state.step5 = { phase: 0, triedPubOnly: false };
    renderStep5();
  }
}

// ============================================================================
// STEP 1: 共通鍵暗号方式と「鍵配送問題」
// ============================================================================
function renderStep1() {
  const s = state.step1;
  document.getElementById('sender-name').textContent = '送信者：チョコ';
  document.getElementById('receiver-name').textContent = '受信者：ミルキィ店長';

  if (!s.triedKeySend && !s.triedPlain && !s.boxLocked) {
    setGuide(
      'cafe',
      'normal',
      'STEP 1 スタート',
      '「まずは下のボタンを順番に押して、<strong>なぜ『合鍵（共通鍵）』をネットで送ると危険なのか</strong>実験しようニャ！」'
    );
    updateBoxUI('sender', '', '📄', '平文（むき出し', '極秘レシピ：塩キャラメル', '<span class="k-pill k-common">🔑 合鍵 #777</span>');
    updateBoxUI('receiver', '', '📭', '未受信', '合鍵も箱もまだ無し', '<span class="loot-empty">鍵なし</span>');
    updateThiefUI('watching', '👀 盗聴中', '「ネットを通るデータは全部丸見えニャ〜！」', '<span class="loot-empty">なし</span>');
    animateWire('none', '📡', '待機中', '下のボタンを押して実験しよう');
  }

  const n = s.peopleCount;
  const totalKeys = (n * (n - 1)) / 2;

  const wb = document.getElementById('control-workbench');
  wb.innerHTML = `
    <div class="workbench-title">🧪 実験ボタン（左から順に押してみよう！）</div>

    <div class="exp-buttons-grid">
      <button type="button" id="btn-s1-plain" class="btn-exp btn-exp-trap ${!s.triedPlain ? 'pulse-danger' : ''}" onclick="step1SendPlain()">
        <span class="exp-tag">❌ 実験①</span>
        <span class="exp-main-label">📄 平文のまま送る</span>
      </button>

      <button type="button" id="btn-s1-lock" class="btn-exp btn-exp-step ${s.triedPlain && !s.boxLocked ? 'pulse-guide' : ''}" onclick="step1LockBox()">
        <span class="exp-tag">🔑 実験②</span>
        <span class="exp-main-label">🔒 合鍵(#777)で箱をロック</span>
      </button>

      <button type="button" id="btn-s1-sendkey" class="btn-exp btn-exp-trap ${s.boxLocked && !s.triedKeySend ? 'pulse-guide' : ''}" onclick="step1SendKeyAndBox()">
        <span class="exp-tag">⚡ 実験③：鍵配送問題</span>
        <span class="exp-main-label">📡 合鍵(#777)と箱を送る</span>
      </button>

      <button type="button" id="btn-s1-quiz" class="btn-exp btn-exp-clear ${s.triedKeySend ? 'pulse-guide' : ''}" ${!s.triedKeySend ? 'disabled' : ''} onclick="openStepQuiz(0)">
        <span class="exp-tag">✅ クリア確認</span>
        <span class="exp-main-label">📝 1問クイズへ進む ➔</span>
      </button>
    </div>

    <div class="sub-widget-box">
      <div class="widget-row">
        <strong>👥 通信人数 <code>n</code> 人と共通鍵の総数シミュレーター</strong>
        <div class="formula-badge" id="s1-formula-badge">
          ${n}人：${n} × (${n} - 1) ÷ 2 ＝ <span style="color:#E11D48;">${totalKeys.toLocaleString()}個</span>
        </div>
      </div>
      <div class="slider-wrap">
        <span>👤 2人</span>
        <input type="range" id="s1-people-slider" min="2" max="100" value="${n}" oninput="step1UpdatePeople(this.value">
        <span>👥 100人（4,950個！）</span>
      </div>
    </div>
  `;
}

function step1SendPlain() {
  sfxTrap();
  state.step1.triedPlain = true;
  animateWire('intercept', '📄', '平文レシピ', '🚨 怪盗が平文をそのまま盗み見！');
  updateBoxUI('receiver', 'box-danger', '😱', '盗聴被害！', '途中でレシピを読まれた！', '<span class="loot-empty">鍵なし</span>');
  updateThiefUI('stole', '😈 盗聴成功', '「暗号化されてないから丸読みニャ！」', '<span class="k-pill k-fake">📄 レシピ</span>');
  triggerFx('thief', '😈 丸読みニャ！', 'fx-danger');
  setGuide('thief', 'danger', '🚨 平文は丸見え！', '「むき出しで送ったら丸見えニャ！次は<strong>『🔒 合鍵(#777)で箱をロック』</strong>を押すニャ！」');
  renderStep1();
}

function step1LockBox() {
  sfxLock();
  state.step1.boxLocked = true;
  updateBoxUI('sender', 'box-locked-common', '🧰🔒', '合鍵でロック済', '暗号箱（#X9$mP...', '<span class="k-pill k-common">🔑 合鍵 #777</span>');
  triggerFx('sender', '🔒 ガチャン！', '');
  setGuide('cafe', 'normal', '🔒 ロック完了！', '「箱に鍵をかけたニャ！でも店長が開けるには<strong>同じ合鍵(#777)</strong>が必要ニャ。<strong>『📡 合鍵(#777)と箱を送る』</strong>を押してみて！」');
  renderStep1();
}

function step1SendKeyAndBox() {
  sfxTrap();
  state.step1.boxLocked = true;
  state.step1.triedKeySend = true;
  animateWire('intercept', '🔑＋🧰', '合鍵#777 ＋ 暗号箱', '🚨 怪盗が合鍵をコピーして箱を開封！');
  updateBoxUI('receiver', 'box-danger', '🔓😱', '鍵配送問題で解読！', '怪盗にも合鍵で開けられた！', '<span class="k-pill k-common">🔑 合鍵 #777</span>');
  updateThiefUI('stole', '😈 合鍵コピー', '「送られてきた『🔑 合鍵#777』をコピーして箱を開けたニャ！」', '<span class="k-pill k-common">🔑 合鍵コピー</span><span class="k-pill k-fake">📄 レシピ</span>');
  triggerFx('thief', '🔑 合鍵コピー成功！', 'fx-danger');
  setGuide('cafe', 'alert', '💥 これが「鍵配送問題」！', '「合鍵をネットで送ると怪盗にもコピーされちゃう！これが<strong>『鍵配送問題』</strong>ニャ！緑のボタンでクイズへ進もう！」');
  renderStep1();
}

function step1UpdatePeople(val) {
  const n = parseInt(val, 10);
  state.step1.peopleCount = n;
  const total = (n * (n - 1)) / 2;
  const badge = document.getElementById('s1-formula-badge');
  if (badge) {
    badge.innerHTML = `${n}人：${n} × (${n} - 1) ÷ 2 ＝ <span style="color:#E11D48;">${total.toLocaleString()}個</span>`;
  }
}

// ============================================================================
// STEP 2: 公開鍵暗号方式（4つの鍵セレクト実験付き）
// ============================================================================
function renderStep2() {
  const s = state.step2;
  document.getElementById('sender-name').textContent = '送信者：チョコ';
  document.getElementById('receiver-name').textContent = '受信者：ミルキィ店長';

  if (s.phase === 0 && !s.triedSecretSend && !s.triedSenderPub) {
    setGuide(
      'cafe',
      'normal',
      'STEP 2 公開鍵暗号',
      '「<strong>🔓 店長の公開鍵（開いた南京錠）</strong>だけを配り、<strong>🗝️ 店長の秘密鍵</strong>は金庫に隠すニャ！4つの鍵から選んで実験しよう！」'
    );
    updateBoxUI('sender', '', '📄', '平文（待機中）', '極秘レシピ：ピスタチオ', '<span class="k-pill k-pub">🔓 チョコの公開鍵</span><span class="k-pill k-priv">💮 チョコの秘密鍵</span>');
    updateBoxUI('receiver', '', '🔓', '公開鍵を配布可能', '開いた南京錠を配る準備OK', '<span class="k-pill k-pub">🔓 店長の公開鍵</span><span class="k-pill k-priv">🗝️ 店長の秘密鍵(金庫)</span>');
    updateThiefUI('watching', '👀 監視中', '「どの鍵をネットに流すか見張ってるニャ！」', '<span class="loot-empty">なし</span>');
    animateWire('none', '🔓', '公開鍵ラボ', '誰の・どの鍵を使うか選んで実験しよう');
  }

  const wb = document.getElementById('control-workbench');
  wb.innerHTML = `
    <!-- ① 4つの鍵・瞬間セレクト実験トレイ -->
    <div class="key-selector-tray">
      <span class="tray-label">🎯 4つの鍵セレクト実験（タップして箱に試そう！）：</span>
      <div class="tray-keys">
        <button type="button" class="btn-key-pick k-pub" onclick="step2TrapSenderPub()">🔓 送信者チョコの公開鍵</button>
        <button type="button" class="btn-key-pick k-priv" onclick="step2PickSenderPriv()">💮 送信者チョコの秘密鍵</button>
        <button type="button" class="btn-key-pick k-pub ${s.phase === 1 ? 'pulse-guide' : ''}" onclick="step2PickReceiverPub()">🔓 受信者(店長)の公開鍵</button>
        <button type="button" class="btn-key-pick k-priv ${s.phase === 2 ? 'pulse-guide' : ''}" onclick="step2PickReceiverPriv()">🗝️ 受信者(店長)の秘密鍵</button>
      </div>
    </div>

    <div class="exp-buttons-grid">
      <button type="button" class="btn-exp btn-exp-trap" onclick="step2TrapSecretSend()">
        <span class="exp-tag">❌ ワナA</span>
        <span class="exp-main-label">🗝️ 秘密鍵をネットで送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-trap" onclick="step2TrapSenderPub()">
        <span class="exp-tag">❌ ワナB（頻出ひっかけ）</span>
        <span class="exp-main-label">🔓 送信者チョコの公開鍵で閉める</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 0 ? 'pulse-guide' : ''}" onclick="step2DistributePub()">
        <span class="exp-tag">✅ 手順①</span>
        <span class="exp-main-label">🔓 受信者(店長)の公開鍵を配る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 1 ? 'pulse-guide' : ''}" ${s.phase < 1 ? 'disabled' : ''} onclick="step2LockWithReceiverPub()">
        <span class="exp-tag">✅ 手順②</span>
        <span class="exp-main-label">🔒 店長の公開鍵で閉めて送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-clear ${s.phase === 2 ? 'pulse-guide' : ''}" ${s.phase < 2 ? 'disabled' : ''} onclick="step2DecryptWithReceiverPriv()">
        <span class="exp-tag">✅ 手順③</span>
        <span class="exp-main-label">🗝️ 金庫の「店長の秘密鍵」で開ける</span>
      </button>
    </div>
  `;
}

function step2PickSenderPriv() {
  sfxTrap();
  triggerFx('sender', '❓ それは署名用ニャ！', 'fx-danger');
  setGuide('cafe', 'alert', '💡 それはデジタル署名で使う鍵ニャ！', '「送信者チョコの秘密鍵（💮）はSTEP 3の『デジタル署名』で使うニャ！暗号化には<strong>『🔓 受信者（店長）の公開鍵』</strong>を選ぼう！」');
}

function step2PickReceiverPub() {
  if (state.step2.phase === 0) {
    step2DistributePub();
  } else {
    step2LockWithReceiverPub();
  }
}

function step2PickReceiverPriv() {
  if (state.step2.phase >= 2) {
    step2DecryptWithReceiverPriv();
  } else {
    step2TrapSecretSend();
  }
}

function step2TrapSecretSend() {
  sfxTrap();
  state.step2.triedSecretSend = true;
  addPenalty(5);
  animateWire('intercept', '🗝️', '店長の秘密鍵（流出！）', '🚨 秘密鍵を怪盗にコピーされた！');
  updateThiefUI('stole', '😈 秘密鍵強奪', '「秘密鍵をネットに流すなんて大マヌケニャ！」', '<span class="k-pill k-priv">🗝️ 店長の秘密鍵</span>');
  triggerFx('thief', '😈 秘密鍵ゲット！', 'fx-danger');
  setGuide('cafe', 'alert', '🙅‍♀️ 秘密鍵は外に出さない！', '「<strong>🗝️ 秘密鍵は金庫から一歩も出さない</strong>のが鉄則ニャ！配っていいのは<strong>🔓 公開鍵（開いた南京錠）</strong>だけニャ！」');
}

function step2TrapSenderPub() {
  sfxTrap();
  state.step2.triedSenderPub = true;
  addPenalty(5);
  animateWire('right', '🧰🔒', 'チョコの公開鍵で閉めた箱', '📤 送信者自身の公開鍵でロックして送信…');
  updateBoxUI('receiver', 'box-danger', '🧰❓', '開封不能エラー！', '店長はチョコの秘密鍵を持っていない！', '<span class="k-pill k-priv">🗝️ 店長の秘密鍵(合わない)</span>');
  triggerFx('receiver', '⚡ カチャ…合わない！', 'fx-danger');
  setGuide('cafe', 'alert', '💡 テストNo.1ひっかけ！', '「チョコの公開鍵で閉めたら、店長は開けられないニャ！受け取る人が開けるには<strong>『🔓 受信者（店長）の公開鍵』</strong>で閉めるニャ！」');
}

function step2DistributePub() {
  sfxClick();
  state.step2.phase = 1;
  animateWire('left', '🔓', '店長の公開鍵（南京錠）', '📥 店長 ➔ 📤 チョコへ「開いた南京錠」を配布！');
  updateBoxUI('sender', '', '📄＋🔓', '店長の公開鍵を入手！', '開いた南京錠が届いた！', '<span class="k-pill k-pub">🔓 店長の公開鍵</span>');
  updateThiefUI('watching', '🤨 南京錠を入手', '「開いた南京錠を拾ったけど、何に使うニャ…？」', '<span class="k-pill k-pub">🔓 店長の公開鍵</span>');
  triggerFx('sender', '🔓 南京錠キャッチ！', '');
  setGuide('cafe', 'normal', '🔓 手順①クリア！', '「開いた南京錠（公開鍵）は怪盗に拾われても平気ニャ！次は<strong>『② 店長の公開鍵で閉めて送る』</strong>を押そう！」');
  renderStep2();
}

function step2LockWithReceiverPub() {
  sfxLock();
  state.step2.phase = 2;
  animateWire('right', '🧰🔒', '店長の公開鍵でロック済', '📤 怪盗が開けようとするが…開かない！');
  updateBoxUI('sender', 'box-locked-pub', '🧰🔒', '店長の公開鍵でロック', '暗号箱（#P9@zW...', '<span class="k-pill k-pub">🔓 店長の公開鍵</span>');
  updateBoxUI('receiver', 'box-locked-pub', '🧰🔒', '暗号箱が到着！', '金庫の秘密鍵で開けよう！', '<span class="k-pill k-priv">🗝️ 店長の秘密鍵(金庫)</span>');
  updateThiefUI('foiled', '😭 解読不能！', '「南京錠で閉まった南京錠は開けられないニャー！！」', '<span class="k-pill k-pub">🔓 公開鍵(開けられない!)</span>');
  triggerFx('sender', '🔒 ガチャン！', 'fx-success');
  triggerFx('thief', '⚡ カンッ！開かない！', 'fx-danger');
  setGuide('cafe', 'happy', '🎉 公開鍵では開けられない！', '「<strong>公開鍵は閉める専用</strong>だから怪盗には絶対開けられないニャ！最後は<strong>『③ 店長の秘密鍵で開ける』</strong>を押そう！」');
  renderStep2();
}

function step2DecryptWithReceiverPriv() {
  sfxStamp();
  state.step2.phase = 3;
  updateBoxUI('receiver', 'box-success', '🎂✨', '復号大成功！', '極秘レシピ：ピスタチオ', '<span class="k-pill k-priv">🗝️ 店長の秘密鍵で開封！</span>');
  triggerFx('receiver', '✨ パカッ！復号成功！', 'fx-success');
  showHankoStamp();
  setTimeout(() => openStepQuiz(1), 650);
}

// ============================================================================
// STEP 3: デジタル署名とハッシュミキサー＆二重ロック実験
// ============================================================================
function renderStep3() {
  const s = state.step3;
  document.getElementById('sender-name').textContent = '送信者：チョコ（署名者）';
  document.getElementById('receiver-name').textContent = '受信者：店長（検証者）';

  const currentHash = computeHexHash(s.docText);
  const isMatch = currentHash === '#A9F2';
  s.tampered = !isMatch;

  if (s.phase === 0 && !s.triedNoSig) {
    setGuide(
      'cafe',
      'normal',
      'STEP 3 デジタル署名',
      '「怪盗のなりすまし＆改ざんを防ぐため、<strong>💮 送信者チョコの秘密鍵</strong>でハッシュ値にデジタル署名を付けるニャ！」'
    );
    updateBoxUI('sender', '', '📝', '注文書（署名待ち', '「マカロン10個」', '<span class="k-pill k-priv">💮 チョコの秘密鍵(金庫)</span>');
    updateBoxUI('receiver', '', '📭', '検証待機中', 'チョコの公開鍵で待機中', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
    updateThiefUI('watching', '😈 改ざん狙い', '「注文数を『9999個』に書き換えてやるニャ！」', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
    animateWire('none', '💮', 'デジタル署名ラボ', 'ハッシュ値を計算して署名しよう');
  }

  const wb = document.getElementById('control-workbench');
  wb.innerHTML = `
    <div class="exp-buttons-grid">
      <button type="button" class="btn-exp btn-exp-trap" onclick="step3TrapNoSig()">
        <span class="exp-tag">❌ ワナ実験</span>
        <span class="exp-main-label">📄 署名なしで注文書を送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 0 ? 'pulse-guide' : ''}" onclick="step3CalcHash()">
        <span class="exp-tag">✅ 手順①</span>
        <span class="exp-main-label">🔢 ハッシュ値(#A9F2)を計算</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 1 ? 'pulse-guide' : ''}" ${s.phase < 1 ? 'disabled' : ''} onclick="step3SignAndSend()">
        <span class="exp-tag">✅ 手順②</span>
        <span class="exp-main-label">💮 チョコの秘密鍵で署名して送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step" ${s.phase < 2 ? 'disabled' : ''} onclick="step3DoubleLockCombo()">
        <span class="exp-tag">🛡️ 応用：二重ロック</span>
        <span class="exp-main-label">🔒 署名＋店長の公開鍵で暗号化</span>
      </button>

      <button type="button" class="btn-exp btn-exp-clear ${s.phase === 2 && isMatch ? 'pulse-guide' : ''}" ${s.phase < 2 ? 'disabled' : ''} onclick="step3VerifySig()">
        <span class="exp-tag">✅ 手順③</span>
        <span class="exp-main-label">🔍 チョコの公開鍵で署名を検証</span>
      </button>
    </div>

    <!-- ② ライブ・ハッシュミキサー＆一方向性実験 -->
    <div class="sub-widget-box">
      <div class="hash-mixer-row">
        <strong>🔢 ライブ・ハッシュミキサー（1文字変えると指紋が激変！）</strong>
        <div class="hash-chips-group">
          <button type="button" class="btn-hash-chip ${s.docText === 'マカロン10個' ? 'active-chip' : ''}" onclick="step3SetDocText('マカロン10個')">🔄 正規「マカロン10個」</button>
          <button type="button" class="btn-hash-chip ${s.docText === 'マカロン11個' ? 'active-chip' : ''}" onclick="step3SetDocText('マカロン11個')">✏️ 1文字変更「11個」</button>
          <button type="button" class="btn-hash-chip ${s.docText === 'マカロン10個。' ? 'active-chip' : ''}" onclick="step3SetDocText('マカロン10個。')">✏️ 句点追加「10個。」</button>
          <button type="button" class="btn-hash-chip ${s.docText === 'マカロン9999個' ? 'active-chip' : ''}" onclick="step3SetDocText('マカロン9999個')">😈 怪盗改ざん「9999個」</button>
          <button type="button" class="btn-hash-chip" onclick="step3TryReverseHash()">🚫 ハッシュから元の文を逆算</button>
        </div>
      </div>

      <div class="hash-compare-grid">
        <div class="hash-card">
          <div>🔍 署名（💮チョコの秘密鍵）から復号したハッシュ</div>
          <span class="hash-code">#A9F2（送信時の指紋）</span>
        </div>
        <div class="hash-vs-badge">
          ${isMatch ? '✨ 完全一致！（改ざん無し' : '🚨 不一致！（改ざん検知！'}
        </div>
        <div class="hash-card">
          <div>📄 受信本文 <input type="text" id="live-hash-input" class="hash-input-mini" value="${s.docText}" oninput="step3SetDocText(this.value"> のハッシュ</div>
          <span class="hash-code ${isMatch ? '' : 'hash-bad'}">${currentHash}</span>
        </div>
      </div>
    </div>
  `;
}

function step3SetDocText(newText) {
  sfxClick();
  state.step3.docText = newText;
  const h = computeHexHash(newText);
  const isMatch = h === '#A9F2';
  state.step3.tampered = !isMatch;

  if (state.step3.phase >= 2) {
    if (!isMatch) {
      updateBoxUI('receiver', 'box-danger', '🚨📝', '改ざん検知！', `#A9F2 ≠ ${h}（不一致！）`, '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
      triggerFx('receiver', `🚨 指紋激変 ${h}！`, 'fx-danger');
      setGuide('cafe', 'alert', '🔍 1文字違っただけでハッシュ激変！', `「本文が『${newText}』に変わったら、ハッシュ値が <strong>${h}</strong> に激変して不一致になったニャ！<strong>『🔄 正規「マカロン10個」』</strong>で元に戻そう！」`);
    } else {
      updateBoxUI('receiver', 'box-signed', '📬💮', '正規の注文書', '#A9F2 ＝ #A9F2（完全一致！', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
      triggerFx('receiver', '✨ #A9F2 一致！', 'fx-success');
      setGuide('cafe', 'happy', '✨ ハッシュ完全一致！', '「両方とも <strong>#A9F2</strong> で一致したニャ！<strong>『③ チョコの公開鍵で署名を検証』</strong>を押そう！」');
    }
  }
  renderStep3();
}

function step3TryReverseHash() {
  sfxTrap();
  triggerFx('sender', '🚫 逆算不能（一方向性）！', 'fx-danger');
  setGuide('cafe', 'alert', '🚫 ハッシュ値から元の文は逆算できないニャ！', '「これがハッシュ関数の<strong>『不可逆性（一方向性）』</strong>ニャ！要約値 <code>#A9F2</code> だけを見ても、元の文が何かは絶対に逆算できないニャ！」');
}

function step3DoubleLockCombo() {
  sfxLock();
  state.step3.doubleLocked = true;
  animateWire('right', '🧰🔒(📝＋💮)', '二重ロック：署名付き文書を公開鍵の箱に格納！', '🛡️ 送信者の秘密鍵で署名 ＋ 受信者の公開鍵で暗号化！');
  updateBoxUI(
    'sender',
    'box-locked-pub',
    '🧰🔒💮',
    '二重ロック完了！',
    '<span class="double-lock-badge">①💮チョコの秘密鍵で署名 ➔ ②🔓店長の公開鍵で暗号化</span>',
    '<span class="k-pill k-priv">💮 チョコの秘密鍵</span><span class="k-pill k-pub">🔓 店長の公開鍵</span>'
  );
  updateBoxUI(
    'receiver',
    'box-locked-pub',
    '🧰🔒💮',
    '二重ロック箱が到着！',
    '①🗝️店長の秘密鍵で開封 ➔ ②🔍チョコの公開鍵で署名検証',
    '<span class="k-pill k-priv">🗝️ 店長の秘密鍵</span><span class="k-pill k-pub">🔍 チョコの公開鍵</span>'
  );
  triggerFx('sender', '🛡️ 盗聴も改ざんも完全防御！', 'fx-success');
  setGuide('cafe', 'happy', '🛡️ 応用問題キラー「二重ロック」完成！', '「<strong>①送信者の秘密鍵で署名</strong>してから<strong>②受信者の公開鍵で暗号化</strong>すれば、盗聴防止（機密性）と改ざん検知（完全性）の両方を同時に実現できるニャ！」');
}

function step3TrapNoSig() {
  sfxTrap();
  state.step3.triedNoSig = true;
  addPenalty(5);
  animateWire('intercept', '📝😈', '9999個に改ざん！', '🚨 署名がないため書き換えを見破れない！');
  updateBoxUI('receiver', 'box-danger', '😱', '改ざん被害！', '9999個の偽注文が届いた！', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
  updateThiefUI('stole', '😈 改ざん成功', '「署名がないから書き換えてもバレないニャ！」', '<span class="k-pill k-fake">📝 偽注文書</span>');
  triggerFx('thief', '😈 改ざん成功！', 'fx-danger');
  setGuide('cafe', 'alert', '🚨 署名がないと改ざんし放題！', '「誰が書いたか・書き換えられたか証明するために、<strong>①ハッシュ計算 ➔ ②送信者チョコの秘密鍵で署名</strong>するニャ！」');
}

function step3CalcHash() {
  sfxClick();
  state.step3.phase = 1;
  state.step3.docText = 'マカロン10個';
  state.step3.tampered = false;
  updateBoxUI('sender', '', '🔢📝', 'ハッシュ算出済', '注文書10個 ➔ 指紋 #A9F2', '<span class="k-pill k-priv">💮 チョコの秘密鍵</span>');
  triggerFx('sender', '🔢 指紋 #A9F2！', '');
  setGuide('cafe', 'normal', '🔢 手順①クリア：#A9F2', '「本文から要約値 <strong>#A9F2</strong> を計算したニャ！次は<strong>『② チョコの秘密鍵で署名して送る』</strong>を押そう！」');
  renderStep3();
}

function step3SignAndSend() {
  sfxLock();
  state.step3.phase = 2;
  state.step3.docText = 'マカロン10個';
  state.step3.tampered = false;
  animateWire('right', '📝＋💮', '注文書 ＋ 署名(#A9F2', '📤 送信者チョコの秘密鍵で署名して送信！');
  updateBoxUI('sender', 'box-signed', '📝💮', '署名送信済', '注文書 ＋ 💮署名(#A9F2', '<span class="k-pill k-priv">💮 チョコの秘密鍵(金庫)</span>');
  updateBoxUI('receiver', 'box-signed', '📬💮', '署名付き注文書が到着', 'ハッシュ値 #A9F2 ＝ #A9F2', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
  updateThiefUI('foiled', '😰 偽造不能！', '「チョコの秘密鍵がないから署名を偽造できないニャ！」', '<span class="k-pill k-pub">🔍 公開鍵(偽造不可)</span>');
  triggerFx('sender', '💮 ポン！署名完了', 'fx-success');
  setGuide('cafe', 'normal', '💮 手順②クリア！', '「下の<strong>ハッシュミキサー</strong>で1文字改ざんを試すか、<strong>『③ チョコの公開鍵で署名を検証』</strong>を押そう！」');
  renderStep3();
}

function step3ToggleTamper() {
  if (state.step3.docText === 'マカロン10個') {
    step3SetDocText('マカロン9999個');
  } else {
    step3SetDocText('マカロン10個');
  }
}

function step3VerifySig() {
  if (computeHexHash(state.step3.docText) !== '#A9F2') {
    sfxTrap();
    setGuide('cafe', 'alert', '🚨 改ざん中ニャ！', '「下の<strong>『🔄 正規「マカロン10個」』</strong>ボタンを押してから検証完了してニャ！」');
    return;
  }
  sfxStamp();
  state.step3.phase = 3;
  updateBoxUI('receiver', 'box-success', '💮✨', '本人＆改ざん無し確認！', '#A9F2 ＝ #A9F2（検証成功！', '<span class="k-pill k-pub">🔍 チョコの公開鍵</span>');
  triggerFx('receiver', '💮 本人確認OK！', 'fx-success');
  showHankoStamp();
  setTimeout(() => openStepQuiz(2), 650);
}

// ============================================================================
// STEP 4: 中間者攻撃と認証局(CA)・電子証明書（スマホURLバー付き）
// ============================================================================
function renderStep4() {
  const s = state.step4;
  document.getElementById('sender-name').textContent = '送信者：チョコ';
  document.getElementById('receiver-name').textContent = '受信者：ミルキィ店長';

  if (s.phase === 0) {
    renderBrowserBar(
      false,
      '証明書未確認・すり替え注意',
      '⚠️ <strong>警告</strong>：この公開鍵はまだ認証局(CA)の署名検証が行われていません。怪盗による中間者攻撃の危険があります！'
    );
  } else {
    renderBrowserBar(
      true,
      '👑 ネコ王国認証局CA 検証済',
      '✅ <strong>電子証明書（検証済）</strong>｜所有者：南京錠カフェ・ミルキィ店長｜発行者：👑 ネコ王国認証局(CA)｜CAの公開鍵によりデジタル署名の一致を確認しました。'
    );
  }

  if (s.phase === 0 && !s.triedFakeKey) {
    setGuide(
      'cafe',
      'normal',
      'STEP 4 電子証明書(CA)',
      '「怪盗が私の公開鍵を<strong>『💀 偽の公開鍵』にすり替える【中間者攻撃】</strong>を仕掛けてきたニャ！<strong>👑 認証局(CA)の電子証明書</strong>で本物を見抜こう！」'
    );
    updateBoxUI('sender', '', '🤔🔓', '公開鍵が2つ到着', 'どちらが本物の店長の鍵？', '<span class="k-pill k-pub">👑 認証局(CA)の公開鍵</span>');
    updateBoxUI('receiver', '', '📜🔓', '電子証明書を発行済', 'CA署名付きの公開鍵を配布', '<span class="k-pill k-cert">📜 電子証明書</span><span class="k-pill k-priv">🗝️ 店長の秘密鍵</span>');
    updateThiefUI('watching', '🦹 すり替え中', '「俺の『💀 偽の南京錠』にすり替えたニャ！」', '<span class="k-pill k-fake">💀 偽公開鍵</span><span class="k-pill k-fake">🗝️ 怪盗の秘密鍵</span>');
    animateWire('intercept', '💀⇄🔓', '公開鍵すり替え発生中！', '⚠️ 怪盗が偽の公開鍵にすり替えています');
  }

  const wb = document.getElementById('control-workbench');
  wb.innerHTML = `
    <div class="workbench-title">🧪 実験ボタン：認証局(CA)の電子証明書で偽鍵を見破ろう！</div>

    <div class="exp-buttons-grid">
      <button type="button" class="btn-exp btn-exp-trap" onclick="step4TrapFakeKey()">
        <span class="exp-tag">❌ ワナ実験</span>
        <span class="exp-main-label">💀 証明書を見ずにロックして送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 0 ? 'pulse-guide' : ''}" onclick="step4InspectCert()">
        <span class="exp-tag">✅ 手順①</span>
        <span class="exp-main-label">📜 認証局(CA)の公開鍵で証明書を検査</span>
      </button>

      <button type="button" class="btn-exp btn-exp-clear ${s.phase === 1 ? 'pulse-guide' : ''}" ${s.phase < 1 ? 'disabled' : ''} onclick="step4SendWithCertKey()">
        <span class="exp-tag">✅ 手順②</span>
        <span class="exp-main-label">🔒 本物と確認した公開鍵で送る！</span>
      </button>
    </div>

    <div class="sub-widget-box">
      <div class="cert-inspector-grid">
        <div class="cert-card cert-fake">
          <div><strong>候補A：すり替えられた公開鍵</strong></div>
          <div style="color:#DC2626;">${s.phase >= 1 ? '🚨 CAの署名なし！（怪盗の偽鍵と判明' : '❓ 未検査'}</div>
        </div>
        <div class="cert-card cert-valid">
          <div><strong>候補B：電子証明書付きの公開鍵</strong></div>
          <div style="color:#166534;">${s.phase >= 1 ? '✅ 認証局(CA)の署名一致！（100%店長の鍵' : '📜 認証局(CA)署名付き（未検査）'}</div>
        </div>
      </div>
    </div>
  `;
}

function step4TrapFakeKey() {
  sfxTrap();
  state.step4.triedFakeKey = true;
  addPenalty(5);
  animateWire('intercept', '🧰💀', '偽公開鍵でロックした箱', '🚨 怪盗が自分の秘密鍵で箱を開けて盗読！');
  updateBoxUI('receiver', 'box-danger', '😱💀', '中間者攻撃被害！', '途中で怪盗に開けられた！', '<span class="k-pill k-cert">📜 電子証明書(未確認)</span>');
  updateThiefUI('stole', '😈 すり替え成功', '「偽の公開鍵で閉めてくれたから開け放題ニャ！」', '<span class="k-pill k-fake">📄 盗んだレシピ</span>');
  triggerFx('thief', '😈 中間者攻撃成功！', 'fx-danger');
  setGuide('cafe', 'alert', '🚨 これが「中間者攻撃」！', '「偽の公開鍵で閉めると怪盗に開けられちゃうニャ！<strong>『① 認証局(CA)の公開鍵で証明書を検査』</strong>を押して本物を見分けよう！」');
}

function step4InspectCert() {
  sfxClick();
  state.step4.phase = 1;
  animateWire('left', '📜✨', 'CA署名検証OK・偽鍵を排除！', '✅ 電子証明書で本物の公開鍵を特定！');
  updateBoxUI('sender', 'box-locked-pub', '📜✨', '証明書検証OK！', '候補Bが本物の店長の鍵と判明！', '<span class="k-pill k-cert">📜 本物の店長の公開鍵</span>');
  updateBoxUI('receiver', '', '📜🔓', '検証OK・受信待機', '本物の公開鍵で送ってニャ！', '<span class="k-pill k-cert">📜 電子証明書</span><span class="k-pill k-priv">🗝️ 店長の秘密鍵</span>');
  updateThiefUI('foiled', '😱 偽鍵がバレた', '「認証局(CA)の署名は偽造できないニャ〜！」', '<span class="k-pill k-fake">💀 破棄された偽鍵</span>');
  triggerFx('sender', '📜 本物の鍵を特定！', 'fx-success');
  setGuide('cafe', 'happy', '📜 手順①クリア！', '「上の<strong>📱スマホブラウザ表示も『🔒 https://』に変わった</strong>ニャ！<strong>『② 本物と確認した公開鍵で送る！』</strong>を押そう！」');
  renderStep4();
}

function step4SendWithCertKey() {
  sfxStamp();
  state.step4.phase = 2;
  animateWire('right', '🧰📜', '本物の公開鍵でロック送信', '📤 中間者攻撃を完全ブロックして到着！');
  updateBoxUI('receiver', 'box-success', '🎂📜', '安全に復号成功！', '証明書つきの公開鍵で安全到着！', '<span class="k-pill k-priv">🗝️ 店長の秘密鍵</span>');
  triggerFx('receiver', '✨ 安全に開封！', 'fx-success');
  showHankoStamp();
  setTimeout(() => openStepQuiz(3), 650);
}

// ============================================================================
// STEP 5: ハイブリッド暗号方式（HTTPS）
// ============================================================================
function renderStep5() {
  const s = state.step5;
  document.getElementById('sender-name').textContent = '送信者：チョコ（ブラウザ';
  document.getElementById('receiver-name').textContent = '受信者：カフェWebサーバ';

  renderBrowserBar(
    s.phase >= 1,
    s.phase >= 2 ? 'HTTPS ハイブリッド暗号通信確立' : (s.phase === 1 ? '電子証明書 検証済' : 'HTTPS ハンドシェイク前'),
    '🔒 <strong>HTTPS（SSL/TLS）接続情報</strong>｜証明書：👑 ネコ王国認証局(CA)検証済｜鍵交換：🔓 公開鍵暗号方式で共通鍵を配送｜本文暗号化：🔑 共通鍵暗号方式（超高速ストリーム'
  );

  if (s.phase === 0 && !s.triedPubOnly) {
    setGuide(
      'cafe',
      'normal',
      'STEP 5 ハイブリッド暗号',
      '「100MBの動画を送る総仕上げニャ！<strong>🔑 共通鍵を 🔓 公開鍵の南京錠に入れて送る『ハイブリッド暗号(HTTPS)』</strong>を完成させよう！」'
    );
    updateBoxUI('sender', '', '🎬', '100MBレシピ動画', '高速な「🔑 共通鍵 #FAST」を生成済', '<span class="k-pill k-common">🔑 共通鍵 #FAST</span>');
    updateBoxUI('receiver', '', '🖥️📜', 'HTTPSサーバ', '証明書付きの公開鍵を用意', '<span class="k-pill k-cert">📜 証明書</span><span class="k-pill k-pub">🔓 公開鍵</span><span class="k-pill k-priv">🗝️ 秘密鍵</span>');
    updateThiefUI('watching', '👀 監視中', '「100MBをどうやって速く安全に送るニャ？」', '<span class="loot-empty">なし</span>');
    animateWire('none', '🚀', 'HTTPSラボ', '3ステップでハイブリッド暗号を完成させよう');
  }

  const wb = document.getElementById('control-workbench');
  wb.innerHTML = `
    <div class="workbench-title">🧪 実験ボタン：公開鍵の「安全」× 共通鍵の「爆速」を合体！</div>

    <div class="exp-buttons-grid">
      <button type="button" class="btn-exp btn-exp-trap" onclick="step5TrapPubOnly()">
        <span class="exp-tag">❌ ワナ実験</span>
        <span class="exp-main-label">🐢 100MBを公開鍵だけで送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 0 ? 'pulse-guide' : ''}" onclick="step5StepA()">
        <span class="exp-tag">✅ 手順①</span>
        <span class="exp-main-label">📜 証明書を検証し公開鍵を入手</span>
      </button>

      <button type="button" class="btn-exp btn-exp-step ${s.phase === 1 ? 'pulse-guide' : ''}" ${s.phase < 1 ? 'disabled' : ''} onclick="step5StepB()">
        <span class="exp-tag">✅ 手順②：鍵の安全配送</span>
        <span class="exp-main-label">🔑 共通鍵を「公開鍵」で包んで送る</span>
      </button>

      <button type="button" class="btn-exp btn-exp-clear ${s.phase === 2 ? 'pulse-guide' : ''}" ${s.phase < 2 ? 'disabled' : ''} onclick="step5StepC()">
        <span class="exp-tag">✅ 手順③：超高速通信</span>
        <span class="exp-main-label">🐇 共有した共通鍵で100MBを爆速送信！</span>
      </button>
    </div>

    <div class="sub-widget-box">
      <div class="speed-compare-bars">
        <div class="speed-bar-row">
          <span>🐢 公開鍵だけで100MB通信</span>
          <div class="speed-track"><div class="speed-fill" style="width:95%; background:#EF4444;"></div></div>
          <span style="color:#DC2626;">約12.0秒(重!)</span>
        </div>
        <div class="speed-bar-row">
          <span>🐇 ハイブリッド暗号(HTTPS)</span>
          <div class="speed-track"><div class="speed-fill" style="width:12%; background:#10B981;"></div></div>
          <span style="color:#166534;">約0.15秒(爆速!)</span>
        </div>
      </div>
    </div>
  `;
}

function step5TrapPubOnly() {
  sfxTrap();
  state.step5.triedPubOnly = true;
  animateWire('right', '🐢💦', '公開鍵で100MB計算中…', '🐢 公開鍵暗号は計算が重すぎて大渋滞！');
  triggerFx('sender', '🐢 計算が重すぎる！', 'fx-danger');
  setGuide('cafe', 'alert', '🐢 公開鍵は計算が重い！', '「公開鍵暗号は計算が複雑で遅いから、<strong>小さな『🔑 共通鍵』を送るときだけ公開鍵を使い、本文は共通鍵で送る</strong>ニャ！」');
}

function step5StepA() {
  sfxClick();
  state.step5.phase = 1;
  animateWire('left', '📜＋🔓', 'サーバの公開鍵を取得', '📥 証明書を確認して本物の公開鍵を入手！');
  updateBoxUI('sender', '', '🎬＋🔓', '公開鍵を入手済', '共通鍵 #FAST を南京錠に入れよう！', '<span class="k-pill k-common">🔑 共通鍵 #FAST</span><span class="k-pill k-pub">🔓 サーバ公開鍵</span>');
  triggerFx('sender', '📜 公開鍵ゲット！', '');
  setGuide('cafe', 'normal', '📜 手順①クリア！', '「本物の公開鍵を受け取ったニャ！次は<strong>『② 共通鍵を公開鍵で包んで送る』</strong>を押そう！」');
  renderStep5();
}

function step5StepB() {
  sfxLock();
  state.step5.phase = 2;
  animateWire('right', '🧰🔒(🔑)', '公開鍵で包んだ共通鍵 #FAST', '📤 共通鍵を南京錠に入れて安全に配送！');
  updateBoxUI('sender', 'box-locked-common', '🎬🔑', '共通鍵を安全共有！', '両者が「🔑 共通鍵 #FAST」を共有', '<span class="k-pill k-common">🔑 共通鍵 #FAST</span>');
  updateBoxUI('receiver', 'box-locked-common', '🖥️🔑', '秘密鍵で共通鍵を取出！', '怪盗に知られず共通鍵を入手！', '<span class="k-pill k-common">🔑 共通鍵 #FAST</span><span class="k-pill k-priv">🗝️ 秘密鍵</span>');
  updateThiefUI('foiled', '😱 鍵が盗めない', '「共通鍵が南京錠の中だからコピーできないニャー！」', '<span class="loot-empty">盗聴失敗！</span>');
  triggerFx('receiver', '🔑 共通鍵を安全共有！', 'fx-success');
  triggerFx('thief', '⚡ 開かないニャ！', 'fx-danger');
  setGuide('cafe', 'happy', '🔑 手順②クリア：鍵共有成功！', '「公開鍵の南京錠に入れて送ったから、怪盗に盗まれずに<strong>『🔑 共通鍵 #FAST』</strong>を共有できたニャ！最後は<strong>『③ 共通鍵で100MBを爆速送信！』</strong>を押そう！」');
  renderStep5();
}

function step5StepC() {
  sfxStamp();
  state.step5.phase = 3;
  animateWire('right', '🐇🎬✨', '共通鍵で0.15秒の爆速暗号通信！', '🚀 安全＆超高速なHTTPS通信が完成！');
  updateBoxUI('receiver', 'box-success', '🎂🎬✨', '0.15秒で受信完了！', 'ハイブリッド暗号(HTTPS)完成！', '<span class="k-pill k-common">🔑 共通鍵 #FAST</span>');
  triggerFx('receiver', '🐇 0.15秒で爆速完了！', 'fx-success');
  showHankoStamp();
  setTimeout(() => openStepQuiz(4), 650);
}

// ============================================================================
// クイズモーダル＆クリア画面
// ============================================================================
function openStepQuiz(stepIdx) {
  const data = STEPS_DATA[stepIdx];
  const q = data.quiz;

  const overlay = document.getElementById('stage-overlay');
  document.getElementById('quiz-badge').textContent = `📝 STEP ${data.stepNum} 理解度チェック`;
  document.getElementById('quiz-title').textContent = `STEP ${data.stepNum} クリア！1問チェックニャ！`;
  document.getElementById('quiz-question').textContent = q.question;

  const optContainer = document.getElementById('quiz-options');
  optContainer.innerHTML = '';

  const feedback = document.getElementById('quiz-feedback');
  feedback.style.display = 'none';

  q.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-quiz-opt';
    btn.textContent = `${['ア', 'イ', 'ウ', 'エ'][idx]}. ${optText}`;
    btn.onclick = () => checkQuizAnswer(stepIdx, idx, btn);
    optContainer.appendChild(btn);
  });

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

function checkQuizAnswer(stepIdx, selectedIdx, clickedBtn) {
  const data = STEPS_DATA[stepIdx];
  const q = data.quiz;
  const feedback = document.getElementById('quiz-feedback');
  const fHeader = document.getElementById('feedback-header');
  const fExp = document.getElementById('feedback-exp');
  const nextBtn = document.getElementById('btn-next-step');

  if (selectedIdx === q.answerIndex) {
    sfxSuccess();
    clickedBtn.classList.add('opt-correct');
    document.querySelectorAll('#quiz-options .btn-quiz-opt').forEach(b => { b.disabled = true; });

    if (!state.clearedSteps[stepIdx]) {
      state.clearedSteps[stepIdx] = true;
      addBonus(10);
    }

    fHeader.textContent = '⭕ 大正解ニャ！';
    fHeader.style.color = '#166534';
    fExp.textContent = q.explanation;
    nextBtn.textContent = stepIdx < 4 ? `STEP ${stepIdx + 2} へ進む ➔` : '🎉 クリア画面＆あいことばへ ➔';
    feedback.style.display = 'block';
  } else {
    sfxTrap();
    clickedBtn.classList.add('opt-wrong');
    clickedBtn.disabled = true;
    addPenalty(5);
    fHeader.textContent = '❌ おしいニャ！もう1つ選んでみて！';
    fHeader.style.color = '#BE123C';
    fExp.textContent = 'ヒント：実験で「誰が開けるか／誰が署名するか」を思い出そう！';
    feedback.style.display = 'block';
  }
}

function proceedAfterQuiz() {
  sfxClick();
  const overlay = document.getElementById('stage-overlay');
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');

  if (state.currentStep < 4) loadStep(state.currentStep + 1);
  else showClearScreen();
}

function showClearScreen() {
  sfxSuccess();
  showScreen('clear');
  launchConfetti();

  document.getElementById('clear-score').textContent = `${state.score}点`;
  document.getElementById('clear-miss').textContent = `${state.missCount}回`;

  let rankText = 'Sランク：王立暗号マイスター👑';
  if (state.missCount >= 4) rankText = 'Aランク：南京錠カフェ熟練技師🔓';
  else if (state.missCount >= 2) rankText = 'S-ランク：敏腕セキュリティパティシエ💮';
  document.getElementById('clear-rank').textContent = rankText;
}

function showHankoStamp() {
  const stamp = document.getElementById('hankostamp');
  if (!stamp) return;
  stamp.classList.add('show');
  setTimeout(() => stamp.classList.remove('show'), 1150);
}

function launchConfetti() {
  const layer = document.getElementById('confetti-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#FF5A79', '#0EA5E9', '#10B981', '#F59E0B', '#A855F7', '#F43F5E'];
  for (let i = 0; i < 55; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    layer.appendChild(piece);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 4500);
}

function copyKeyword() {
  sfxClick();
  const kw = document.getElementById('classroom-keyword').textContent.trim();
  const fb = document.getElementById('copy-feedback');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(kw).then(() => {
      fb.textContent = '✅ コピー完了！Classroomに貼り付けよう！';
    }).catch(() => fallbackCopy(kw, fb));
  } else {
    fallbackCopy(kw, fb);
  }
}

function fallbackCopy(text, fb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  fb.textContent = '✅ コピー完了！Classroomに貼り付けよう！';
}

function openReviewModal() {
  sfxClick();
  const modal = document.getElementById('reviewModal');
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeReviewModal() {
  sfxClick();
  const modal = document.getElementById('reviewModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
}
