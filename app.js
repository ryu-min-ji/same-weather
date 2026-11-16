(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const C = t => `${t}<small class="u">℃</small>`;
  const CITIES = [["서울",37.5665,126.978],["인천",37.4563,126.7052],["수원",37.2636,127.0286],["청주",36.6424,127.489],["대전",36.3504,127.3845],["대구",35.8714,128.6014],["광주",35.1595,126.8526],["부산",35.1796,129.0756],["강릉",37.7519,128.8761],["제주",33.4996,126.5312]];
  const state = { place:"서울", now:null, low:null, hourly:[], wear:null, doing:null, deg:1, compared:false, house:"old" };

  // 집 구조별로 난방을 끈 방의 실내 온도를 추정하는 설명용 단순 모델 (실측값 아님)
  //  a: 바깥 기온이 방 안에 미치는 정도, b: 기본 보정, cap: 겨울철 상한
  const HOUSES = {
    rooftop:{ name:"옥탑방", a:.6, b:7, cap:15, note:"지붕 바로 아래라 열이 쉽게 빠져나가고, 바깥 기온을 가장 크게 받아요." },
    semi:{ name:"반지하", a:.35, b:8, cap:14, note:"땅속이라 기온 변화는 덜하지만, 습기와 곰팡이 때문에 실제로는 더 춥게 느껴져요." },
    old:{ name:"낡은 단독주택", a:.5, b:9, cap:16, note:"벽과 창이 얇아 외풍이 심하고, 보일러를 켜도 열이 금방 새요." },
    villa:{ name:"오래된 연립", a:.4, b:11, cap:17, note:"이웃집 덕분에 조금 덜 춥지만, 낡은 창틀로 찬바람이 들어와요." }
  };
  // 바깥이 상한보다 따뜻한 날에는 방이 바깥보다 차갑게 나오지 않도록 바깥 기온을 그대로 써요
  const theirRoom = (t, house = state.house) => { const h = HOUSES[house]; return t >= h.cap ? t : Math.min(h.cap, Math.round(t * h.a + h.b)); };
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
    $("#heroTheirsSub").textContent = `오늘 밤 최저 ${low}℃일 때 ${HOUSES[state.house].name}의 추정 온도예요. WHO 권장 18℃보다 ${Math.max(0, 18 - tr)}℃ 낮아요.`;
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
  function setHouse(key){
    state.house = key;
    $$("[data-house]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.house === key)));
    $("#houseNote").textContent = HOUSES[key].note;
    if (state.low !== null){
      const tr = theirRoom(state.low);
      $("#heroTheirs").innerHTML = C(tr); $("#heroFrost").style.opacity = frostOf(tr);
      $("#heroTheirsSub").textContent = `오늘 밤 최저 ${state.low}℃일 때 ${HOUSES[key].name}의 추정 온도예요. WHO 권장 18℃보다 ${Math.max(0, 18 - tr)}℃ 낮아요.`;
    }
    if (state.compared) render(+$("#colder").value);
    drawDay(); drawNation();
  }
  $$("[data-house]").forEach(b => b.addEventListener("click", () => setHouse(b.dataset.house)));
  $("#houseNote").textContent = HOUSES[state.house].note;
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
    $("#houseTag").textContent = `${HOUSES[state.house].name} 기준`;
    const s = STORIES[state.doing]; $("#storyWhen").textContent = s.when; $("#storyText").textContent = s[b];
    const it = ITEMS[b]; $("#itemsLead").textContent = it.lead;
    $("#items").innerHTML = it.list.map(([e,n,d]) => `<li><span class="em" aria-hidden="true">${e}</span><div><b>${n}</b><span>${d}</span></div></li>`).join("");
    $("#colderVal").textContent = `${outdoor}℃`;
  }
  $("#colder").addEventListener("input", e => render(+e.target.value));

  /* 하루 그래프 */
  let chartGeo = null;
  (function bindTip(){
    const wrap = $(".chart-wrap"), tip = $("#tip"), svg = $("#chart");
    function show(clientX){
      if (!chartGeo) return;
      const { H, rooms, X, Y, L, R, W } = chartGeo, rect = svg.getBoundingClientRect();
      const vx = (clientX - rect.left) / rect.width * W;
      const i = Math.max(0, Math.min(rooms.length - 1, Math.round((vx - L) / ((W - L - R) / (rooms.length - 1)))));
      const x = X(i), y = Y(rooms[i].r);
      svg.querySelector(".hover-line").setAttribute("x1", x); svg.querySelector(".hover-line").setAttribute("x2", x);
      const dot = svg.querySelector(".hover-dot"); dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      svg.classList.add("hovering");
      const mine = state.wear !== null ? `<br>내 방 ${state.wear}℃` : "";
      tip.innerHTML = `<b>${rooms[i].h}시</b>바깥 ${H[i].t}℃<br><span class="r">그 방 ${rooms[i].r}℃</span>${mine}`;
      const px = x / W * rect.width, py = y / 300 * rect.height;
      tip.style.left = Math.max(60, Math.min(rect.width - 60, px)) + "px";
      tip.style.top = Math.max(0, py - 92) + "px";
      tip.classList.add("on");
    }
    function hide(){ tip.classList.remove("on"); svg.classList.remove("hovering"); }
    wrap.addEventListener("pointermove", e => show(e.clientX));
    wrap.addEventListener("pointerdown", e => show(e.clientX));
    wrap.addEventListener("pointerleave", hide);
  })();
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
    g += `<line class="hover-line" x1="0" x2="0" y1="${T}" y2="${Ht-B}"/><circle class="hover-dot" r="6" cx="0" cy="0"/>`;
    const chart = $("#chart"), wasDrawn = chart.classList.contains("drawn");
    chart.innerHTML = g;
    chartGeo = { H, rooms, X, Y, L, R, W };
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

  /* 낮과 밤 창문 */
  (function dayNight(){ const h = new Date().getHours(); $(".windows").classList.toggle("is-day", h >= 7 && h < 17); })();

  /* 전국 지도 */
  let nation = null;
  const LAND = [[126.6,37.75],[127.1,38.0],[127.6,38.3],[128.2,38.4],[128.37,38.62],[128.6,38.1],[128.9,37.8],[129.1,37.5],[129.35,37.0],[129.45,36.4],[129.4,36.0],[129.57,35.98],[129.4,35.5],[129.25,35.2],[128.9,35.05],[128.4,34.85],[127.8,34.75],[127.4,34.5],[126.9,34.4],[126.5,34.3],[126.3,34.7],[126.4,35.1],[126.5,35.6],[126.7,36.0],[126.5,36.4],[126.2,36.8],[126.5,37.0],[126.8,37.2],[126.6,37.5]];
  const px = lon => 47 + (lon - 125.6) * 71, py = lat => 10 + (38.7 - lat) * 87.7;
  function mix(a, b, t){ return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
  function roomColor(r){
    const warm = [246,205,85], mid = [201,216,231], cold = [63,95,132];
    const c = r >= 10 ? mix(mid, warm, Math.min(1, (r - 10) / 6)) : mix(cold, mid, Math.max(0, (r - 2) / 8));
    return `rgb(${c.join(",")})`;
  }
  async function loadNation(){
    const lat = CITIES.map(c => c[1]).join(","), lon = CITIES.map(c => c[2]).join(",");
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=temperature_2m&forecast_days=2&timezone=Asia%2FSeoul`);
      if (!r.ok) throw new Error(r.status);
      const arr = await r.json();
      nation = (Array.isArray(arr) ? arr : [arr]).map((j, k) => {
        const key = j.current.time.slice(0, 13); let i0 = j.hourly.time.findIndex(t => t.slice(0, 13) === key); if (i0 < 0) i0 = 0;
        const next = j.hourly.temperature_2m.slice(i0, i0 + 24);
        return { name:CITIES[k][0], lat:CITIES[k][1], lon:CITIES[k][2], low:Math.round(Math.min(...next)) };
      });
    } catch { $("#rank").innerHTML = `<li class="loading">기온을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</li>`; return; }
    drawNation();
  }
  function drawNation(){
    if (!nation) return;
    const data = nation.map(c => ({ ...c, room:theirRoom(c.low) }));
    const land = LAND.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(" ");
    let g = `<polygon class="land" points="${land}"/><ellipse class="land" cx="${px(126.55)}" cy="${py(33.38)}" rx="34" ry="16"/>`;
    // 가까운 도시끼리 겹치지 않도록 위치를 살짝 옮기고, 이름 위치도 정해요
    const OFF = { "서울":[0,-14], "인천":[-26,6], "수원":[18,14], "청주":[8,-10], "대전":[-8,10] };
    const LBL = { "서울":"top", "수원":"left", "청주":"right" };
    data.forEach(c => {
      const [ox, oy] = OFF[c.name] || [0, 0];
      const x = px(c.lon) + ox, y = py(c.lat) + oy, sel = state.place.startsWith(c.name) ? " sel" : "";
      const side = LBL[c.name] || "bottom";
      const lx = side === "left" ? x - 22 : side === "right" ? x + 22 : x;
      const ly = side === "top" ? y - 24 : side === "bottom" ? y + 34 : y + 5;
      const anchor = side === "left" ? "end" : side === "right" ? "start" : "middle";
      g += `<g class="city${sel}" data-city="${c.name}" tabindex="0" role="button" aria-label="${c.name} 오늘 밤 최저 ${c.low}도, 그 방 ${c.room}도"><circle cx="${x}" cy="${y}" r="17" fill="${roomColor(c.room)}" stroke="#fff" stroke-width="2"/><text class="t" x="${x}" y="${y + 5}" text-anchor="middle" style="fill:${c.room < 8 ? "#fff" : "#4E3F37"}">${c.room}</text><text x="${lx}" y="${ly}" text-anchor="${anchor}">${c.name}</text></g>`;
    });
    $("#map").innerHTML = g;
    const sorted = [...data].sort((a, b) => a.room - b.room || a.low - b.low);
    $("#rank").innerHTML = sorted.map(c => `<li data-city="${c.name}" class="${state.place.startsWith(c.name) ? "sel" : ""}" tabindex="0"><b>${c.name}</b><span class="out">바깥 ${c.low}℃</span><span class="room-t">${c.room}℃</span><span class="bar"><i style="width:${Math.max(6, Math.min(100, c.room / 18 * 100))}%"></i></span></li>`).join("");
    $("#nationNote").textContent = `오늘 밤부터 내일 아침까지의 최저기온 기준이에요. ${HOUSES[state.house].name} 기준으로 추정했어요.`;
  }
  function pickCity(name){
    const c = CITIES.find(x => x[0] === name); if (!c) return;
    loadCity(...c).then(drawNation);
    toast(`${name} 기준으로 바꿨어요`);
  }
  ["#map", "#rank"].forEach(sel => {
    $(sel).addEventListener("click", e => { const t = e.target.closest("[data-city]"); if (t) pickCity(t.dataset.city); });
    $(sel).addEventListener("keydown", e => { const t = e.target.closest("[data-city]"); if (t && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); pickCity(t.dataset.city); } });
  });
  loadNation();

  /* 이미지 카드 (결과 카드, 약속 카드) */
  async function fontsReady(){
    try { await Promise.all([document.fonts.load('80px "Black Han Sans"'), document.fonts.load('700 40px "Pretendard"'), document.fonts.load('400 40px "Pretendard"')]); } catch {}
  }
  function wrapText(ctx, text, maxW){
    const lines = []; let line = "";
    for (const word of text.split(" ")){
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxW){ line = test; continue; }
      if (line) lines.push(line);
      line = word;
      while (ctx.measureText(line).width > maxW){ let k = line.length; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--; lines.push(line.slice(0, k)); line = line.slice(k); }
    }
    if (line) lines.push(line);
    return lines;
  }
  function rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const DISPLAY = '"Black Han Sans", "Pretendard", sans-serif', BODY = '"Pretendard", "Malgun Gothic", sans-serif';
  const SITE = "ryu-min-ji.github.io/same-weather";
  async function deliver(canvas, filename, title){
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const file = new File([blob], filename, { type:"image/png" });
    try { if (navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title }); return; } } catch (e){ if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("이미지를 저장했어요");
  }
  async function makeResultCard(){
    if (!state.compared){ toast("먼저 두 방을 비교해 주세요"); return; }
    await fontsReady();
    const out = +$("#colder").value, mine = state.wear, theirs = theirRoom(out), b = band(theirs);
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#5E7322"; rr(c, 90, 110, 64, 64, 18); c.fill();
    c.fillStyle = "#76675D"; c.font = `700 34px ${BODY}`; c.fillText("Web:메이커스 1기 프로젝트", 176, 154);
    c.fillStyle = "#4E3F37"; c.font = `120px ${DISPLAY}`; c.fillText("같은 날씨,", 90, 340);
    c.fillStyle = "#3F5F84"; c.fillText("다른 겨울", 90, 480);
    c.fillStyle = "#76675D"; c.font = `500 40px ${BODY}`;
    c.fillText(out === state.low ? `오늘 밤 ${state.place} 최저 ${out}℃` : `바깥 기온 ${out}℃일 때`, 90, 570);
    const card = (x, warm, label, temp, sub) => {
      const y = 650, w = 420, h = 620;
      const gr = c.createLinearGradient(0, y, 0, y + h);
      if (warm){ gr.addColorStop(0, "#FFF3CF"); gr.addColorStop(1, "#F6C871"); } else { gr.addColorStop(0, "#E4ECF4"); gr.addColorStop(1, "#9FB6CC"); }
      c.save(); c.shadowColor = "rgba(30,30,30,.18)"; c.shadowBlur = 40; c.shadowOffsetY = 16; c.fillStyle = gr; rr(c, x, y, w, h, 44); c.fill(); c.restore();
      if (!warm){ c.fillStyle = "rgba(255,255,255,.85)"; for (let i = 0; i < 46; i++){ const sx = x + 20 + ((i * 97) % (w - 40)), sy = y + 30 + ((i * 151) % (h - 60)), r = 3 + (i % 4); c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill(); } }
      c.fillStyle = warm ? "#5A3A12" : "#2C3E52"; c.font = `700 38px ${BODY}`; c.fillText(label, x + 40, y + 76);
      c.font = `200px ${DISPLAY}`; c.fillText(String(temp), x + 36, y + 360);
      const tw = c.measureText(String(temp)).width; c.font = `800 64px ${BODY}`; c.fillText("℃", x + 44 + tw, y + 250);
      c.font = `600 32px ${BODY}`; wrapText(c, sub, w - 80).forEach((l, i) => c.fillText(l, x + 40, y + 460 + i * 46));
    };
    card(90, true, "내 방", mine, mine >= 18 ? "건강을 지키기에 충분한 온도" : "언제든 난방을 켤 수 있어요");
    card(570, false, `${HOUSES[state.house].name}`, theirs, theirs < 18 ? `WHO 권장보다 ${18 - theirs}℃ 낮아요` : "밤이 깊으면 금방 식어요");
    const gap = mine - theirs;
    c.fillStyle = "#4E3F37"; rr(c, W / 2 - 150, 1222, 300, 96, 48); c.fill();
    c.fillStyle = "#fff"; c.font = `48px ${DISPLAY}`; c.textAlign = "center"; c.fillText(gap > 0 ? `${gap}℃ 차이` : "비슷한 온도", W / 2, 1287); c.textAlign = "left";
    c.fillStyle = "#F4F5F2"; rr(c, 90, 1340, W - 180, 330, 36); c.fill();
    c.fillStyle = "#3F5F84"; c.font = `800 32px ${BODY}`; c.fillText(STORIES[state.doing].when, 140, 1410);
    c.fillStyle = "#4E3F37"; c.font = `600 42px ${BODY}`; wrapText(c, STORIES[state.doing][b], W - 280).slice(0, 4).forEach((l, i) => c.fillText(l, 140, 1484 + i * 60));
    c.fillStyle = "#76675D"; c.font = `600 34px ${BODY}`; c.fillText("내 방과 비교해 보기", 90, 1786);
    c.fillStyle = "#5E7322"; c.font = `800 38px ${BODY}`; c.fillText(SITE, 90, 1840);
    await deliver(cv, "같은날씨다른겨울_결과카드.png", "같은 날씨, 다른 겨울");
  }
  async function makePledgeCard(name){
    await fontsReady();
    const d = state.deg, winter = 5150 * d * 3;
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#5E7322"); gr.addColorStop(1, "#465719"); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.12)"; for (let i = 0; i < 60; i++){ const x = (i * 173) % W, y = (i * 241) % H, r = 2 + (i % 5); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 3; rr(c, 60, 60, W - 120, H - 120, 40); c.stroke();
    c.fillStyle = "#F6CD55"; c.font = `800 36px ${BODY}`; c.fillText("같은 날씨, 다른 겨울", 120, 170);
    c.fillStyle = "#fff"; c.font = `150px ${DISPLAY}`; c.fillText(`${d}℃`, 120, 380);
    c.font = `96px ${DISPLAY}`; c.fillText("나눔 약속", 120, 500);
    c.font = `700 52px ${BODY}`; c.fillText(`${name} 님은`, 120, 660);
    c.font = `500 44px ${BODY}`;
    [`보일러를 ${d}℃ 낮춰`, `한 겨울 약 ${winter.toLocaleString("ko-KR")}원을 아끼고,`, "그만큼 다른 겨울을 데우기로", "약속했어요."].forEach((l, i) => c.fillText(l, 120, 750 + i * 70));
    const now = new Date();
    c.fillStyle = "rgba(255,255,255,.75)"; c.font = `600 34px ${BODY}`;
    c.fillText(`${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`, 120, 1110);
    c.fillStyle = "#F6CD55"; c.font = `800 34px ${BODY}`; c.fillText(SITE, 120, 1190);
    await deliver(cv, "1도나눔약속.png", "1℃ 나눔 약속");
  }
  $("#saveCard").addEventListener("click", makeResultCard);
  $("#pledgeForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#pledgeName").value.trim().slice(0, 12) || "나";
    makePledgeCard(name);
  });

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
  ["problem","try","day","nation","act"].forEach(id => secObs.observe(document.getElementById(id)));

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
  $$(".sec-head, .define, .program, .chart-card, .try .grid, .nation-grid, .pledge, .qa").forEach(el => el.classList.add("reveal-up"));
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
