/* TeCoBot site — page behaviour (clips, video library, lightbox, citation).
   The robot renderer lives in tecobot.js; nothing here touches it. */
(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Looping clips load and play only while on screen, so a page with forty of
     them costs one or two at a time. With reduced motion they wait for a click. */
  var loops = Array.prototype.slice.call(document.querySelectorAll('video[data-src]'));
  function load(v){
    if(v.getAttribute('src')) return;
    v.src = v.getAttribute('data-src');
  }
  if(reduce){
    loops.forEach(function(v){ v.removeAttribute('autoplay'); v.controls = true; v.preload = 'none'; load(v); });
  } else if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v = e.target;
        if(e.isIntersecting){ load(v); var p = v.play(); if(p && p.catch) p.catch(function(){}); }
        else if(!v.paused){ v.pause(); }
      });
    }, { rootMargin:'200px 0px', threshold:0.01 });
    loops.forEach(function(v){ io.observe(v); });
  } else {
    loops.forEach(function(v){ load(v); });
  }

  /* Reels start muted; the button turns the sound on for that one only. */
  document.querySelectorAll('.reel').forEach(function(r){
    var v = r.querySelector('video'), b = r.querySelector('.sound');
    if(!v || !b) return;
    b.addEventListener('click', function(){
      document.querySelectorAll('.reel video').forEach(function(o){ if(o !== v){ o.muted = true; } });
      document.querySelectorAll('.reel .sound').forEach(function(o){ if(o !== b){ o.textContent = 'Sound on'; } });
      v.muted = !v.muted;
      if(!v.muted){ load(v); v.play(); }
      b.textContent = v.muted ? 'Sound on' : 'Sound off';
    });
  });

  /* Video library: one player, a list beside it. */
  var lib = document.querySelector('.library');
  if(lib){
    var pv = lib.querySelector('.player video'), pt = lib.querySelector('.player b'),
        pd = lib.querySelector('.player span');
    lib.querySelectorAll('.playlist button').forEach(function(btn){
      btn.addEventListener('click', function(){
        lib.querySelectorAll('.playlist button').forEach(function(o){ o.removeAttribute('aria-current'); });
        btn.setAttribute('aria-current', 'true');
        pv.poster = btn.getAttribute('data-poster');
        pv.src = btn.getAttribute('data-video');
        pt.textContent = btn.querySelector('b').textContent;
        pd.textContent = btn.getAttribute('data-desc') || '';
        var p = pv.play(); if(p && p.catch) p.catch(function(){});
      });
    });
  }

  /* Figures open full size. */
  var dlg = document.querySelector('dialog.lightbox');
  if(dlg){
    var di = dlg.querySelector('img'), dp = dlg.querySelector('p');
    document.querySelectorAll('[data-zoom]').forEach(function(el){
      el.addEventListener('click', function(){
        di.src = el.getAttribute('data-zoom');
        di.alt = el.getAttribute('data-alt') || '';
        dp.textContent = el.getAttribute('data-caption') || '';
        if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    dlg.querySelector('.close').addEventListener('click', function(){ dlg.close(); });
    dlg.addEventListener('click', function(e){ if(e.target === dlg) dlg.close(); });
  }

  /* Copy the citation. */
  document.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click', function(){
      var t = document.getElementById(b.getAttribute('data-target')).textContent;
      function done(){ b.textContent = 'Copied'; setTimeout(function(){ b.textContent = 'Copy'; }, 1600); }
      if(navigator.clipboard) navigator.clipboard.writeText(t).then(done, function(){});
    });
  });

  /* Guides: highlight the section being read. */
  var toc = document.querySelectorAll('.toc a');
  if(toc.length && 'IntersectionObserver' in window){
    var map = {};
    toc.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){
          toc.forEach(function(a){ a.classList.remove('on'); });
          var a = map[e.target.id]; if(a) a.classList.add('on');
        }
      });
    }, { rootMargin:'-30% 0px -60% 0px' });
    Object.keys(map).forEach(function(id){ var s = document.getElementById(id); if(s) obs.observe(s); });
  }
})();

/* Day / night. Night is the default; day applies only when a visitor picks
   it, and the choice is remembered in this browser. The head of the page sets data-theme before
   anything draws, so this only wires the switch. */
(function(){
  "use strict";
  var root = document.documentElement, btns = document.querySelectorAll('[data-set-theme]');
  if(!btns.length) return;
  function apply(t){
    root.setAttribute('data-theme', t);
    btns.forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-set-theme') === t)); });
    var pal = document.getElementById('pal');
    if(pal) pal.value = (t === 'light') ? 'day' : 'studio';
    if(window.__tecobotRecolor) window.__tecobotRecolor();
  }
  btns.forEach(function(b){
    b.addEventListener('click', function(){
      var t = b.getAttribute('data-set-theme');
      try{ localStorage.setItem('tecobot-theme', t); }catch(e){}
      apply(t);
    });
  });
  apply(root.getAttribute('data-theme') || 'dark');
})();

/* Play: the page is as wide as the screen rule allows (90% of the window,
   1240 to 2200 px), and wider still when that is what it takes for the first
   row of controls to sit on one line — but never wider than the window. On a
   phone the row simply wraps. */
(function(){
  "use strict";
  if(!document.body.classList.contains('playpage')) return;
  var wrap = document.querySelector('.wrap'), row = document.querySelector('#below .controls'),
      bar = document.querySelector('.topbar .in');
  if(!wrap || !row) return;
  var last = '';
  function need(){
    var cs = getComputedStyle(row), gap = parseFloat(cs.columnGap) || 0, w = 0, n = 0;
    Array.prototype.forEach.call(row.children, function(el){
      if(el.hidden || getComputedStyle(el).display === 'none') return;
      w += el.getBoundingClientRect().width; n++;
    });
    return Math.ceil(w + gap*Math.max(0, n-1)) + 2;
  }
  function fit(){
    var vw = document.documentElement.clientWidth;
    var base = Math.min(2200, Math.max(1240, vw*0.9));
    var ps = getComputedStyle(wrap), pad = parseFloat(ps.paddingLeft) + parseFloat(ps.paddingRight);
    var w = Math.min(vw, Math.max(base, need() + pad));
    var v = Math.round(w) + 'px';
    if(v === last) return;
    last = v;
    wrap.style.maxWidth = v;
    if(bar) bar.style.maxWidth = v;
    window.dispatchEvent(new Event('resize'));   // the stage re-measures itself
  }
  window.addEventListener('resize', function(){ requestAnimationFrame(fit); });
  ['cat','morph'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('change', function(){ setTimeout(fit, 0); });
  });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('load', fit);
  fit();
})();

/* What's new: each card opens its panel; one open at a time. */
(function(){
  "use strict";
  var cards = document.querySelectorAll('.idea');
  cards.forEach(function(b){
    b.addEventListener('click', function(){
      var open = b.getAttribute('aria-expanded') === 'true';
      cards.forEach(function(o){
        o.setAttribute('aria-expanded', 'false');
        o.querySelector('.ideaMore').textContent = 'Show details';
        var pn = document.getElementById(o.getAttribute('aria-controls')); if(pn) pn.hidden = true;
      });
      if(!open){
        b.setAttribute('aria-expanded', 'true');
        b.querySelector('.ideaMore').textContent = 'Hide details';
        var p = document.getElementById(b.getAttribute('aria-controls'));
        p.hidden = false;
        // clips inside a panel that was hidden start now
        p.querySelectorAll('video[data-src]').forEach(function(v){ if(!v.getAttribute('src')) v.src = v.getAttribute('data-src'); var pr = v.play(); if(pr && pr.catch) pr.catch(function(){}); });
      }
    });
  });
})();

/* The video list matches the player's height and scrolls inside it. */
(function(){
  "use strict";
  var fr = document.querySelector('.library .player .frame'), list = document.querySelector('.library .playlist');
  if(!fr || !list) return;
  var v = fr.querySelector('video');
  function fit(){
    if(window.innerWidth <= 860){ list.style.maxHeight = ''; return; }
    list.style.maxHeight = Math.round(fr.getBoundingClientRect().height) + 'px';
  }
  window.addEventListener('resize', fit);
  if(v){ v.addEventListener('loadedmetadata', fit); }
  if(window.ResizeObserver) new ResizeObserver(fit).observe(fr);
  fit();
})();
