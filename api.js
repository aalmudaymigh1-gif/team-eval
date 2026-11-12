/* تقييم الفريق — طبقة الاتصال مع Supabase (بديل Code.gs) */
(function () {
  const SB_URL = 'https://qwagdoopszcyezywyfad.supabase.co';
  const SB_KEY = 'sb_publishable_QS6Ujy65uyr2MQJUT-691g_2vkeRKxP';
  const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const BUCKET = 'files';
  const FN_URL = SB_URL + '/functions/v1/push';
  const FILES_URL = SB_URL + '/functions/v1/files';
  let CRED = {};
  const NOTIFY = ['tasks_add', 'task_return', 'task_update', 'inv_approve', 'inv_return', 'inv_fix', 'att_bad', 'att_bad_undo'];
  function flush() {
    fetch(FN_URL, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{"op":"flush"}', keepalive: true }).catch(() => {});
  }

  const TRUST = 'الأمانة والمصداقية';
  const HEAVY = [TRUST];
  const heavy = c => HEAVY.indexOf(c) >= 0;
  const STAR_CRIT = 'موقف مميز';
  const MAX_MEDIA = 5, MAX_VID = 45 * 1024 * 1024;
  const DEF = { miss: 5, trust: 10, star: 5, starCap: 100, clean: 50 };
  const CRITERIA = [
    { n: 'الحضور والمواعيد', s: 'الأداء', short: 'الحضور', bad: 'ركّز على الحضور بوقتك والالتزام بمواعيد التسليم.' },
    { n: 'جودة الشغل', s: 'الأداء', short: 'جودة الشغل', bad: 'راجع الشغل قبل التسليم عشان ما نحتاج نعيده.' },
    { n: 'إدارة العمال', s: 'الأداء', short: 'إدارة العمال', bad: 'تابع العمال أكثر وتأكد إن كل واحد عارف شغله.' },
    { n: 'حل المشاكل', s: 'الأداء', short: 'حل المشاكل', bad: 'حاول تحل المشاكل البسيطة بنفسك وترجع لي بالكبيرة بس.' },
    { n: 'متابعة الأعمال الموكلة', s: 'الأداء', short: 'المتابعة', bad: 'اللي أوكّله لك سجّله وتابعه لين يخلص، لا يضيع منك.' },
    { n: 'التركيز والانتباه', s: 'الأداء', short: 'التركيز', bad: 'وقت الدوام للشغل، خلّ الجوال والسوالف بعدين.' },
    { n: 'تأمين المشروع', s: 'الأداء', short: 'تأمين المشروع', bad: 'قبل ما تطلع تأكد إن الموقع مقفل والمواد والعدّة محفوظة.' },
    { n: 'الأمانة والمصداقية', s: 'السلوك', short: 'الأمانة', bad: 'الأمانة والوضوح في المصاريف والمعلومات خط أحمر، انتبه لها.' },
    { n: 'الاحترام وحسن التعامل', s: 'السلوك', short: 'الاحترام', bad: 'انتبه لأسلوبك في التعامل مع العمال والعملاء.' },
    { n: 'الالتزام بالتعليمات', s: 'السلوك', short: 'التعليمات', bad: 'نفّذ التعليمات مثل ما هي، وإذا عندك رأي قوله قبل التنفيذ.' },
    { n: 'النظافة', s: 'السلوك', short: 'النظافة', bad: 'اهتم بنظافة المكان والأدوات ونظافتك الشخصية.' },
    { n: 'الانضباط والمظهر', s: 'السلوك', short: 'الانضباط', bad: 'اهتم بانضباطك ومظهرك قدام العمال والعملاء.' }
  ];
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  /* ---------- اتصال ---------- */
  /* الإصدار 63: أي رقم عربي ينحفظ إنجليزي */
  const toEn = s => s.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x6F0));
  function enDeep(v) {
    if (typeof v === 'string') return toEn(v);
    if (Array.isArray(v)) return v.map(enDeep);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { o[k] = enDeep(v[k]); }); return o; }
    return v;
  }
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, enDeep(args));
    if (error) throw new Error(friendly(error));
    return data;
  }
  function friendly(e) {
    const m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ما فيه اتصال، تأكد من النت وجرّب مرة ثانية';
    return m || 'صار خطأ، جرّب مرة ثانية';
  }
  /* الإصدار 74: كل عملية تطلع برقم طلب (rid). لو وصلت السيرفر مرتين ينحفظ أول وحدة بس، والإعادة بعد فشل الاتصال تستخدم نفس الرقم */
  const RID = {};
  const NO_RID = ['ticket', 'push_sub', 'proj_add', 'admin_newkey'];
  const RID_SKIP = ['grp', 'lat', 'lng', 'acc', 'rid'];
  const ridKey = (op, a) => op + '|' + JSON.stringify(a, (k, v) => RID_SKIP.indexOf(k) >= 0 ? undefined : v);
  const newRid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, '');
  async function withRid(fn, op, a) {
    if (NO_RID.indexOf(op) >= 0) return fn(a);
    const key = ridKey(op, a), now = Date.now();
    Object.keys(RID).forEach(x => { if (RID[x].exp && RID[x].exp < now) delete RID[x]; });
    if (!RID[key]) RID[key] = { id: newRid(), exp: 0 };
    /* الإصدار 91: الرقم ينمسح أول ما ترد العملية بنجاح، عشان نفس العملية بنفس المحتوى تنحفظ لو انعادت عن قصد. يبقى 20 ثانية بس لو الرد تأخر (ممكن التطبيق حسبها فشلت)، ويبقى لو فشلت */
    const ent = RID[key], t0 = Date.now();
    const r = await fn(Object.assign({}, a, { rid: ent.id }));
    if (Date.now() - t0 < 10000) { if (RID[key] === ent) delete RID[key]; } else ent.exp = Date.now() + 20000;
    return r;
  }
  const aexec = (k, op, a) => withRid(x => rpc('admin_exec', { k: k, op: op, a: x }), op, a || {});
  const eexec = (t, op, a) => withRid(x => rpc('emp_exec', { t: t, op: op, a: x }), op, a || {});
  const gadmin = (k, op, a) => op === 'add' ? withRid(x => rpc('guide_admin', { k: k, op: op, a: x }), 'guide_' + op, a || {}) : rpc('guide_admin', { k: k, op: op, a: a || {} });
  const gemp = (t, op, a) => rpc('guide_emp', { t: t, op: op, a: a || {} });

  let RAW = null;
  /* الإصدار 60: التحميل الخفيف (المهام المنتهية من أكثر من 90 يوم تنجاب عند الطلب)، ولو الدالة الجديدة مو موجودة يرجع للقديمة */
  let LITE = true;
  const noFn = e => /Could not find the function|schema cache|PGRST202/i.test(String(e && e.message || e));
  async function loadAdmin(k) {
    CRED = { k: k };
    if (LITE) { try { RAW = norm(await rpc('admin_raw2', { k: k, days: 90 })); return RAW; } catch (e) { if (!noFn(e)) throw e; LITE = false; } }
    RAW = norm(await rpc('admin_raw', { k: k })); return RAW;
  }
  async function loadEmp(t) {
    CRED = { t: t };
    if (LITE) { try { RAW = norm(await rpc('emp_raw2', { t: t, days: 90 })); return RAW; } catch (e) { if (!noFn(e)) throw e; LITE = false; } }
    RAW = norm(await rpc('emp_raw', { t: t })); return RAW;
  }

  function norm(r) {
    r.employees = (r.employees || []).map(e => ({ id: e.id, name: e.name, salary: Number(e.salary) || 0, max: Number(e.max) || 0,
      token: e.token || '', active: e.active !== false, track: !!e.track, attend: !!e.attend, guide: !!e.guide, lang: e.lang || 'ar', payDay: Number(e.payDay) || 28, payNext: !!e.payNext }));
    r.guides = (r.guides || []).map(g => Object.assign({}, g, { points: Array.isArray(g.points) ? g.points : [], q: g.q && typeof g.q === 'object' ? g.q : null }));
    r.greads = (r.greads || []).map(x => Object.assign({}, x, { secs: Number(x.secs) || 0, wrong: Number(x.wrong) || 0 }));
    r.attendance = (r.attendance || []).map(x => Object.assign({}, x, { homeLat: x.homeLat == null ? null : Number(x.homeLat), homeLng: x.homeLng == null ? null : Number(x.homeLng), inLat: x.inLat == null ? null : Number(x.inLat), inLng: x.inLng == null ? null : Number(x.inLng),
      outLat: x.outLat == null ? null : Number(x.outLat), outLng: x.outLng == null ? null : Number(x.outLng), late: Number(x.late) || 0 }));
    r.logs = r.logs || [];
    r.fin = (r.fin || []).map(f => Object.assign({}, f, { amount: Number(f.amount) || 0, months: Number(f.months) || 0 }));
    r.tasks = (r.tasks || []).map(t => {
      const pr = Array.isArray(t.proofs) ? t.proofs : [];
      return Object.assign({}, t, { photo: pr[0] || '', extra: pr.slice(1), media: Array.isArray(t.media) ? t.media : [], urgent: !!t.urgent, proof: t.proof || 'photo' });
    });
    r.projects = (r.projects || []).map(p => Object.assign({}, p, { lat: p.lat == null ? null : Number(p.lat), lng: p.lng == null ? null : Number(p.lng) }));
    r.invoices = (r.invoices || []).map(x => Object.assign({}, x, { amount: Math.round((Number(x.amount) || 0) * 100) / 100,
      photos: Array.isArray(x.photos) ? x.photos : [] }));
    return r;
  }

  /* ---------- ملفات ---------- */
  function dataUrlBlob(d) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(d || ''));
    if (!m) throw new Error('الصورة غير صالحة');
    const bin = atob(m[2]), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if (u.length > 8 * 1024 * 1024) throw new Error('الصورة كبيرة، جرّب وحدة ثانية');
    return new Blob([u], { type: m[1] });
  }
  function put(path, blob, type, onProgress) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', SB_URL + '/storage/v1/object/' + BUCKET + '/' + path);
      x.setRequestHeader('apikey', SB_KEY);
      x.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      x.setRequestHeader('Content-Type', type || blob.type || 'application/octet-stream');
      x.setRequestHeader('x-upsert', 'false');
      x.setRequestHeader('cache-control', 'max-age=31536000');
      /* الإصدار 87: لو ما تقدّم الرفع 45 ثانية (نت ضعيف أو مقطوع) يتوقف ويطلع خطأ واضح، بدل ما يعلّق بدون نهاية */
      let wd; const kick = () => { clearTimeout(wd); wd = setTimeout(() => { try { x.abort(); } catch (e) {} rej(new Error('تعذّر رفع الملف لأن الاتصال ضعيف. اللي ارتفع محفوظ، وأعد المحاولة يكمل الباقي')); }, 45000); };
      if (x.upload) x.upload.onprogress = ev => { kick(); if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total); };
      x.onloadend = () => clearTimeout(wd);
      kick();
      x.onload = () => {
        clearTimeout(wd);
        if (x.status >= 200 && x.status < 300) return res(path);
        let m = ''; try { m = JSON.parse(x.responseText).message || ''; } catch (e) {}
        rej(new Error(m || 'ما ارتفع الملف، جرّب مرة ثانية'));
      };
      x.onerror = () => { clearTimeout(wd); rej(new Error('ما فيه اتصال، تأكد من النت وجرّب مرة ثانية')); };
      x.ontimeout = () => rej(new Error('الاتصال تأخر، جرّب مرة ثانية'));
      x.send(blob);
    });
  }
  /* الصورة اللي ارتفعت ما ترتفع مرة ثانية لو أعاد المحاولة */
  const UPD = new Map();
  const thumbOf = p => /\.jpg$/.test(p) ? p.replace(/\.jpg$/, '_t.jpg') : '';
  async function makeThumb(blob) {
    let src;
    try { src = await createImageBitmap(blob); } catch (e) {
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
    }
    const w = src.width, h = src.height, s = Math.min(1, 480 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.72));
  }
  async function putImg(path, blob, onProg) {
    const t = thumbOf(path);
    const thumbJob = t ? makeThumb(blob).then(tb => tb ? put(t, tb, 'image/jpeg') : null).catch(() => null) : null;
    await Promise.all([put(path, blob, blob.type, onProg), thumbJob]);
    return path;
  }

  /* روابط الصور (من الإصدار 60): تطلع من دالة files بعد التحقق من الصلاحية، صالحة ساعة، وتنحفظ 50 دقيقة */
  const LS = 'urlc2', KEEP = 50 * 60000;
  try { localStorage.removeItem('urlc1'); } catch (e) {}
  let UC = {};
  try { UC = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { UC = {}; }
  (function prune() { const n = Date.now(); Object.keys(UC).forEach(k => { if (!UC[k] || UC[k].x < n) delete UC[k]; }); })();
  let saveT;
  function saveUC() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(UC)); } catch (e) {} }, 300); }
  const fresh = k => UC[k] && UC[k].x > Date.now();
  async function signMany(paths) {
    const need = Array.from(new Set(paths.filter(p => p && !fresh(p))));
    if (!need.length) return;
    for (let i = 0; i < need.length; i += 100) {
      const part = need.slice(i, i + 100);
      let j = null;
      try {
        const r = await fetch(FILES_URL, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ op: 'sign', paths: part }, CRED)) });
        j = await r.json().catch(() => null);
        if (!r.ok) throw new Error((j && j.error) || 'ما قدرت أفتح الملف');
      } catch (e) { throw new Error(friendly(e)); }
      const x = Date.now() + KEEP, urls = (j && j.urls) || {};
      part.forEach(p => { if (urls[p]) UC[p] = { u: urls[p], x: x }; });
    }
    saveUC();
  }
  async function fileUrl(path) {
    if (!path) throw new Error('ما فيه صورة');
    await signMany([path]);
    if (!UC[path] || !UC[path].u) throw new Error('ما قدرت أفتح الملف');
    return UC[path].u;
  }
  async function imgUrl(path) {
    if (!path) throw new Error('ما فيه صورة');
    const t = thumbOf(path);
    await signMany(t ? [path, t] : [path]);
    if (t && UC[t] && UC[t].u) return UC[t].u;
    if (!UC[path] || !UC[path].u) throw new Error('ما قدرت أفتح الملف');
    return UC[path].u;
  }
  async function prefetch(paths) {
    const ps = Array.from(new Set(paths.filter(Boolean))).slice(0, 150);
    if (!ps.length) return {};
    await signMany(ps.concat(ps.map(thumbOf).filter(Boolean)));
    const out = {};
    ps.forEach(p => {
      const t = thumbOf(p), u = (t && UC[t] && UC[t].u) || (UC[p] && UC[p].u) || '';
      if (u) { out[p] = u; const im = new Image(); im.decoding = 'async'; im.src = u; }
    });
    return out;
  }

  /* ---------- أدوات ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()).replace(/[^a-f0-9]/g, '').slice(0, 12);
  const nowMonth = () => RAW.today.slice(0, 7);
  function nextMonth_(mk) {
    let y = Number(mk.slice(0, 4)), m = Number(mk.slice(5, 7)) + 1;
    if (m === 13) { m = 1; y++; }
    return y + '-' + (m < 10 ? '0' : '') + m;
  }
  function monthsRange_(from, to) {
    const out = []; let mk = from, guard = 0;
    while (mk <= to && guard++ < 60) { out.push(mk); mk = nextMonth_(mk); }
    return out;
  }
  function monthLabel_(mk) { return MONTHS[Number(mk.slice(5, 7)) - 1] + ' ' + mk.slice(0, 4); }
  function addDay(d, n) {
    const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  }
  function settings_() {
    const s = RAW.settings || {};
    const g = (k, d) => { const v = s[k]; return v == null || v === '' || !isFinite(Number(v)) ? d : Number(v); };
    return { miss: g('MISS_SAR', DEF.miss), trust: g('TRUST_SAR', DEF.trust), star: g('STAR_SAR', DEF.star),
      starCap: g('STAR_CAP', DEF.starCap), clean: g('CLEAN_SAR', DEF.clean) };
  }
  function attCfg_() {
    const s = RAW.settings || {};
    return { start: s.WORK_START || '07:00', grace: Number(s.GRACE_MIN || 15), auto: (s.ATT_AUTO || '1') === '1' };
  }
  function projMap_(ps) { const m = {}; ps.forEach(p => { m[p.id] = p.name; }); return m; }
  /* الإصدار 83: موعد صرف راتب الشهر لكل موظف (يوم + نفس الشهر أو الشهر اللي بعده) */
  function dueDate_(emp, mk) {
    let y = Number(mk.slice(0, 4)), m = Number(mk.slice(5, 7));
    if (emp.payNext) { m++; if (m > 12) { m = 1; y++; } }
    return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(28, Math.max(1, emp.payDay || 28))).padStart(2, '0');
  }
  const rr2 = n => Math.round(n * 100) / 100;
  const fromP_ = p => Number((p.details && p.details.fromParts) || 0);
  function payDetails_(f) {
    return { base: f.base, bonus: f.bonus, points: f.points, target: f.target, max: f.max,
      advance: f.advance, inst: f.inst, deds: f.deds, loanParts: f.loanParts, net: f.net };
  }
  /* الإصدار 83: الرواتب المتراكمة والدفعات. الدفعة تتوزع على أقدم راتب ما انصرف، والشهر اللي يكتمل يتقفل بصرف «سُدد بالدفعات» */
  /* الإصدار 85: كل دفعة لها شهر (اختياري). تتوزع على شهرها أول، وبعدها على أقدم شهر ما انسدد. extra = دفعة جديدة للمعاينة قبل الحفظ */
  function salSt_(emp, fin, logs, now, extra) {
    const mine = fin.filter(f => f.emp === emp.id);
    const parts = mine.filter(f => f.kind === 'part').sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
    if (extra) parts.push({ id: '_new', amount: extra.amount, month: extra.month || '', date: extra.date || null, note: extra.note || '', ts: '~' });
    const pays = mine.filter(f => f.kind === 'pay');
    const rows = monthsRange_(startMonth_(emp, logs, fin), now).map(mk => {
      const p = pays.filter(x => x.month === mk)[0];
      if (p) return { month: mk, label: monthLabel_(mk), closed: true, due: p.amount, cap: fromP_(p), via: !!(p.details && p.details.part), date: p.date, payId: p.id };
      const f = finMonth_(emp, fin, logs, mk);
      return { month: mk, label: f.label, closed: false, due: Math.max(0, f.net), cap: Math.max(0, f.net), dueDate: f.due, f: f };
    });
    const caps = rows.map(r => r.cap), got = rows.map(() => 0), totalCap = rr2(caps.reduce((x, y) => x + y, 0));
    let cum = 0;
    const hist = parts.map(p => {
      let r = p.amount; const al = [], ti = p.month ? rows.findIndex(x => x.month === p.month) : -1, order = ti >= 0 ? [ti] : [];
      rows.forEach((x, i) => { if (i !== ti) order.push(i); });
      order.forEach(i => {
        if (r <= 0 || caps[i] <= 0) return;
        const rest = got[i] > 0 || caps[i] < rows[i].cap, tk = rr2(Math.min(caps[i], r));
        caps[i] = rr2(caps[i] - tk); got[i] = rr2(got[i] + tk); r = rr2(r - tk); cum = rr2(cum + tk);
        al.push({ month: rows[i].month, label: rows[i].label, take: tk, done: caps[i] === 0, rest: rest });
      });
      return { id: p.id, date: p.date || null, amount: p.amount, month: p.month || '', note: p.note || '', al: al, extra: r, after: rr2(Math.max(0, totalCap - cum)) };
    });
    const open = [], months = rows.map((r, i) => {
      if (r.closed) return { month: r.month, label: r.label, due: r.due, paid: r.due, left: 0, closed: true, via: r.via, date: r.date, payId: r.payId };
      r.f.credit = got[i]; open.push(r.f);
      return { month: r.month, label: r.label, due: r.due, paid: got[i], left: rr2(r.due - got[i]), closed: false, dueDate: r.dueDate, full: r.due > 0 && got[i] >= r.due };
    });
    const due = rr2(months.reduce((x, m) => x + m.due, 0)), paid = rr2(months.reduce((x, m) => x + m.paid, 0));
    const real = hist.filter(h => h.id !== '_new');
    return { show: real.length > 0 || open.length > 1, open: open, months: months.slice(-12), parts: real.slice().reverse(), due: due, paid: paid, left: rr2(due - paid),
      lastPart: real.length ? real[real.length - 1].id : '', preview: extra ? hist[hist.length - 1] : null,
      close: extra ? months.filter(m => !m.closed && m.full).map(m => m.month) : [] };
  }
  function prevMonth_(mk) { let y = Number(mk.slice(0, 4)), m = Number(mk.slice(5, 7)) - 1; if (m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
  /* الإصدار 85: الشهور اللي قبل بداية الحساب (12 شهر) وما لها صرف، عشان يقدر يسجّل راتب قديم على شهره */
  function prevMonths_(emp, fin, logs) {
    const out = []; let mk = startMonth_(emp, logs, fin);
    for (let i = 0; i < 12; i++) { mk = prevMonth_(mk); if (!isPaid_(fin, emp.id, mk)) { const f = finMonth_(emp, fin, logs, mk); out.push({ month: mk, label: f.label, net: f.net }); } }
    return out;
  }
  function isPaid_(fin, empId, mk) { return fin.some(f => f.kind === 'pay' && f.emp === empId && f.month === mk); }
  function startMonth_(emp, logs, fin) {
    let s = (RAW.settings && RAW.settings.START) || '2026-11';
    logs.forEach(l => { if (l.emp === emp.id && l.date.slice(0, 7) < s) s = l.date.slice(0, 7); });
    fin.forEach(f => { if (f.emp === emp.id && f.month && f.month < s) s = f.month; });
    return s;
  }
  function cleanAmount_(v) {
    const n = Math.round(Number(String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '')) * 100) / 100;
    if (!(n > 0) || n > 1000000) throw new Error('اكتب المبلغ');
    return n;
  }
  function pick_(m) {
    let best = null, bv = 0;
    CRITERIA.forEach(c => { if ((m[c.n] || 0) > bv) { bv = m[c.n]; best = c; } });
    return best;
  }

  /* ---------- الحساب (نفس منطق Code.gs) ---------- */
  function calcMonth_(emp, logs, mk) {
    const st = settings_();
    const seen = {}, mMap = {};
    let misses = 0, trust = 0, stars = 0;
    logs.forEach(l => {
      if (l.emp !== emp.id || l.date.slice(0, 7) !== mk) return;
      if (l.type === '+') { if (l.crit === STAR_CRIT) stars++; return; }
      const k = l.date + '|' + l.crit;
      if (seen[k]) return;
      seen[k] = true;
      if (heavy(l.crit)) trust++; else misses++;
      mMap[l.crit] = (mMap[l.crit] || 0) + (heavy(l.crit) ? 3 : 1);
    });
    const track = !!emp.track;
    const base = track ? 0 : (emp.max || 0);
    const deduct = misses * st.miss + trust * st.trust;
    const reward = track ? 0 : Math.min(stars * st.star, st.starCap);
    const clean = !track && misses + trust === 0 ? st.clean : 0;
    const bonus = track ? 0 : Math.max(0, base - deduct + reward + clean);
    const w = pick_(mMap);
    const starTxt = stars === 1 ? 'موقف مميز واحد' : stars === 2 ? 'موقفين مميزين' : stars + (stars <= 10 ? ' مواقف مميزة' : ' موقف مميز');
    return {
      month: mk, label: monthLabel_(mk), base: base, deduct: deduct, reward: reward, clean: clean, bonus: bonus,
      misses: misses + trust, trustMisses: trust, stars: stars, salary: emp.salary, total: emp.salary + bonus,
      points: bonus, target: 0, max: base, settings: st, track: track,
      strength: stars ? { crit: 'مواقف مميزة', text: starTxt + ' هالشهر، يعطيك العافية.' } : null,
      improve: w ? { crit: w.n, text: w.bad } : null
    };
  }
  function loanDue_(emp, fin, mk) {
    const pays = fin.filter(f => f.kind === 'pay' && f.emp === emp.id && f.month !== mk);
    const parts = {}; let total = 0;
    fin.filter(f => f.kind === 'loan' && f.emp === emp.id && f.start <= mk).forEach(l => {
      const paidSoFar = pays.reduce((s, p) => s + ((p.details && p.details.loanParts && p.details.loanParts[l.id]) || 0), 0);
      const per = Math.ceil(l.amount / l.months);
      const due = Math.max(0, Math.min(per, l.amount - paidSoFar));
      if (due > 0) { parts[l.id] = due; total += due; }
    });
    return { total: total, parts: parts };
  }
  function finMonth_(emp, fin, logs, mk) {
    const pay = fin.filter(f => f.kind === 'pay' && f.emp === emp.id && f.month === mk)[0];
    if (pay && pay.details) {
      const d = pay.details;
      return { month: mk, label: monthLabel_(mk), paid: true, paidAmount: pay.amount, paidDate: pay.date, payId: pay.id, due: dueDate_(emp, mk), fromParts: fromP_(pay), viaParts: !!d.part,
        base: d.base, bonus: d.bonus, points: d.points, target: d.target, max: d.max,
        advance: d.advance, inst: d.inst, deds: d.deds || [], loanParts: d.loanParts || {}, net: d.net, warn10: false, track: !!emp.track };
    }
    const c = calcMonth_(emp, logs, mk);
    const advance = fin.filter(f => f.kind === 'adv' && f.emp === emp.id && f.month === mk).reduce((s, f) => s + f.amount, 0);
    const due = loanDue_(emp, fin, mk);
    const deds = fin.filter(f => f.kind === 'ded' && f.emp === emp.id && f.month === mk).map(f => ({ note: f.note, amount: f.amount }));
    const dedT = deds.reduce((s, f) => s + f.amount, 0);
    return { month: mk, label: monthLabel_(mk), paid: false, due: dueDate_(emp, mk),
      base: emp.salary, bonus: c.bonus, points: c.points, target: 20, max: c.max,
      advance: advance, inst: due.total, deds: deds, loanParts: due.parts,
      net: emp.salary + c.bonus - advance - due.total - dedT,
      warn10: due.total + dedT > emp.salary * 0.1, track: !!emp.track };
  }
  function loanBalances_(emp, fin) {
    const pays = fin.filter(f => f.kind === 'pay' && f.emp === emp.id);
    return fin.filter(f => f.kind === 'loan' && f.emp === emp.id).map(l => {
      const paid = pays.reduce((s, p) => s + ((p.details && p.details.loanParts && p.details.loanParts[l.id]) || 0), 0);
      return { id: l.id, date: l.date, amount: l.amount, months: l.months, per: Math.ceil(l.amount / l.months),
        paid: paid, remaining: Math.max(0, l.amount - paid), note: l.note };
    }).filter(l => l.remaining > 0);
  }
  function txList_(rows) {
    return rows.slice().sort((a, b) => a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0).map(f => ({
      id: f.id, date: f.date, ts: f.ts || '', kind: f.kind, amount: f.amount, months: f.months, start: f.start, via: !!(f.details && f.details.part), fromParts: fromP_(f),
      month: f.month, label: f.month ? monthLabel_(f.month) : (f.start ? monthLabel_(f.start) : ''), note: f.note }));
  }
  function groups_(rows) {
    const st = settings_();
    const map = {}, order = [];
    rows.forEach(l => {
      if (l.type === '+' && l.crit !== STAR_CRIT) return;
      const g = l.group + l.type;
      if (!map[g]) { map[g] = { id: l.group, date: l.date, type: l.type, crits: [], note: l.note, pts: 0 }; order.push(g); }
      if (l.type === '+') map[g].pts += st.star;
      else { map[g].crits.push(l.crit); map[g].pts -= heavy(l.crit) ? st.trust : st.miss; }
    });
    return order.map(g => map[g]).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }
  function taskInv_(id) {
    const x = RAW.invoices.filter(v => v.task === id).slice(-1)[0];
    return x ? { id: x.id, amount: x.amount, vendor: x.vendor || '', paidBy: x.paidBy, status: x.status } : null;
  }
  function tasksFor_(empId, tasks, today, pmap) {
    const mine = tasks.filter(t => t.emp === empId);
    const open = mine.filter(t => t.status !== 'done').sort((a, b) => {
      const x = a.due || '9999-99-99', y = b.due || '9999-99-99';
      return x < y ? -1 : x > y ? 1 : (a.ts < b.ts ? -1 : 1);
    });
    const done = mine.filter(t => t.status === 'done').sort((a, b) => a.doneAt < b.doneAt ? 1 : -1).slice(0, 15);
    return open.concat(done).map(t => ({
      id: t.id, title: t.title, due: t.due, note: t.note, status: t.status, doneAt: t.doneAt.slice(0, 10),
      comment: t.comment, cmtEdited: !!t.cmtEdited, apNote: t.apNote || '', hasPhoto: !!t.photo, reason: t.reason, urgent: t.urgent,
      proofs: [t.photo].concat(t.extra || []).filter(Boolean),
      project: pmap[t.project] ? t.project : '', pname: pmap[t.project] || '', media: t.media, proof: t.proof || 'photo',
      inv: t.proof === 'invoice' ? taskInv_(t.id) : null,
      late: t.status !== 'done' && t.status !== 'review' && !!t.due && t.due < today,
      lateDone: t.status === 'done' && !!t.due && t.doneAt.slice(0, 10) > t.due }));
  }
  /* العهدة: c باقي معه، o له عندك من جيبه، t كل اللي له عندك */
  function invParts_(rows, empId) {
    let g = 0, rt = 0, sd = 0, cash = 0, own = 0;
    rows.forEach(x => {
      if (!x.emp || x.emp !== empId || x.status !== 'ok') return;
      if (x.kind === 'give') { if (x.paidBy === 'own') sd += x.amount; else if (x.paidBy === 'ret') rt += x.amount; else g += x.amount; }
      else if (x.paidBy === 'own') own += x.amount;
      else if (x.paidBy !== 'card') cash += x.amount;
    });
    const r2 = n => Math.round(n * 100) / 100;
    const rawO = own - sd, o = Math.max(0, rawO), c = g - rt - cash + Math.max(0, -rawO);
    return { c: r2(c), o: r2(o), t: r2(o), g: r2(g), rt: r2(rt), cash: r2(cash), own: r2(own), sd: r2(sd) };
  }
  function invOut_(x, pmap) {
    return { id: x.id, ts: x.ts, emp: x.emp, kind: x.kind, amount: x.amount, desc: x.desc, project: x.project,
      pname: x.project ? (pmap[x.project] || '') : '', nph: x.photos.length, photos: x.photos, status: x.status, reason: x.reason,
      method: x.method || '', warrantyUntil: x.warrantyUntil || '', vendor: x.vendor || '', task: x.task || '', taskDeleted: !!x.taskDeleted,
      paidBy: ['card', 'own', 'ret'].indexOf(x.paidBy) >= 0 ? x.paidBy : 'cash', oldAmount: x.oldAmount == null ? null : Number(x.oldAmount) };
  }

  function empPayload_(emp) {
    const logs = RAW.logs, fin = RAW.fin, now = nowMonth(), todayS = RAW.today;
    const pmap = projMap_(RAW.projects);
    const mine = logs.filter(l => l.emp === emp.id);
    const inv = RAW.invoices.filter(x => x.emp === emp.id);
    return {
      id: emp.id,
      name: emp.name,
      today: todayS,
      tasks: tasksFor_(emp.id, RAW.tasks, todayS, pmap),
      month: calcMonth_(emp, logs, now),
      fin: finMonth_(emp, fin, logs, now),
      sal: salSt_(emp, fin, logs, now),
      entries: groups_(mine.filter(l => l.date.slice(0, 7) === now)),
      history: monthsRange_(startMonth_(emp, logs, fin), now).reverse().map(mk => {
        const f = finMonth_(emp, fin, logs, mk);
        return { month: mk, label: monthLabel_(mk), points: f.points, bonus: f.bonus, net: f.net,
          paid: f.paid, paidAmount: f.paidAmount, paidDate: f.paidDate };
      }),
      loans: loanBalances_(emp, fin),
      tx: txList_(fin.filter(f => f.emp === emp.id)).slice(0, 30),
      rules: settings_(),
      projects: RAW.projects.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })),
      attend: !!emp.attend,
      alerts: (RAW.alerts || []).filter(a => a.kind === 'task'),
      lang: emp.lang || 'ar',
      guideOn: !!emp.guide,
      guides: RAW.guides.map(g => {
        const r = RAW.greads.filter(x => x.guide === g.id && x.emp === emp.id)[0] || {};
        return { id: g.id, ts: g.ts, title: g.title, points: g.points, q: g.q ? { text: g.q.text || '', opts: g.q.opts || [] } : null,
          done: r.done || '', opened: r.opened || '' };
      }).filter(g => RAW.greads.some(x => x.guide === g.id && x.emp === emp.id)),
      att: RAW.attendance.filter(x => x.emp === emp.id),
      attCfg: attCfg_(),
      inv: Object.assign(invParts_(inv, emp.id), { balance: invParts_(inv, emp.id).c, owed: invParts_(inv, emp.id).t,
        items: inv.slice().reverse().slice(0, 60).map(x => invOut_(x, pmap)) })
    };
  }

  function adminPayload_() {
    const emps = RAW.employees.filter(e => e.active);
    const logs = RAW.logs, fin = RAW.fin, tasks = RAW.tasks, now = nowMonth(), todayS = RAW.today;
    const projects = RAW.projects, pmap = projMap_(projects);
    const empIds = emps.map(e => e.id);
    const bal = {};
    const parts = {};
    emps.forEach(e => { parts[e.id] = invParts_(RAW.invoices, e.id); bal[e.id] = parts[e.id].c; });
    return {
      inv: { bal: bal, parts: parts, items: RAW.invoices.slice().reverse().map(x => invOut_(x, pmap)) },
      attendance: RAW.attendance,
      attCfg: attCfg_(),
      alerts: RAW.alerts || [],
      guides: RAW.guides.map(g => ({ id: g.id, ts: g.ts, title: g.title, points: g.points, q: g.q,
        reads: RAW.greads.filter(x => x.guide === g.id).map(x => Object.assign({ name: (empById(x.emp) || {}).name || '' }, x)) })),
      projects: projects.map(p => ({ id: p.id, name: p.name, archived: p.archived, lat: p.lat, lng: p.lng,
        open: tasks.filter(t => t.project === p.id && t.status !== 'done' && empIds.indexOf(t.emp) >= 0).length })),
      criteria: CRITERIA.map(c => ({ n: c.n, s: c.s, short: c.short })),
      today: todayS,
      yesterday: addDay(todayS, -1),
      month: monthLabel_(now),
      settings: settings_(),
      employees: emps.map(e => {
        const mine = logs.filter(l => l.emp === e.id);
        const sal = salSt_(e, fin, logs, now);
        return {
          id: e.id, name: e.name, salary: e.salary, max: e.max, token: e.token, track: e.track, attend: e.attend, guide: e.guide, lang: e.lang, payDay: e.payDay, payNext: e.payNext, sal: sal, prevMonths: prevMonths_(e, fin, logs), seen: (RAW.seen || {})[e.id] || 0, left: (RAW.left || {})[e.id] || 0,
          month: calcMonth_(e, logs, now),
          recent: groups_(mine).slice(0, 15),
          unpaid: sal.open,
          loans: loanBalances_(e, fin),
          tx: txList_(fin.filter(f => f.emp === e.id)),
          tasks: tasksFor_(e.id, tasks, todayS, pmap)
        };
      })
    };
  }

  /* الإصدار 74: لو انحفظت العملية وفشل التحديث بعدها، ترجع البيانات القديمة مع علامة __stale بدل ما يطلع خطأ */
  async function reloadAdmin(k, r) {
    let out;
    try { await loadAdmin(k); out = adminPayload_(); }
    catch (e) { out = adminPayload_(); out.__stale = true; }
    if (r && r.dup) out.__dup = true;
    return out;
  }
  async function reloadEmp(t, r) {
    let out;
    try { out = await API.apiEmp(t); }
    catch (e) { const emp = RAW && empById(RAW.me); if (!emp) throw e; out = empPayload_(emp); out.__stale = true; }
    if (r && r.dup) out.__dup = true;
    return out;
  }
  /* الإصدار 76: العملية وتحديث البيانات في طلب واحد (admin_exec2 و emp_exec2). لو الدالة مو موجودة يرجع للطريقة القديمة */
  let X2 = true;
  async function exec2(fn, args, op, a) {
    if (!X2) return null;
    try { return await withRid(x => rpc(fn, Object.assign({}, args, { op: op, a: x, days: 90 })), op, a || {}); }
    catch (e) { if (!noFn(e)) throw e; X2 = false; return null; }
  }
  async function adminDo(k, op, a) {
    const x2 = await exec2('admin_exec2', { k: k }, op, a);
    if (x2) {
      CRED = { k: k }; RAW = norm(x2.raw);
      if (NOTIFY.indexOf(op) >= 0) flush();
      const out = adminPayload_();
      if (x2.r && x2.r.dup) out.__dup = true;
      return out;
    }
    const r = await aexec(k, op, a);
    if (NOTIFY.indexOf(op) >= 0) flush();
    return reloadAdmin(k, r);
  }
  async function empDo(t, op, a) {
    const x2 = await exec2('emp_exec2', { t: t }, op, a);
    if (x2) {
      CRED = { t: t }; RAW = norm(x2.raw);
      flush();
      const emp = empById(RAW.me);
      if (!emp) throw new Error('الرابط غير صالح');
      const out = empPayload_(emp);
      if (x2.r && x2.r.dup) out.__dup = true;
      return out;
    }
    const r = await eexec(t, op, a);
    flush();
    return reloadEmp(t, r);
  }
  const empById = id => RAW.employees.filter(e => e.id === id)[0];

  async function attDo(token, op, dataUrl, pos, project) {
    const paths = await empUpload(token, [dataUrl], 1);
    const p = pos || {};
    return empDo(token, op, { photo: paths[0], lat: p.lat == null ? '' : String(p.lat), lng: p.lng == null ? '' : String(p.lng),
      acc: p.acc == null ? '' : String(Math.round(p.acc)), project: project || '' });
  }
  async function empUpload(token, dataUrls, max, onProg) {
    const list = (Array.isArray(dataUrls) ? dataUrls : [dataUrls]).filter(Boolean).slice(0, max);
    const pr = list.map(d => UPD.has(d) ? 1 : 0), tell = () => { if (onProg) onProg(pr.filter(v => v >= 1).length, list.length, Math.round(pr.reduce((a, v) => a + v, 0) / (list.length || 1) * 100)); };
    tell();
    return Promise.all(list.map(async (d, i) => {
      if (UPD.has(d)) return UPD.get(d);
      const blob = dataUrlBlob(d);
      if (blob.size > 5 * 1024 * 1024) throw new Error('الصورة كبيرة، جرّب وحدة ثانية');
      const r = await eexec(token, 'ticket', {});
      const p = await putImg(r.path, blob, v => { pr[i] = Math.min(v, 0.99); tell(); });
      UPD.set(d, p); pr[i] = 1; tell();
      return p;
    }));
  }

  /* ---------- الواجهات (نفس أسماء Code.gs) ---------- */
  const API = {
    async apiAdmin(k) { await loadAdmin(k); return adminPayload_(); },

    async apiAdd(k, x) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      if (!RAW.employees.some(e => e.id === x.emp)) throw new Error('اختر الموظف');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ''))) throw new Error('التاريخ غير صحيح');
      if (isPaid_(RAW.fin, x.emp, x.date.slice(0, 7))) throw new Error('راتب هالشهر انصرف وتقفل، ما ينفع تسجل فيه');
      let misses = (x.misses || []).filter((c, i, a) => a.indexOf(c) === i && CRITERIA.some(k2 => k2.n === c));
      const starNote = x.star ? String(x.star.note || '').trim().slice(0, 300) : '';
      if (x.star && !starNote) throw new Error('اكتب وش سوّى عشان الموقف المميز');
      const sameDay = RAW.logs.filter(l => l.emp === x.emp && l.date === x.date && l.type === '-').map(l => l.crit);
      const before = misses.length;
      misses = misses.filter(c => sameDay.indexOf(c) < 0);
      const skipped = before - misses.length;
      if (!misses.length && !starNote) throw new Error(skipped ? 'هالتقصير متسجل له بنفس اليوم' : 'كل شي تمام، ما فيه شي تسجله');
      const grp = uid();
      const note = String(x.note || '').trim().slice(0, 300);
      const rows = misses.map(c => ({ date: x.date, emp: x.emp, type: '-', crit: c, note: note, grp: grp }));
      if (starNote) rows.push({ date: x.date, emp: x.emp, type: '+', crit: STAR_CRIT, note: starNote, grp: grp });
      const out = await adminDo(k, 'log_add', { rows: rows });
      out.lastId = grp; out.skipped = skipped;
      return out;
    },

    async apiDelete(k, group) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const l = RAW.logs.filter(v => v.group === group)[0];
      if (l && isPaid_(RAW.fin, l.emp, l.date.slice(0, 7))) throw new Error('راتب هالشهر انصرف وتقفل');
      return adminDo(k, 'log_del', { grp: group });
    },

    async apiSaveEmp(k, x) {
      const name = String(x.name || '').trim();
      if (!name) throw new Error('اكتب اسم الموظف');
      const a = { id: x.id || '', name: name, salary: Math.max(0, Math.round(Number(x.salary) || 0)),
        max: Math.max(0, Math.round(Number(x.max) || 0)), newToken: !!x.newToken };
      if (typeof x.track === 'boolean') a.track = x.track;
      return adminDo(k, 'emp_save', a);
    },

    async apiSaveSettings(k, x) {
      const map = { miss: 'MISS_SAR', trust: 'TRUST_SAR', star: 'STAR_SAR', starCap: 'STAR_CAP', clean: 'CLEAN_SAR' };
      const out = {};
      Object.keys(map).forEach(key => {
        const v = Math.round(Number(x[key]));
        if (!isFinite(v) || v < 0 || v > 100000) throw new Error('فيه رقم غير صحيح');
        out[map[key]] = String(v);
      });
      return adminDo(k, 'settings_save', out);
    },

    async apiAdminLogin(code, label) { return rpc('admin_login', { code: String(code || '').trim(), label: String(label || '').slice(0, 60) }); },
    async apiAdminCode(k) { return rpc('admin_code_new', { k: k }); },
    async apiAdminRotate(k) { return rpc('admin_rotate', { k: k }); },
    async apiAdminLogout(k) { return rpc('admin_logout', { k: k }); },
    async apiCleanup(k, apply) {
      const r = await fetch(FILES_URL, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'cleanup', k: k, apply: !!apply }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error((j && j.error) || 'ما قدرت أجيب الملفات');
      return j;
    },

    async apiPreview(k, empId) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const emp = empById(empId);
      if (!emp) throw new Error('الموظف غير موجود');
      return empPayload_(emp);
    },

    async apiFinAdd(k, x) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const emp = empById(x.emp);
      if (!emp) throw new Error('اختر الموظف');
      const amount = Math.round(Number(x.amount) || 0);
      if (amount <= 0) throw new Error('اكتب المبلغ');
      const fin = RAW.fin, now = nowMonth();
      const note = String(x.note || '').slice(0, 200);
      let a;
      if (x.kind === 'loan') {
        const months = Math.round(Number(x.months) || 0);
        if (months < 1 || months > 24) throw new Error('عدد الأقساط من 1 إلى 24');
        let start = x.start === 'next' ? nextMonth_(now) : now;
        while (isPaid_(fin, emp.id, start)) start = nextMonth_(start);
        a = { date: RAW.today, emp: emp.id, kind: 'loan', amount: amount, months: months, start: start, month: '', note: note };
      } else if (x.kind === 'adv') {
        let month = now;
        while (isPaid_(fin, emp.id, month)) month = nextMonth_(month);
        a = { date: RAW.today, emp: emp.id, kind: 'adv', amount: amount, months: 0, start: '', month: month, note: note };
      } else if (x.kind === 'ded') {
        if (!note.trim()) throw new Error('اكتب سبب الخصم');
        let month = now;
        while (isPaid_(fin, emp.id, month)) month = nextMonth_(month);
        a = { date: RAW.today, emp: emp.id, kind: 'ded', amount: amount, months: 0, start: '', month: month, note: note.trim() };
      } else throw new Error('نوع غير معروف');
      return adminDo(k, 'fin_add', a);
    },

    async apiPay(k, x) {
      await loadAdmin(k);
      const emp = empById(x.emp);
      if (!emp) throw new Error('الموظف غير موجود');
      const mk = String(x.month || '');
      if (!/^\d{4}-\d{2}$/.test(mk) || mk > nowMonth()) throw new Error('الشهر غير صحيح');
      if (isPaid_(RAW.fin, emp.id, mk)) throw new Error('هالشهر انصرف من قبل');
      const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth());
      const f = st.open.filter(m => m.month === mk)[0] || finMonth_(emp, RAW.fin, RAW.logs, mk);
      const cr = f.credit || 0;
      const cashv = x.amount === '' || x.amount == null ? Math.max(0, f.net) - cr : rr2(Number(x.amount));
      if (!(cashv >= 0)) throw new Error('المبلغ غير صحيح');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : RAW.today;
      if (date > RAW.today) throw new Error('تاريخ التسليم بعد اليوم');
      if (date < mk + '-01') throw new Error('تاريخ التسليم قبل شهر الراتب. لو الراتب لشهر قبل، اختر الشهر من «راتب شهر سابق»');
      const details = payDetails_(f);
      if (cr > 0) details.fromParts = cr;
      return adminDo(k, 'fin_add', { date: date, emp: emp.id, kind: 'pay', amount: rr2(cashv + cr), months: 0, start: '', month: mk,
        note: String(x.note || '').slice(0, 200), details: details });
    },

    async apiFinDelete(k, id) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const fin = RAW.fin;
      const r = fin.filter(f => f.id === id)[0];
      if (!r) throw new Error('الحركة غير موجودة');
      if ((r.kind === 'adv' || r.kind === 'ded') && isPaid_(fin, r.emp, r.month)) throw new Error('الشهر انصرف، احذف الصرف أول');
      if (r.kind === 'loan' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.details && f.details.loanParts && f.details.loanParts[r.id])) {
        throw new Error('فيه أقساط من هالسلفة انخصمت، احذف الصرف أول');
      }
      if (r.kind === 'pay' && r.details && r.details.part) throw new Error('هذا الشهر انسدد بدفعة، احذف الدفعة نفسها');
      if (r.kind === 'pay' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.month > r.month)) throw new Error('احذف صرف الشهور اللي بعده أول');
      if (r.kind === 'part' && fin.some(f => f.kind === 'part' && f.emp === r.emp && f.ts > r.ts)) throw new Error('احذف الدفعات اللي بعدها أول');
      return adminDo(k, 'fin_del', { id: id });
    },

    async apiSalPart(k, x) {
      await loadAdmin(k);
      const emp = empById(x.emp);
      if (!emp) throw new Error('الموظف غير موجود');
      const amount = cleanAmount_(x.amount);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : '';
      if (date && date > RAW.today) throw new Error('تاريخ التسليم بعد اليوم');
      const month = /^\d{4}-\d{2}$/.test(x.month || '') ? x.month : '';
      const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth(), { amount: amount, month: month, date: date });
      if (st.preview.extra > 0.001) throw new Error('المبلغ أكثر من المتبقي (' + rr2(amount - st.preview.extra).toLocaleString('en-US') + ')');
      const close = st.close.map(mk => {
        const f = st.open.filter(m => m.month === mk)[0], det = payDetails_(f);
        det.fromParts = Math.max(0, f.net);
        return { month: mk, amount: Math.max(0, f.net), details: det };
      });
      return adminDo(k, 'sal_part', { emp: emp.id, amount: amount, date: date, month: month, note: String(x.note || '').trim().slice(0, 200), close: close });
    },
    /* الإصدار 85: معاينة توزيع الدفعة قبل الحفظ (من البيانات المحمّلة) */
    salPreview(empId, amount, month) {
      const emp = RAW && empById(empId), a = rr2(Number(amount) || 0);
      if (!emp || !(a > 0)) return null;
      const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth(), { amount: a, month: month || '' });
      return { al: st.preview.al, extra: st.preview.extra, after: st.preview.after, close: st.close };
    },
    /* الإصدار 85: تصحيح شهر حركة صرف موجودة وتاريخها (نفس الحركة، بدون حركة ثانية) */
    async apiFinMove(k, id, x) {
      await loadAdmin(k);
      const r = RAW.fin.filter(f => f.id === id)[0];
      if (!r || r.kind !== 'pay') throw new Error('الحركة غير موجودة');
      if (r.details && r.details.part) throw new Error('هذا الشهر انسدد بالدفعات، عدّل الدفعات نفسها');
      if (fromP_(r) > 0) throw new Error('فيه دفعات محسوبة على هذا الصرف، احذف الصرف وسجّله من جديد');
      const emp = empById(r.emp);
      if (!emp) throw new Error('الموظف غير موجود');
      const mk = String(x.month || '');
      if (!/^\d{4}-\d{2}$/.test(mk) || mk > nowMonth()) throw new Error('الشهر غير صحيح');
      if (mk !== r.month && isPaid_(RAW.fin, r.emp, mk)) throw new Error('راتب ' + monthLabel_(mk) + ' مسجّل من قبل');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : r.date;
      if (date > RAW.today) throw new Error('تاريخ التسليم بعد اليوم');
      if (date < mk + '-01') throw new Error('تاريخ التسليم قبل شهر الراتب');
      const others = RAW.fin.filter(f => f.id !== id);
      const f = finMonth_(emp, others, RAW.logs, mk);
      const amount = x.amount === '' || x.amount == null ? r.amount : rr2(Number(x.amount));
      if (!(amount >= 0)) throw new Error('المبلغ غير صحيح');
      return adminDo(k, 'fin_move', { id: id, month: mk, date: date, amount: amount, details: payDetails_(f) });
    },
    async apiEmpPayday(k, empId, day, next) { return adminDo(k, 'emp_payday', { emp: empId, day: Number(day), next: !!next }); },
    /* الإصدار 94 */
    async apiRepLaterPut(id, item, why, aft) { return rpc('rep_later_put', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), why: String(why || ''), aft: String(aft || '') }); },
    async apiRepNoteDel(id, at, txt) { return rpc('rep_note_del', { k: CRED.k || '', id: String(id || ''), at: Number(at) || 0, txt: String(txt || '') }); },
    async apiRepCurAdd(id, item) { return rpc('rep_cur_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || '') }); },
    async apiRepLaterAdd(id, item, aft) { return rpc('rep_later_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), aft: String(aft || '') }); },
    async apiRepCurOrder(id, items) { return rpc('rep_cur_order', { k: CRED.k || '', id: String(id || ''), items: (items || []).map(String) }); },

    async apiProjectAdd(k, name) {
      const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!n) throw new Error('اكتب اسم المشروع');
      const r = await aexec(k, 'proj_add', { name: n });
      return { id: r.id, data: await reloadAdmin(k) };
    },

    async apiTaskRemind(k, id) {
      const r = await rpc('task_remind', { k: k, id: String(id) });
      flush();
      if (RAW && r && r.id) (RAW.alerts = RAW.alerts || []).unshift({ id: r.id, kind: 'task', ref: String(id), item: null, emp: (RAW.tasks.find(t => t.id === String(id)) || {}).emp || '', msg: '', at: Date.now(), seen: null });
      return r || true;
    },
    async apiEmpOrder(k, ids) {
      if (!Array.isArray(ids) || !ids.length) throw new Error('ما فيه ترتيب');
      await rpc('emp_order', { k: k, ids: ids.map(String) });
      return reloadAdmin(k);
    },
    async apiProjOrder(k, ids) {
      if (!Array.isArray(ids) || !ids.length) throw new Error('ما فيه ترتيب');
      return adminDo(k, 'proj_order', { ids: ids.map(String) });
    },

    async apiProjectSave(k, x) {
      const a = { id: x.id };
      if (x.name !== undefined) {
        const n = String(x.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!n) throw new Error('اكتب اسم المشروع');
        a.name = n;
      }
      if (x.archived !== undefined) a.archived = !!x.archived;
      return adminDo(k, 'proj_save', a);
    },

    async apiTasksAdd(k, x) {
      if (!RAW || !RAW.employees || CRED.k !== k) await loadAdmin(k);
      const act = RAW.employees.filter(e => e.active).map(e => e.id);
      const ids = (x.emps || []).filter((id, i, a) => a.indexOf(id) === i && act.indexOf(id) >= 0);
      if (!ids.length) throw new Error('اختر الموظف');
      const project = String(x.project || '');
      if (!project) throw new Error('اختر المشروع');
      if (!RAW.projects.some(p => p.id === project)) throw new Error('المشروع غير موجود');
      const items = (x.items || []).slice(0, 20);
      if (!items.length) throw new Error('اكتب المهمة');
      const rows = [];
      items.forEach((it, n) => {
        const title = String(it.title || '').trim().slice(0, 200);
        if (!title) throw new Error('اكتب عنوان المهمة ' + (n + 1));
        const due = String(it.due || '');
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('الموعد غير صحيح');
        const note = String(it.note || '').trim().slice(0, 1000);
        const media = (it.media || []).filter(m => m && m.id && (m.t === 'i' || m.t === 'v')).slice(0, MAX_MEDIA)
          .map(m => ({ id: String(m.id), t: m.t }));
        const voice = (it.media || []).find(m => m && m.id && m.t === 'a');
        if (voice) media.push({ id: String(voice.id), t: 'a', d: Math.max(0, Math.round(Number(voice.d) || 0)) });
        const proof = ['invoice', 'note'].indexOf(it.proof) >= 0 ? it.proof : 'photo';
        ids.forEach(id => rows.push({ emp: id, title: title, due: due, note: note, project: project, media: media, urgent: !!it.urgent, proof: proof }));
      });
      return adminDo(k, 'tasks_add', { rows: rows });
    },

    oldCount() { return (RAW && RAW.tasksOld) || 0; },
    /* الإصدار 97: «طلعت» ترسل حتى والصفحة تتقفل، وقائمة آخر ظهور للمدير */
    seenOff() { if (!CRED.k && !CRED.t) return; try { fetch(SB_URL + '/rest/v1/rpc/app_seen_off', { method: 'POST', keepalive: true, headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ k: CRED.k || '', t: CRED.t || '' }) }).catch(() => {}); } catch (e) {} },
    async seenList() { const r = await rpc('app_seen_list', { k: CRED.k || '' }); if (RAW && r) { RAW.seen = r.seen || {}; RAW.left = r.left || {}; } return r; },
    seen(ver, label) { rpc('app_seen_mark', { k: CRED.k || '', t: CRED.t || '', ver: String(ver || ''), label: String(label || '').slice(0, 60) }).catch(() => {}); },
    async apiTasksOld(k, q) {
      const old = await rpc('admin_tasks_old', { k: k, q: String(q || ''), lim: 200 });
      const n = norm({ tasks: old || [] }).tasks, have = new Set(RAW.tasks.map(t => t.id));
      RAW.tasks = RAW.tasks.concat(n.filter(t => !have.has(t.id)));
      if (!String(q || '').trim()) RAW.tasksOld = Math.max(0, (RAW.tasksOld || 0) - n.length);
      return adminPayload_();
    },
    async apiTaskDelete(k, id) { return adminDo(k, 'task_del', { id: id }); },
    async apiTasksDelete(k, ids) {
      if (!Array.isArray(ids) || !ids.length) throw new Error('ما حددت مهام');
      await rpc('tasks_del', { k: k, ids: ids.map(String) });
      return reloadAdmin(k);
    },

    async apiTaskReturn(k, id, reason) {
      const r = String(reason || '').trim().slice(0, 300);
      if (!r) throw new Error('اكتب السبب عشان يعرف وش ناقص');
      return adminDo(k, 'task_return', { id: id, reason: r });
    },

    async apiTaskApprove(k, id) { return adminDo(k, 'task_approve', { id: id }); },
    async apiTaskClose(k, id) { return adminDo(k, 'task_close', { id: id }); },

    async apiTaskUpdate(k, id, x) {
      x = x || {};
      const a = { id: id };
      ['title', 'emp', 'note', 'project'].forEach(f => { if (x[f] !== undefined) a[f] = String(x[f] || ''); });
      if (x.due !== undefined) {
        const v = String(x.due || '');
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('الموعد غير صحيح');
        a.due = v;
      }
      if (x.urgent !== undefined) a.urgent = !!x.urgent;
      if (x.proof !== undefined) a.proof = String(x.proof);
      if (x.voice !== undefined) { a.voice = String(x.voice || ''); a.vd = Math.max(0, Math.round(Number(x.vd) || 0)); }
      return adminDo(k, 'task_update', a);
    },

    async apiTaskDone(token, id, comment, dataUrls, extra, onProg) {
      const paths = await empUpload(token, dataUrls || [], 5, onProg);
      const x = extra || {}, a = { id: id, comment: String(comment || ''), proofs: paths };
      if (x.amount !== undefined) { a.amount = cleanAmount_(x.amount); a.vendor = String(x.vendor || '').trim(); a.paidBy = x.paidBy || 'cash'; }
      return empDo(token, 'task_done', a);
    },

    async apiProofAdmin(k, id, fid) { return imgUrl(fid); },
    async apiProofEmp(t, id, fid) { return imgUrl(fid); },
    async apiMediaAdmin(k, taskId, fid) { return fileUrl(fid); },
    async apiMediaEmp(t, taskId, fid) { return fileUrl(fid); },
    async apiInvImgAdmin(k, id, fid) { return imgUrl(fid); },
    async apiInvImgEmp(t, id, fid) { return imgUrl(fid); },
    prefetch: prefetch,

    async apiUploadImg(k, dataUrl) {
      if (UPD.has(dataUrl)) return UPD.get(dataUrl);
      const blob = dataUrlBlob(dataUrl);
      const r = await aexec(k, 'ticket', { kind: 'img', ext: 'jpg' });
      const p = await putImg(r.path, blob);
      UPD.set(dataUrl, p);
      return p;
    },

    async apiUploadVid(k, file, onProgress) {
      if (!file) throw new Error('ما وصل الفيديو، جرّب مرة ثانية');
      if (file.size > MAX_VID) throw new Error('الفيديو أكبر من الحد، صوّره أقصر');
      const ext = ((String(file.name || '').match(/\.(\w{2,4})$/) || [])[1] || 'mp4').toLowerCase();
      const known = { mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', '3gp': 'video/3gpp' };
      let type = String(file.type || '');
      if (['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'].indexOf(type) < 0) type = known[ext] || 'video/mp4';
      const r = await aexec(k, 'ticket', { kind: 'vid', ext: ext === 'm4v' ? 'mp4' : ext });
      return put(r.path, file, type, onProgress);
    },

    async apiUploadAud(k, blob) {
      if (!blob || !blob.size) throw new Error('ما وصل التسجيل، جرّب مرة ثانية');
      if (blob.size > 20 * 1024 * 1024) throw new Error('التسجيل كبير، سجّل أقصر');
      let type = String(blob.type || '').split(';')[0];
      const ext = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[type];
      if (!ext) type = 'audio/mp4';
      const r = await aexec(k, 'ticket', { kind: 'aud', ext: ext || 'm4a' });
      return put(r.path, blob, type);
    },

    async apiFileUrls(ids) {
      const ps = Array.from(new Set((ids || []).filter(Boolean))).slice(0, 50);
      if (!ps.length) return {};
      await signMany(ps);
      const out = {};
      ps.forEach(p => { if (UC[p] && UC[p].u) out[p] = UC[p].u; });
      return out;
    },

    async apiMediaDiscard() { return true; },

    async apiInvAdd(token, x, dataUrls) {
      x = x || {};
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وش اشتريت');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      const paths = await empUpload(token, dataUrls, 3);
      if (!paths.length) throw new Error('صوّر الفاتورة');
      const w = Math.round(Number(x.warranty) || 0);
      return empDo(token, 'inv_add', { cid: String(x.cid || ''), amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), project: String(x.project || ''), photos: paths, warranty: w > 0 && w <= 120 ? w : 0, paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' });
    },
    /* الإصدار 74: تصحيح فاتورة رجّعها المدير العام وإعادة إرسالها بنفس السجل */
    async apiInvResend(token, id, x, dataUrls, keep) {
      x = x || {};
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وش اشتريت');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      const old = (keep || []).filter(Boolean).slice(0, 3);
      const paths = old.concat(await empUpload(token, dataUrls || [], Math.max(0, 3 - old.length)));
      if (!paths.length) throw new Error('صوّر الفاتورة');
      return empDo(token, 'inv_resend', { id: String(id), amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), project: String(x.project || ''), photos: paths, paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' });
    },

    async apiInvApprove(k, id) { return adminDo(k, 'inv_approve', { id: id }); },
    async apiInvReturn(k, id, reason) {
      const r = String(reason || '').trim().slice(0, 300);
      if (!r) throw new Error('اكتب السبب');
      return adminDo(k, 'inv_return', { id: id, reason: r });
    },
    async apiInvDelete(k, id) { return adminDo(k, 'inv_del', { id: id }); },
    async apiInvGive(k, empId, amount, note, method, sdad, ret) {
      const n = cleanAmount_(amount);
      return adminDo(k, 'inv_give', { emp: empId, amount: n, note: String(note || '').trim().slice(0, 200), method: String(method || ''), sdad: !!sdad, ret: !!ret });
    },
    async apiInvAddAdmin(k, x, dataUrls) {
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وش انشرى');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      const list = (dataUrls || []).slice(0, 3), paths = [];
      for (const d of list) paths.push(await API.apiUploadImg(k, d));
      return adminDo(k, 'inv_add', { emp: x.emp || '', amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), project: x.project || '',
        photos: paths, paidBy: x.emp ? 'cash' : 'card' });
    },
    async apiInvEdit(k, id, x) {
      const n = cleanAmount_(x.amount);
      return adminDo(k, 'inv_edit', { id: id, amount: n, note: String(x.note || '').trim().slice(0, 200), method: String(x.method || '') });
    },
    async apiInvPaidBy(k, id, by) { return adminDo(k, 'inv_paidby', { id: id, by: by === 'card' || by === 'own' ? by : 'cash' }); },
    async apiInvWarranty(k, id, until) {
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error('التاريخ غير صحيح');
      return adminDo(k, 'inv_warranty', { id: id, until: until || '' });
    },

    async pushKey() {
      const r = await fetch(FN_URL, { headers: { apikey: SB_KEY } });
      const j = await r.json().catch(() => ({}));
      if (!j.pub) throw new Error('خدمة الإشعارات ما ردّت، جرّب بعدين');
      return j.pub;
    },

    async pushSave(cred, page, sub) {
      return page === 'admin' ? aexec(cred, 'push_sub', sub) : eexec(cred, 'push_sub', sub);
    },

    async apiAttHome(token, dataUrl, pos) { return attDo(token, 'att_home', dataUrl, pos, ''); },
    async apiAttIn(token, dataUrl, pos, project) { return attDo(token, 'att_in', dataUrl, pos, project); },
    async apiAttOut(token, dataUrl, pos) { return attDo(token, 'att_out', dataUrl, pos, ''); },
    async apiGuideAdd(k, x) {
      const title = String(x.title || '').trim().slice(0, 120);
      if (!title) throw new Error('اكتب عنوان التوجيه');
      const points = (x.points || []).map(t => String(t || '').trim().slice(0, 400)).filter(Boolean).slice(0, 20);
      if (!points.length) throw new Error('اكتب نقطة وحدة على الأقل');
      let q = null;
      if (x.q) {
        const text = String(x.q.text || '').trim().slice(0, 200);
        const opts = (x.q.opts || []).map(t => String(t || '').trim().slice(0, 120));
        const ok = Number(x.q.ok);
        if (!text) throw new Error('اكتب السؤال');
        if (opts.filter(Boolean).length < 2) throw new Error('اكتب خيارين على الأقل');
        if (!(ok >= 0) || !opts[ok]) throw new Error('حدد الجواب الصح');
        const keep = opts.map((t, i) => ({ t: t, i: i })).filter(o => o.t);
        q = { text: text, opts: keep.map(o => o.t), ok: String(keep.findIndex(o => o.i === ok)) };
      }
      const emps = (x.emps || []).filter(Boolean);
      if (!emps.length) throw new Error('اختر الموظف');
      const r = await gadmin(k, 'add', { title: title, points: points, q: q, emps: emps });
      flush();
      return reloadAdmin(k, r);
    },
    async apiGuideDel(k, id) { await gadmin(k, 'del', { id: id }); return reloadAdmin(k); },
    async apiGuideToggle(k, empId, on) { await gadmin(k, 'emp_guide', { emp: empId, on: !!on }); return reloadAdmin(k); },
    async apiGuideOpen(token, id) { await gemp(token, 'open', { id: id }); return true; },
    async apiGuideDone(token, id, secs, ans) {
      const r = await gemp(token, 'done', { id: id, secs: Math.round(Number(secs) || 0), ans: ans == null ? '' : String(ans) });
      return { ok: !!(r && r.ok), data: await reloadEmp(token) };
    },
    async apiEmpLang(k, empId, lang) { return adminDo(k, 'emp_lang', { emp: empId, lang: lang }); },
    async apiAttToggle(k, empId, on) { return adminDo(k, 'att_toggle', { emp: empId, on: !!on }); },
    async apiProjLoc(k, id, lat, lng) { return adminDo(k, 'proj_loc', { id: id, lat: lat == null ? '' : String(lat), lng: lng == null ? '' : String(lng) }); },
    async apiAttDel(k, id) { return adminDo(k, 'att_del', { id: id }); },
    /* الإصدار 97 */
    async apiAttBad(k, id, reason) { return adminDo(k, 'att_bad', { id: id, reason: String(reason || '') }); },
    async apiAttBadUndo(k, id) { return adminDo(k, 'att_bad_undo', { id: id }); },
    async apiInvFix(k, id, amount) { return adminDo(k, 'inv_fix', { id: id, amount: String(amount) }); },
    async apiAttSettings(k, x) {
      const st = String(x.start || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(st)) throw new Error('وقت بداية الدوام غير صحيح');
      const g = Math.round(Number(x.grace));
      if (!(g >= 0 && g <= 180)) throw new Error('السماح بالدقائق من 0 إلى 180');
      return adminDo(k, 'settings_save', { WORK_START: st, GRACE_MIN: String(g), ATT_AUTO: x.auto ? '1' : '0' });
    },
    attPhoto: imgUrl,

    /* الإصدار 62: تقارير تقدم الأعمال */
    async apiRepList() { return rpc('rep_list', { k: CRED.k || '', t: CRED.t || '' }); },
    async apiRepAdd(a) {
      const r = await rpc('rep_add', { k: CRED.k || '', t: CRED.t || '', a: a || {} });
      flush();
      return r;
    },
    async apiRepReply(id, v, txt) {
      const r = await rpc('rep_reply', { k: CRED.k || '', id: String(id || ''), v: String(v || ''), txt: String(txt || '') });
      if (v) flush();
      return r;
    },
    async apiRepEdit(id, a) { const r = await rpc('rep_edit', { k: CRED.k || '', id: String(id || ''), a: a || {} }); flush(); return r; },
    async apiRepShare(id, emps, msg) {
      const r = await rpc('rep_share', { k: CRED.k || '', id: String(id || ''), emps: emps || [], msg: String(msg || '') });
      flush();
      return r;
    },
    async apiRepTick(id, item, undo, files, note) {
      const r = await rpc('rep_tick', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), undo: !!undo, files: (files || []).map(f => ({ p: f.p, t: f.t })), note: String(note || '') });
      flush();
      return r;
    },
    async apiRepNow(id, item, undo) { return rpc('rep_later_now', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), undo: !!undo }); },
    async apiRepLreqReview(id, rid, ok, note) { return rpc('rep_lreq_review', { k: CRED.k || '', id: String(id || ''), rid: String(rid || ''), ok: !!ok, note: String(note || '') }); },
    async apiRepLaterReview(id, item, ok, note) { return rpc('rep_later_review', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), ok: !!ok, note: String(note || '') }); },
    async apiRepUndone(id, item) { const r = await rpc('rep_undone', { k: CRED.k || '', id: String(id || ''), item: String(item || '') }); flush(); return r; },
    /* الإصدار 86: اعتماد الإنجاز أو إرجاعه، والتنبيه على عمل محدد، وتسجيل مشاهدة التنبيه */
    async apiRepReview(id, item, ok, note) { const r = await rpc('rep_review', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), ok: !!ok, note: String(note || '') }); flush(); return r; },
    async apiRepAlert(id, item, emps, msg, rid) { const r = await rpc('rep_alert', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), emps: emps || [], msg: String(msg || ''), rid: String(rid || '') }); flush(); return r; },
    async apiAlertSeen(id) { const r = await rpc('alert_seen', { t: CRED.t || '', id: String(id || '') }); flush(); return r; },
    async apiRepDecDel(id, item) { return rpc('rep_dec_del', { k: CRED.k || '', id: String(id || ''), item: String(item || '') }); },
    async trGet(texts, lang) { return rpc('tr_get', { k: CRED.k || '', t: CRED.t || '', texts: texts, tl: lang }); },
    async apiNotifs() { return rpc('notif_list', { k: CRED.k || '', t: CRED.t || '' }); },
    async apiTaskApprove2(k, id, txt) {
      await rpc('task_approve2', { k: k, id: String(id || ''), txt: String(txt || '') });
      flush();
      return reloadAdmin(k);
    },
    async apiTaskMedia(k, id, media) {
      await rpc('task_media_set', { k: k, id: String(id || ''), media: (media || []).map(x => ({ t: x.t, id: x.id })) });
      flush();
      return reloadAdmin(k);
    },
    async apiTaskComment(k, id, txt) {
      await rpc('task_comment_edit', { k: k, id: String(id || ''), txt: String(txt || '') });
      return reloadAdmin(k);
    },
    async apiRepUpload(x, onProgress) {
      const key = x.t === 'i' ? x.d : x.file;
      if (UPD.has(key)) return UPD.get(key);
      const ticket = (kind, ext) => rpc('rep_ticket', { k: CRED.k || '', t: CRED.t || '', kind: kind, ext: ext });
      let p;
      if (x.t === 'i') {
        const blob = dataUrlBlob(x.d);
        const r = await ticket('img', 'jpg');
        p = await putImg(r.path, blob);
      } else if (x.t === 'v') {
        const file = x.file;
        if (file.size > MAX_VID) throw new Error('الفيديو أكبر من الحد المسموح، صوّر مقطعاً أقصر');
        const ext = ((String(file.name || '').match(/\.(\w{2,4})$/) || [])[1] || 'mp4').toLowerCase();
        const known = { mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', '3gp': 'video/3gpp' };
        let type = String(file.type || '');
        if (['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'].indexOf(type) < 0) type = known[ext] || 'video/mp4';
        const e2 = ext === 'm4v' || !known[ext] ? 'mp4' : ext;
        const r = await ticket('vid', e2);
        p = await put(r.path, file, type, onProgress);
      } else {
        const file = x.file;
        const ext = ((String(file.name || '').match(/\.(\w{2,5})$/) || [])[1] || '').toLowerCase();
        const types = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
        if (!types[ext]) throw new Error('نوع الملف غير مدعوم');
        if (file.size > 20 * 1024 * 1024) throw new Error('حجم الملف أكبر من 20 ميغابايت');
        const r = await ticket('doc', ext);
        p = await put(r.path, file, types[ext], onProgress);
      }
      UPD.set(key, p);
      return p;
    },

    async apiEmp(token) {
      await loadEmp(token);
      const emp = empById(RAW.me);
      if (!emp) throw new Error('الرابط غير صالح');
      return empPayload_(emp);
    }
  };

  /* إذا رابط صورة أو فيديو انتهى أو انبطل (تدوير مفتاح التوقيع)، نطلب رابط جديد مرة وحدة بدون ما يبان للمستخدم */
  const SIGN_MARK = '/storage/v1/object/sign/' + BUCKET + '/';
  function pathOf(u) {
    const i = String(u || '').indexOf(SIGN_MARK);
    if (i < 0) return '';
    try { return decodeURIComponent(u.slice(i + SIGN_MARK.length).split('?')[0]); } catch (e) { return ''; }
  }
  async function healMedia(el) {
    const bad = el.currentSrc || el.src || '';
    const p = pathOf(bad);
    if (!p) return;
    const n = +(el.dataset.rs || 0);
    if (n >= 2) return;
    el.dataset.rs = n + 1;
    if (!(fresh(p) && UC[p].u !== bad)) { delete UC[p]; saveUC(); await signMany([p]).catch(() => {}); }
    const nu = UC[p] && UC[p].u;
    if (!nu || nu === bad) return;
    el.src = nu;
    if (el.tagName === 'VIDEO' && el.load) el.load();
  }
  document.addEventListener('error', e => {
    const el = e.target;
    if (el && (el.tagName === 'IMG' || el.tagName === 'VIDEO')) healMedia(el);
  }, true);

  window.API = API;
  window.fileUrl = fileUrl;
})();
