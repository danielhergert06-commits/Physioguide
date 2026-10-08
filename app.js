
const state = {
  muscles: [],
  regionImages: {},
  currentView: 'dashboard',
  currentMuscle: null,
  favorites: JSON.parse(localStorage.getItem('physio_favorites') || '[]'),
  seen: JSON.parse(localStorage.getItem('physio_seen') || '[]'),
  quiz: JSON.parse(localStorage.getItem('physio_quiz') || '{"correct":0,"wrong":0}'),
  flash: JSON.parse(localStorage.getItem('physio_flash') || '{"known":0,"unknown":0}'),
  theme: localStorage.getItem('physio_theme') || 'light',
  mode: localStorage.getItem('physio_mode') || 'extended',
  flashDeck: [],
  flashIndex: 0,
  currentQuiz: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

async function boot(){
  document.documentElement.dataset.theme = state.theme;
  try {
    const res = await fetch('./data/muscles.json');
    state.muscles = await res.json();
    const imgRes = await fetch('./data/region-images.json');
    state.regionImages = await imgRes.json();
  } catch(e) {
    $('#loadWarning').style.display='block';
  }
  bindNav();
  renderAll();
  registerSW();
}

function save(){
  localStorage.setItem('physio_favorites', JSON.stringify(state.favorites));
  localStorage.setItem('physio_seen', JSON.stringify(state.seen));
  localStorage.setItem('physio_quiz', JSON.stringify(state.quiz));
  localStorage.setItem('physio_flash', JSON.stringify(state.flash));
  localStorage.setItem('physio_theme', state.theme);
  localStorage.setItem('physio_mode', state.mode);
}

function bindNav(){
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $('#themeBtn').addEventListener('click',()=>{
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme; save();
  });
  $('#globalSearch').addEventListener('input',e=>renderSearch(e.target.value));
  $('#modeExam').addEventListener('click',()=>setMode('exam'));
  $('#modeExtended').addEventListener('click',()=>setMode('extended'));
  $('#sourceClose').addEventListener('click',closeSource);
  $('#sourceBackdrop').addEventListener('click',closeSource);
}

function setMode(mode){state.mode=mode;save();renderModes();}

function renderModes(){
  $('#modeExam').classList.toggle('active',state.mode==='exam');
  $('#modeExtended').classList.toggle('active',state.mode==='extended');
  $('#modeStatus').textContent = state.mode==='exam' ? 'Prüfungswissen' : 'Erweitertes Wissen';
  $('#extendedNote').style.display = state.mode==='extended' ? 'block' : 'none';
}

function showView(view){
  state.currentView=view;
  $$('.view').forEach(v=>v.classList.remove('active'));
  const el=$(`#view-${view}`); if(el) el.classList.add('active');
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#globalSearch').value='';
  $('#searchResults').innerHTML='';
  if(view==='anatomy') renderMuscles();
  if(view==='favorites') renderFavorites();
  if(view==='progress') renderProgress();
  if(view==='flashcards') startFlashcards();
  if(view==='quiz') nextQuiz();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderAll(){
  renderModes(); renderDashboard(); renderMuscles(); renderFavorites(); renderProgress();
}

function renderDashboard(){
  const total=state.muscles.length, seen=state.seen.length, fav=state.favorites.length;
  const quizTotal=state.quiz.correct+state.quiz.wrong;
  $('#statMuscles').textContent=total;
  $('#statSeen').textContent=seen;
  $('#statFav').textContent=fav;
  $('#statQuiz').textContent=quizTotal ? Math.round(state.quiz.correct/quizTotal*100)+'%' : '–';
  $('#progressBar').style.width = total ? Math.min(100,seen/total*100)+'%' : '0%';
  $('#progressText').textContent = `${seen} von ${total} Muskeln angesehen`;
  const recent = [...state.seen].slice(-4).reverse().map(id=>state.muscles.find(m=>m.id===id)).filter(Boolean);
  $('#recentList').innerHTML = recent.length ? recent.map(m=>`<div class="result" onclick="openMuscle('${m.id}')"><b>${m.latinName}</b><div class="muted">${m.germanName}</div></div>`).join('') : '<div class="empty">Noch nichts angesehen.</div>';
}

function regions(){
  return [...new Set(state.muscles.map(m=>m.region))].sort();
}
function renderMuscles(){
  const regionSel=$('#regionFilter');
  const current=regionSel.value;
  regionSel.innerHTML='<option value="">Alle Regionen</option>'+regions().map(r=>`<option>${r}</option>`).join('');
  if(current) regionSel.value=current;
  regionSel.onchange=renderMuscles;
  $('#muscleSearch').oninput=renderMuscles;
  const q=($('#muscleSearch').value||'').toLowerCase(), region=regionSel.value;
  const list=state.muscles.filter(m=>(!region||m.region===region)&&(!q||Object.values(m).join(' ').toLowerCase().includes(q)));
  $('#muscleCount').textContent=`${list.length} Einträge`;
  $('#muscleGrid').innerHTML=list.map(m=>`
    <article class="muscle-card" onclick="openMuscle('${m.id}')">
      <span class="tag">${m.region}</span>
      <div class="latin">${m.latinName}</div>
      <div class="german">${m.germanName}</div>
      <div class="mini">${m.function}</div>
    </article>`).join('');
}

window.openMuscle=function(id){
  const m=state.muscles.find(x=>x.id===id); if(!m) return;
  state.currentMuscle=m;
  if(!state.seen.includes(id)) state.seen.push(id);
  save(); renderDashboard(); renderProgress();
  $('#detailName').textContent=m.latinName;
  $('#detailGerman').textContent=m.germanName;
  $('#detailRegion').textContent=`${m.region} · ${m.group}`;
  $('#detailInfo').innerHTML=[
    ['Ursprung',m.origin],['Ansatz',m.insertion],['Innervation',m.innervation],['Funktion',m.function]
  ].map(([k,v])=>`<div class="info-row"><strong>${k}</strong><div>${v}</div><button class="source" onclick="openSource('${m.id}','${k}')">Skript · Quelle</button></div>`).join('');
  const on=state.favorites.includes(id); $('#favBtn').classList.toggle('on',on); $('#favBtn').textContent=on?'★ Gespeichert':'☆ Speichern';
  $('#favBtn').onclick=()=>toggleFavorite(id);
  setBodyFocus(m.region);
  renderRegionPhotos(m.region);
  showView('muscle');
}

window.toggleFavorite=function(id){
  state.favorites = state.favorites.includes(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id];
  save(); renderFavorites(); renderDashboard();
  if(state.currentMuscle?.id===id) openMuscle(id);
}

function renderFavorites(){
  const list=state.favorites.map(id=>state.muscles.find(m=>m.id===id)).filter(Boolean);
  $('#favoritesGrid').innerHTML=list.length?list.map(m=>`<article class="muscle-card" onclick="openMuscle('${m.id}')"><span class="tag">${m.region}</span><div class="latin">${m.latinName}</div><div class="german">${m.germanName}</div></article>`).join(''):'<div class="empty">Noch keine Favoriten gespeichert.</div>';
}

function renderProgress(){
  const total=state.muscles.length||1, viewed=state.seen.length;
  const qt=state.quiz.correct+state.quiz.wrong;
  $('#pViewed').textContent=`${viewed}/${state.muscles.length}`;
  $('#pViewedBar').style.width=Math.min(100,viewed/total*100)+'%';
  $('#pQuiz').textContent=qt?`${Math.round(state.quiz.correct/qt*100)}%`:'–';
  $('#pCards').textContent=`${state.flash.known} sicher`;
  $('#pFav').textContent=state.favorites.length;
}

function makeDeck(){
  const fields=[['Ursprung','origin'],['Ansatz','insertion'],['Innervation','innervation'],['Funktion','function']];
  return state.muscles.filter(m=>state.mode!=='exam'||m.sourceType==='exam_pdf').flatMap(m=>fields.map(([label,key])=>({q:`${label} von ${m.latinName}?`,a:m[key],muscle:m,field:label}))).filter(x=>x.a);
}
function startFlashcards(){
  state.flashDeck=shuffle(makeDeck()).slice(0,40); state.flashIndex=0; renderFlash();
}
function renderFlash(){
  const c=state.flashDeck[state.flashIndex];
  if(!c){$('#flashQuestion').textContent='Keine Karten verfügbar.';return;}
  $('#flashcard').classList.remove('flipped');
  $('#flashQuestion').textContent=c.q;
  $('#flashAnswer').textContent=c.a;
  $('#flashMeta').textContent=`${state.flashIndex+1} / ${state.flashDeck.length}`;
  $('#flashSource').onclick=()=>openSource(c.muscle.id,c.field);
}
window.flipCard=()=>$('#flashcard').classList.toggle('flipped');
window.rateCard=function(known){
  if(known) state.flash.known++; else state.flash.unknown++;
  save(); state.flashIndex=(state.flashIndex+1)%state.flashDeck.length; renderFlash(); renderProgress();
}

function nextQuiz(){
  if(!state.muscles.length)return;
  const fields=[['Innervation','innervation'],['Ansatz','insertion'],['Ursprung','origin']];
  const eligible=state.muscles.filter(m=>state.mode!=='exam'||m.sourceType==='exam_pdf'); if(!eligible.length)return; const m=pick(eligible), [label,key]=pick(fields), correct=m[key];
  const pool=shuffle(eligible.filter(x=>x.id!==m.id).map(x=>x[key]).filter(Boolean).filter(x=>x!==correct));
  const opts=shuffle([correct,...pool.slice(0,3)]);
  state.currentQuiz={m,label,key,correct,answered:false};
  $('#quizQ').textContent=`${label} von ${m.latinName}?`;
  $('#quizOptions').innerHTML=opts.map(o=>`<button class="option" onclick='answerQuiz(${JSON.stringify(o)})'>${escapeHtml(o)}</button>`).join('');
  $('#quizFeedback').innerHTML='';
}
window.answerQuiz=function(answer){
  const q=state.currentQuiz;if(!q||q.answered)return;q.answered=true;
  const ok=answer===q.correct; if(ok)state.quiz.correct++;else state.quiz.wrong++; save();
  $$('#quizOptions .option').forEach(b=>{if(b.textContent===q.correct)b.classList.add('good');else if(b.textContent===answer)b.classList.add('bad')});
  $('#quizFeedback').innerHTML=`<div class="card" style="margin-top:14px"><b>${ok?'Richtig ✓':'Nicht ganz'}</b><p style="margin-top:8px">${q.correct}</p><button class="btn secondary" onclick="openMuscle('${q.m.id}')">Zum Muskel</button> <button class="btn primary" onclick="nextQuiz()">Nächste Frage</button></div>`;
  renderDashboard();renderProgress();
}

function renderSearch(q){
  const box=$('#searchResults');
  if(!q.trim()){box.innerHTML='';return;}
  const hits=state.muscles.filter(m=>Object.values(m).join(' ').toLowerCase().includes(q.toLowerCase())).slice(0,8);
  box.innerHTML=`<div class="card" style="position:absolute;top:64px;left:26px;right:26px;max-width:680px;z-index:30;padding:10px">${hits.length?hits.map(m=>`<div class="result" onclick="openMuscle('${m.id}')"><b>${m.latinName}</b><div class="muted">${m.germanName} · ${m.region}</div></div>`).join(''):'<div class="empty">Keine Treffer</div>'}</div>`;
}
window.openSource=function(id,field){
  const m=state.muscles.find(x=>x.id===id);if(!m)return;
  $('#sourceTitle').textContent=`Quelle · ${field}`;
  const exam=m.sourceType==='exam_pdf'; $('#sourceBody').innerHTML=`<span class="badge-script">${exam?'Prüfungswissen':'Erweitertes Wissen – nicht fachgeprüft'}</span><h3 style="margin-top:16px">${m.latinName}</h3><p><b>${field}</b>: ${exam?'Aus dem bereitgestellten Lernskript übernommen.':'Ergänzter Anatomieeintrag. Vor medizinischer Veröffentlichung mit Fachatlas prüfen.'}</p><div class="card"><b>${m.source}</b></div>`;
  $('#sourceDrawer').classList.add('open');
}
function closeSource(){$('#sourceDrawer').classList.remove('open')}

function setBodyFocus(region){
  const map={Schulter:'shoulder',Oberarm:'arm',Unterarm:'forearm','Hand/Unterarm':'forearm',Hand:'hand',Hüfte:'hip',Oberschenkel:'thigh',Knie:'knee',Unterschenkel:'leg'};
  $$('.focus-zone').forEach(x=>x.classList.remove('focus'));
  const id=map[region]||'torso'; const z=$(`#${id}`); if(z)z.classList.add('focus');
  $('#viewerLabel').textContent=region;
}

function pick(a){return a[Math.floor(Math.random()*a.length)]}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function registerSW(){if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}
boot();

function renderRegionPhotos(region){
 const items=state.regionImages[region]||[];
 const box=document.querySelector('#regionPhotos');
 if(!box)return;
 box.innerHTML=items.map((src,i)=>`<div><img loading="lazy" src="${src}" alt="Illustrative regionale Anatomie, Ansicht ${i+1}"><div class="region-photo-label">Region ${region} · Illustration ${i+1}</div></div>`).join('');
}
