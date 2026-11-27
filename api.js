/* إدارة الفريق — طبقة الاتصال مع Supabase */
(function () {
  const SB_URL = 'https://qwagdoopszcyezywyfad.supabase.co';
  const SB_KEY = 'sb_publishable_QS6Ujy65uyr2MQJUT-691g_2vkeRKxP';
  const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const BUCKET = 'files';
  const FN_URL = SB_URL + '/functions/v1/push';
  const FILES_URL = SB_URL + '/functions/v1/files';
  let CRED = {};
  /* الإصدار 109: تعديل الفاتورة وإضافة فاتورة المدير والميزانية واعتماد المهمة يكتبون إشعار (للموظف أو تنبيه ميزانية)، فينرسل فورًا */
  /* الإصدار 121: المخالفة والموقف المميز وحذفها وإضافة عمل لمخالفة اليوم وحذف يوم الحضور كلها ترسل فورًا (بدون مهلة الدقيقتين) */
  const NOTIFY = ['inv_approve', 'inv_return', 'inv_fix', 'inv_upd', 'inv_edit', 'inv_add', 'proj_budget', 'att_bad', 'att_bad_undo', 'log_add', 'log_del', 'log_note_add', 'att_del'];
  function flush() {
    fetch(FN_URL, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{"op":"flush"}', keepalive: true }).catch(() => {});
  }

  const TRUST = 'الأمانة والمصداقية';
  const HEAVY = [TRUST];
  const heavy = c => HEAVY.indexOf(c) >= 0;
  const STAR_CRIT = 'موقف مميز';
  const FOLLOW = 'متابعة الأعمال الموكلة';
  const MAX_VID = 45 * 1024 * 1024;
  const DEF = { miss: 5, trust: 10, star: 5, starCap: 100, clean: 0 }; /* الإصدار 117: «شهر بدون تقصير» افتراضه 0 مثل الإعداد */
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
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'لا يوجد اتصال، تأكد من الإنترنت وحاول مرة أخرى';
    return m || 'حدث خطأ، حاول مرة أخرى';
  }
  /* الإصدار 74: كل عملية تطلع برقم طلب (rid). لو وصلت السيرفر مرتين ينحفظ أول وحدة بس، والإعادة بعد فشل الاتصال تستخدم نفس الرقم */
  const RID = {};
  const NO_RID = ['ticket', 'push_sub', 'proj_add'];
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
  /* الإصدار 60: التحميل الخفيف (آخر 90 يوم). من 118 ما فيه رجوع للدوال القديمة admin_raw و emp_raw */
  async function loadAdmin(k) {
    CRED = { k: k };
    RAW = norm(await rpc('admin_raw2', { k: k, days: 90 })); return RAW;
  }
  async function loadEmp(t) {
    CRED = { t: t };
    RAW = norm(await rpc('emp_raw2', { t: t, days: 90 })); return RAW;
  }

  function norm(r) {
    r.employees = (r.employees || []).map(e => ({ id: e.id, name: e.name, salary: Number(e.salary) || 0, max: Number(e.max) || 0,
      token: e.token || '', active: e.active !== false, track: !!e.track, attend: !!e.attend, guide: !!e.guide, lang: e.lang || 'ar', payDay: Number(e.payDay) || 28, payNext: !!e.payNext,
      stops: Array.isArray(e.stops) ? e.stops.filter(s => s && s.from).map(s => ({ from: String(s.from), to: String(s.to || ''), at: Number(s.at) || 0 })) : [] })); /* 141 */
    r.guides = (r.guides || []).map(g => Object.assign({}, g, { points: Array.isArray(g.points) ? g.points : [], q: g.q && typeof g.q === 'object' ? g.q : null }));
    r.greads = (r.greads || []).map(x => Object.assign({}, x, { secs: Number(x.secs) || 0, wrong: Number(x.wrong) || 0 }));
    r.attendance = (r.attendance || []).map(x => Object.assign({}, x, { homeLat: x.homeLat == null ? null : Number(x.homeLat), homeLng: x.homeLng == null ? null : Number(x.homeLng), inLat: x.inLat == null ? null : Number(x.inLat), inLng: x.inLng == null ? null : Number(x.inLng),
      outLat: x.outLat == null ? null : Number(x.outLat), outLng: x.outLng == null ? null : Number(x.outLng), late: Number(x.late) || 0 }));
    r.logs = r.logs || [];
    r.fin = (r.fin || []).map(f => Object.assign({}, f, { amount: Number(f.amount) || 0, months: Number(f.months) || 0 }));
    r.tprojs = Array.isArray(r.tprojs) ? r.tprojs : []; /* 118: [الموظف، المشروع] من جدول المهام، للتنبيه بس */
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
    if (u.length > 8 * 1024 * 1024) throw new Error('الصورة كبيرة، جرّب صورة أخرى');
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
      let wd; const kick = () => { clearTimeout(wd); wd = setTimeout(() => { try { x.abort(); } catch (e) {} rej(new Error('تعذّر رفع الملف لضعف الاتصال. ما رُفع محفوظ، وإعادة المحاولة تُكمل الباقي')); }, 45000); };
      if (x.upload) x.upload.onprogress = ev => { kick(); if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total); };
      x.onloadend = () => clearTimeout(wd);
      kick();
      x.onload = () => {
        clearTimeout(wd);
        if (x.status >= 200 && x.status < 300) return res(path);
        let m = ''; try { m = JSON.parse(x.responseText).message || ''; } catch (e) {}
        rej(new Error(m || 'تعذّر رفع الملف، حاول مرة أخرى'));
      };
      x.onerror = () => { clearTimeout(wd); rej(new Error('لا يوجد اتصال، تأكد من الإنترنت وحاول مرة أخرى')); };
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
        if (!r.ok) throw new Error((j && j.error) || 'تعذّر فتح الملف');
      } catch (e) { throw new Error(friendly(e)); }
      const x = Date.now() + KEEP, urls = (j && j.urls) || {};
      part.forEach(p => { if (urls[p]) UC[p] = { u: urls[p], x: x }; });
    }
    saveUC();
  }
  /* الإصدار 109: رابط الملف من الذاكرة لو ما قرب ينتهي، وإلا فاضي */
  const cachedUrl = p => (p && fresh(p) && UC[p].u) || '';
  async function fileUrl(path) {
    if (!path) throw new Error('لا توجد صورة');
    await signMany([path]);
    if (!UC[path] || !UC[path].u) throw new Error('تعذّر فتح الملف');
    return UC[path].u;
  }
  async function imgUrl(path) {
    if (!path) throw new Error('لا توجد صورة');
    const t = thumbOf(path);
    await signMany(t ? [path, t] : [path]);
    if (t && UC[t] && UC[t].u) return UC[t].u;
    if (!UC[path] || !UC[path].u) throw new Error('تعذّر فتح الملف');
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
  /* الإصدار 109: الشهر اللي خلص وما انصرف وتغيّر بعده الراتب أو الحسبة، ينحسب بقيمه المحفوظة */
  function snap_(empId, mk) { return (RAW.snaps || []).filter(s => s.emp === empId && s.month === mk)[0] || null; }
  function settings_(src) {
    const s = src || RAW.settings || {};
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
  /* الإصدار 141: إيقاف الراتب (إجازة بدون راتب). الشهر موقوف إذا from <= الشهر < to، و to فاضي = موقوف للحين.
     الشهر الموقوف ما ينحسب ولا يطلع مستحق أو متأخر، وقسط السلفة يتأجل معه. الشهر المصروف يبقى مصروف */
  function stopOn_(emp, mk) { return (emp.stops || []).some(s => s.from <= mk && (!s.to || mk < s.to)); }
  function stopNow_(emp) { const s = (emp.stops || []).filter(x => !x.to)[0]; return s ? s.from : ''; }
  const fromP_ = p => Number((p.details && p.details.fromParts) || 0);
  function payDetails_(f) {
    return { base: f.base, bonus: f.bonus, max: f.max, /* 119: points و target انشالوا (ما تنقرا) */
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
      if (stopOn_(emp, mk)) return { month: mk, label: monthLabel_(mk), closed: false, due: 0, cap: 0, stop: true }; /* 141 */
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
      if (r.stop) return { month: r.month, label: r.label, due: 0, paid: 0, left: 0, closed: false, stop: true }; /* 141 */
      r.f.credit = got[i]; open.push(r.f);
      return { month: r.month, label: r.label, due: r.due, paid: got[i], left: rr2(r.due - got[i]), closed: false, dueDate: r.dueDate, full: r.due > 0 && got[i] >= r.due };
    });
    const due = rr2(months.reduce((x, m) => x + m.due, 0)), paid = rr2(months.reduce((x, m) => x + m.paid, 0));
    const real = hist.filter(h => h.id !== '_new');
    return { show: real.length > 0 || open.length > 1 || months.some(m => m.stop), open: open, months: months.slice(-12), parts: real.slice().reverse(), due: due, paid: paid, left: rr2(due - paid),
      lastPart: real.length ? real[real.length - 1].id : '', preview: extra ? hist[hist.length - 1] : null,
      close: extra ? months.filter(m => !m.closed && m.full).map(m => m.month) : [] };
  }
  /* الشهور اللي تنقفل بالدفعة (نفس الحساب في «دفعة راتب» واعتماد فاتورة «راتب موظف») */
  function closeParts_(st) {
    return st.close.map(mk => {
      const f = st.open.filter(m => m.month === mk)[0], det = payDetails_(f);
      det.fromParts = Math.max(0, f.net);
      return { month: mk, amount: Math.max(0, f.net), details: det };
    });
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
  /* الإصدار 111: قراءة المبلغ. لوحة الأرقام العربية في الآيفون تكتب «٫»، فتنقرا فاصلة عشرية مثل «.» و«،».
     «,» فاصلة عشرية إلا إذا بعدها 3 أرقام بالضبط (1,200 = ألف ومئتين)، و«٬» فاصل آلاف. كانت كلها تنحذف فالرقم يكبر (560٫58 تصير 56058) */
  function parseAmt_(v) {
    let s = String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[\s٬]/g, '');
    s = s.replace(/[٫،]/g, '.').replace(/,(?=\d{3}(?!\d))/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
    const i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    if (!/\d/.test(s)) return NaN;
    return Math.round(Number(s) * 100) / 100;
  }
  function cleanAmount_(v) {
    const n = parseAmt_(v);
    if (!(n > 0) || n > 1000000) throw new Error('اكتب المبلغ');
    return n;
  }
  function pick_(m) {
    let best = null, bv = 0;
    CRITERIA.forEach(c => { if ((m[c.n] || 0) > bv) { bv = m[c.n]; best = c; } });
    return best;
  }

  /* ---------- الحساب ---------- */
  function calcMonth_(emp, logs, mk) {
    const sn = snap_(emp.id, mk);
    if (sn) emp = Object.assign({}, emp, { max: Number(sn.max) || 0, track: !!sn.track });
    const st = sn ? settings_(sn.st || {}) : settings_();
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
      max: base, settings: st, track: track,
      strength: stars ? { crit: 'مواقف مميزة', text: starTxt + ' هالشهر، يعطيك العافية.' } : null,
      improve: w ? { crit: w.n, text: w.bad } : null
    };
  }
  /* الإصدار 116: القسط ينحسب شهر شهر من بداية السلفة: الشهر المنصرف ياخذ اللي انخصم فعلاً، والشهر اللي ما انصرف ياخذ قسطه من الباقي.
     كانت كل الشهور المفتوحة تاخذ القسط كامل، فسلفة 1000 على شهرين تنخصم 1500 لو فيه ثلاث شهور مفتوحة */
  function loanDue_(emp, fin, mk) {
    const pays = {}; fin.forEach(f => { if (f.kind === 'pay' && f.emp === emp.id) pays[f.month] = f; });
    const parts = {}; let total = 0;
    fin.filter(f => f.kind === 'loan' && f.emp === emp.id && f.start <= mk).forEach(l => {
      const per = Math.ceil(l.amount / l.months); let rem = l.amount, due = 0;
      monthsRange_(l.start, mk).forEach(m => {
        const p = m !== mk ? pays[m] : null;
        const take = p ? Number((p.details && p.details.loanParts && p.details.loanParts[l.id]) || 0) : stopOn_(emp, m) ? 0 : Math.max(0, Math.min(per, rem)); /* 141: الشهر الموقوف بدون قسط */
        if (m === mk) due = take;
        rem = rr2(rem - take);
      });
      if (due > 0) { parts[l.id] = due; total = rr2(total + due); }
    });
    return { total: total, parts: parts };
  }
  function finMonth_(emp, fin, logs, mk) {
    const pay = fin.filter(f => f.kind === 'pay' && f.emp === emp.id && f.month === mk)[0];
    if (pay && pay.details) {
      const d = pay.details;
      return { month: mk, label: monthLabel_(mk), paid: true, paidAmount: pay.amount, paidDate: pay.date, payId: pay.id, due: dueDate_(emp, mk), fromParts: fromP_(pay), viaParts: !!d.part,
        base: d.base, bonus: d.bonus, max: d.max,
        advance: d.advance, inst: d.inst, deds: d.deds || [], loanParts: d.loanParts || {}, net: d.net, warn10: false, track: !!emp.track };
    }
    const c = calcMonth_(emp, logs, mk);
    const sn = snap_(emp.id, mk), sal = sn ? Number(sn.salary) || 0 : emp.salary;
    const advance = fin.filter(f => f.kind === 'adv' && f.emp === emp.id && f.month === mk).reduce((s, f) => s + f.amount, 0);
    const due = loanDue_(emp, fin, mk);
    const deds = fin.filter(f => f.kind === 'ded' && f.emp === emp.id && f.month === mk).map(f => ({ note: f.note, amount: f.amount }));
    const dedT = deds.reduce((s, f) => s + f.amount, 0);
    return { month: mk, label: monthLabel_(mk), paid: false, due: dueDate_(emp, mk),
      base: sal, bonus: c.bonus, max: c.max,
      advance: advance, inst: due.total, deds: deds, loanParts: due.parts,
      net: sal + c.bonus - advance - due.total - dedT,
      warn10: due.total + dedT > sal * 0.1, track: sn ? !!sn.track : !!emp.track };
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
  /* الإصدار 117: مبلغ كل موقف في القائمة نفس اللي انحسب في الحافز (calcMonth_): المعيار ينحسب مرة باليوم،
     والمكافأة تقف عند حدها بالشهر، والمبالغ من إعدادات الشهر المثبتة. المكرر يبقى ظاهر بعلامة ومبلغه صفر */
  function groups_(rows) {
    const map = {}, order = [], seen = {}, acc = {};
    rows.forEach(l => {
      if (l.type === '+' && l.crit !== STAR_CRIT) return;
      const mk = l.date.slice(0, 7), sn = snap_(l.emp, mk), st = sn ? settings_(sn.st || {}) : settings_();
      const g = l.group + l.type;
      if (!map[g]) { map[g] = { id: l.group, date: l.date, type: l.type, crits: [], note: l.note, notes: [], pts: 0, dup: false, over: false, at: '', seen: '', unseen: false }; order.push(g); }
      if (l.type === '+') {
        const ak = l.emp + '|' + mk, got = acc[ak] || 0, add = Math.max(0, Math.min(st.star, st.starCap - got));
        acc[ak] = got + add; map[g].pts += add; if (add < st.star) map[g].over = true;
        return;
      }
      map[g].crits.push(l.crit);
      /* الإصدار 121: لكل معيار ملاحظته (متابعة الأعمال لها ملاحظة لحالها)، ووقت الإشعار ووقت «فهمت» */
      const nt = String(l.note || '').trim();
      if (nt && map[g].notes.indexOf(nt) < 0) map[g].notes.push(nt);
      map[g].note = map[g].notes.join('\n');
      if (l.at) { if (!map[g].at || l.at < map[g].at) map[g].at = l.at; if (!l.seen) map[g].unseen = true; else if (l.seen > map[g].seen) map[g].seen = l.seen; }
      const k = l.emp + '|' + l.date + '|' + l.crit;
      if (seen[k]) { map[g].dup = true; return; }
      seen[k] = true;
      map[g].pts -= heavy(l.crit) ? st.trust : st.miss;
    });
    /* الإصدار 115: الصفوف جاية بالأقدم أول (التاريخ ثم وقت التسجيل)، فنقلبها قبل الترتيب عشان داخل اليوم الواحد يطلع الأحدث فوق */
    order.forEach(g => { const x = map[g]; if (x.unseen) x.seen = ''; delete x.unseen; delete x.notes; });
    return order.map(g => map[g]).reverse().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }
  /* العهدة: c باقي معه، o له لديك من حسابه الخاص، t كل اللي له عندك */
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
      method: x.method || '', warrantyUntil: x.warrantyUntil || '', vendor: x.vendor || '', cat: x.cat || '', salEmp: x.cat === 'sal' ? (x.salEmp || '') : '', task: x.task || '', taskDeleted: !!x.taskDeleted,
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
      month: calcMonth_(emp, logs, now),
      fin: finMonth_(emp, fin, logs, now),
      sal: salSt_(emp, fin, logs, now),
      stop: stopNow_(emp), stopNow: stopOn_(emp, now), /* 141 */
      entries: groups_(mine.filter(l => l.date.slice(0, 7) === now)),
      /* الإصدار 121: مخالفات اليوم اللي وصله إشعارها وما ضغط «فهمت» (تختفي 12 الليل بتوقيت الرياض) */
      viol: mine.filter(l => l.type === '-' && l.at && !l.seen && l.at.slice(0, 10) === todayS)
        .sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0).map(l => ({ id: l.id, crit: l.crit, note: l.note || '', at: l.at })),
      history: monthsRange_(startMonth_(emp, logs, fin), now).reverse().map(mk => {
        const f = finMonth_(emp, fin, logs, mk);
        return { month: mk, label: monthLabel_(mk), bonus: f.bonus, net: f.net,
          paid: f.paid, paidAmount: f.paidAmount, paidDate: f.paidDate, stop: !f.paid && stopOn_(emp, mk) };
      }),
      loans: loanBalances_(emp, fin),
      tx: txList_(fin.filter(f => f.emp === emp.id)).slice(0, 30),
      rules: settings_(),
      team: (RAW.team || []).filter(t => t.id !== emp.id).map(t => ({ id: t.id, name: t.name })),
      projects: RAW.projects.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name })),
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
    const logs = RAW.logs, fin = RAW.fin, now = nowMonth(), todayS = RAW.today;
    const projects = RAW.projects, pmap = projMap_(projects);
    const bal = {};
    const parts = {};
    emps.forEach(e => { parts[e.id] = invParts_(RAW.invoices, e.id); bal[e.id] = parts[e.id].c; });
    return {
      inv: { bal: bal, parts: parts, items: (ms => RAW.invoices.slice().reverse().map(x => Object.assign(invOut_(x, pmap), { matched: ms.has(x.id) })))(new Set(RAW.matched || [])) },
      attendance: RAW.attendance,
      deleted: (RAW.deleted || []).map(z => { const r = z.row || {}, e = empById(r.emp);
        return { id: z.id, tbl: z.tbl, rid: z.rid, at: z.at || '', back: z.back || '', emp: e ? e.name : '', amount: Math.round((Number(r.amount) || 0) * 100) / 100,
          kind: r.kind || '', status: r.status || '', desc: z.tbl === 'invoices' ? (r.descr || '') : z.tbl === 'proj_ideas' ? (r.text || '') : (r.note || ''), month: r.month || r.start || '', project: pmap[r.project] || '' }; }),
      /* الإصدار 110: الكراسة. أفكار المدير لكل مشروع، ترجع له بس */
      ideas: (RAW.ideas || []).map(x => ({ id: x.id, proj: x.proj, text: x.text || '', status: x.status, out: x.out || '', ts: Number(x.ts) || 0, archAt: Number(x.archAt) || 0 })),
      attCfg: attCfg_(),
      alerts: RAW.alerts || [],
      guides: RAW.guides.map(g => ({ id: g.id, ts: g.ts, title: g.title, points: g.points, q: g.q,
        reads: RAW.greads.filter(x => x.guide === g.id).map(x => Object.assign({ name: (empById(x.emp) || {}).name || '' }, x)) })),
      projects: projects.map(p => ({ id: p.id, name: p.name, archived: p.archived, budget: Number((RAW.budgets || {})[p.id]) || 0 })),
      criteria: CRITERIA.map(c => ({ n: c.n, s: c.s, short: c.short })),
      today: todayS,
      yesterday: addDay(todayS, -1),
      month: monthLabel_(now),
      settings: settings_(),
      employees: emps.map(e => {
        const mine = logs.filter(l => l.emp === e.id);
        const sal = salSt_(e, fin, logs, now);
        return {
          id: e.id, name: e.name, salary: e.salary, max: e.max, token: e.token, track: e.track, attend: e.attend, guide: e.guide, lang: e.lang, payDay: e.payDay, payNext: e.payNext, stop: stopNow_(e), stops: e.stops, sal: sal, prevMonths: prevMonths_(e, fin, logs), seen: (RAW.seen || {})[e.id] || 0, left: (RAW.left || {})[e.id] || 0,
          month: calcMonth_(e, logs, now),
          recent: groups_(mine).slice(0, 15),
          unpaid: sal.open,
          loans: loanBalances_(e, fin),
          tx: txList_(fin.filter(f => f.emp === e.id)),
          tprojs: RAW.tprojs.filter(x => x[0] === e.id).map(x => x[1])
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
  /* الإصدار 76: العملية وتحديث البيانات في طلب واحد (admin_exec2 و emp_exec2). من 118 ما فيه رجوع للطريقة القديمة */
  function exec2(fn, args, op, a) {
    return withRid(x => rpc(fn, Object.assign({}, args, { op: op, a: x, days: 90 })), op, a || {});
  }
  async function adminDo(k, op, a) {
    const x2 = await exec2('admin_exec2', { k: k }, op, a);
    CRED = { k: k }; RAW = norm(x2.raw);
    if (NOTIFY.indexOf(op) >= 0) flush();
    const out = adminPayload_();
    if (x2.r && x2.r.dup) out.__dup = true;
    return out;
  }
  async function empDo(t, op, a) {
    const x2 = await exec2('emp_exec2', { t: t }, op, a);
    CRED = { t: t }; RAW = norm(x2.raw);
    flush();
    const emp = empById(RAW.me);
    if (!emp) throw new Error('الرابط غير صالح');
    const out = empPayload_(emp);
    if (x2.r && x2.r.dup) out.__dup = true;
    return out;
  }
  const empById = id => RAW.employees.filter(e => e.id === id)[0];

  async function attDo(token, op, dataUrl, pos, project) {
    const paths = await empUpload(token, [dataUrl], 1);
    const p = pos || {};
    return empDo(token, op, { photo: paths[0], lat: p.lat == null ? '' : String(p.lat), lng: p.lng == null ? '' : String(p.lng),
      acc: p.acc == null ? '' : String(Math.round(p.acc)), project: project || '' });
  }
  async function pdfUp_(k, t, file, onProgress) {
    if (UPD.has(file)) return UPD.get(file);
    if (file.size > 20 * 1024 * 1024) throw new Error('حجم الملف أكبر من 20 ميغابايت');
    const r = await rpc('rep_ticket', { k: k || '', t: t || '', kind: 'doc', ext: 'pdf' });
    const p = await put(r.path, file, 'application/pdf', onProgress);
    UPD.set(file, p);
    return p;
  }
  function addMonths_(ymd, n) {
    const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7)) - 1 + n, dd = Number(ymd.slice(8, 10));
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(dd, last))).toISOString().slice(0, 10);
  }
  async function empUpload(token, dataUrls, max, onProg) {
    const list = (Array.isArray(dataUrls) ? dataUrls : [dataUrls]).filter(Boolean).slice(0, max);
    const pr = list.map(d => UPD.has(d) ? 1 : 0), tell = () => { if (onProg) onProg(pr.filter(v => v >= 1).length, list.length, Math.round(pr.reduce((a, v) => a + v, 0) / (list.length || 1) * 100)); };
    tell();
    return Promise.all(list.map(async (d, i) => {
      if (d && d.pdf) { /* الإصدار 107: مرفق PDF بتذكرة الملفات */
        if (UPD.has(d.pdf)) { pr[i] = 1; tell(); return UPD.get(d.pdf); }
        const pp = await pdfUp_('', token, d.pdf, v => { pr[i] = Math.min(v, 0.99); tell(); });
        pr[i] = 1; tell();
        return pp;
      }
      if (UPD.has(d)) return UPD.get(d);
      const blob = dataUrlBlob(d);
      if (blob.size > 5 * 1024 * 1024) throw new Error('الصورة كبيرة، جرّب صورة أخرى');
      const r = await eexec(token, 'ticket', {});
      const p = await putImg(r.path, blob, v => { pr[i] = Math.min(v, 0.99); tell(); });
      UPD.set(d, p); pr[i] = 1; tell();
      return p;
    }));
  }

  /* ---------- الواجهات ---------- */
  const API = {
    async apiAdmin(k) { await loadAdmin(k); return adminPayload_(); },

    async apiAdd(k, x) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      if (!RAW.employees.some(e => e.id === x.emp)) throw new Error('اختر الموظف');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ''))) throw new Error('التاريخ غير صحيح');
      if (isPaid_(RAW.fin, x.emp, x.date.slice(0, 7))) throw new Error('راتب هذا الشهر مصروف ومقفل، لا يمكن التسجيل فيه');
      let misses = (x.misses || []).filter((c, i, a) => a.indexOf(c) === i && CRITERIA.some(k2 => k2.n === c));
      const starNote = x.star ? String(x.star.note || '').trim().slice(0, 300) : '';
      if (x.star && !starNote) throw new Error('اكتب ما قام به في الموقف المميز');
      /* الإصدار 121: ملاحظة لكل معيار (x.notes)، واللي ما له ملاحظة ياخذ العامة */
      const notes = x.notes && typeof x.notes === 'object' ? x.notes : {};
      const gen = String(x.note || '').trim().slice(0, 300);
      const noteOf = c => Object.prototype.hasOwnProperty.call(notes, c) ? String(notes[c] || '').trim().slice(0, c === FOLLOW ? 1000 : 300) : gen;
      const day = RAW.logs.filter(l => l.emp === x.emp && l.date === x.date && l.type === '-');
      const sameDay = day.map(l => l.crit);
      /* «متابعة الأعمال الموكلة» متسجلة بنفس اليوم: الأعمال الجديدة تنضاف لملاحظتها بدون خصم جديد */
      let append = null;
      if (misses.indexOf(FOLLOW) >= 0 && sameDay.indexOf(FOLLOW) >= 0) {
        const old = day.filter(l => l.crit === FOLLOW && !/^bad/.test(l.group || '')).pop();
        const have = String(old ? old.note || '' : '').split('\n').map(s => s.trim());
        const add = noteOf(FOLLOW).split('\n').map(s => s.trim()).filter((s, i, a) => s && have.indexOf(s) < 0 && a.indexOf(s) === i).join('\n');
        if (old && add) append = { id: old.id, add: add };
      }
      const before = misses.length;
      misses = misses.filter(c => sameDay.indexOf(c) < 0);
      const skipped = before - misses.length - (append ? 1 : 0);
      if (!misses.length && !starNote && !append) throw new Error(skipped ? 'هذا التقصير مسجّل له في اليوم نفسه' : 'لا يوجد ما يُسجَّل');
      let out = null, grp = null;
      if (append) out = await adminDo(k, 'log_note_add', append);
      if (misses.length || starNote) {
        grp = uid();
        const rows = misses.map(c => ({ date: x.date, emp: x.emp, type: '-', crit: c, note: noteOf(c), grp: grp }));
        if (starNote) rows.push({ date: x.date, emp: x.emp, type: '+', crit: STAR_CRIT, note: starNote, grp: grp });
        out = await adminDo(k, 'log_add', { rows: rows });
      }
      out.lastId = grp; out.lastNote = append; out.skipped = skipped; out.appended = !!append;
      return out;
    },

    /* الإصدار 121: «تراجع» بعد إضافة عمل لمخالفة اليوم: يشيل السطر المضاف بس */
    /* معايير التقصير المسجلة للموظف بهاليوم (للتنبيه في نافذة التأكيد) */
    dayMisses(emp, date) { return RAW ? RAW.logs.filter(l => l.emp === emp && l.date === date && l.type === '-').map(l => l.crit) : []; },
    async apiNoteUndo(k, n) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      return adminDo(k, 'log_note_add', { id: n.id, add: n.add, undo: '1' });
    },

    async apiDelete(k, group) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const l = RAW.logs.filter(v => v.group === group)[0];
      if (l && isPaid_(RAW.fin, l.emp, l.date.slice(0, 7))) throw new Error('راتب هذا الشهر مصروف ومقفل');
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
        if (!isFinite(v) || v < 0 || v > 100000) throw new Error('يوجد رقم غير صحيح');
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
      if (!r.ok) throw new Error((j && j.error) || 'تعذّر جلب الملفات');
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
      const amount = cleanAmount_(x.amount);
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
      if (isPaid_(RAW.fin, emp.id, mk)) throw new Error('هذا الشهر مصروف مسبقاً');
      const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth());
      const f = st.open.filter(m => m.month === mk)[0] || finMonth_(emp, RAW.fin, RAW.logs, mk);
      const cr = f.credit || 0;
      const cashv = x.amount === '' || x.amount == null ? Math.max(0, f.net) - cr : parseAmt_(x.amount);
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
      if ((r.kind === 'adv' || r.kind === 'ded') && isPaid_(fin, r.emp, r.month)) throw new Error('الشهر مصروف، احذف الصرف أولاً');
      if (r.kind === 'loan' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.details && f.details.loanParts && f.details.loanParts[r.id])) {
        throw new Error('خُصمت أقساط من هذه السلفة، احذف الصرف أولاً');
      }
      if (r.kind === 'pay' && r.details && r.details.part) throw new Error('هذا الشهر سُدّد بدفعة، احذف الدفعة نفسها');
      if (r.kind === 'pay' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.month > r.month)) throw new Error('احذف صرف الشهور التي بعده أولاً');
      if (r.kind === 'part' && fin.some(f => f.kind === 'part' && f.emp === r.emp && f.ts > r.ts)) throw new Error('احذف الدفعات التي بعدها أولاً');
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
      const close = closeParts_(st);
      return adminDo(k, 'sal_part', { emp: emp.id, amount: amount, date: date, month: month, note: String(x.note || '').trim().slice(0, 200), close: close });
    },
    /* الإصدار 85: معاينة توزيع الدفعة قبل الحفظ (من البيانات المحمّلة) */
    salPreview(empId, amount, month) {
      const emp = RAW && empById(empId), a = parseAmt_(amount) || 0;
      if (!emp || !(a > 0)) return null;
      const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth(), { amount: a, month: month || '' });
      return { al: st.preview.al, extra: st.preview.extra, after: st.preview.after, close: st.close };
    },
    /* الإصدار 85: تصحيح شهر حركة صرف موجودة وتاريخها (نفس الحركة، بدون حركة ثانية) */
    async apiFinMove(k, id, x) {
      await loadAdmin(k);
      const r = RAW.fin.filter(f => f.id === id)[0];
      if (!r || r.kind !== 'pay') throw new Error('الحركة غير موجودة');
      if (r.details && r.details.part) throw new Error('هذا الشهر سُدّد بالدفعات، عدّل الدفعات نفسها');
      if (fromP_(r) > 0) throw new Error('توجد دفعات محسوبة على هذا الصرف، احذف الصرف وسجّله من جديد');
      const emp = empById(r.emp);
      if (!emp) throw new Error('الموظف غير موجود');
      const mk = String(x.month || '');
      if (!/^\d{4}-\d{2}$/.test(mk) || mk > nowMonth()) throw new Error('الشهر غير صحيح');
      if (mk !== r.month && isPaid_(RAW.fin, r.emp, mk)) throw new Error('راتب ' + monthLabel_(mk) + ' مسجّل مسبقاً');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : r.date;
      if (date > RAW.today) throw new Error('تاريخ التسليم بعد اليوم');
      if (date < mk + '-01') throw new Error('تاريخ التسليم قبل شهر الراتب');
      const others = RAW.fin.filter(f => f.id !== id);
      const f = finMonth_(emp, others, RAW.logs, mk);
      const amount = x.amount === '' || x.amount == null ? r.amount : parseAmt_(x.amount);
      if (!(amount >= 0)) throw new Error('المبلغ غير صحيح');
      return adminDo(k, 'fin_move', { id: id, month: mk, date: date, amount: amount, details: payDetails_(f) });
    },
    async apiEmpPayday(k, empId, day, next) { return adminDo(k, 'emp_payday', { emp: empId, day: Number(day), next: !!next }); },
    /* الإصدار 94 */
    async apiRepLaterPut(id, item, why, aft) { const r = await rpc('rep_later_put', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), why: String(why || ''), aft: String(aft || '') }); flush(); return r; }, /* v117 */
    async apiRepNoteDel(id, at, txt) { return rpc('rep_note_del', { k: CRED.k || '', id: String(id || ''), at: Number(at) || 0, txt: String(txt || '') }); },
    async apiRepQuoteAdd(id, item, a) { const r = await rpc('rep_quote_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), a: a || {} }); flush(); return r; }, /* v117 */
    async apiRepQuoteOk(qid, undo) { const r = await rpc('rep_quote_ok', { k: CRED.k || '', qid: String(qid || ''), undo: !!undo }); flush(); return r; }, /* v117 */
    async apiRepQuoteDel(qid) { return rpc('rep_quote_del', { k: CRED.k || '', t: CRED.t || '', qid: String(qid || '') }); },
    /* الإصدار 114: خطوات تحت العمل الحالي */
    async apiRepStepAdd(id, item, txt) { const r = await rpc('rep_step_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), txt: String(txt || '') }); flush(); return r; },
    async apiRepStepTick(sid, undo) { return rpc('rep_step_tick', { k: CRED.k || '', t: CRED.t || '', sid: String(sid || ''), undo: !!undo }); },
    async apiRepStepEdit(sid, txt) { return rpc('rep_step_edit', { k: CRED.k || '', t: CRED.t || '', sid: String(sid || ''), txt: String(txt || '') }); }, /* v138: تعديل نص الخطوة */
    async apiRepStepDel(sid) { return rpc('rep_step_del', { k: CRED.k || '', t: CRED.t || '', sid: String(sid || '') }); },
    /* v141: الموظف يطلب حذف خطوته (أو يلغي الطلب)، والمدير العام يعتمد أو يرفض */
    async apiRepStepDelReq(sid, undo) { const r = await rpc('rep_step_del_req', { t: CRED.t || '', sid: String(sid || ''), undo: !!undo }); if (!undo) flush(); return r; },
    async apiRepStepDelRev(sid, ok) { const r = await rpc('rep_step_del_rev', { k: CRED.k || '', sid: String(sid || ''), ok: !!ok }); flush(); return r; },
    /* v141: إيقاف الراتب وإعادته من شهر */
    async apiEmpPayStop(k, id, stop, month) {
      if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw new Error('اختر الشهر');
      await rpc('emp_pay_stop', { k: k, id: String(id || ''), stop: !!stop, month: String(month) });
      return reloadAdmin(k);
    },
    async apiRepRetSeen(id, at) { const r = await rpc('rep_ret_seen', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), rat: Number(at) || 0 }); return r; }, /* v137: «فهمت» على «أُعيد للعمل» */
    async apiRepCurAdd(id, item) { const r = await rpc('rep_cur_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || '') }); flush(); return r; }, /* v117 */
    async apiRepLaterAdd(id, item, aft) { const r = await rpc('rep_later_add', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), aft: String(aft || '') }); flush(); return r; }, /* v117 */
    async apiRepCurOrder(id, items) { return rpc('rep_cur_order', { k: CRED.k || '', id: String(id || ''), items: (items || []).map(String) }); },

    async apiProjectAdd(k, name) {
      const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!n) throw new Error('اكتب اسم المشروع');
      const r = await aexec(k, 'proj_add', { name: n });
      return { id: r.id, data: await reloadAdmin(k) };
    },

    async apiEmpOrder(k, ids) {
      if (!Array.isArray(ids) || !ids.length) throw new Error('لا يوجد ترتيب');
      await rpc('emp_order', { k: k, ids: ids.map(String) });
      return reloadAdmin(k);
    },
    async apiProjOrder(k, ids) {
      if (!Array.isArray(ids) || !ids.length) throw new Error('لا يوجد ترتيب');
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


    /* الإصدار 97: «طلعت» ترسل حتى والصفحة تتقفل، وقائمة آخر ظهور للمدير */
    seenOff() { if (!CRED.k && !CRED.t) return; try { fetch(SB_URL + '/rest/v1/rpc/app_seen_off', { method: 'POST', keepalive: true, headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ k: CRED.k || '', t: CRED.t || '' }) }).catch(() => {}); } catch (e) {} },
    async seenList() { const r = await rpc('app_seen_list', { k: CRED.k || '' }); if (RAW && r) { RAW.seen = r.seen || {}; RAW.left = r.left || {}; } return r; },
    seen(ver, label) { rpc('app_seen_mark', { k: CRED.k || '', t: CRED.t || '', ver: String(ver || ''), label: String(label || '').slice(0, 60) }).catch(() => {}); },





    async apiInvImgAdmin(k, id, fid) { return imgUrl(fid); },
    async apiInvImgEmp(t, id, fid) { return imgUrl(fid); },
    prefetch: prefetch,
    cachedUrl: cachedUrl,
    parseAmt: parseAmt_,
    fileUrl: fileUrl,
    fileUrls: async ps => { await signMany(ps); const o = {}; ps.forEach(p => { if (UC[p] && UC[p].u) o[p] = UC[p].u; }); return o; },

    async apiUploadImg(k, dataUrl) {
      if (UPD.has(dataUrl)) return UPD.get(dataUrl);
      const blob = dataUrlBlob(dataUrl);
      const r = await aexec(k, 'ticket', { kind: 'img', ext: 'jpg' });
      const p = await putImg(r.path, blob);
      UPD.set(dataUrl, p);
      return p;
    },



    async apiFileUrls(ids) {
      const ps = Array.from(new Set((ids || []).filter(Boolean))).slice(0, 50);
      if (!ps.length) return {};
      await signMany(ps);
      const out = {};
      ps.forEach(p => { if (UC[p] && UC[p].u) out[p] = UC[p].u; });
      return out;
    },


    async apiInvAdd(token, x, dataUrls) {
      x = x || {};
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وصف المشتريات');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      if (x.cat === 'sal' && !x.salEmp) throw new Error('اختر الموظف الذي سلّمته الراتب');
      const paths = await empUpload(token, dataUrls, 3);
      if (!paths.length) throw new Error('صوّر الفاتورة');
      const w = Math.round(Number(x.warranty) || 0);
      return empDo(token, 'inv_add', { cid: String(x.cid || ''), amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), cat: String(x.cat || ''), salEmp: x.cat === 'sal' ? String(x.salEmp || '') : '', project: String(x.project || ''), photos: paths, warranty: w > 0 && w <= 120 ? w : 0, paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' });
    },
    /* الإصدار 74: تصحيح فاتورة رجّعها المدير العام وإعادة إرسالها بنفس السجل */
    async apiInvResend(token, id, x, dataUrls, keep) {
      x = x || {};
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وصف المشتريات');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      const old = (keep || []).filter(Boolean).slice(0, 3);
      const paths = old.concat(await empUpload(token, dataUrls || [], Math.max(0, 3 - old.length)));
      if (!paths.length) throw new Error('صوّر الفاتورة');
      if (x.cat === 'sal' && !x.salEmp) throw new Error('اختر الموظف الذي سلّمته الراتب');
      return empDo(token, 'inv_resend', { id: String(id), amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), cat: String(x.cat || ''), salEmp: x.cat === 'sal' ? String(x.salEmp || '') : '', project: String(x.project || ''), photos: paths, paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' });
    },

    /* الإصدار 116: فاتورة «راتب موظف» لما تنعتمد تنسجل دفعة من راتب الشخص (نفس توزيع «دفعة راتب»). المبلغ الزايد عن اللي له يوقف الاعتماد */
    async apiInvApprove(k, id) {
      if (!RAW || CRED.k !== k) await loadAdmin(k);
      const x = RAW.invoices.filter(v => v.id === id)[0], a = { id: id };
      if (x && x.cat === 'sal' && x.salEmp) {
        const emp = empById(x.salEmp);
        if (!emp) throw new Error('الموظف الذي صُرف له الراتب غير موجود');
        const amount = rr2(Number(x.amount) || 0);
        const st = salSt_(emp, RAW.fin, RAW.logs, nowMonth(), { amount: amount, month: '', date: String(x.ts || '').slice(0, 10) });
        if (st.preview.extra > 0.001) throw new Error('المبلغ أكثر من المتبقي لـ' + emp.name + ' (' + rr2(amount - st.preview.extra).toLocaleString('en-US') + ')، صحّح المبلغ أو أعدها');
        a.sal = { close: closeParts_(st) };
      }
      return adminDo(k, 'inv_approve', a);
    },
    async apiInvReturn(k, id, reason) {
      const r = String(reason || '').trim().slice(0, 300);
      if (!r) throw new Error('اكتب السبب');
      return adminDo(k, 'inv_return', { id: id, reason: r });
    },
    async apiInvDelete(k, id) { return adminDo(k, 'inv_del', { id: id }); },
    async apiDelRestore(k, a) { return adminDo(k, 'del_restore', a); },
    async apiIdeaAdd(k, p, t) { return adminDo(k, 'idea_add', { project: p, text: t }); },
    async apiIdeaUpd(k, id, t) { return adminDo(k, 'idea_upd', { id: id, text: t }); },
    async apiIdeaOut(k, id, o) { return adminDo(k, 'idea_out', { id: id, out: o }); },
    async apiIdeaOpen(k, id) { return adminDo(k, 'idea_open', { id: id }); },
    async apiIdeaDel(k, id) { return adminDo(k, 'idea_del', { id: id }); },
    async apiIdeaUndel(k, id) { return adminDo(k, 'idea_undel', { id: id }); },
    async apiInvGive(k, empId, amount, note, method, sdad, ret) {
      const n = cleanAmount_(amount);
      return adminDo(k, 'inv_give', { emp: empId, amount: n, note: String(note || '').trim().slice(0, 200), method: String(method || ''), sdad: !!sdad, ret: !!ret });
    },
    async apiInvAddAdmin(k, x, dataUrls) {
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وصف المشتريات');
      if (!String(x.project || '')) throw new Error('اختر المشروع');
      const list = (dataUrls || []).slice(0, 3), paths = [];
      for (const d of list) paths.push(d && d.pdf ? await pdfUp_(k, '', d.pdf) : await API.apiUploadImg(k, d));
      const w = Math.round(Number(x.warranty) || 0);
      return adminDo(k, 'inv_add', { emp: x.emp || '', amount: amount, desc: desc, vendor: String(x.vendor || '').trim(), cat: String(x.cat || ''), project: x.project || '',
        photos: paths, paidBy: x.emp ? 'cash' : 'card', warranty: w >= 1 && w <= 120 ? addMonths_(RAW.today, w) : '' });
    },
    async apiInvEdit(k, id, x) {
      const n = cleanAmount_(x.amount);
      return adminDo(k, 'inv_edit', { id: id, amount: n, note: String(x.note || '').trim().slice(0, 200), method: String(x.method || '') });
    },
    async apiInvUpd(k, id, x) {
      x = x || {};
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وصف المشتريات');
      return adminDo(k, 'inv_upd', { id: String(id), amount: String(cleanAmount_(x.amount)), desc: desc, project: String(x.project || ''), vendor: String(x.vendor || '').trim(), cat: String(x.cat || ''),
        paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash', warranty: /^\d{4}-\d{2}-\d{2}$/.test(String(x.warranty || '')) ? x.warranty : '' });
    },
    async apiInvMatch(k, id, on) { return adminDo(k, 'inv_match', { id: id, on: !!on }); },
    async apiProjBudget(k, id, budget) { return adminDo(k, 'proj_budget', { id: id, budget: String(budget == null ? '' : budget) }); },
    async apiInvCat(k, id, cat) { return adminDo(k, 'inv_cat', { id: id, cat: String(cat || '') }); },
    async apiInvPaidBy(k, id, by) { return adminDo(k, 'inv_paidby', { id: id, by: by === 'card' || by === 'own' ? by : 'cash' }); },
    async apiInvWarranty(k, id, until) {
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error('التاريخ غير صحيح');
      return adminDo(k, 'inv_warranty', { id: id, until: until || '' });
    },

    async pushKey() {
      const r = await fetch(FN_URL, { headers: { apikey: SB_KEY } });
      const j = await r.json().catch(() => ({}));
      if (!j.pub) throw new Error('خدمة الإشعارات لا تستجيب، حاول لاحقاً');
      return j.pub;
    },

    async pushSave(cred, page, sub) {
      return page === 'admin' ? aexec(cred, 'push_sub', sub) : eexec(cred, 'push_sub', sub);
    },

    async apiAttHome(token, dataUrl, pos) { return attDo(token, 'att_home', dataUrl, pos, ''); },
    async apiAttIn(token, dataUrl, pos, project) { return attDo(token, 'att_in', dataUrl, pos, project); },
    async apiAttOut(token, dataUrl, pos) { return attDo(token, 'att_out', dataUrl, pos, ''); },
    async apiAttSeen(token, id) { return empDo(token, 'att_seen', { id: String(id || '') }); },
    /* الإصدار 121: «فهمت» على بطاقة مخالفات اليوم */
    async apiLogSeen(token) { return empDo(token, 'log_seen', {}); },
    async apiGuideAdd(k, x) {
      const title = String(x.title || '').trim().slice(0, 120);
      if (!title) throw new Error('اكتب عنوان التوجيه');
      const points = (x.points || []).map(t => String(t || '').trim().slice(0, 400)).filter(Boolean).slice(0, 20);
      if (!points.length) throw new Error('اكتب نقطة واحدة على الأقل');
      let q = null;
      if (x.q) {
        const text = String(x.q.text || '').trim().slice(0, 200);
        const opts = (x.q.opts || []).map(t => String(t || '').trim().slice(0, 120));
        const ok = Number(x.q.ok);
        if (!text) throw new Error('اكتب السؤال');
        if (opts.filter(Boolean).length < 2) throw new Error('اكتب خيارين على الأقل');
        if (!(ok >= 0) || !opts[ok]) throw new Error('حدّد الإجابة الصحيحة');
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
    async apiRepTick(id, item, undo, files, note) {
      const r = await rpc('rep_tick', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), undo: !!undo, files: (files || []).map(f => ({ p: f.p, t: f.t })), note: String(note || '') });
      flush();
      return r;
    },
    async apiRepTickBack(id, item, pos) { return await rpc('rep_tick_back', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), pos: Math.max(0, parseInt(pos, 10) || 0) }); }, /* v125: «تراجع» من التنبيه يرجّع العمل لمكانه بدون سطر الرجوع */
    async apiRepNow(id, item, undo) { const r = await rpc('rep_later_now', { k: CRED.k || '', t: CRED.t || '', id: String(id || ''), item: String(item || ''), undo: !!undo }); flush(); return r; }, /* v117 */
    async apiRepLreqReview(id, rid, ok, note) { const r = await rpc('rep_lreq_review', { k: CRED.k || '', id: String(id || ''), rid: String(rid || ''), ok: !!ok, note: String(note || '') }); flush(); return r; }, /* v117 */
    async apiRepLaterReview(id, item, ok, note) { const r = await rpc('rep_later_review', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), ok: !!ok, note: String(note || '') }); flush(); return r; }, /* v117 */
    /* v123: طلب الموظف تغيير «تبدأ بعد» للعمل اللاحق (undo يلغي طلبه)، واعتماد المدير العام أو رفضه */
    async apiRepAfterReq(id, item, aft, undo) { const r = await rpc('rep_after_req', { t: CRED.t || '', id: String(id || ''), item: String(item || ''), aft: String(aft || ''), undo: !!undo }); if (!undo) flush(); return r; },
    async apiRepAfterReview(id, item, ok, note) { const r = await rpc('rep_after_review', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), ok: !!ok, note: String(note || '') }); flush(); return r; },
    async apiRepUndone(id, item) { const r = await rpc('rep_undone', { k: CRED.k || '', id: String(id || ''), item: String(item || '') }); flush(); return r; },
    /* الإصدار 86: اعتماد الإنجاز أو إرجاعه، والتنبيه على عمل محدد، وتسجيل مشاهدة التنبيه */
    async apiRepReview(id, item, ok, note) { const r = await rpc('rep_review', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), ok: !!ok, note: String(note || '') }); flush(); return r; },
    async apiRepAlert(id, item, emps, msg, rid) { const r = await rpc('rep_alert', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), emps: emps || [], msg: String(msg || ''), rid: String(rid || '') }); flush(); return r; },
    /* الإصدار 133: موعد إنجاز العمل: التحديد والإلغاء مني، وطلب التمديد من الموظف المسؤول، واعتماده أو رفضه */
    async apiDueSet(id, item, emp, due, rid) { const r = await rpc('rep_due_set', { k: CRED.k || '', id: String(id || ''), item: String(item || ''), emp: String(emp || ''), due: String(due || ''), rid: String(rid || '') }); flush(); return r; },
    async apiDueDel(did) { const r = await rpc('rep_due_del', { k: CRED.k || '', did: String(did || '') }); flush(); return r; },
    async apiDueReq(did, due, note, undo) { const r = await rpc('rep_due_req', { t: CRED.t || '', did: String(did || ''), due: String(due || ''), note: String(note || ''), undo: !!undo }); if (!undo) flush(); return r; },
    async apiDueRev(did, ok, note) { const r = await rpc('rep_due_rev', { k: CRED.k || '', did: String(did || ''), ok: !!ok, note: String(note || '') }); flush(); return r; },
    async apiAlertSeen(id) { const r = await rpc('alert_seen', { t: CRED.t || '', id: String(id || '') }); flush(); return r; },
    async apiRepDecDel(id, item) { return rpc('rep_dec_del', { k: CRED.k || '', id: String(id || ''), item: String(item || '') }); },
    async trGet(texts, lang) { return rpc('tr_get', { k: CRED.k || '', t: CRED.t || '', texts: texts, tl: lang }); },
    async apiNotifs() { return rpc('notif_list', { k: CRED.k || '', t: CRED.t || '' }); },
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
