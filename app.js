(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const C = t => `${t}<small class="u">℃</small>`;
  const CITIES = [["서울",37.5665,126.978],["인천",37.4563,126.7052],["수원",37.2636,127.0286],["청주",36.6424,127.489],["대전",36.3504,127.3845],["대구",35.8714,128.6014],["광주",35.1595,126.8526],["부산",35.1796,129.0756],["강릉",37.7519,128.8761],["제주",33.4996,126.5312]];
  const state = { place:"서울", now:null, low:null, hourly:[], wear:null, doing:null, deg:1, compared:false };

  // 단열이 약하고 난방을 끈 방의 실내 온도 추정 (설명용 단순 모델)
  const theirRoom = t => Math.min(16, Math.round(t * 0.5 + 9));
  const band = r => r <= 5 ? "severe" : r <= 11 ? "cold" : "cool";
  const frostOf = r => Math.max(0, Math.min(1, (14 - r) / 12)).toFixed(2);

  const STORIES = {
    study:{ when:"내가 공부하는 지금, 그 방에서는", severe:"입김이 보이는 방에서 숙제를 해요. 손이 곱아서 글씨가 자꾸 삐뚤어져요.", cold:"이불을 어깨에 두르고 책상 앞에 앉아요. 30분마다 손을 비벼 녹여요.", cool:"겉옷을 입은 채 공부해요. 발이 시려서 자꾸 집중이 끊겨요." },
    sleep:{ when:"내가 잠들기 전 이 시간, 그 방에서는", severe:"패딩을 입은 채 이불 두 장을 덮고 누워요. 그래도 코끝이 시려 쉽게 잠들지 못해요.", cold:"동생과 한 이불 속에 꼭 붙어서 서로의 체온으로 버텨요.", cool:"양말을 두 겹 신고 잠자리에 들어요. 새벽이면 추워서 한 번씩 깨요." },
    wash:{ when:"내가 씻으려는 지금, 그 방에서는", severe:"보일러를 켤 수 없어서 냄비에 데운 물 한 대야로 머리를 감아요.", cold:"온수가 아까워서 샤워는 이틀에 한 번, 최대한 빨리 끝내요.", cool:"욕실이 추워서 씻고 나오면 한참 동안 몸이 떨려요." },
    meal:{ when:"내가 밥을 먹는 지금, 그 방에서는", severe:"식탁 대신 이불 속에서 밥을 먹어요. 국은 금방 식어 버려요.", cold:"따뜻한 국물 한 그릇이 하루 중 가장 따뜻한 순간이에요.", cool:"밥을 다 먹으면 서둘러 이불 속으로 들어가요." }
  };
  const MOMENTS = [
    { h:7, title:"아침, 일어나기", severe:"이불 밖으로 나오기가 가장 힘든 시간이에요. 옷을 이불 속에 넣어 데워 두고 입어요.", cold:"찬 바닥에 발이 닿자마자 다시 이불로 들어가고 싶어져요.", cool:"아침 공기가 차가워서 겉옷부터 찾아 입어요." },
    { h:17, title:"하교 후, 숙제", key:"study" },
    { h:19, title:"저녁, 식사", key:"meal" },
    { h:22, title:"밤, 잠들기 전", key:"sleep" }
  ];
  const ITEMS = {
    severe:{ lead:"방이 이 정도로 차가우면 건강이 먼저 위험해져요. 방 전체를 데우는 도움이 가장 급해요.", list:[["🔥","난방비 지원","꺼 두었던 보일러를 다시 켤 수 있어요."],["🛏️","전기요","난방을 못 하는 밤에도 잠자리를 지켜 줘요."],["⛺","실내 방한 텐트","외풍을 막아 텐트 안을 몇 도 끌어올려요."]]},
    cold:{ lead:"찬 기운이 스며드는 방이에요. 바람을 막고 몸을 감싸는 것부터 필요해요.", list:[["🪟","문풍지·단열 뽁뽁이","창문과 문틈의 찬바람을 막아요."],["🧣","극세사 이불","얇은 이불보다 훨씬 따뜻하게 밤을 보내요."],["🧦","내복 세트","한 겹만 더 입어도 체온을 지켜 줘요."]]},
    cool:{ lead:"버틸 수는 있지만 오래 있으면 몸이 식는 방이에요.", list:[["🧦","수면양말","발이 따뜻하면 몸 전체가 덜 추워요."],["👕","내복","실내에서도 체온을 지켜 줘요."],["🥿","털 실내화","바닥에서 올라오는 냉기를 막아요."]]}
  };

  /* 기온 */
  async function fetchWx(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=temperature_2m&forecast_days=2&timezone=Asia%2FSeoul`;
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const key = j.current.time.slice(0, 13);
      let i0 = j.hourly.time.findIndex(t => t.slice(0, 13) === key); if (i0 < 0) i0 = 0;
      const hourly = j.hourly.time.slice(i0, i0 + 24).map((t, k) => ({ h:+t.slice(11, 13), t:Math.round(j.hourly.temperature_2m[i0 + k]) }));
      const now = Math.round(j.current.temperature_2m);
      return { now, low:Math.min(now, ...hourly.map(x => x.t)), hourly };
    } finally { clearTimeout(tm); }
  }
  function sampleHourly(low){
    const h0 = new Date().getHours();
    return Array.from({ length:24 }, (_, k) => { const h = (h0 + k) % 24; return { h, t: low + Math.round(7 * Math.max(0, Math.sin((h - 6) / 24 * 2 * Math.PI))) }; });
  }
  async function loadCity(name, lat, lon){
    $("#badge").classList.add("loading"); $("#badgeText").textContent = `${name} 기온을 불러오는 중`;
    $$("#cities .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.name === name)));
    try { const w = await fetchWx(lat, lon); applyWx(name, w.now, w.low, w.hourly, true); }
    catch { applyWx(name, 3, -3, sampleHourly(-3), false); }
  }
  function applyWx(place, now, low, hourly, live){
    Object.assign(state, { place, now, low, hourly });
    $("#badge").classList.remove("loading");
    $("#badgeText").textContent = live ? `${place} 실시간 기온` : "기온을 불러오지 못해 예시 기온으로 보여 드려요";
    $("#hwPlace").textContent = `지금 ${place}`;
    $("#hwNow").innerHTML = C(now); $("#hwLow").innerHTML = C(low);
    const tr = theirRoom(low);
    $("#heroTheirs").innerHTML = C(tr); $("#heroFrost").style.opacity = frostOf(tr);
    $("#heroTheirsSub").textContent = `오늘 밤 최저 ${low}℃일 때 단열이 약한 방의 추정 온도예요. WHO 권장 18℃보다 ${Math.max(0, 18 - tr)}℃ 낮아요.`;
    $("#wxNow").innerHTML = `${place} 지금 ${now}℃, <b>오늘 밤 최저 ${low}℃</b>를 기준으로 비교해요.`;
    $("#colder").value = low;
    if (state.compared) render(low);
    drawDay();
  }
  function nearest(lat, lon){ let b = CITIES[0], d = Infinity; for (const c of CITIES){ const x = (c[1]-lat)**2 + (c[2]-lon)**2; if (x < d){ d = x; b = c; } } return b[0]; }

  CITIES.forEach(([n, la, lo]) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = n; b.dataset.name = n; b.setAttribute("aria-pressed","false"); b.addEventListener("click", () => loadCity(n, la, lo)); $("#cities").appendChild(b); });
  const locBtn = document.createElement("button"); locBtn.className = "chip"; locBtn.textContent = "📍 내 위치"; locBtn.setAttribute("aria-pressed","false"); $("#cities").prepend(locBtn);
  function useLocation(){
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(async p => {
      const { latitude:la, longitude:lo } = p.coords; const name = nearest(la, lo) + " 근처";
      $$("#cities .chip").forEach(c => c.setAttribute("aria-pressed","false")); locBtn.setAttribute("aria-pressed","true");
      try { const w = await fetchWx(la, lo); applyWx(name, w.now, w.low, w.hourly, true); } catch {}
    }, () => {}, { timeout:8000, maximumAge:600000 });
  }
  locBtn.addEventListener("click", useLocation);
  loadCity(...CITIES[0]); useLocation();

  /* 입력 */
  $$("[data-wear]").forEach(b => b.addEventListener("click", () => { $$("[data-wear]").forEach(x => x.setAttribute("aria-pressed","false")); b.setAttribute("aria-pressed","true"); state.wear = +b.dataset.wear; $("#q-wear").classList.remove("missing"); afterPick(); }));
  $$("[data-doing]").forEach(b => b.addEventListener("click", () => { $$("[data-doing]").forEach(x => x.setAttribute("aria-pressed","false")); b.setAttribute("aria-pressed","true"); state.doing = b.dataset.doing; $("#q-doing").classList.remove("missing"); afterPick(); }));
  const missing = () => [state.wear === null && ["#q-wear","지금 차림"], !state.doing && ["#q-doing","지금 하는 일"]].filter(Boolean);
  function afterPick(){
    const m = missing();
    if ($("#err").textContent) $("#err").textContent = m.length ? `${m.map(x => x[1]).join(", ")}을 골라 주세요.` : "";
    if (state.wear !== null){ $("#heroMine").innerHTML = C(state.wear); $("#heroMineSub").textContent = `고른 차림으로 짐작한 지금 내 방 온도예요.`; $("#convRoom").innerHTML = `${state.wear - state.deg}℃`; }
    if (state.compared && !m.length) render(+$("#colder").value);
    drawDay();
  }
  $("#show").addEventListener("click", () => {
    const m = missing();
    if (m.length){ m.forEach(([s]) => $(s).classList.add("missing")); $("#err").textContent = `${m.map(x => x[1]).join(", ")}을 골라 주세요.`; return; }
    $("#err").textContent = ""; state.compared = true;
    const low = state.low ?? 0; $("#colder").value = low; render(low);
    const r = $("#result"); r.classList.add("on"); r.classList.remove("reveal"); void r.offsetWidth; r.classList.add("reveal");
    if (innerWidth < 1000) r.scrollIntoView({ behavior:"smooth", block:"start" });
  });

  /* 결과 */
  const pct = t => Math.max(3, Math.min(100, t / 30 * 100));
  function render(outdoor){
    const mine = state.wear, theirs = theirRoom(outdoor), b = band(theirs), g = mine - theirs;
    $("#rPlace").textContent = outdoor === state.low ? `오늘 밤 ${state.place} 최저 ${outdoor}℃일 때` : `바깥 기온이 ${outdoor}℃일 때`;
    const gapText = g > 0 ? `${g}℃ 차이` : "비슷한 온도", pill = $("#gap");
    if (pill.textContent !== gapText){ pill.textContent = gapText; pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
    $("#tMine").innerHTML = C(mine); $("#tTheirs").innerHTML = C(theirs);
    $("#subMine").textContent = mine >= 18 ? "건강을 지키기에 충분한 온도예요." : "조금 서늘하지만 언제든 난방을 켤 수 있어요.";
    $("#subTheirs").textContent = theirs < 18 ? `WHO 권장 최저 온도보다 ${18 - theirs}℃ 낮아요.` : "그래도 밤이 깊으면 금방 식어요.";
    $("#fMine").style.width = pct(mine) + "%"; $("#fTheirs").style.width = pct(theirs) + "%";
    $("#whoMine").style.left = $("#whoTheirs").style.left = pct(18) + "%";
    $("#frost").style.opacity = frostOf(theirs);
    const s = STORIES[state.doing]; $("#storyWhen").textContent = s.when; $("#storyText").textContent = s[b];
    const it = ITEMS[b]; $("#itemsLead").textContent = it.lead;
    $("#items").innerHTML = it.list.map(([e,n,d]) => `<li><span class="em" aria-hidden="true">${e}</span><div><b>${n}</b><span>${d}</span></div></li>`).join("");
    $("#colderVal").textContent = `${outdoor}℃`;
  }
  $("#colder").addEventListener("input", e => render(+e.target.value));

  /* 하루 그래프 */
  function drawDay(){
    const H = state.hourly; if (!H.length) return;
    const rooms = H.map(x => ({ h:x.h, r:theirRoom(x.t) }));
    const W = 1000, Ht = 300, L = 48, R = 16, T = 20, B = 36;
    const lo = Math.min(0, ...rooms.map(x => x.r)) - 1, hi = 26;
    const X = i => L + i * (W - L - R) / (rooms.length - 1);
    const Y = v => T + (hi - v) * (Ht - T - B) / (hi - lo);
    const P = rooms.map((x, i) => [X(i).toFixed(1), Y(x.r).toFixed(1)]);
    let g = `<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FC1E4" stop-opacity=".45"/><stop offset="1" stop-color="#9FC1E4" stop-opacity="0"/></linearGradient></defs>`;
    for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) g += `<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${L-10}" y="${Y(v)+4}" text-anchor="end">${v}℃</text>`;
    rooms.forEach((x, i) => { if (i % 3 === 0) g += `<text x="${X(i)}" y="${Ht-10}" text-anchor="middle">${x.h}시</text>`; });
    g += `<path d="M${X(0)},${Y(lo)} ${P.map(p => "L" + p.join(",")).join(" ")} L${X(rooms.length-1)},${Y(lo)} Z" fill="url(#ar)" class="area"/>`;
    g += `<line x1="${L}" x2="${W-R}" y1="${Y(18)}" y2="${Y(18)}" stroke="#fff" stroke-dasharray="6 6" opacity=".7"/><text x="${W-R}" y="${Y(18)-8}" text-anchor="end" style="fill:#fff">WHO 권장 18℃</text>`;
    if (state.wear !== null) g += `<line x1="${L}" x2="${W-R}" y1="${Y(state.wear)}" y2="${Y(state.wear)}" stroke="#F6CD55" stroke-width="3"/><text x="${L+8}" y="${Y(state.wear)-8}" style="fill:#F6CD55;font-weight:700">내 방 ${state.wear}℃</text>`;
    g += `<polyline points="${P.map(p => p.join(",")).join(" ")}" class="line" fill="none" stroke="#9FC1E4" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const mi = rooms.reduce((a, x, i) => x.r < rooms[a].r ? i : a, 0);
    g += `<g class="minpt"><circle cx="${X(mi)}" cy="${Y(rooms[mi].r)}" r="7" fill="#fff" stroke="#5F82AA" stroke-width="3"/><text x="${X(mi)}" y="${Y(rooms[mi].r)+28}" text-anchor="middle" style="fill:#fff;font-weight:700">${rooms[mi].h}시 ${rooms[mi].r}℃</text></g>`;
    const chart = $("#chart"), wasDrawn = chart.classList.contains("drawn");
    chart.innerHTML = g;
    const line = chart.querySelector(".line"); line.style.setProperty("--len", Math.ceil(line.getTotalLength()));
    if (wasDrawn){ chart.classList.remove("drawn"); void chart.getBoundingClientRect(); chart.classList.add("drawn"); }
    $("#chartTitle").textContent = `${state.place}, 앞으로 24시간`;
    $("#dayLead").textContent = `가장 추운 ${rooms[mi].h}시, 난방하지 못하는 방은 ${rooms[mi].r}℃까지 내려가요. WHO 권장 온도보다 ${Math.max(0, 18 - rooms[mi].r)}℃ 낮아요.`;
    const at = h => { const f = H.find(x => x.h === h) || H[0]; return theirRoom(f.t); };
    $("#moments").innerHTML = MOMENTS.map(m => { const r = at(m.h), b = band(r); const text = m.key ? STORIES[m.key][b] : m[b]; return `<article class="moment"><div class="time"><b>${String(m.h).padStart(2,"0")}:00</b><span>${r}℃</span></div><h4>${m.title}</h4><p>${text}</p></article>`; }).join("");
  }

  /* 1도 계산기 */
  const won = n => n.toLocaleString("ko-KR");
  function renderCalc(){
    const d = state.deg, month = 5150 * d, winter = month * 3;
    $("#deg").textContent = `${d}℃`; $("#minus").disabled = d <= 1; $("#plus").disabled = d >= 3;
    const mo = $("#money"); mo.textContent = `한 겨울 약 ${won(winter)}원`; mo.classList.remove("tick"); void mo.offsetWidth; mo.classList.add("tick");
    $("#moneySub").textContent = `한 달에 ${won(month)}원씩, 12월부터 2월까지 아낄 수 있어요.`;
    $("#convTimes").textContent = `${(winter / 10000).toFixed(1).replace(".0","")}번`;
    $("#convPct").textContent = `약 ${7 * d}%`;
    $("#convRoom").textContent = `${(state.wear ?? 21) - d}℃`;
  }
  $("#minus").addEventListener("click", () => { state.deg = Math.max(1, state.deg - 1); renderCalc(); });
  $("#plus").addEventListener("click", () => { state.deg = Math.min(3, state.deg + 1); renderCalc(); });
  renderCalc();

  /* 공유 */
  function toast(m){ const t = $("#toast"); t.textContent = m; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 2200); }
  async function share(){
    const out = state.compared ? +$("#colder").value : (state.low ?? 0), tr = theirRoom(out);
    const text = state.compared ? `바깥 ${out}℃, 내 방은 ${state.wear}℃인데 난방하지 못하는 방은 ${tr}℃래요. 같은 날씨, 다른 겨울 🌡️` : `오늘 밤 ${state.place} ${out}℃, 난방하지 못하는 방은 ${tr}℃래요. 같은 날씨, 다른 겨울 🌡️`;
    const url = location.href.split("#")[0];
    try { if (navigator.share){ await navigator.share({ title:"같은 날씨, 다른 겨울", text, url }); return; } await navigator.clipboard.writeText(`${text}\n${url}`); toast("공유 문구와 링크를 복사했어요"); }
    catch(e){ if (e && e.name !== "AbortError") toast("복사하지 못했어요. 주소창의 링크를 공유해 주세요"); }
  }
  $("#share").addEventListener("click", share); $("#share2").addEventListener("click", share);

  const nav = $("#nav"); addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive:true });

  /* ---------- UI 효과 ---------- */
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 스크롤 진행 바
  const bar = document.createElement("div"); bar.className = "progress"; document.body.appendChild(bar);
  const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; };
  addEventListener("scroll", onScroll, { passive:true }); onScroll();

  // 메뉴에 현재 섹션 표시
  const links = $$(".menu a");
  const secObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin:"-45% 0px -50% 0px" });
  ["problem","try","day","act"].forEach(id => secObs.observe(document.getElementById(id)));

  // 차가운 창문에 눈 내리기
  const coldWin = $(".win.cold");
  if (coldWin && !calm){
    const snow = document.createElement("div"); snow.className = "snow";
    for (let i = 0; i < 26; i++){
      const f = document.createElement("i");
      f.style.left = Math.random() * 100 + "%";
      f.style.setProperty("--s", (2 + Math.random() * 4).toFixed(1) + "px");
      f.style.setProperty("--o", (.45 + Math.random() * .5).toFixed(2));
      f.style.setProperty("--d", (6 + Math.random() * 7).toFixed(1) + "s");
      f.style.setProperty("--delay", (-Math.random() * 12).toFixed(1) + "s");
      f.style.setProperty("--x", (Math.random() * 40 - 20).toFixed(0) + "px");
      snow.appendChild(f);
    }
    coldWin.appendChild(snow);
  }

  // 마우스를 따라 창문이 살짝 기울어요
  const wins = $(".windows");
  if (wins && !calm && matchMedia("(hover:hover)").matches){
    const houses = wins.querySelectorAll(".house");
    wins.addEventListener("mousemove", e => {
      const r = wins.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      houses.forEach(h => h.style.transform = `rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg) translateY(-4px)`);
    });
    wins.addEventListener("mouseleave", () => houses.forEach(h => h.style.transform = ""));
  }

  // 통계 숫자가 올라가요
  function countUp(el){
    const node = el.firstChild; if (!node || node.nodeType !== 3) return;
    const raw = node.textContent, end = parseFloat(raw), dec = (raw.split(".")[1] || "").length, t0 = performance.now(), dur = 1200;
    const step = now => { const p = Math.min(1, (now - t0) / dur); node.textContent = (end * (1 - Math.pow(1 - p, 3))).toFixed(dec); if (p < 1) requestAnimationFrame(step); else node.textContent = raw; };
    requestAnimationFrame(step);
  }

  // 스크롤하면 한 번씩 나타나요
  $$(".sec-head, .define, .program, .chart-card, .try .grid").forEach(el => el.classList.add("reveal-up"));
  $$(".stats, .acts, .moments, .degree .grid").forEach(el => el.classList.add("stagger"));
  const revObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); revObs.unobserve(e.target);
    if (e.target.matches(".stats") && !calm) e.target.querySelectorAll(".stat b").forEach(countUp);
  }), { threshold:.12 });
  $$(".reveal-up, .stagger").forEach(el => revObs.observe(el));

  // 그래프가 보이면 선을 그려요
  const chartObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ $("#chart").classList.add("drawn"); chartObs.disconnect(); } }), { threshold:.35 });
  chartObs.observe($("#chart"));
})();
