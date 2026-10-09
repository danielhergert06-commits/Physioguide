
const state = {
  muscles: [],
  regionImages: {},
  conditions: [],
  exercises: [],
  venousQuiz: [],
  venousIndex: 0,
  venousScore: 0,
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
    const res = await fetch('./data/muscles.json?v=3');
    state.muscles = await res.json();
    const imgRes = await fetch('./data/region-images.json?v=3');
    state.regionImages = await imgRes.json();
    const clinical = await Promise.all([
      fetch('./data/conditions.json?v=7'),
      fetch('./data/exercises.json?v=7')
    ]);
    if(clinical.every(r=>r.ok)) {
      state.conditions = await clinical[0].json();
      state.exercises = await clinical[1].json();
    }
    const vq = await fetch('./data/venous-quiz.json?v=7');
    if(vq.ok) state.venousQuiz = await vq.json();
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
  $$('[data-view]').forEach(btn =>
    btn.addEventListener('click',()=>showView(btn.dataset.view))
  );
  $('#themeBtn').addEventListener('click',()=>{
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme;
    save();
  });
  $('#globalSearch').addEventListener('input',e=>renderSearch(e.target.value));
  $('#modeExam').addEventListener('click',()=>setMode('exam'));
  $('#modeExtended').addEventListener('click',()=>setMode('extended'));
  $('#sourceClose').addEventListener('click',closeSource);
  $('#sourceBackdrop').addEventListener('click',closeSource);
  $('#conditionsSearch').addEventListener('input',renderConditions);
  $('#conditionsField').addEventListener('change',renderConditions);
  $('#exerciseSearch').addEventListener('input',renderExercises);
  $('#exerciseCategory').addEventListener('change',renderExercises);
}

function setMode(mode){
  state.mode=mode;
  save();
  renderModes();
}

function renderModes(){
  $('#modeExam').classList.toggle('active',state.mode==='exam');
  $('#modeExtended').classList.toggle('active',state.mode==='extended');
  $('#modeStatus').textContent =
    state.mode==='exam' ? 'Prüfungswissen' : 'Erweitertes Wissen';
  $('#extendedNote').style.display =
    state.mode==='extended' ? 'block' : 'none';
}

function showView(view){
  state.currentView = view;

  $$('.view').forEach(v => v.classList.remove('active'));

  const el = $(`#view-${view}`);
  if(el) el.classList.add('active');

  $$('[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );

  $('#globalSearch').value = '';
  $('#searchResults').innerHTML = '';

  if(view === 'anatomy') renderMuscles();
  if(view === 'favorites') renderFavorites();
  if(view === 'progress') renderProgress();
  if(view === 'flashcards') startFlashcards();
  if(view === 'quiz') nextQuiz();
  if(view === 'conditions') renderConditions();
  if(view === 'exercises') renderExercises();
  if(view === 'venousquiz') renderVenousQuiz();

  window.scrollTo({top: 0, behavior: 'smooth'});
}

function renderAll(){
  renderModes();
  renderDashboard();
  renderMuscles();
  renderFavorites();
  renderProgress();
  clinicSetup();
  renderConditions();
  renderExercises();
  renderVenousQuiz();
}

function renderDashboard(){
  const total = state.muscles.length;
  const seen = state.seen.length;
  const fav = state.favorites.length;
  const quizTotal = state.quiz.correct + state.quiz.wrong;

  $('#statMuscles').textContent = total;
  $('#statSeen').textContent = seen;
  $('#statFav').textContent = fav;

  $('#statQuiz').textContent = quizTotal
    ? Math.round(state.quiz.correct / quizTotal * 100) + '%'
    : '–';

  $('#progressBar').style.width = total
    ? Math.min(100, seen / total * 100) + '%'
    : '0%';

  $('#progressText').textContent =
    `${seen} von ${total} Muskel-Einträgen angesehen · ` +
    `${state.muscles.filter(m => m.sourceType !== 'draft_index').length} mit Fachangaben`;

  const recent = [...state.seen]
    .slice(-4)
    .reverse()
    .map(id => state.muscles.find(m => m.id === id))
    .filter(Boolean);

  $('#recentList').innerHTML = recent.length
    ? recent.map(m => `
      <div class="result" onclick="openMuscle('${m.id}')">
        <b>${m.latinName}</b>
        <div class="muted">${m.germanName}</div>
      </div>
    `).join('')
    : '<div class="empty">Noch nichts angesehen.</div>';
}

function regions(){
  return [...new Set(state.muscles.map(m => m.region))].sort();
}

function renderMuscles(){
  const regionSel = $('#regionFilter');
  const current = regionSel.value;

  regionSel.innerHTML =
    '<option value="">Alle Regionen</option>' +
    regions().map(r => `<option>${r}</option>`).join('');

  if(current) regionSel.value = current;

  regionSel.onchange = renderMuscles;
  $('#muscleSearch').oninput = renderMuscles;

  const q = ($('#muscleSearch').value || '').toLowerCase();
  const region = regionSel.value;

  const list = state.muscles.filter(m =>
    (!region || m.region === region) &&
    (!q || Object.values(m).join(' ').toLowerCase().includes(q))
  );

  $('#muscleCount').textContent = `${list.length} Einträge`;

  $('#muscleGrid').innerHTML = list.map(m => `
    <article class="muscle-card" onclick="openMuscle('${m.id}')">
      <span class="tag">${m.region}</span>
      <div class="latin">${m.latinName}</div>
      <div class="german">${m.germanName}</div>
      <div class="mini">
        ${m.sourceType === 'draft_index'
          ? 'Noch nicht fachlich ausgearbeitet – keine Lernfragen'
          : m.function}
      </div>
    </article>
  `).join('');
}

window.openMuscle = function(id){
  const m = state.muscles.find(x => x.id === id);
  if(!m) return;

  state.currentMuscle = m;

  if(!state.seen.includes(id)){
    state.seen.push(id);
  }

  save();
  renderDashboard();
  renderProgress();

  $('#detailName').textContent = m.latinName;
  $('#detailGerman').textContent = m.germanName;
  $('#detailRegion').textContent = `${m.region} · ${m.group}`;

  $('#detailInfo').innerHTML = [
    ['Ursprung', m.origin || 'Noch nicht erfasst'],
    ['Ansatz', m.insertion || 'Noch nicht erfasst'],
    ['Innervation', m.innervation || 'Noch nicht erfasst'],
    ['Funktion', m.function || 'Noch nicht erfasst']
  ].map(([k, v]) => `
    <div class="info-row">
      <strong>${k}</strong>
      <div>${v}</div>
      <button class="source" onclick="openSource('${m.id}','${k}')">
        ${m.sourceType === 'draft_index' ? 'Prüfstatus' : 'Skript · Quelle'}
      </button>
    </div>
  `).join('');

  const on = state.favorites.includes(id);

  $('#favBtn').classList.toggle('on', on);
  $('#favBtn').textContent =
    on ? '★ Gespeichert' : '☆ Speichern';

  $('#favBtn').onclick = () => toggleFavorite(id);

  setBodyFocus(m.region);
  renderRegionPhotos(m.region);
  showView('muscle');
};

window.toggleFavorite = function(id){
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter(x => x !== id)
    : [...state.favorites, id];

  save();
  renderFavorites();
  renderDashboard();

  if(state.currentMuscle?.id === id){
    openMuscle(id);
  }
};

function renderFavorites(){
  const list = state.favorites
    .map(id => state.muscles.find(m => m.id === id))
    .filter(Boolean);

  $('#favoritesGrid').innerHTML = list.length
    ? list.map(m => `
      <article class="muscle-card" onclick="openMuscle('${m.id}')">
        <span class="tag">${m.region}</span>
        <div class="latin">${m.latinName}</div>
        <div class="german">${m.germanName}</div>
      </article>
    `).join('')
    : '<div class="empty">Noch keine Favoriten gespeichert.</div>';
}

function renderProgress(){
  const total = state.muscles.length || 1;
  const viewed = state.seen.length;
  const qt = state.quiz.correct + state.quiz.wrong;

  $('#pViewed').textContent =
    `${viewed}/${state.muscles.length}`;

  $('#pViewedBar').style.width =
    Math.min(100, viewed / total * 100) + '%';

  $('#pQuiz').textContent = qt
    ? `${Math.round(state.quiz.correct / qt * 100)}%`
    : '–';

  $('#pCards').textContent =
    `${state.flash.known} sicher`;

  $('#pFav').textContent = state.favorites.length;
}

function makeDeck(){
  const fields = [
    ['Ursprung', 'origin'],
    ['Ansatz', 'insertion'],
    ['Innervation', 'innervation'],
    ['Funktion', 'function']
  ];

  return state.muscles
    .filter(m =>
      m.sourceType !== 'draft_index' &&
      (state.mode !== 'exam' || m.sourceType === 'exam_pdf')
    )
    .flatMap(m =>
      fields.map(([label, key]) => ({
        q: `${label} von ${m.latinName}?`,
        a: m[key],
        muscle: m,
        field: label
      }))
    )
    .filter(x => x.a);
}

function startFlashcards(){
  state.flashDeck = shuffle(makeDeck()).slice(0, 40);
  state.flashIndex = 0;
  renderFlash();
}

function renderFlash(){
  const c = state.flashDeck[state.flashIndex];

  if(!c){
    $('#flashQuestion').textContent =
      'Keine Karten verfügbar.';
    return;
  }

  $('#flashcard').classList.remove('flipped');
  $('#flashQuestion').textContent = c.q;
  $('#flashAnswer').textContent = c.a;

  $('#flashMeta').textContent =
    `${state.flashIndex + 1} / ${state.flashDeck.length}`;

  $('#flashSource').onclick = () =>
    openSource(c.muscle.id, c.field);
}

window.flipCard = () =>
  $('#flashcard').classList.toggle('flipped');

window.rateCard = function(known){
  if(!state.flashDeck.length) return;

  if(known){
    state.flash.known++;
  } else {
    state.flash.unknown++;
  }

  save();

  state.flashIndex =
    (state.flashIndex + 1) % state.flashDeck.length;

  renderFlash();
  renderProgress();
};

function nextQuiz(){
  if(!state.muscles.length) return;

  const fields = [
    ['Innervation', 'innervation'],
    ['Ansatz', 'insertion'],
    ['Ursprung', 'origin']
  ];

  const eligible = state.muscles.filter(m =>
    m.sourceType !== 'draft_index' &&
    (state.mode !== 'exam' || m.sourceType === 'exam_pdf')
  );

  if(!eligible.length) return;

  const m = pick(eligible);
  const [label, key] = pick(fields);
  const correct = m[key];

  const pool = shuffle(
    eligible
      .filter(x => x.id !== m.id)
      .map(x => x[key])
      .filter(Boolean)
      .filter(x => x !== correct)
  );

  const opts = shuffle([correct, ...pool.slice(0, 3)]);

  state.currentQuiz = {
    m,
    label,
    key,
    correct,
    answered: false
  };

  $('#quizQ').textContent =
    `${label} von ${m.latinName}?`;

  $('#quizOptions').innerHTML = opts.map(o => `
    <button class="option"
      onclick='answerQuiz(${JSON.stringify(o)})'>
      ${escapeHtml(o)}
    </button>
  `).join('');

  $('#quizFeedback').innerHTML = '';
}

window.answerQuiz = function(answer){
  const q = state.currentQuiz;

  if(!q || q.answered) return;

  q.answered = true;

  const ok = answer === q.correct;

  if(ok){
    state.quiz.correct++;
  } else {
    state.quiz.wrong++;
  }

  save();

  $$('#quizOptions .option').forEach(b => {
    if(b.textContent === q.correct){
      b.classList.add('good');
    } else if(b.textContent === answer){
      b.classList.add('bad');
    }
  });

  $('#quizFeedback').innerHTML = `
    <div class="card" style="margin-top:14px">
      <b>${ok ? 'Richtig ✓' : 'Nicht ganz'}</b>
      <p style="margin-top:8px">${escapeHtml(q.correct)}</p>
      <button class="btn secondary"
        onclick="openMuscle('${q.m.id}')">
        Zum Muskel
      </button>
      <button class="btn primary"
        onclick="nextQuiz()">
        Nächste Frage
      </button>
    </div>
  `;

  renderDashboard();
  renderProgress();
};

function renderSearch(q){
  const box = $('#searchResults');

  if(!q.trim()){
    box.innerHTML = '';
    return;
  }

  const hits = state.muscles.filter(m =>
    Object.values(m).join(' ').toLowerCase()
      .includes(q.toLowerCase())
  ).slice(0,8);

  box.innerHTML = `
    <div class="card" style="position:absolute;top:64px;left:26px;right:26px;max-width:680px;z-index:30;padding:10px">
      ${hits.length
        ? hits.map(m => `
          <div class="result" onclick="openMuscle('${m.id}')">
            <b>${escapeHtml(m.latinName)}</b>
            <div class="muted">
              ${escapeHtml(m.germanName)} · ${escapeHtml(m.region)}
            </div>
          </div>
        `).join('')
        : '<div class="empty">Keine Treffer</div>'
      }
    </div>
  `;
}

window.openSource = function(id,field){
  const m = state.muscles.find(x => x.id === id);
  if(!m) return;

  $('#sourceTitle').textContent = `Quelle · ${field}`;

  const draft = m.sourceType === 'draft_index';
  const exam = m.sourceType === 'exam_pdf';

  $('#sourceBody').innerHTML = `
    <span class="badge-script">
      ${draft
        ? 'Katalogeintrag – unvollständig'
        : exam
          ? 'Prüfungswissen'
          : 'Erweitertes Wissen – nicht fachgeprüft'}
    </span>

    <h3 style="margin-top:16px">
      ${escapeHtml(m.latinName)}
    </h3>

    <p>
      <b>${escapeHtml(field)}</b>:
      ${draft
        ? 'Nur der Muskelname ist vorgemerkt. Fachangaben fehlen.'
        : exam
          ? 'Aus dem bereitgestellten Lernskript übernommen.'
          : 'Ergänzter Anatomieeintrag. Fachlich prüfen.'}
    </p>

    <div class="card">
      <b>${escapeHtml(m.source || 'Keine Quelle angegeben')}</b>
    </div>
  `;

  $('#sourceDrawer').classList.add('open');
};

function closeSource(){
  $('#sourceDrawer').classList.remove('open');
}

function setBodyFocus(region){
  const map = {
    Schulter:'shoulder',
    Oberarm:'arm',
    Unterarm:'forearm',
    'Hand/Unterarm':'forearm',
    Hand:'hand',
    Hüfte:'hip',
    Oberschenkel:'thigh',
    Knie:'knee',
    Unterschenkel:'leg'
  };

  $$('.focus-zone').forEach(x =>
    x.classList.remove('focus')
  );

  const id = map[region] || 'torso';
  const z = $(`#${id}`);

  if(z) z.classList.add('focus');

  $('#viewerLabel').textContent = region;
}

function pick(a){
  return a[Math.floor(Math.random() * a.length)];
}

function shuffle(a){
  return [...a].sort(() => Math.random() - .5);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker
      .register('./sw.js')
      .catch(() => {});
  }
}

function renderRegionPhotos(region){
  const items = state.regionImages[region] || [];
  const box = $('#regionPhotos');

  if(!box) return;

  box.innerHTML = items.map((src,i) => `
    <div>
      <img loading="lazy"
        src="${escapeHtml(src)}"
        alt="Anatomie der Region ${escapeHtml(region)}, Ansicht ${i+1}">
      <div class="region-photo-label">
        Region ${escapeHtml(region)} · Illustration ${i+1}
      </div>
    </div>
  `).join('');
}

function clinicEscape(value){
  return escapeHtml(value ?? '');
}

function clinicList(items){
  if(!Array.isArray(items) || !items.length){
    return '<p class="muted">Keine Angaben vorhanden.</p>';
  }

  return '<ul>' +
    items.map(item =>
      `<li>${clinicEscape(item)}</li>`
    ).join('') +
    '</ul>';
}

function clinicSetup(){
  const field = $('#conditionsField');
  const category = $('#exerciseCategory');

  if(field){
    field.innerHTML =
      '<option value="">Alle Fachbereiche</option>';

    const fields = [...new Set(
      state.conditions.map(c => c.field).filter(Boolean)
    )].sort();

    fields.forEach(name =>
      field.add(new Option(name, name))
    );
  }

  if(category){
    category.innerHTML =
      '<option value="">Alle Kategorien</option>';

    const categories = [...new Set(
      state.exercises.map(e => e.category).filter(Boolean)
    )].sort();

    categories.forEach(name =>
      category.add(new Option(name, name))
    );
  }
}

function renderConditions(){
  const list = $('#conditionsList');
  if(!list) return;

  const q = ($('#conditionsSearch')?.value || '')
    .trim().toLocaleLowerCase('de');

  const field = $('#conditionsField')?.value || '';

  const items = state.conditions.filter(c => {
    const matchesField = !field || c.field === field;

    const text = [
      c.name,
      c.area,
      c.definition,
      c.field
    ].join(' ').toLocaleLowerCase('de');

    return matchesField && (!q || text.includes(q));
  });

  list.innerHTML = items.map(c => `
    <button type="button"
      class="clinic-tile"
      onclick="openCondition('${c.id}')">

      <span class="tag">
        ${clinicEscape(c.field)}
      </span>

      <h3>${clinicEscape(c.name)}</h3>
      <p>${clinicEscape(c.definition)}</p>

      <small>
        ${clinicEscape(c.area)} · Details anzeigen →
      </small>
    </button>
  `).join('') || '<p>Keine Krankheitsbilder gefunden.</p>';
}

window.openCondition = function(id){
  const c = state.conditions.find(x => x.id === id);
  if(!c) return;

  const related = (c.exerciseIds || [])
    .map(exId => state.exercises.find(e => e.id === exId))
    .filter(Boolean);

  const box = $('#conditionDetail');
  if(!box) return;

  box.innerHTML = `
    <article class="clinic-detail">

      <button class="btn secondary"
        onclick="document.getElementById('conditionDetail').innerHTML=''">
        ← Übersicht
      </button>

      <span class="tag">${clinicEscape(c.area)}</span>

      <h2>${clinicEscape(c.name)}</h2>
      <p>${clinicEscape(c.definition)}</p>

      <h3>Leitsymptome</h3>
      ${clinicList(c.symptoms)}

      <h3>Physiotherapeutischer Befund</h3>
      ${clinicList(c.assessment)}

      <h3>Therapieziele</h3>
      ${clinicList(c.goals)}

      <h3>Warnzeichen und Vorsicht</h3>
      <div class="clinic-warning">
        ${clinicList(c.warnings)}
      </div>

      ${c.note
        ? `<p class="muted">${clinicEscape(c.note)}</p>`
        : ''
      }

      <h3>Passende Therapieübungen</h3>

      ${related.length
        ? related.map(e => `
          <button class="btn secondary"
            onclick="showView('exercises');openExercise('${e.id}')">
            ${clinicEscape(e.name)} →
          </button>
        `).join(' ')
        : '<p>Keine pauschale Übungsfreigabe.</p>'
      }

      <h3>Quellenunterlagen</h3>
      ${clinicList(c.sources)}

      <p class="muted">
        Lernmaterial für die Physiotherapieausbildung.
        Individuelle ärztliche Vorgaben und
        Kontraindikationen beachten.
      </p>

    </article>
  `;

  box.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
};

function renderExercises(){
  const list = $('#exercisesList');
  if(!list) return;

  const q = ($('#exerciseSearch')?.value || '')
    .trim().toLocaleLowerCase('de');

  const category = $('#exerciseCategory')?.value || '';

  const items = state.exercises.filter(e => {
    const matchesCategory =
      !category || e.category === category;

    const text = [
      e.name,
      e.region,
      e.purpose,
      e.category
    ].join(' ').toLocaleLowerCase('de');

    return matchesCategory && (!q || text.includes(q));
  });

  list.innerHTML = items.map(e => `
    <button type="button"
      class="clinic-tile"
      onclick="openExercise('${e.id}')">

      <span class="tag">
        ${clinicEscape(e.category)}
      </span>

      <h3>${clinicEscape(e.name)}</h3>

      <p>${clinicEscape(e.purpose)}</p>

      <small>
        ${clinicEscape(e.region)} · Details anzeigen →
      </small>
    </button>
  `).join('') || '<p>Keine Übungen gefunden.</p>';
}

window.openExercise = function(id){
  const e = state.exercises.find(x => x.id === id);
  if(!e) return;

  const related = (e.conditions || [])
    .map(id => state.conditions.find(c => c.id === id))
    .filter(Boolean);

  const box = $('#exerciseDetail');
  if(!box) return;

  box.innerHTML = `
    <article class="clinic-detail">

      <button class="btn secondary"
        onclick="document.getElementById('exerciseDetail').innerHTML=''">
        ← Übersicht
      </button>

      <span class="tag">
        ${clinicEscape(e.category)}
      </span>

      <h2>${clinicEscape(e.name)}</h2>

      <p>${clinicEscape(e.purpose)}</p>

      <h3>Durchführung</h3>
      ${clinicList(e.steps)}

      <h3>Dosierung</h3>
      <p>${clinicEscape(e.dose)}</p>

      <h3>Steigerungsmöglichkeiten</h3>
      <p>${clinicEscape(e.progression)}</p>

      <h3>Kontraindikationen und Vorsicht</h3>
      <div class="clinic-warning">
        ${clinicEscape(e.cautions)}
      </div>

      <h3>Zugehörige Krankheitsbilder</h3>

      ${related.length
        ? related.map(c => `
          <button class="btn secondary"
            onclick="showView('conditions');openCondition('${c.id}')">
            ${clinicEscape(c.name)} →
          </button>
        `).join(' ')
        : '<p>Keine direkte Zuordnung.</p>'
      }

      <h3>Quellenunterlagen</h3>
      ${clinicList(e.sources)}

      <p class="muted">
        Die Dosierung ist ein Lernbeispiel.
        Belastung und Durchführung müssen
        individuell angepasst werden.
      </p>

    </article>
  `;

  box.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
};

function renderVenousQuiz(){
  const box = $('#venousQuizBox');
  if(!box) return;

  const questions = state.venousQuiz;

  if(!questions.length){
    box.innerHTML = `
      <p>Die Quizfragen konnten nicht geladen werden.</p>
    `;
    return;
  }

  if(state.venousIndex >= questions.length){
    const score = state.venousScore;

    box.innerHTML = `
      <div class="card">
        <h2>Quiz abgeschlossen! 🎉</h2>
        <p>Du hast ${score} von ${questions.length}
        Fragen richtig beantwortet.</p>

        <button class="btn primary"
          onclick="restartVenousQuiz()">
          Quiz wiederholen
        </button>
      </div>
    `;
    return;
  }

  const q = questions[state.venousIndex];

  box.innerHTML = `
    <div class="card">
      <p class="muted">
        Frage ${state.venousIndex + 1}
        von ${questions.length}
      </p>

      <h3>${escapeHtml(q.statement)}</h3>

      <div id="venousAnswers">
        <button class="btn secondary"
          onclick="answerVenousQuiz(true)">
          Richtig
        </button>

        <button class="btn secondary"
          onclick="answerVenousQuiz(false)">
          Falsch
        </button>
      </div>

      <div id="venousFeedback"></div>
    </div>
  `;
}

window.answerVenousQuiz = function(answer){
  const q = state.venousQuiz[state.venousIndex];
  if(!q) return;

  const answers = $('#venousAnswers');
  if(!answers || answers.dataset.answered === '1') return;

  answers.dataset.answered = '1';

  const correct = answer === q.answer;

  if(correct) state.venousScore++;

  answers.querySelectorAll('button').forEach(button => {
    button.disabled = true;
  });

  $('#venousFeedback').innerHTML = `
    <div class="card" style="margin-top:15px">
      <h3>${correct ? 'Richtig! ✅' : 'Leider falsch ❌'}</h3>

      <p>
        <b>Richtige Antwort:</b>
        ${q.answer ? 'Richtig' : 'Falsch'}
      </p>

      <p>${escapeHtml(q.explanation)}</p>

      <button class="btn primary"
        onclick="nextVenousQuestion()">
        ${state.venousIndex + 1 === state.venousQuiz.length
          ? 'Ergebnis anzeigen'
          : 'Nächste Frage →'}
      </button>
    </div>
  `;
};

window.nextVenousQuestion = function(){
  state.venousIndex++;
  renderVenousQuiz();
};

window.restartVenousQuiz = function(){
  state.venousIndex = 0;
  state.venousScore = 0;
  renderVenousQuiz();
};

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* PHYSIOLEARN – REHA-PHASEN V1 */
(function () {
  let rehabData = [];
  let selectedCondition = null;
  let loadError = false;

  const originalOpenCondition = window.openCondition;

  function safe(value) {
    return escapeHtml(String(value ?? ''));
  }

  function makeList(items) {
    if (!Array.isArray(items) || !items.length) {
      return '<p>Keine Angaben vorhanden.</p>';
    }
    return '<ul>' + items.map(x =>
      '<li>' + safe(x) + '</li>'
    ).join('') + '</ul>';
  }

  function renderRehab(conditionId, phaseIndex = 0) {
    const detail = document.getElementById('conditionDetail');
    if (!detail) return;

    const article = detail.querySelector('.clinic-detail');
    if (!article) return;

    const old = article.querySelector('#rehabPanel');
    if (old) old.remove();

    const record = rehabData.find(
      item => item.conditionId === conditionId
    );

    if (!record || !Array.isArray(record.phases)) {
      return;
    }

    const phase = record.phases[phaseIndex];
    if (!phase) return;

    const panel = document.createElement('section');
    panel.id = 'rehabPanel';
    panel.style.cssText =
      'margin:22px 0;padding:20px;' +
      'border:1px solid var(--border,#8AB8D8);' +
      'border-radius:18px;' +
      'background:var(--surface2,#DCEEFF);' +
      'color:var(--text,#173B60);';

    panel.innerHTML = `
      <h3>Rehabilitation nach Phasen</h3>

      <p style="font-size:13px;opacity:.85">
        Lernbeispiele. Individuelle OP-Vorgaben,
        Belastungsfreigabe und Heilungsverlauf beachten.
      </p>

      <div id="rehabPhaseButtons"
        style="display:flex;flex-wrap:wrap;gap:9px;
        margin:16px 0"></div>

      <div class="card"
        style="padding:18px;margin-top:12px">

        <h3>${safe(phase.name)}</h3>
        <p><strong>Zeitraum:</strong>
          ${safe(phase.period)}</p>

        <h4>Therapieziele</h4>
        ${makeList(phase.goals)}

        <h4>Passende Übungen</h4>
        <div id="rehabExerciseCards"></div>

        <h4>Vorsichtsmaßnahmen</h4>
        ${makeList(phase.cautions)}

        <h4>Kriterien für die nächste Phase</h4>
        ${makeList(phase.progressionCriteria)}
      </div>
    `;

    const buttonArea =
      panel.querySelector('#rehabPhaseButtons');

    record.phases.forEach((p, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Phase ' + (index + 1);

      button.style.cssText =
        'padding:11px 16px;border-radius:12px;' +
        'border:1px solid #6495B9;' +
        'font-weight:700;cursor:pointer;' +
        'background:' +
        (index === phaseIndex ? '#176FA9' : '#233D60') +
        ';color:#FFFFFF;';

      button.addEventListener('click', () => {
        renderRehab(conditionId, index);
      });

      buttonArea.appendChild(button);
    });

    const exerciseArea =
      panel.querySelector('#rehabExerciseCards');

    (phase.exercises || []).forEach((exercise, i) => {
      const card = document.createElement('details');

      card.style.cssText =
        'margin:10px 0;padding:14px;' +
        'border:1px solid var(--border,#8AB8D8);' +
        'border-radius:12px;' +
        'background:var(--surface,#FFFFFF);';

      card.innerHTML = `
        <summary style="cursor:pointer;font-weight:700">
          ${i + 1}. ${safe(exercise.name)}
        </summary>

        <div style="margin-top:13px">
          <p><strong>Ziel:</strong>
            ${safe(exercise.purpose)}</p>

          <p><strong>Ausgangsstellung:</strong>
            ${safe(exercise.position)}</p>

          <strong>Durchführung:</strong>
          ${makeList(exercise.steps)}

          <p><strong>Dosierung:</strong>
            ${safe(exercise.dose)}</p>
        </div>
      `;

      exerciseArea.appendChild(card);
    });

    const heading = article.querySelector('h2');
    if (heading) {
      heading.insertAdjacentElement('afterend', panel);
    } else {
      article.prepend(panel);
    }
  }

  if (typeof originalOpenCondition === 'function') {
    window.openCondition = function (id) {
      selectedCondition = id;
      originalOpenCondition(id);
      renderRehab(id);
    };
  }

  async function loadRehabPhases() {
    try {
      const response = await fetch(
        './data/rehab-phases.json?v=1',
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Reha-Daten nicht gefunden');
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Ungültiges Datenformat');
      }

      rehabData = data;

      if (selectedCondition) {
        renderRehab(selectedCondition);
      }

      console.log(
        'PhysioLearn Reha-Phasen geladen:',
        rehabData.length
      );
    } catch (error) {
      loadError = true;
      console.error('Reha-Daten konnten nicht geladen werden', error);
    }
  }

  loadRehabPhases();
})();
