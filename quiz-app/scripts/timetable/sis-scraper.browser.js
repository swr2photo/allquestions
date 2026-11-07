/*
 * PSU SIS → Timetable scraper (runs in the browser)
 * ------------------------------------------------------------
 * ทำไมต้องรันในเบราว์เซอร์:
 *   - api-gateway.psu.ac.th (Postman "Central") ต้องใช้ API key และไม่มี endpoint รายวิชา/ตารางเรียน
 *   - sis.psu.ac.th อยู่หลัง Cloudflare (curl/fetch ฝั่ง server ได้ 403) และเป็น Blazor Server
 *     ที่โหลดข้อมูลผ่าน websocket จึงต้องให้เบราว์เซอร์จริงเรนเดอร์หน้าแล้วอ่าน DOM
 *
 * วิธีใช้:
 *   1. เปิด https://sis.psu.ac.th/Culture/SetCulture?culture=th-TH&redirectUri=%2Fexplore%2Fsubject
 *      (สลับเป็นภาษาไทย เพื่อให้ชื่อคณะ/อาจารย์/วันสอบเป็นภาษาไทย — ใช้ภาษาอังกฤษก็ได้ importer รองรับทั้งคู่)
 *   2. เปิด DevTools → Console แล้วกำหนดภาคที่ต้องการ เช่น
 *        window.SIS_SCRAPE_CONFIG = { year: 2569, term: 1 };
 *   3. วางโค้ดทั้งไฟล์นี้ลงใน Console แล้วกด Enter
 *   4. รอจนเสร็จ (ดูความคืบหน้าที่ window.__SIS_SCRAPE) ไฟล์ sis_subjects_<year>-<term>.json จะถูกดาวน์โหลด
 *   5. นำเข้าแอป:  node scripts/timetable/import-term.mjs <ไฟล์ที่ได้>
 *
 * ตัวเลือก (SIS_SCRAPE_CONFIG):
 *   year         ปี พ.ศ. (เช่น 2569)              term   1 | 2 | 3
 *   campuses     รหัสวิทยาเขต ['01','02','03','04','05'] (01 หาดใหญ่ 02 ปัตตานี 03 ภูเก็ต 04 สุราษฎร์ฯ 05 ตรัง)
 *   keyword      จำกัดด้วยคำค้น (เช่น '322-') — ว่าง = ทุกวิชา
 *   concurrency  จำนวน iframe ที่โหลดหน้ารายละเอียดพร้อมกัน (ค่าเริ่มต้น 3 — อย่าตั้งสูง เกรงใจเซิร์ฟเวอร์ SIS)
 *   limit        จำกัดจำนวนวิชา (0 = ไม่จำกัด) ใช้ทดสอบ
 *   download     true = ดาวน์โหลดไฟล์ JSON เมื่อเสร็จ
 *   submitTo     URL ที่จะ POST ผลลัพธ์ (ฟอร์ม field "json") เมื่อเสร็จ แทนการดาวน์โหลด
 *   resume       true (ค่าเริ่มต้น) = บันทึกทุกวิชาลง IndexedDB ระหว่างทำงาน ถ้าแท็บปิด/เบราว์เซอร์ค้าง
 *                ให้วางสคริปต์ซ้ำ จะทำต่อจากเดิม (ไม่ใช้เมื่อกำหนด keyword หรือ limit)
 *
 * ระหว่างทำงาน: window.__SIS_SCRAPE.stop() หยุด, window.__SIS_SCRAPE.download() ดาวน์โหลดผลที่ได้ถึงตอนนี้,
 *               window.__SIS_SCRAPE.clear() ลบข้อมูลที่บันทึกไว้ของภาคนี้เพื่อเริ่มใหม่
 */
(async () => {
  "use strict";
  const CFG = Object.assign(
    {
      year: 2569,
      term: 1,
      campuses: ["01", "02", "03", "04", "05"],
      keyword: "",
      concurrency: 3,
      limit: 0,
      download: true,
      submitTo: "",
      resume: true,
      pageTimeoutMs: 30000,
    },
    window.SIS_SCRAPE_CONFIG || {}
  );

  if (!/sis\.psu\.ac\.th$/.test(location.hostname)) {
    console.error("[SIS] ต้องรันสคริปต์นี้บน https://sis.psu.ac.th");
    return;
  }

  const state = {
    config: CFG,
    phase: "listing",
    listed: 0,
    done: 0,
    total: 0,
    errors: [],
    subjects: [],
    stopped: false,
    stop() {
      this.stopped = true;
    },
    download() {
      downloadJson();
    },
  };
  window.__SIS_SCRAPE = state;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const log = (...a) => console.log("%c[SIS]", "color:#0b7a75;font-weight:bold", ...a);

  // ---------- iframe helpers ----------
  function makeFrame() {
    const f = document.createElement("iframe");
    f.style.cssText =
      "position:fixed;left:-3000px;top:0;width:1200px;height:900px;border:0;visibility:hidden";
    document.body.appendChild(f);
    return f;
  }

  async function waitFor(fn, timeout = CFG.pageTimeoutMs, every = 200) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        const v = fn();
        if (v) return v;
      } catch {
        /* frame navigating */
      }
      await sleep(every);
    }
    return null;
  }

  async function loadInto(frame, url, ready) {
    const loaded = new Promise((res) => frame.addEventListener("load", res, { once: true }));
    frame.src = url;
    await Promise.race([loaded, sleep(CFG.pageTimeoutMs)]);
    return waitFor(() => ready(frame.contentDocument));
  }

  // ---------- Phase 1: list subject links per campus ----------
  function listUrl(campus) {
    const p = new URLSearchParams({ term: String(CFG.term), year: String(CFG.year) });
    if (campus) p.set("c", campus);
    if (CFG.keyword) p.set("keyword", CFG.keyword);
    return `/explore/subject?${p}`;
  }

  const linkSel = 'a[href*="/explore/subjects/"]';
  const firstHref = (doc) => doc.querySelector(linkSel)?.getAttribute("href") || "";

  async function listCampus(frame, campus) {
    const found = new Map();
    const ok = await loadInto(frame, listUrl(campus), (doc) => {
      const main = doc && doc.querySelector("main");
      if (!main) return false;
      if (doc.querySelector(linkSel)) return true;
      // empty-state: no links and the search card has rendered something other than a spinner
      return /ไม่พบ|No subject|not found|0 subjects|0 รายวิชา/i.test(main.innerText);
    });
    if (!ok) {
      log(`วิทยาเขต ${campus}: ไม่มีข้อมูลหรือโหลดไม่สำเร็จ`);
      return [];
    }
    const doc = frame.contentDocument;
    const totalMatch = doc.querySelector("main").innerText.match(/(?:of|จาก)\s*([\d,]+)/i);
    const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0;
    log(`วิทยาเขต ${campus}: ${total || "?"} วิชา`);

    for (let page = 1; page < 2000 && !state.stopped; page++) {
      const d = frame.contentDocument;
      d.querySelectorAll(linkSel).forEach((a) => {
        const href = a.getAttribute("href");
        const m = href.match(/\/explore\/subjects\/(\d+)\/(\d)\/(\d{4})\/(\d+)/);
        if (!m) return;
        const key = `${m[1]}-${m[4]}`;
        if (!found.has(key)) {
          const url = new URL(href, location.origin);
          url.search = new URLSearchParams({ term: m[2], year: m[3], c: m[4] }).toString();
          found.set(key, { id: m[1], campus: m[4], url: url.href });
        }
      });
      state.listed = [...found.values()].length;
      if (CFG.limit && found.size >= CFG.limit) break;
      if (total && found.size >= total) break;

      const next = d.querySelector('[data-slot="next"]');
      if (!next || next.disabled || next.getAttribute("aria-disabled") === "true") break;
      const before = firstHref(d);
      next.click();
      const changed = await waitFor(() => firstHref(frame.contentDocument) !== before, 15000, 150);
      if (!changed) break;
    }
    return [...found.values()];
  }

  // ---------- Phase 2: parse subject detail ----------
  // The subject header renders first and the section list streams in later over the
  // Blazor circuit, so "no rows yet" is only trusted after it has stayed that way a while.
  function makeDetailReady() {
    let emptySince = 0;
    return (doc) => {
      if (!doc || !doc.querySelector(".sdh-title")) return false;
      const rows = doc.querySelectorAll("article.sis-section-row").length;
      const n = Number((doc.querySelector(".scl-count")?.textContent.match(/\d+/) || ["0"])[0]);
      if (rows > 0 && rows >= n) return "ok";
      if (rows === 0) {
        if (!emptySince) emptySince = Date.now();
        return Date.now() - emptySince > 4000 ? "ok" : false;
      }
      emptySince = 0;
      return false;
    };
  }

  const LABELS = {
    semester: /Semester|ภาค/i,
    faculty: /Faculty|คณะ|ส่วนงาน/i,
    dept: /Department|ภาควิชา|หน่วยงาน|สาขา/i,
    campus: /Campus|วิทยาเขต/i,
  };

  function parseDetail(doc, item) {
    const info = {};
    doc.querySelectorAll(".sdv-grid > div").forEach((row) => {
      const dt = text(row.querySelector("dt"));
      const dd = text(row.querySelector("dd"));
      for (const [k, re] of Object.entries(LABELS)) {
        if (!(k in info) && re.test(dt)) {
          info[k] = dd;
          break;
        }
      }
    });

    const chip = text(doc.querySelector(".sdh-credit"));
    const ltp = text(doc.querySelector(".sdh-ltp")).replace(/^·\s*/, "");
    const creditNum = Number((chip.match(/\d+(\.\d+)?/) || ["0"])[0]);

    const desc = text(doc.querySelector(".sd-description .sdd-text"));

    const conditions = [...doc.querySelectorAll(".sd-conditions .sis-callout")].map((c) => ({
      title: text(c.querySelector('[data-slot="title"]')),
      body: text(c.querySelector('[data-slot="body"]')),
    }));

    const sections = [...doc.querySelectorAll("article.sis-section-row")].map((art) => {
      const sec = (text(art.querySelector('[data-slot="title"]')).match(/\d+[A-Z]?/i) || [art.id])[0];
      const seats = text(art.querySelector('[data-slot="seat-desktop"]'));
      const group = text(art.querySelector('[data-slot="group-value"]'));
      const badges = [...art.querySelectorAll('[data-slot="header"] .sis-pill, [data-slot="header"] .sis-chip')]
        .map(text)
        .filter((t) => t && t !== seats);

      const schedule = [...art.querySelectorAll('table[data-slot="schedule-desktop"] tbody tr')].map((tr) => {
        const tds = tr.querySelectorAll("td");
        const lecturers = (tds[2]?.innerText || "")
          .split(/\n|,\s*/)
          .map((s) => s.trim())
          .filter((s) => s && s !== "-");
        return { dayTime: text(tds[0]), room: text(tds[1]), lecturers };
      });
      if (!schedule.length) {
        const mobile = text(art.querySelector('[data-slot="schedule-mobile"]'));
        if (mobile) schedule.push({ dayTime: mobile, room: "", lecturers: [] });
      }

      let midterm = "-";
      let final = "-";
      art.querySelectorAll('[data-slot="exams"] span').forEach((s, i) => {
        const t = text(s);
        const v = t.replace(/^[^:]*:\s*/, "").trim() || "-";
        if (/Midterm|กลางภาค/i.test(t)) midterm = v;
        else if (/Final|ปลายภาค/i.test(t)) final = v;
        else if (i === 0) midterm = v;
        else final = v;
      });

      const instructors = [...new Set(schedule.flatMap((r) => r.lecturers))];
      const rooms = [...new Set(schedule.map((r) => r.room).filter((r) => r && r !== "-"))];
      return {
        sec,
        seats,
        badges,
        group,
        dayTime: schedule.map((r) => r.dayTime).filter(Boolean).join(", "),
        room: rooms.join(", ") || "-",
        instructors,
        midterm,
        final,
        schedule,
      };
    });

    return {
      id: item.id,
      code: text(doc.querySelector(".sdh-code")),
      nameTh: text(doc.querySelector(".sdh-title")),
      nameEn: text(doc.querySelector(".sdh-subtitle")),
      credits: ltp ? `${ltp}` : chip,
      creditNum,
      desc,
      dept: info.dept && info.dept !== "-" ? info.dept : "",
      faculty: info.faculty || "",
      campus: info.campus || "",
      campusCode: item.campus,
      semester: `${CFG.term}/${CFG.year}`,
      url: item.url,
      conditions,
      sections,
    };
  }

  // ---------- persistence (IndexedDB on sis.psu.ac.th) ----------
  // Every parsed subject is stored as soon as it is done, so a closed tab / crashed browser
  // resumes from where it stopped instead of starting over.
  const TERM_KEY = `${CFG.year}-${CFG.term}`;
  const persist = CFG.resume && !CFG.keyword && !CFG.limit;
  let dbPromise = null;
  function db() {
    dbPromise ||= new Promise((res, rej) => {
      const r = indexedDB.open("psu-timetable-scrape", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("subjects");
        r.result.createObjectStore("meta");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbPromise;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  const termRange = () => IDBKeyRange.bound(`${TERM_KEY}:`, `${TERM_KEY}:￿`);
  state.clear = async () => {
    await idb("subjects", "readwrite", (s) => s.delete(termRange()));
    await idb("meta", "readwrite", (s) => s.delete(`${TERM_KEY}:items`));
    log(`ล้างข้อมูลที่บันทึกไว้ของภาค ${CFG.term}/${CFG.year} แล้ว`);
  };

  // ---------- output ----------
  function payloadJson() {
    return JSON.stringify({
      source: "sis.psu.ac.th",
      year: CFG.year,
      term: CFG.term,
      scrapedAt: new Date().toISOString(),
      complete: state.phase === "done",
      errors: state.errors,
      subjects: state.subjects,
    });
  }

  /** POST the result as a top-level form (works even where CSP blocks fetch/iframes to that host). */
  function submitJson(url) {
    const fm = document.createElement("form");
    fm.method = "POST";
    fm.action = url;
    const ta = document.createElement("textarea");
    ta.name = "json";
    ta.value = payloadJson();
    fm.appendChild(ta);
    document.body.appendChild(fm);
    fm.submit();
  }

  function downloadJson() {
    const blob = new Blob([payloadJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sis_subjects_${CFG.year}-${CFG.term}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 5000);
  }

  log(`เริ่มดึงภาค ${CFG.term}/${CFG.year}`, CFG);
  let items = persist ? (await idb("meta", "readonly", (s) => s.get(`${TERM_KEY}:items`))) || [] : [];
  if (items.length) {
    log(`ใช้รายชื่อวิชาที่บันทึกไว้ (${items.length} วิชา) — เรียก __SIS_SCRAPE.clear() เพื่อเริ่มใหม่`);
  } else {
    const listFrame = makeFrame();
    for (const c of CFG.campuses) {
      if (state.stopped) break;
      items = items.concat(await listCampus(listFrame, c));
      if (CFG.limit && items.length >= CFG.limit) break;
    }
    listFrame.remove();
    if (CFG.limit) items = items.slice(0, CFG.limit);
    if (persist && !state.stopped) await idb("meta", "readwrite", (s) => s.put(items, `${TERM_KEY}:items`));
  }
  state.total = items.length;

  const keyOf = (item) => `${TERM_KEY}:${item.id}-${item.campus}`;
  if (persist) {
    state.subjects = (await idb("subjects", "readonly", (s) => s.getAll(termRange()))) || [];
    const have = new Set(state.subjects.map((s) => `${TERM_KEY}:${s.id}-${s.campusCode}`));
    state.done = items.filter((it) => have.has(keyOf(it))).length;
    items = items.filter((it) => !have.has(keyOf(it)));
    if (state.done) log(`ทำต่อจากเดิม: มีแล้ว ${state.done} วิชา เหลือ ${items.length}`);
  }
  state.phase = "details";
  log(`พบ ${state.total} วิชา → กำลังโหลดรายละเอียด`);

  let cursor = 0;
  async function worker() {
    const frame = makeFrame();
    while (!state.stopped && cursor < items.length) {
      const item = items[cursor++];
      let attempt = 0;
      while (attempt < 3) {
        attempt++;
        const ok = await loadInto(frame, item.url, makeDetailReady());
        if (ok) {
          try {
            const subject = parseDetail(frame.contentDocument, item);
            state.subjects.push(subject);
            if (persist) await idb("subjects", "readwrite", (s) => s.put(subject, keyOf(item)));
          } catch (e) {
            state.errors.push({ url: item.url, error: String(e) });
          }
          break;
        }
        if (attempt === 3) state.errors.push({ url: item.url, error: "timeout" });
        await sleep(1500 * attempt);
      }
      state.done++;
      if (state.done % 50 === 0 || state.done === items.length) {
        log(`${state.done}/${items.length} (error ${state.errors.length})`);
      }
      await sleep(150);
    }
    frame.remove();
  }
  await Promise.all(Array.from({ length: Math.max(1, CFG.concurrency) }, worker));

  state.phase = state.stopped ? "stopped" : "done";
  const secCount = state.subjects.reduce((n, s) => n + s.sections.length, 0);
  log(`เสร็จ: ${state.subjects.length} วิชา, ${secCount} sections, error ${state.errors.length}`);
  // A finished run must not be "resumed" next time (that would resubmit stale data),
  // so drop the saved progress once the result is in memory and about to be handed off.
  if (state.phase === "done" && persist) await state.clear();
  if (state.phase === "done" && CFG.submitTo) submitJson(CFG.submitTo);
  else if (CFG.download) downloadJson();
})();
