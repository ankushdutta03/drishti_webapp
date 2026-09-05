/* ===== Robust theme controller ===== */
(function () {
  const root = document.documentElement;
  const media = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

  function getSavedTheme() {
    try { return localStorage.getItem("drishti-theme") || "auto"; }
    catch (e) { return "auto"; }
  }

  function saveTheme(mode) {
    try { localStorage.setItem("drishti-theme", mode); } catch (e) {}
  }

  function applyTheme(mode) {
    const actual = mode === "auto"
      ? (media && media.matches ? "light" : "dark")
      : mode;

    root.setAttribute("data-theme", actual);

    ["auto", "light", "dark"].forEach(function (name) {
      const btn = document.getElementById(
        "theme" + name.charAt(0).toUpperCase() + name.slice(1)
      );
      if (btn) btn.classList.toggle("active", name === mode);
    });
  }

  window.setTheme = function (mode) {
    if (["auto", "light", "dark"].indexOf(mode) === -1) mode = "auto";
    saveTheme(mode);
    applyTheme(mode);
  };

  applyTheme(getSavedTheme());

  if (media) {
    const onChange = function () {
      if (getSavedTheme() === "auto") applyTheme("auto");
    };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }
})();

/* ===== Privacy / PII demo controller ===== */
let hybridMode = false;

function updatePrivacyUI() {
  const privateBtn = document.getElementById("modePrivate");
  const hybridBtn = document.getElementById("modeHybrid");
  const state = document.getElementById("privacyState");
  const payload = document.getElementById("sanitizedPayload");

  if (privateBtn) privateBtn.classList.toggle("active", !hybridMode);
  if (hybridBtn) hybridBtn.classList.toggle("active", hybridMode);

  if (state) {
    state.textContent = hybridMode
      ? "● sanitized channel only"
      : "● network blocked";
  }

  if (payload) {
    payload.textContent = hybridMode
      ? 'SANITIZED PAYLOAD: {"email":"[REDACTED]","password":"[REDACTED]","phone":"[REDACTED]"}'
      : "SANITIZED PAYLOAD: not transmitted";
    payload.classList.toggle("safe", hybridMode);
  }

  const network = document.getElementById("networkCalls");
  if (network && !running) network.textContent = hybridMode ? "1*" : "0";
}

window.setPrivacyMode = function (hybrid) {
  if (running) return;
  hybridMode = !!hybrid;
  updatePrivacyUI();
};

async function privacyScan() {
  const demo = document.getElementById("privacyDemo");
  const status = document.getElementById("privacyScanStatus");
  const items = demo ? demo.querySelectorAll(".privacy-item") : [];

  if (demo) demo.classList.add("scan");
  if (status) status.textContent = "scanning locally…";

  items.forEach(function (item) {
    item.classList.remove("redacted");
  });

  await sleep(350);

  items.forEach(function (item) {
    item.classList.add("redacted");
  });

  if (status) status.textContent = hybridMode
    ? "3 sensitive regions protected · sanitized"
    : "3 sensitive regions protected · local only";

  await sleep(450);

  if (demo) demo.classList.remove("scan");
}

function resetPrivacy() {
  const demo = document.getElementById("privacyDemo");
  const status = document.getElementById("privacyScanStatus");
  const items = demo ? demo.querySelectorAll(".privacy-item") : [];

  if (demo) demo.classList.remove("scan");
  items.forEach(function (item) {
    item.classList.remove("redacted");
  });

  if (status) status.textContent = "waiting";
  updatePrivacyUI();
}

document.addEventListener("DOMContentLoaded", function () {
  const privateBtn = document.getElementById("modePrivate");
  const hybridBtn = document.getElementById("modeHybrid");

  if (privateBtn) {
    privateBtn.addEventListener("click", function () {
      window.setPrivacyMode(false);
    });
  }
  if (hybridBtn) {
    hybridBtn.addEventListener("click", function () {
      window.setPrivacyMode(true);
    });
  }

  updatePrivacyUI();
});

let running = false;
let timerInt = null;
let elapsed = 0;

function boxFor(el, pad){
  pad = pad || 5;
  const page = document.getElementById('page');
  const pr = page.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    left: (r.left - pr.left) + page.scrollLeft - pad,
    top: (r.top - pr.top) + page.scrollTop - pad,
    width: r.width + pad*2,
    height: r.height + pad*2
  };
}

function placeDet(id, el, label, pad){
  const b = boxFor(el, pad);
  const d = document.getElementById(id);
  d.style.left = b.left+'px';
  d.style.top = b.top+'px';
  d.style.width = b.width+'px';
  d.style.height = b.height+'px';
  d.querySelector('.tag').textContent = label;
}

function ensureDet(id){
  if(document.getElementById(id)) return;
  const el = document.createElement('div');
  el.className = 'det';
  el.id = id;
  el.innerHTML = '<span class="tag"></span>';
  document.getElementById('page').appendChild(el);
}

['det-from','det-to','det-date','det-class','det-submit'].forEach(ensureDet);

function setStep(i, state){
  const el = document.querySelector(`.step[data-step="${i}"]`);
  if(!el) return;
  el.classList.remove('active');
  if(state==='active') el.classList.add('active');
  if(state==='done') el.classList.add('done');
}

function moveCursor(x,y){
  const c = document.getElementById('cursor');
  c.style.left = x+'px';
  c.style.top = y+'px';
  c.classList.add('show');
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function startTimer(){
  elapsed = 0;
  document.getElementById('timer').textContent = '0.0s';
  timerInt = setInterval(()=>{
    elapsed += 0.1;
    document.getElementById('timer').textContent = elapsed.toFixed(1)+'s';
  }, 100);
}
function stopTimer(){ if(timerInt){ clearInterval(timerInt); timerInt=null; } }

async function runAgent(){
  if(running) return;
  running = true;
  resetVisuals();
  document.getElementById('runBtn').disabled = true;
  document.getElementById('resetBtn').disabled = true;
  const pill = document.getElementById('statuspill');
  pill.textContent = 'running'; pill.className = 'status-pill running';
  startTimer();

  // Step 1: capture
  setStep(0,'active');
  await sleep(450);
  setStep(0,'done');

  // Privacy layer: inspect sensitive regions locally before optional reasoning
  await privacyScan();
  document.getElementById('networkCalls').textContent = hybridMode ? '1*' : '0';

  // Step 2: perceive — detect all 5 elements
  setStep(1,'active');
  document.getElementById('scanline').classList.add('run'); document.querySelector('.browser')?.classList.add('scanning');
  await sleep(650);
  const targets = [
    ['det-from', document.getElementById('box-from'), 'input_field · 0.96'],
    ['det-to', document.getElementById('box-to'), 'input_field · 0.94'],
    ['det-date', document.getElementById('box-date'), 'input_field · 0.91'],
    ['det-class', document.getElementById('box-class'), 'dropdown · 0.93'],
    ['det-submit', document.getElementById('btn-submit'), 'button · 0.98'],
  ];
  targets.forEach(([id, el, label])=>{ placeDet(id, el, label); document.getElementById(id).classList.add('show'); });
  document.getElementById('latency').textContent = '38 ms';
  document.getElementById('detcount').textContent = '5';
  document.getElementById('scanline').classList.remove('run'); document.querySelector('.browser')?.classList.remove('scanning');
  await sleep(500);
  setStep(1,'done');

  // Step 3: ground on "to" field, dim the rest
  setStep(2,'active');
  await sleep(450);
  ['det-from','det-date','det-class','det-submit'].forEach(id=>document.getElementById(id).classList.add('dim'));
  document.getElementById('det-to').classList.add('active');
  await sleep(550);
  setStep(2,'done');

  // Step 4: click + type
  setStep(3,'active');
  const toBox = document.getElementById('box-to');
  const tb = boxFor(toBox,0);
  moveCursor(tb.left+18, tb.top+18);
  await sleep(550);
  toBox.classList.remove('empty');
  toBox.textContent = 'Delhi (NDLS)';
  await sleep(450);
  document.getElementById('det-to').classList.remove('show','active');
  ['det-from','det-date','det-class','det-submit'].forEach(id=>document.getElementById(id).classList.remove('show','dim'));
  setStep(3,'done');

  // Step 5: re-perceive, ground submit
  setStep(4,'active');
  document.getElementById('scanline').classList.add('run'); document.querySelector('.browser')?.classList.add('scanning');
  await sleep(650);
  placeDet('det-submit', document.getElementById('btn-submit'), 'button · 0.99');
  document.getElementById('det-submit').classList.add('show','active');
  document.getElementById('scanline').classList.remove('run'); document.querySelector('.browser')?.classList.remove('scanning');
  await sleep(500);
  setStep(4,'done');

  // Step 6: click submit, reveal results
  setStep(5,'active');
  const sb = boxFor(document.getElementById('btn-submit'),0);
  moveCursor(sb.left+22, sb.top+16);
  await sleep(550);
  document.getElementById('btn-submit').style.filter = 'brightness(1.35)';
  await sleep(250);
  document.getElementById('btn-submit').style.filter = 'none';
  document.getElementById('det-submit').classList.remove('show','active');
  document.getElementById('results').classList.add('show');
  await sleep(150);
  document.getElementById('tc1').classList.add('in');
  await sleep(140);
  document.getElementById('tc2').classList.add('in');
  await sleep(300);
  setStep(5,'done');

  stopTimer();
  pill.textContent = 'task complete'; pill.className = 'status-pill done';
  document.getElementById('runBtn').disabled = false;
  document.getElementById('resetBtn').disabled = false;
  running = false;
}

function resetVisuals(){ document.querySelector('.browser')?.classList.remove('scanning');
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('active','done'));
  document.querySelectorAll('.det').forEach(d=>d.classList.remove('show','active','dim'));
  document.getElementById('cursor').classList.remove('show');
  document.getElementById('box-to').classList.add('empty');
  document.getElementById('box-to').textContent = 'Enter destination';
  document.getElementById('btn-submit').style.filter = 'none';
  document.getElementById('results').classList.remove('show');
  document.getElementById('tc1').classList.remove('in');
  document.getElementById('tc2').classList.remove('in');
  document.getElementById('latency').textContent = '—';
  document.getElementById('detcount').textContent = '—';
  document.getElementById('networkCalls').textContent = '0';
  resetPrivacy();
  stopTimer();
  document.getElementById('timer').textContent = '0.0s';
}

function resetDemo(){
  if(running) return;
  resetVisuals();
  const pill = document.getElementById('statuspill');
  pill.textContent = 'idle'; pill.className = 'status-pill';
}

/* ===== SIH-specific runtime layer ===== */
(function(){
  const $ = id => document.getElementById(id);
  const gpu = $('gpuStatus');
  const cap = $('captureStatus');
  const red = $('redactionCount');
  const serverStatus = $('serverStatus');
  const endpoint = $('serverEndpoint');

  async function checkGPU(){
    try{
      if(navigator.gpu){
        const adapter = await navigator.gpu.requestAdapter();
        gpu.textContent = adapter ? 'AVAILABLE' : 'NOT AVAILABLE';
      }else{
        gpu.textContent = 'NOT AVAILABLE';
      }
    }catch(e){ gpu.textContent = 'NOT AVAILABLE'; }
  }
  checkGPU();

  $('captureScreenBtn')?.addEventListener('click', async ()=>{
    if(!navigator.mediaDevices?.getDisplayMedia){
      cap.textContent = 'Screen capture API is unavailable in this browser/context.';
      return;
    }
    try{
      const stream = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false});
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      cap.textContent = `Captured locally: ${settings.width||'?'}×${settings.height||'?'} ${settings.displaySurface||'screen/tab/window'}. No upload performed.`;
      track.stop();
    }catch(e){
      cap.textContent = 'Capture cancelled or blocked. The deterministic SIH demo is still available above.';
    }
  });

  $('runPrivacyBtn')?.addEventListener('click', ()=>{
    // Deterministic demo values correspond to the visible sensitive examples in the original prototype.
    let count = 0;
    document.querySelectorAll('#privacyDemo .privacy-item').forEach(item=>{
      const label = item.querySelector('.pi-label')?.textContent?.trim().toLowerCase();
      if(label==='email' || label==='password' || label==='phone'){
        item.classList.add('redacted');
        count++;
      }
    });
    red.textContent = String(count);
    const s = $('sanitizedPayload');
    if(s) s.textContent = `SANITIZED PAYLOAD: ${count} sensitive region(s) redacted locally; raw values excluded.`;
    if(typeof privacyScan === 'function') privacyScan();
  });

  $('sendSanitizedBtn')?.addEventListener('click', async ()=>{
    const url = endpoint.value.trim() || '/api/agent';
    const privateActive = document.getElementById('modePrivate')?.classList.contains('active');
    if(privateActive){
      serverStatus.textContent = 'BLOCKED';
      cap.textContent = 'Private mode: network request blocked by the client privacy gate.';
      return;
    }

    const payload = {
      screen_context: {
        elements: ['source field','destination field','date field','class selector','Search Trains button'],
        sensitive_regions: 'redacted',
        redaction_scheme: 'local bounding-box masking',
        raw_pixels: false
      },
      task: 'Search a train from Kolkata to Delhi, 3A class, for 18 Sep',
      allowed_actions: ['click','scroll'],
      protocol: 'drishti-sanitized-v1'
    };

    try{
      serverStatus.textContent = 'SENDING…';
      const r = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data = await r.json().catch(()=>({}));
      serverStatus.textContent = r.ok ? 'CONNECTED' : `HTTP ${r.status}`;
      cap.textContent = r.ok
        ? `Sanitized context accepted. Server response: ${JSON.stringify(data).slice(0,240)}`
        : `Server rejected the request with HTTP ${r.status}.`;
    }catch(e){
      serverStatus.textContent = 'ERROR';
      cap.textContent = `No connection to configured endpoint. ${e.message}`;
    }
  });
})();

/* ===== Event wiring for controls that used inline onclick in the original
   prototype. Manifest V3's default extension-page CSP (script-src 'self')
   disallows inline event handler attributes, so these are bound here
   instead. Behavior is identical to the original demo. ===== */
document.addEventListener('DOMContentLoaded', function () {
  var themeAuto = document.getElementById('themeAuto');
  var themeLight = document.getElementById('themeLight');
  var themeDark = document.getElementById('themeDark');
  var runBtn = document.getElementById('runBtn');
  var resetBtn = document.getElementById('resetBtn');

  if (themeAuto) themeAuto.addEventListener('click', function () { window.setTheme('auto'); });
  if (themeLight) themeLight.addEventListener('click', function () { window.setTheme('light'); });
  if (themeDark) themeDark.addEventListener('click', function () { window.setTheme('dark'); });
  if (runBtn) runBtn.addEventListener('click', function () { runAgent(); });
  if (resetBtn) resetBtn.addEventListener('click', function () { resetDemo(); });
});
