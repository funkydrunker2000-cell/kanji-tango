(function () {
  var KEY = 'kanjiTango.known';
  var DATA = KANJI_DATA.map(function (r) {
    return {
      k: r[0], cat: r[2], ja: r[3], idn: r[4], read: r[1],
      words: r[5].split(';').map(function (w) { var p = w.split('|'); return { w: p[0], r: p[1], idn: p[2] }; })
    };
  });

  var known = {};
  try { (JSON.parse(localStorage.getItem(KEY)) || []).forEach(function (k) { known[k] = true; }); } catch (e) {}
  function saveKnown() { try { localStorage.setItem(KEY, JSON.stringify(Object.keys(known))); } catch (e) {} }

  var st = { mode: 'card', cat: '', onlyUnknown: false, deck: [], pos: 0, flipped: false, qtype: 'read', quiz: null };
  var view = document.getElementById('view');
  var catSel = document.getElementById('cat');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function count(o) { return Object.keys(o).length; }

  function buildDeck(keepOrder) {
    var d = DATA.filter(function (x) {
      return (!st.cat || x.cat === st.cat) && (!st.onlyUnknown || !known[x.k]);
    });
    st.deck = keepOrder ? d : d;
    st.pos = 0; st.flipped = false; st.quiz = null;
  }

  function progress() {
    var inCat = DATA.filter(function (x) { return !st.cat || x.cat === st.cat; });
    var n = inCat.filter(function (x) { return known[x.k]; }).length;
    document.getElementById('progress').textContent =
      '習得 ' + n + ' / ' + inCat.length + ' 語（全体 ' + count(known) + ' / ' + DATA.length + '）';
  }

  function render() {
    progress();
    view.textContent = '';
    if (st.mode === 'card') renderCard(); else renderQuiz();
  }

  // ---- カード ----
  function renderCard() {
    if (!st.deck.length) { view.appendChild(el('p', 'empty', '表示する言葉がありません。')); return; }
    var c = st.deck[st.pos];
    var card = el('div', 'card');
    if (!st.flipped) {
      card.appendChild(el('span', 'tag', c.cat));
      card.appendChild(el('div', 'big', c.k));
      card.appendChild(el('div', 'hint', 'タップして裏を見る（スペースキーでも可）'));
    } else {
      card.style.cursor = 'default';
      var b = el('div', 'back');
      var head = el('div', 'head');
      head.appendChild(el('span', 'k', c.k));
      head.appendChild(el('span', 'tag', c.cat));
      b.appendChild(head);
      var dl = el('dl');
      function add(label, text, cls) { dl.appendChild(el('dt', null, label)); dl.appendChild(el('dd', cls, text)); }
      add('読み方', c.read);
      add('意味（日本語）', c.ja);
      add('Arti（インドネシア語）', c.idn, 'id');
      b.appendChild(dl);
      b.appendChild(el('dt', null, '関連する言葉'));
      var ul = el('ul');
      c.words.forEach(function (w) {
        var li = el('li');
        li.appendChild(el('b', null, w.w));
        li.appendChild(el('span', null, '（' + w.r + '）'));
        li.appendChild(el('span', 'id', ' ' + w.idn));
        ul.appendChild(li);
      });
      b.appendChild(ul);
      card.appendChild(b);
    }
    if (!st.flipped) card.onclick = flip;
    view.appendChild(card);

    var row = el('div', 'row');
    var prev = el('button', null, '← 前'); prev.onclick = function () { move(-1); };
    var flipB = el('button', null, st.flipped ? '表に戻す' : '裏を見る'); flipB.onclick = flip;
    var next = el('button', null, '次 →'); next.onclick = function () { move(1); };
    row.appendChild(prev); row.appendChild(flipB); row.appendChild(next);
    view.appendChild(row);

    var row2 = el('div', 'row');
    var ng = el('button', 'ng', 'まだ'); ng.onclick = function () { mark(false); };
    var ok = el('button', 'ok', known[c.k] ? '✓ おぼえた（済）' : 'おぼえた'); ok.onclick = function () { mark(true); };
    row2.appendChild(ng); row2.appendChild(ok);
    view.appendChild(row2);
    view.appendChild(el('p', 'hint', (st.pos + 1) + ' / ' + st.deck.length));
    view.lastChild.style.textAlign = 'center'; view.lastChild.style.color = 'var(--sub)';
  }
  function flip() { st.flipped = !st.flipped; render(); }
  function move(d) { if (!st.deck.length) return; st.pos = (st.pos + d + st.deck.length) % st.deck.length; st.flipped = false; render(); }
  function mark(ok) {
    var c = st.deck[st.pos];
    if (ok) known[c.k] = true; else delete known[c.k];
    saveKnown();
    move(1);
  }

  // ---- クイズ ----
  function startQuiz() {
    var list = st.deck.slice();
    shuffle(list);
    st.quiz = { list: list, i: 0, score: 0, wrong: [], answered: false, opts: null };
  }
  function answerOf(c) { return st.qtype === 'read' ? c.read : c.idn.split(',')[0].trim(); }
  function makeOptions(c) {
    var correct = answerOf(c);
    var seen = {}; seen[correct] = true;
    var opts = [correct];
    var pool = shuffle(DATA.slice());
    for (var i = 0; i < pool.length && opts.length < 4; i++) {
      var a = answerOf(pool[i]);
      if (!seen[a]) { seen[a] = true; opts.push(a); }
    }
    return shuffle(opts);
  }
  function renderQuiz() {
    var q = st.quiz;
    var tp = el('div', 'qtype');
    [['read', '言葉 → 読み'], ['idn', '言葉 → インドネシア語']].forEach(function (t) {
      var lab = el('label');
      var r = el('input'); r.type = 'radio'; r.name = 'qt'; r.checked = st.qtype === t[0];
      r.onchange = function () { st.qtype = t[0]; st.quiz = null; render(); };
      lab.appendChild(r); lab.appendChild(document.createTextNode(' ' + t[1]));
      tp.appendChild(lab);
    });
    view.appendChild(tp);

    if (!st.deck.length) { view.appendChild(el('p', 'empty', '出題する言葉がありません。')); return; }
    if (!q) { startQuiz(); q = st.quiz; }

    if (q.i >= q.list.length) {
      var box = el('div', 'q');
      box.appendChild(el('h2', null, '結果: ' + q.score + ' / ' + q.list.length));
      if (q.wrong.length) {
        var res = el('div', 'result');
        res.appendChild(el('p', null, '間違えた言葉（「未習得」に戻しました）'));
        q.wrong.forEach(function (c) { res.appendChild(el('div', null, c.k + '（' + c.read + '）　' + c.idn)); });
        box.appendChild(res);
      }
      var again = el('button', 'opt', 'もう一度'); again.onclick = function () { st.quiz = null; render(); };
      box.appendChild(el('div', 'opts')).appendChild(again);
      view.appendChild(box);
      return;
    }

    var c = q.list[q.i];
    if (!q.opts) q.opts = makeOptions(c);
    var box2 = el('div', 'q');
    box2.appendChild(el('p', null, (q.i + 1) + ' / ' + q.list.length + '　正解 ' + q.score));
    box2.appendChild(el('div', 'big', c.k));
    box2.appendChild(el('p', null, st.qtype === 'read' ? 'この言葉の読み方は？' : 'インドネシア語の意味は？'));
    var opts = el('div', 'opts');
    var correct = answerOf(c);
    q.opts.forEach(function (o) {
      var b = el('button', 'opt', o);
      b.onclick = function () { choose(b, o, correct, c, opts); };
      opts.appendChild(b);
    });
    box2.appendChild(opts);
    view.appendChild(box2);
  }
  function choose(btn, o, correct, c, opts) {
    var q = st.quiz;
    if (q.answered) return;
    q.answered = true;
    Array.prototype.forEach.call(opts.children, function (b) {
      if (b.textContent === correct) b.classList.add('right');
    });
    if (o === correct) { q.score++; known[c.k] = true; }
    else { btn.classList.add('wrong'); q.wrong.push(c); delete known[c.k]; }
    saveKnown(); progress();
    var detail = el('div', 'result', c.k + '（' + c.read + '）　' + c.ja + ' / ' + c.idn);
    view.firstChild && view.lastChild.appendChild(detail);
    var nx = el('button', 'opt', q.i + 1 >= q.list.length ? '結果を見る' : '次へ');
    nx.style.marginTop = '12px';
    nx.onclick = function () { q.i++; q.opts = null; q.answered = false; render(); };
    view.lastChild.appendChild(nx);
  }

  // ---- 操作 ----
  function setMode(m) {
    st.mode = m;
    document.getElementById('tab-card').classList.toggle('active', m === 'card');
    document.getElementById('tab-quiz').classList.toggle('active', m === 'quiz');
    st.pos = 0; st.flipped = false; st.quiz = null;
    render();
  }
  document.getElementById('tab-card').onclick = function () { setMode('card'); };
  document.getElementById('tab-quiz').onclick = function () { setMode('quiz'); };
  catSel.onchange = function () { st.cat = catSel.value; buildDeck(); render(); };
  document.getElementById('unknown').onchange = function (e) { st.onlyUnknown = e.target.checked; buildDeck(); render(); };
  document.getElementById('shuffle').onclick = function () { shuffle(st.deck); st.pos = 0; st.flipped = false; st.quiz = null; render(); };
  document.getElementById('reset').onclick = function () {
    if (confirm('「おぼえた」の記録をすべて消します。よろしいですか？')) { known = {}; saveKnown(); buildDeck(); render(); }
  };
  document.addEventListener('keydown', function (e) {
    if (st.mode !== 'card') return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
  });

  var cats = [''];
  DATA.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
  cats.forEach(function (c) {
    var o = el('option', null, c || 'すべて（' + DATA.length + '語）'); o.value = c; catSel.appendChild(o);
  });

  buildDeck();
  render();
})();
