/* تقييم الفريق — طبقة الاتصال مع Supabase (بديل Code.gs) */
(function () {
  const SB_URL = 'https://qwagdoopszcyezywyfad.supabase.co';
  const SB_KEY = 'sb_publishable_QS6Ujy65uyr2MQJUT-691g_2vkeRKxP';
  const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const BUCKET = 'files';
  const FN_URL = SB_URL + '/functions/v1/push';
  const NOTIFY = ['tasks_add', 'task_return', 'inv_approve', 'inv_return'];
  function flush() {
    fetch(FN_URL, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{"op":"flush"}', keepalive: true }).catch(() => {});
  }

  const TRUST = 'الأمانة والمصداقية';
  const STAR_CRIT = 'موقف مميز';
  const MAX_MEDIA = 5, MAX_VID = 45 * 1024 * 1024;
  const DEF = { miss: 5, trust: 10, star: 5, starCap: 100, clean: 50 };
  const CRITERIA = [
    { n: 'الحضور والمواعيد', s: 'الأداء', short: 'الحضور', bad: 'ركّز على الحضور بوقتك والالتزام بمواعيد التسليم.' },
    { n: 'جودة الشغل', s: 'الأداء', short: 'جودة الشغل', bad: 'راجع الشغل قبل التسليم عشان ما نحتاج نعيده.' },
    { n: 'إدارة العمال', s: 'الأداء', short: 'إدارة العمال', bad: 'تابع العمال أكثر وتأكد إن كل واحد عارف شغله.' },
    { n: 'حل المشاكل', s: 'الأداء', short: 'حل المشاكل', bad: 'حاول تحل المشاكل البسيطة بنفسك وترجع لي بالكبيرة بس.' },
    { n: 'الأمانة والمصداقية', s: 'السلوك', short: 'الأمانة', bad: 'الأمانة والوضوح في المصاريف والمعلومات خط أحمر، انتبه لها.' },
    { n: 'الاحترام وحسن التعامل', s: 'السلوك', short: 'الاحترام', bad: 'انتبه لأسلوبك في التعامل مع العمال والعملاء.' },
    { n: 'الالتزام بالتعليمات', s: 'السلوك', short: 'التعليمات', bad: 'نفّذ التعليمات مثل ما هي، وإذا عندك رأي قوله قبل التنفيذ.' },
    { n: 'النظافة', s: 'السلوك', short: 'النظافة', bad: 'اهتم بنظافة المكان والأدوات ونظافتك الشخصية.' },
    { n: 'الانضباط والمظهر', s: 'السلوك', short: 'الانضباط', bad: 'اهتم بانضباطك ومظهرك قدام العمال والعملاء.' }
  ];
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  /* ---------- اتصال ---------- */
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(friendly(error));
    return data;
  }
  function friendly(e) {
    const m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ما فيه اتصال، تأكد من النت وجرّب مرة ثانية';
    return m || 'صار خطأ، جرّب مرة ثانية';
  }
  const aexec = (k, op, a) => rpc('admin_exec', { k: k, op: op, a: a || {} });
  const eexec = (t, op, a) => rpc('emp_exec', { t: t, op: op, a: a || {} });

  let RAW = null;
  async function loadAdmin(k) { RAW = norm(await rpc('admin_raw', { k: k })); return RAW; }
  async function loadEmp(t) { RAW = norm(await rpc('emp_raw', { t: t })); return RAW; }

  function norm(r) {
    r.employees = (r.employees || []).map(e => ({ id: e.id, name: e.name, salary: Number(e.salary) || 0, max: Number(e.max) || 0,
      token: e.token || '', active: e.active !== false, track: !!e.track }));
    r.logs = r.logs || [];
    r.fin = (r.fin || []).map(f => Object.assign({}, f, { amount: Number(f.amount) || 0, months: Number(f.months) || 0 }));
    r.tasks = (r.tasks || []).map(t => {
      const pr = Array.isArray(t.proofs) ? t.proofs : [];
      return Object.assign({}, t, { photo: pr[0] || '', extra: pr.slice(1), media: Array.isArray(t.media) ? t.media : [], urgent: !!t.urgent });
    });
    r.projects = r.projects || [];
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
  async function put(path, blob, type) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(friendly(error));
    return path;
  }
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
  async function putImg(path, blob) {
    const t = thumbOf(path);
    const thumbJob = t ? makeThumb(blob).then(tb => tb ? put(t, tb, 'image/jpeg') : null).catch(() => null) : null;
    await Promise.all([put(path, blob, blob.type), thumbJob]);
    return path;
  }

  /* روابط الصور: تنطلب دفعة وحدة وتنحفظ في المتصفح 6 أيام عشان الصورة تنفتح من الكاش */
  const LS = 'urlc1', TTL = 7 * 86400, KEEP = 6 * 864e5;
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
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(part, TTL);
      if (error) throw new Error('ما قدرت أفتح الملف');
      const x = Date.now() + KEEP;
      (data || []).forEach((d, j) => { const p = d.path || part[j]; UC[p] = { u: d.signedUrl || '', x: x }; });
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
  function projMap_(ps) { const m = {}; ps.forEach(p => { m[p.id] = p.name; }); return m; }
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
      if (l.crit === TRUST) trust++; else misses++;
      mMap[l.crit] = (mMap[l.crit] || 0) + (l.crit === TRUST ? 3 : 1);
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
      return { month: mk, label: monthLabel_(mk), paid: true, paidAmount: pay.amount, paidDate: pay.date, payId: pay.id,
        base: d.base, bonus: d.bonus, points: d.points, target: d.target, max: d.max,
        advance: d.advance, inst: d.inst, loanParts: d.loanParts || {}, net: d.net, warn10: false, track: !!emp.track };
    }
    const c = calcMonth_(emp, logs, mk);
    const advance = fin.filter(f => f.kind === 'adv' && f.emp === emp.id && f.month === mk).reduce((s, f) => s + f.amount, 0);
    const due = loanDue_(emp, fin, mk);
    return { month: mk, label: monthLabel_(mk), paid: false,
      base: emp.salary, bonus: c.bonus, points: c.points, target: 20, max: c.max,
      advance: advance, inst: due.total, loanParts: due.parts,
      net: emp.salary + c.bonus - advance - due.total,
      warn10: due.total > emp.salary * 0.1, track: !!emp.track };
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
      id: f.id, date: f.date, kind: f.kind, amount: f.amount, months: f.months, start: f.start,
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
      else { map[g].crits.push(l.crit); map[g].pts -= l.crit === TRUST ? st.trust : st.miss; }
    });
    return order.map(g => map[g]).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
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
      comment: t.comment, hasPhoto: !!t.photo, reason: t.reason, urgent: t.urgent,
      proofs: [t.photo].concat(t.extra || []).filter(Boolean),
      project: pmap[t.project] ? t.project : '', pname: pmap[t.project] || '', media: t.media,
      late: t.status !== 'done' && t.status !== 'review' && !!t.due && t.due < today,
      lateDone: t.status === 'done' && !!t.due && t.doneAt.slice(0, 10) > t.due }));
  }
  /* العهدة: c باقي معه، o له عندك من جيبه، t كل اللي له عندك */
  function invParts_(rows, empId) {
    let g = 0, sd = 0, cash = 0, own = 0;
    rows.forEach(x => {
      if (x.emp !== empId || x.status !== 'ok') return;
      if (x.kind === 'give') { if (x.paidBy === 'own') sd += x.amount; else g += x.amount; }
      else if (x.paidBy === 'own') own += x.amount;
      else if (x.paidBy !== 'card') cash += x.amount;
    });
    const r2 = n => Math.round(n * 100) / 100;
    const rawO = own - sd, o = Math.max(0, rawO), c = g - cash + Math.max(0, -rawO);
    return { c: r2(c), o: r2(o), t: r2(o + Math.max(0, -c)), g: r2(g), cash: r2(cash), own: r2(own), sd: r2(sd) };
  }
  function invOut_(x, pmap) {
    return { id: x.id, ts: x.ts, emp: x.emp, kind: x.kind, amount: x.amount, desc: x.desc, project: x.project,
      pname: x.project ? (pmap[x.project] || '') : '', nph: x.photos.length, photos: x.photos, status: x.status, reason: x.reason,
      method: x.method || '', warrantyUntil: x.warrantyUntil || '', paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' };
  }

  function empPayload_(emp) {
    const logs = RAW.logs, fin = RAW.fin, now = nowMonth(), todayS = RAW.today;
    const pmap = projMap_(RAW.projects);
    const mine = logs.filter(l => l.emp === emp.id);
    const inv = RAW.invoices.filter(x => x.emp === emp.id);
    return {
      name: emp.name,
      today: todayS,
      tasks: tasksFor_(emp.id, RAW.tasks, todayS, pmap),
      month: calcMonth_(emp, logs, now),
      fin: finMonth_(emp, fin, logs, now),
      entries: groups_(mine.filter(l => l.date.slice(0, 7) === now)),
      history: monthsRange_(startMonth_(emp, logs, fin), now).reverse().map(mk => {
        const f = finMonth_(emp, fin, logs, mk);
        return { month: mk, label: monthLabel_(mk), points: f.points, bonus: f.bonus, net: f.net,
          paid: f.paid, paidAmount: f.paidAmount, paidDate: f.paidDate };
      }),
      loans: loanBalances_(emp, fin),
      tx: txList_(fin.filter(f => f.emp === emp.id)).slice(0, 30),
      rules: settings_(),
      projects: RAW.projects.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name })),
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
      inv: { bal: bal, parts: parts, items: RAW.invoices.slice().reverse().slice(0, 400).map(x => invOut_(x, pmap)) },
      projects: projects.map(p => ({ id: p.id, name: p.name, archived: p.archived,
        open: tasks.filter(t => t.project === p.id && t.status !== 'done' && empIds.indexOf(t.emp) >= 0).length })),
      criteria: CRITERIA.map(c => ({ n: c.n, s: c.s, short: c.short })),
      today: todayS,
      yesterday: addDay(todayS, -1),
      month: monthLabel_(now),
      settings: settings_(),
      employees: emps.map(e => {
        const mine = logs.filter(l => l.emp === e.id);
        const unpaid = monthsRange_(startMonth_(e, logs, fin), now).filter(mk => !isPaid_(fin, e.id, mk));
        return {
          id: e.id, name: e.name, salary: e.salary, max: e.max, token: e.token, track: e.track,
          month: calcMonth_(e, logs, now),
          recent: groups_(mine).slice(0, 15),
          unpaid: unpaid.map(mk => finMonth_(e, fin, logs, mk)),
          loans: loanBalances_(e, fin),
          tx: txList_(fin.filter(f => f.emp === e.id)).slice(0, 15),
          tasks: tasksFor_(e.id, tasks, todayS, pmap)
        };
      })
    };
  }

  async function adminDo(k, op, a) {
    await aexec(k, op, a);
    if (NOTIFY.indexOf(op) >= 0) flush();
    await loadAdmin(k);
    return adminPayload_();
  }
  const empById = id => RAW.employees.filter(e => e.id === id)[0];

  async function empUpload(token, dataUrls, max) {
    const list = (Array.isArray(dataUrls) ? dataUrls : [dataUrls]).filter(Boolean).slice(0, max);
    return Promise.all(list.map(async d => {
      const blob = dataUrlBlob(d);
      if (blob.size > 5 * 1024 * 1024) throw new Error('الصورة كبيرة، جرّب وحدة ثانية');
      const r = await eexec(token, 'ticket', {});
      return putImg(r.path, blob);
    }));
  }

  /* ---------- الواجهات (نفس أسماء Code.gs) ---------- */
  const API = {
    async apiAdmin(k) { await loadAdmin(k); return adminPayload_(); },

    async apiAdd(k, x) {
      await loadAdmin(k);
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
      await loadAdmin(k);
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

    async apiNewAdminLink(k) { return aexec(k, 'admin_newkey', {}); },

    async apiPreview(k, empId) {
      await loadAdmin(k);
      const emp = empById(empId);
      if (!emp) throw new Error('الموظف غير موجود');
      return empPayload_(emp);
    },

    async apiFinAdd(k, x) {
      await loadAdmin(k);
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
      const f = finMonth_(emp, RAW.fin, RAW.logs, mk);
      const paid = x.amount === '' || x.amount == null ? f.net : Math.round(Number(x.amount));
      if (!(paid >= 0)) throw new Error('المبلغ غير صحيح');
      const details = { base: f.base, bonus: f.bonus, points: f.points, target: f.target, max: f.max,
        advance: f.advance, inst: f.inst, loanParts: f.loanParts, net: f.net };
      return adminDo(k, 'fin_add', { date: RAW.today, emp: emp.id, kind: 'pay', amount: paid, months: 0, start: '', month: mk,
        note: String(x.note || '').slice(0, 200), details: details });
    },

    async apiFinDelete(k, id) {
      await loadAdmin(k);
      const fin = RAW.fin;
      const r = fin.filter(f => f.id === id)[0];
      if (!r) throw new Error('الحركة غير موجودة');
      if (r.kind === 'adv' && isPaid_(fin, r.emp, r.month)) throw new Error('الشهر انصرف، احذف الصرف أول');
      if (r.kind === 'loan' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.details && f.details.loanParts && f.details.loanParts[r.id])) {
        throw new Error('فيه أقساط من هالسلفة انخصمت، احذف الصرف أول');
      }
      if (r.kind === 'pay' && fin.some(f => f.kind === 'pay' && f.emp === r.emp && f.month > r.month)) throw new Error('احذف صرف الشهور اللي بعده أول');
      return adminDo(k, 'fin_del', { id: id });
    },

    async apiProjectAdd(k, name) {
      const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!n) throw new Error('اكتب اسم المشروع');
      const r = await aexec(k, 'proj_add', { name: n });
      await loadAdmin(k);
      return { id: r.id, data: adminPayload_() };
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
      await loadAdmin(k);
      const act = RAW.employees.filter(e => e.active).map(e => e.id);
      const ids = (x.emps || []).filter((id, i, a) => a.indexOf(id) === i && act.indexOf(id) >= 0);
      if (!ids.length) throw new Error('اختر الموظف');
      const project = String(x.project || '');
      if (project && !RAW.projects.some(p => p.id === project)) throw new Error('المشروع غير موجود');
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
        ids.forEach(id => rows.push({ emp: id, title: title, due: due, note: note, project: project, media: media, urgent: !!it.urgent }));
      });
      return adminDo(k, 'tasks_add', { rows: rows });
    },

    async apiTaskDelete(k, id) { return adminDo(k, 'task_del', { id: id }); },

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
      return adminDo(k, 'task_update', a);
    },

    async apiTaskDone(token, id, comment, dataUrls) {
      const paths = await empUpload(token, dataUrls, 5);
      if (!paths.length) throw new Error('لازم ترفق صورة');
      await eexec(token, 'task_done', { id: id, comment: String(comment || ''), proofs: paths });
      flush();
      return API.apiEmp(token);
    },

    async apiProofAdmin(k, id, fid) { return imgUrl(fid); },
    async apiProofEmp(t, id, fid) { return imgUrl(fid); },
    async apiMediaAdmin(k, taskId, fid) { return fileUrl(fid); },
    async apiMediaEmp(t, taskId, fid) { return fileUrl(fid); },
    async apiInvImgAdmin(k, id, fid) { return imgUrl(fid); },
    async apiInvImgEmp(t, id, fid) { return imgUrl(fid); },
    prefetch: prefetch,

    async apiUploadImg(k, dataUrl) {
      const blob = dataUrlBlob(dataUrl);
      const r = await aexec(k, 'ticket', { kind: 'img', ext: 'jpg' });
      return putImg(r.path, blob);
    },

    async apiUploadVid(k, file) {
      if (!file) throw new Error('ما وصل الفيديو، جرّب مرة ثانية');
      if (file.size > MAX_VID) throw new Error('الفيديو أكبر من الحد، صوّره أقصر');
      const ext = ((String(file.name || '').match(/\.(\w{2,4})$/) || [])[1] || 'mp4').toLowerCase();
      const known = { mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', '3gp': 'video/3gpp' };
      let type = String(file.type || '');
      if (['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'].indexOf(type) < 0) type = known[ext] || 'video/mp4';
      const r = await aexec(k, 'ticket', { kind: 'vid', ext: ext === 'm4v' ? 'mp4' : ext });
      return put(r.path, file, type);
    },

    async apiMediaDiscard() { return true; },

    async apiInvAdd(token, x, dataUrls) {
      x = x || {};
      const amount = cleanAmount_(x.amount);
      const desc = String(x.desc || '').trim().slice(0, 200);
      if (!desc) throw new Error('اكتب وش اشتريت');
      const paths = await empUpload(token, dataUrls, 3);
      if (!paths.length) throw new Error('صوّر الفاتورة');
      const w = Math.round(Number(x.warranty) || 0);
      await eexec(token, 'inv_add', { amount: amount, desc: desc, project: String(x.project || ''), photos: paths, warranty: w > 0 && w <= 120 ? w : 0, paidBy: x.paidBy === 'card' || x.paidBy === 'own' ? x.paidBy : 'cash' });
      flush();
      return API.apiEmp(token);
    },

    async apiInvApprove(k, id) { return adminDo(k, 'inv_approve', { id: id }); },
    async apiInvReturn(k, id, reason) {
      const r = String(reason || '').trim().slice(0, 300);
      if (!r) throw new Error('اكتب السبب');
      return adminDo(k, 'inv_return', { id: id, reason: r });
    },
    async apiInvDelete(k, id) { return adminDo(k, 'inv_del', { id: id }); },
    async apiInvGive(k, empId, amount, note, method, sdad) {
      const n = cleanAmount_(amount);
      return adminDo(k, 'inv_give', { emp: empId, amount: n, note: String(note || '').trim().slice(0, 200), method: String(method || ''), sdad: !!sdad });
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

    async apiEmp(token) {
      await loadEmp(token);
      const emp = empById(RAW.me);
      if (!emp) throw new Error('الرابط غير صالح');
      return empPayload_(emp);
    }
  };

  window.API = API;
  window.fileUrl = fileUrl;
})();
