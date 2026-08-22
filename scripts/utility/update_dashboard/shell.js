  // ---- Tab switching ----
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'map') renderMermaid();
    });
  });

  // ---- Updates: render JSON data from the server (single source of truth) ----
  var scanBtn = document.getElementById('scanBtn');
  var scanStatus = document.getElementById('scanStatus');
  var pkgList = document.getElementById('pkgList');
  var projList = document.getElementById('projChips');
  var summaryEl = document.getElementById('summary');
  var bulkBar = document.getElementById('bulkBar');
  var selectAll = document.getElementById('selectAll');
  var selCount = document.getElementById('selCount');
  var bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
  var bulkProgress = document.getElementById('bulkProgress');
  var bulkStats = document.getElementById('bulkStats');
  var clearSelBtn = document.getElementById('clearSelBtn');
  var bulkDoneCount = 0, bulkFailCount = 0, bulkTotalCount = 0;
  function updateBulkStats(){
    if (!bulkStats) return;
    if (bulkTotalCount === 0){ bulkStats.hidden = true; return; }
    bulkStats.hidden = false;
    var parts = bulkStats.querySelectorAll('.bs');
    var active = bulkTotalCount - bulkDoneCount - bulkFailCount;
    for (var i=0;i<parts.length;i++){
      var b = parts[i].querySelector('b');
      if (parts[i].classList.contains('bs-ok')) b.textContent = bulkDoneCount;
      else if (parts[i].classList.contains('bs-fail')) b.textContent = bulkFailCount;
      else if (parts[i].classList.contains('bs-active')) b.textContent = active;
    }
  }
  var sortSel = document.getElementById('sortSel');
  var searchInput = document.getElementById('searchInput');
  var banner = document.getElementById('banner');
  var scanSpinner = document.getElementById('scanSpinner');
  var allPkgs = [];
  var allProjects = [];
  var projByPath = {};
  var filterPath = null;
  var selected = new Set();
  var sortMode = 'default';
  var statusFilter = 'all';
  var searchTerm = '';

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]; }); }

  var COMPAT_TITLE = {
    major: 'Major update — breaking changes likely',
    minor: 'Minor update — new features, backwards compatible',
    patch: 'Patch update — bug fixes only'
  };

  // Inline SVG icon set (monochrome, currentColor). No external assets / emojis.
  var ICONS = {
    refresh: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 2.5V6H10"/></svg>',
    search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.2"/><path d="M14 14l-3.2-3.2"/></svg>',
    layers: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.8l6 3-6 3-6-3z"/><path d="M2 7.4l6 3 6-3M2 10.8l6 3 6-3"/></svg>',
    pkg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.6l5.2 3v6.8L8 14.4 2.8 11V4z"/><path d="M2.8 4l5.2 3 5.2-3M8 7v7.4"/></svg>',
    code: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4l-3 4 3 4M10.5 4l3 4-3 4"/></svg>',
    folder: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M1.5 4.2h4l1.5 1.6h7.5v7.2H1.5z"/></svg>',
    app: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4"/><path d="M1.8 6h12.4M8 6v7.2"/></svg>',
    npm: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.6l5.4 3.1v6.2L8 14 2.6 10.9V4.7z"/></svg>',
    pip: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/><path d="M8 4.5v7M5 8h6"/></svg>',
    cargo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1"/><path d="M2.2 7.2h11.6M8 3.2v9.6"/></svg>',
    winget: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4"/><path d="M8 2.8v10.4M1.8 8h12.4"/></svg>',
    portable: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="3" y="2.5" width="10" height="11" rx="1.2"/><path d="M6 2.5V1.6M10 2.5V1.6M3 6h10"/></svg>'
  };

  if (scanBtn){ scanBtn.innerHTML = ICONS.refresh + '<span>Refresh</span>'; }

  function badge(method){
    var m = (method || '').toLowerCase();
    var cls = (m.indexOf('npm')>=0)?'npm':(m.indexOf('pip')>=0)?'pip':(m.indexOf('cargo')>=0)?'cargo':(m.indexOf('portable')>=0)?'portable':(m.indexOf('winget')>=0)?'winget':'cargo';
    var label = {npm:'npm',pip:'pip',cargo:'Cargo',portable:'Portable',winget:'WinGet'}[cls] || cls;
    var icon = ICONS[cls] || ICONS.pkg;
    return '<span class="badge '+cls+'">'+icon+'<span class="b-label">'+label+'</span></span>';
  }

  function statusClass(p){
    var s=(p.Status||'').toLowerCase();
    return s==='outdated'?'s-outdated':(s==='current'?'s-current':'s-unknown');
  }

  function rank(p){
    var s=(p.Status||'').toLowerCase();
    return s==='outdated'?0:(s==='unknown'?1:2);
  }

  function getVisible(){
    var pkgs = allPkgs.slice();
    if (filterPath) pkgs = pkgs.filter(function(p){ return (p.Path||null) === filterPath; });
    if (statusFilter !== 'all') pkgs = pkgs.filter(function(p){ return (p.Status||'').toLowerCase() === statusFilter; });
    if (searchTerm){
      var q = searchTerm.toLowerCase();
      pkgs = pkgs.filter(function(p){
        return (p.Name||'').toLowerCase().indexOf(q)>=0
          || (p.Method||'').toLowerCase().indexOf(q)>=0
          || (p.Project||'').toLowerCase().indexOf(q)>=0;
      });
    }
    if (sortMode === 'outdated') pkgs.sort(function(a,b){ return rank(a)-rank(b); });
    else if (sortMode === 'current') pkgs.sort(function(a,b){ return rank(b)-rank(a); });
    else if (sortMode === 'source') pkgs.sort(function(a,b){ return (a.Method||'').localeCompare(b.Method||''); });
    return pkgs;
  }

  function renderSummary(s){
    if (!s) { summaryEl.innerHTML = ''; return; }
    var cards = [
      { cls:'total',    k:'Checked',  v:s.total },
      { cls:'outdated', k:'Outdated', v:s.outdated },
      { cls:'current',  k:'Up to date', v:s.current },
      { cls:'projects', k:'Projects', v:s.projects },
    ];
    summaryEl.innerHTML = cards.map(function(c){
      return '<div class="stat '+c.cls+'" data-to="'+c.v+'"><div class="v">0</div><div class="k">'+c.k+'</div></div>';
    }).join('');
    // Count-up animation
    summaryEl.querySelectorAll('.stat').forEach(function(el){
      var to = parseInt(el.dataset.to, 10) || 0, start = 0, t0 = null, dur = 600;
      function step(ts){
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var ease = 1 - Math.pow(1 - p, 3);
        el.querySelector('.v').textContent = Math.round(start + (to - start) * ease);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function updateChips(){
    var total = allPkgs.length;
    var out = allPkgs.filter(function(p){ return (p.Status||'').toLowerCase()==='outdated'; }).length;
    var cur = allPkgs.filter(function(p){ return (p.Status||'').toLowerCase()==='current'; }).length;
    var counts = { all: total, outdated: out, current: cur };
    document.querySelectorAll('.chip').forEach(function(c){
      var k = c.dataset.status;
      var label = k.charAt(0).toUpperCase() + k.slice(1);
      c.textContent = label + ' (' + (counts[k]||0) + ')';
    });
  }

  // Re-tally the top summary cards + status chips from the live allPkgs array
  // so optimistic post-update changes stay consistent without a full re-scan.
  function recomputeSummary(){
    var total = allPkgs.length;
    var out = allPkgs.filter(function(p){ return (p.Status||'').toLowerCase()==='outdated'; }).length;
    var cur = allPkgs.filter(function(p){ return (p.Status||'').toLowerCase()==='current'; }).length;
    var projCount = allProjects.length;
    updateChips();
    if (!summaryEl) return;
    summaryEl.querySelectorAll('.stat').forEach(function(el){
      var cls = (el.getAttribute('class')||'').replace('stat','').trim().split(/\s+/)[0];
      var v = cls==='outdated' ? out : cls==='current' ? cur : cls==='total' ? total : cls==='projects' ? projCount : 0;
      var vEl = el.querySelector('.v');
      if (vEl) vEl.textContent = v;
    });
  }

  function renderProjects(projects){
    if (!projList) return;
    if (!projects || !projects.length){ projList.innerHTML = ''; return; }
    var chips = ['<button class="proj-chip'+(filterPath?'':' active')+'" data-path="" aria-pressed="'+(filterPath?'false':'true')+'" title="All projects"><span class="pc-ico">'+ICONS.layers+'</span><span class="pc-name">All projects</span></button>'];
    projects.forEach(function(p){
      var total = p.total||0, out = p.outdated||0;
      var dot = (out===0 && total>0) ? 'ok' : (out===0 ? 'unknown' : (out===total ? 'bad' : 'mix'));
      var active = (filterPath === p.path);
      var outCls = out>0 ? '' : ' ok';
      var outTxt = out>0 ? (out + ' out') : (total ? 'ok' : '?');
      var ico = p.isGit ? ICONS.code : ICONS.folder;
      chips.push('<button class="proj-chip'+(active?' active':'')+'" data-path="'+esc(p.path)+'" aria-pressed="'+active+'" title="'+esc(p.name+(p.path?' — '+p.path:''))+'">'
        + '<span class="pc-ico">'+ico+'</span>'
        + '<span class="proj-dot '+dot+'"></span>'
        + '<span class="pc-name">'+esc(p.name)+'</span>'
        + '<span class="pc-out'+outCls+'">'+outTxt+'</span>'
        + '</button>');
    });
    projList.innerHTML = chips.join('');
    projList.querySelectorAll('.proj-chip').forEach(function(c){
      c.addEventListener('click', function(){
        var path = c.dataset.path || null;
        filterPath = (filterPath === path) ? null : path;
        projList.querySelectorAll('.proj-chip').forEach(function(x){
          var xp = x.dataset.path || null;
          x.classList.toggle('active', xp === filterPath);
          x.setAttribute('aria-pressed', xp === filterPath);
        });
        renderPackages();
      });
    });
  }

  function findRow(cmd){
    var rows = pkgList.querySelectorAll('.pkg');
    for (var i=0;i<rows.length;i++){ if (rows[i].dataset.cmd === cmd) return rows[i]; }
    return null;
  }

  // Optimistically reflect a successful (or failed) update on the row + data model
  // so the UI immediately stops flagging the package as "needs updating".
  function markUpdated(cmd, success){
    var pkg = findPkg(cmd);
    if (pkg && success){ pkg.Installed = pkg.Available; pkg.Status = 'current'; }
    var row = findRow(cmd);
    if (row && success){
      row.classList.remove('s-outdated'); row.classList.add('s-current');
      var ver = row.querySelector('.pver'); if (ver) ver.textContent = (pkg && pkg.Installed) || '?';
      var arrow = row.querySelector('.parrow'); if (arrow) arrow.style.display = 'none';
      var neu = row.querySelector('.pnew'); if (neu) neu.style.display = 'none';
      var compat = row.querySelector('.pcompat'); if (compat) compat.style.display = 'none';
      row.setAttribute('title', (pkg && pkg.Name ? pkg.Name + ' ' : '') + ((pkg && pkg.Installed) || ''));
      row.setAttribute('aria-label', 'Package ' + ((pkg && pkg.Name) || '?') + ', up to date' + ((pkg && pkg.Installed) ? ', ' + pkg.Installed : ''));
    }
    recomputeSummary();
  }

  function renderPkgRows(pkgs){
    return pkgs.map(function(p){
      var cmd = p.Cmd || '';
      var sc = statusClass(p);
      var isSel = selected.has(cmd);
      var compat = p.Compat ? '<span class="pcompat c-'+esc(p.Compat)+'" title="'+esc(COMPAT_TITLE[p.Compat]||'')+'" aria-label="'+esc((p.Compat||'')+' level update')+'">'+esc(p.Compat)+'</span>' : '';
      var title = p.Name ? 'title="'+esc(p.Name+' '+p.Installed+' → '+p.Available)+'"' : '';
      var aria = 'Package '+(p.Name||'?')+(p.Status?', '+p.Status:'')+(p.Installed&&p.Available?', '+p.Installed+' to '+p.Available:'');
      return '<div class="pkg '+sc+(isSel?' sel':'')+'" role="listitem" data-cmd="'+esc(cmd)+'"'+title+' aria-label="'+esc(aria)+'">'
        + '<div class="pkg-main">'
        + '<input type="checkbox" class="pcheck" '+(cmd?'':'disabled ')+(isSel?'checked':'')+' data-cmd="'+esc(cmd)+'" aria-label="Select '+esc(p.Name||'?')+'">'
        + '<span class="pname">'+esc(p.Name||'?')+'</span>'
        + '<span class="pkg-meta">'
        + '<span class="pver">'+esc(p.Installed||'?')+'</span>'
        + '<span class="parrow">→</span>'
        + '<span class="pnew">'+esc(p.Available||'?')+'</span>'
        + compat
        + '</span>'
        + '<span class="pmeth">'+badge(p.Method)+'</span>'
        + '<span class="pkg-acts">'
        + '<button class="act" data-copy="'+esc(cmd)+'">Copy</button>'
        + '<button class="act run" data-update="'+esc(cmd)+'" data-name="'+esc(p.Name||'')+'">Update</button>'
        + '</span>'
        + '</div>'
        + '<div class="pkg-update" data-cmd="'+esc(cmd)+'">'
        +   '<div class="pu-head"><span class="stage queued">Queued</span><span class="pu-compat"></span>'
        +     '<button class="pu-toggle" type="button" aria-label="Collapse log" data-cmd="'+esc(cmd)+'">–</button></div>'
        +   '<div class="pbar"><i></i></div>'
        + '<div class="plog"></div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function resolveGroupMeta(p){
    if (p.Path){
      var pm = projByPath[p.Path];
      return { name: pm ? pm.name : p.Path, path: p.Path, isGit: pm ? !!pm.isGit : false, method: null };
    }
    var m = (p.Method || 'portable').toLowerCase();
    var names = { portable:'Portable apps', winget:'WinGet apps', npm:'npm packages', pip:'pip packages', cargo:'Cargo packages' };
    return { name: names[m] || (m + ' packages'), path: '', isGit: false, method: m };
  }

  function groupByProject(pkgs){
    var map = {};
    pkgs.forEach(function(p){
      var key = p.Path ? ('p:' + (p.Path||'')) : ('m:' + (p.Method||'portable'));
      (map[key] = map[key] || []).push(p);
    });
    var arr = Object.keys(map).map(function(k){
      var items = map[k];
      var first = items[0];
      var out = items.filter(function(p){ return (p.Status||'').toLowerCase() === 'outdated'; }).length;
      var meta = resolveGroupMeta(first);
      return { key:k, items:items, name:meta.name, path:meta.path, isGit:meta.isGit, method:meta.method, out:out, total:items.length };
    });
    arr.sort(function(a,b){ return (b.out - a.out) || a.name.localeCompare(b.name); });
    return arr;
  }

  function renderGroupHead(g){
    var ico = g.method ? (ICONS[g.method] || ICONS.app) : (g.isGit ? ICONS.code : ICONS.folder);
    var outCls = g.out > 0 ? 'has-out' : 'ok';
    return '<div class="pgroup-head'+(g.out>0?' has-out':'')+'">'
      + '<span class="pg-ico">'+ico+'</span>'
      + '<span class="pg-name">'+esc(g.name)+'</span>'
      + (g.path ? '<span class="pg-path" title="'+esc(g.path)+'">'+esc(g.path)+'</span>' : '')
      + '<span class="pg-counts"><span class="pg-out '+outCls+'">'+g.out+' out</span><span class="pg-total">'+g.total+'</span></span>'
      + '</div>';
  }

  function renderPackages(){
    var pkgs = getVisible();
    updateBulkBar(pkgs);
    if (!pkgs.length){
      pkgList.innerHTML = '<div class="empty">No packages to show'+(filterPath?' for this project':'')+(searchTerm?' matching “'+esc(searchTerm)+'”':'')+'.</div>';
      return;
    }
    var head = filterPath ? '<div class="filterbar">Filtered to one project · <a href="#" id="clearFilter">Show all projects</a></div>' : '';
    var body;
    if (filterPath){
      body = renderPkgRows(pkgs);
    } else {
      body = groupByProject(pkgs).map(function(g){
        return renderGroupHead(g) + renderPkgRows(g.items);
      }).join('');
    }
    pkgList.innerHTML = head + body;
      if (filterPath){
        var cf = document.getElementById('clearFilter');
        if (cf){ cf.addEventListener('click', function(e){ e.preventDefault(); filterPath = null; projList.querySelectorAll('.proj-chip').forEach(function(x){ var xp=x.dataset.path||null; x.classList.toggle('active', xp===filterPath); x.setAttribute('aria-pressed', xp===filterPath); }); renderPackages(); }); }
      }
    pkgList.querySelectorAll('.pcheck').forEach(function(cb){
      cb.addEventListener('change', function(){
        var cmd = cb.dataset.cmd;
        if (cb.checked) selected.add(cmd); else selected.delete(cmd);
        var row = cb.closest('.pkg'); if (row) row.classList.toggle('sel', cb.checked);
        updateBulkBar(getVisible());
      });
    });
    pkgList.querySelectorAll('[data-copy]').forEach(function(b){
      b.addEventListener('click', function(){
        navigator.clipboard.writeText(b.dataset.copy).then(function(){ b.textContent='Copied'; setTimeout(function(){ b.textContent='Copy'; }, 1200); });
      });
    });
    pkgList.querySelectorAll('[data-update]').forEach(function(b){
      b.addEventListener('click', function(){
        var pkg = findPkg(b.dataset.update);
        runSingleUpdate(b, pkg);
      });
    });
  }

  function updateBulkBar(pkgs){
    if (!bulkBar) return;
    bulkBar.classList.toggle('show', selected.size > 0);
    var selectable = pkgs.filter(function(p){ return p.Cmd; });
    var selVisible = selectable.filter(function(p){ return selected.has(p.Cmd); }).length;
    var totalSel = selected.size;
    selCount.textContent = selVisible + ' selected' + ((totalSel!==selVisible && totalSel>0) ? ' · ' + totalSel + ' unique' : '');
    bulkUpdateBtn.disabled = selVisible === 0;
    var allVis = selectable.length>0 && selVisible===selectable.length;
    var someVis = selVisible>0 && !allVis;
    selectAll.checked = allVis;
    selectAll.indeterminate = someVis;
  }

  function resetSelectionUI(){
    selected.clear();
    pkgList.querySelectorAll('.pcheck').forEach(function(cb){ cb.checked = false; });
    pkgList.querySelectorAll('.pkg').forEach(function(row){ row.classList.remove('sel'); });
    updateBulkBar(getVisible());
  }

  function findPkg(cmd){
    for (var i=0;i<allPkgs.length;i++){ if ((allPkgs[i].Cmd||'') === cmd) return allPkgs[i]; }
    return null;
  }

  var STAGE_LABEL = { queued:'Queued', starting:'Starting', downloading:'Downloading', installing:'Installing', done:'Done', failed:'Failed' };
  function setStageText(el, stage){
    if (!el) return;
    el.className = 'stage ' + stage;
    el.textContent = STAGE_LABEL[stage] || stage;
  }

  function findUpdatePanel(cmd){
    var els = pkgList.querySelectorAll('.pkg-update');
    for (var i=0;i<els.length;i++){ if (els[i].dataset.cmd === cmd) return els[i]; }
    return null;
  }

  function appendPanelLog(panel, text, isErr){
    if (!panel) return;
    var logEl = panel.querySelector('.plog');
    if (!logEl) return;
    var d = document.createElement('div');
    if (isErr) d.className = 'err';
    d.textContent = text;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.childNodes.length > 60) logEl.removeChild(logEl.firstChild);
  }

  function setPanelStage(panel, stage){ setStageText(panel && panel.querySelector('.stage'), stage); }

  function setPanelBar(panel, cls){
    var el = panel && panel.querySelector('.pbar');
    if (el) el.className = 'pbar ' + cls;
  }

  // Context for compatibility: how this package's update relates to its siblings
  // in the same project (shared Path). Used to warn about breaking (major) changes.
  function projectContext(pkg){
    var path = (pkg && pkg.Path) || null;
    var siblings = path ? allPkgs.filter(function(p){ return (p.Path||null) === path; }) : [pkg];
    var proj = null;
    for (var i=0;i<allProjects.length;i++){ if (allProjects[i].path === path) { proj = allProjects[i]; break; } }
    var name = proj ? proj.name : (path ? path : 'this package');
    var majors = siblings.filter(function(p){ return (p.Compat||'').toLowerCase()==='major'; }).length;
    var out = siblings.filter(function(p){ return (p.Status||'').toLowerCase()==='outdated'; }).length;
    return { name:name, total:siblings.length, outdated:out, majors:majors, compat:(pkg && pkg.Compat)||'' };
  }

  // Generic SSE reader: parses `event:` / `data:` frames and invokes onEvent.
  async function readSse(res, onEvent){
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    while (true){
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, {stream:true});
      var parts = buf.split('\n\n'); buf = parts.pop();
      for (var i=0;i<parts.length;i++){
        var em = parts[i].match(/^event:\s*(\S+)/m);
        var dm = parts[i].match(/^data:\s*(.+)$/m);
        if (em && dm){ try { onEvent(em[1], JSON.parse(dm[1])); } catch(e){} }
      }
    }
  }

  function showBanner(type, msg){
    if (!banner) return;
    banner.className = 'banner show ' + type;
    banner.textContent = msg;
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(function(){ banner.classList.remove('show'); }, 6000);
  }

  // Stream a single-package update with a live progress panel: queued → starting →
  // downloading/installing → done/failed, plus a compatibility verdict vs. siblings.
  function runSingleUpdate(btn){
    var cmd = btn.dataset.update;
    var pkg = findPkg(cmd) || {};
    var row = btn.closest('.pkg');
    var panel = findUpdatePanel(cmd);
    var stageEl = panel ? panel.querySelector('.stage') : null;
    var compatEl = panel ? panel.querySelector('.pu-compat') : null;
    var barEl = panel ? panel.querySelector('.pbar') : null;
    var logEl = panel ? panel.querySelector('.plog') : null;

    function setStage(s){ setStageText(stageEl, s); }
    function log(text, isErr){
      if (!logEl) return;
      var d = document.createElement('div');
      if (isErr) d.className = 'err';
      d.textContent = text;
      logEl.appendChild(d);
      logEl.scrollTop = logEl.scrollHeight;
      while (logEl.childNodes.length > 60) logEl.removeChild(logEl.firstChild);
    }

    var ctx = projectContext(pkg);
    if (panel) panel.classList.add('show');
    if (compatEl){
      var level = (ctx.compat||'').toLowerCase();
      var cls = level==='major' ? 'bad' : (level==='minor' ? 'warn' : (level==='patch' ? 'ok' : ''));
      var verdict = level==='major' ? '⚠ Major — breaking change'
        : level==='minor' ? 'Minor — new features, compatible'
        : level==='patch' ? 'Patch — bug fixes only'
        : 'Compatibility unknown';
      compatEl.className = 'pu-compat ' + cls;
      compatEl.innerHTML = verdict + '<span class="cu">· '+esc(ctx.name)+': '+ctx.total+' pkgs, '+ctx.outdated+' outdated'+(ctx.majors?(', '+ctx.majors+' major'):'')+'</span>';
    }
    setStage('starting');
    if (barEl) barEl.className = 'pbar indet';
    row.classList.add('in-progress');
    btn.disabled = true; btn.textContent = 'Updating';

    var firstOut = true;
    fetch('/api/update', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cmd:cmd, name:btn.dataset.name, method:'manual'})})
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return readSse(res, function(ev, data){
          if (ev === 'start'){
            setStage('starting');
            log('▶ ' + (data.name || 'package') + ' — starting update…');
          } else if (ev === 'output'){
            var line = (data.line||'').trim();
            if (!line) return;
            if (firstOut){ firstOut = false; setStage('downloading'); if (barEl) barEl.className='pbar indet'; log('▼ download/install began'); }
            var isErr = /^\[err\]/i.test(line);
            log(line.replace(/^\[err\]\s*/,''), isErr);
            if (/added|reify|installing|building|linking|compiling/i.test(line)) setStage('installing');
          } else if (ev === 'done'){
            if (data.success){
              setStage('done'); if (barEl) barEl.className='pbar done';
              row.classList.remove('in-progress'); row.classList.add('done-ok');
              log('✔ ' + (data.message || 'Updated'));
              markUpdated(cmd, true);
              showBanner('ok', (data.name||'Package') + ' updated successfully.');
            } else {
              setStage('failed'); if (barEl) barEl.className='pbar fail';
              row.classList.remove('in-progress'); row.classList.add('done-fail');
              log('✖ ' + (data.message || 'Failed'), true);
              showBanner('fail', (data.name||'Package') + ' update failed: ' + (data.message||'unknown error'));
            }
          }
        });
      })
      .catch(function(e){
        setStage('failed'); if (barEl) barEl.className='pbar fail';
        row.classList.remove('in-progress'); row.classList.add('done-fail');
        log('✖ ' + e.message, true);
        showBanner('fail', 'Update request failed: ' + e.message);
      })
      .finally(function(){ btn.disabled = false; btn.textContent = 'Update'; });
  }

  function runBulkUpdate(commands){
    bulkUpdateBtn.disabled = true;
    var total = commands.length;
    var doneCount = 0;
    bulkTotalCount = total; bulkDoneCount = 0; bulkFailCount = 0; updateBulkStats();
    if (bulkProgress) bulkProgress.textContent = '0 / ' + total;
    scanStatus.textContent = 'Bulk updating ' + total + ' package(s)…';
    fetch('/api/bulk-update', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({commands:commands})})
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return readSse(res, function(ev, data){
          if (ev === 'bulk_start'){
            total = data.total || total;
            if (bulkProgress) bulkProgress.textContent = '0 / ' + total;
          } else if (ev === 'bulk_progress'){
            var panel = findUpdatePanel(data.cmd);
            var row = findRow(data.cmd);
            if (panel) panel.classList.add('show');
            if (data.stage === 'starting'){
              if (row) row.classList.add('in-progress');
              setPanelStage(panel, 'starting');
              setPanelBar(panel, 'indet');
            } else if (data.line != null && data.line !== ''){
              appendPanelLog(panel, data.line, /^\[err\]/i.test(data.line));
              if (panel){
                var st = panel.querySelector('.stage');
                if (st && st.className.indexOf('starting') >= 0) setPanelStage(panel, 'installing');
                setPanelBar(panel, 'indet');
              }
            } else if (data.stage === 'done'){
              setPanelStage(panel, data.success ? 'done' : 'failed');
              setPanelBar(panel, data.success ? 'done' : 'fail');
              if (row){ row.classList.remove('in-progress'); row.classList.add(data.success ? 'done-ok' : 'done-fail'); }
              markUpdated(data.cmd, data.success);
              doneCount++;
              if (data.success) bulkDoneCount++; else bulkFailCount++;
              updateBulkStats();
              if (bulkProgress) bulkProgress.textContent = doneCount + ' / ' + total;
              scanStatus.textContent = 'Bulk updating — ' + doneCount + ' / ' + total + (data.name ? ' · ' + data.name : '');
            }
          } else if (ev === 'bulk_done'){
            bulkTotalCount = total; bulkDoneCount = data.success || 0; bulkFailCount = data.failed || 0; updateBulkStats();
            resetSelectionUI();
            scanStatus.textContent = 'Bulk update finished: ' + data.success + ' ok, ' + data.failed + ' failed. Click Refresh for current versions.';
            if (data.failed > 0) showBanner('warn', 'Bulk update complete — ' + data.success + ' ok, ' + data.failed + ' failed. Refresh to see new versions.');
            else showBanner('ok', 'Bulk update complete — ' + data.success + ' package(s) updated.');
            if (bulkProgress) bulkProgress.textContent = (data.success + data.failed) + ' / ' + total;
          }
        });
      })
      .catch(function(e){
        scanStatus.textContent = 'Bulk update failed: ' + e.message;
        showBanner('fail', 'Bulk update failed: ' + e.message);
      })
      .finally(function(){ bulkUpdateBtn.disabled = false; });
  }

  function applyData(d){
    scanStatus.textContent = 'Last scan: ' + (d.timestamp || 'never');
    renderSummary(d.summary);
    allPkgs = d.packages || [];
    allProjects = d.projects || [];
    projByPath = {};
    allProjects.forEach(function(p){ if (p.path) projByPath[p.path] = p; });
    filterPath = null;
    selected.clear();
    sortMode = 'default';
    statusFilter = 'all';
    searchTerm = '';
    if (sortSel) sortSel.value = 'default';
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.chip').forEach(function(c){ c.classList.toggle('active', c.dataset.status === 'all'); });
    updateChips();
    renderProjects(d.projects || []);
    renderPackages();
  }

  function loadUpdates(){
    fetch('/api/updates').then(function(r){ return r.json(); }).then(applyData).catch(function(){
      pkgList.innerHTML = '<div class="empty">No saved update data. Click <b>Refresh</b> to generate it.</div>';
    });
  }

  function runScan(){
    scanBtn.disabled = true;
    if (scanSpinner) scanSpinner.hidden = false;
    scanStatus.textContent = 'Scanning…';
    pkgList.innerHTML = '<div class="empty">Refreshing update data…</div>';
    fetch('/api/refresh').then(function(r){ return r.json(); }).then(function(d){
      applyData(d);
      var s = d.summary || {};
      showBanner('ok', 'Scan complete — ' + (s.outdated||0) + ' outdated, ' + (s.current||0) + ' up to date across ' + (s.projects||0) + ' projects.');
    }).catch(function(e){
      scanStatus.textContent = 'Scan failed: ' + e.message;
      pkgList.innerHTML = '<div class="empty">Could not reach the update API. Is the dashboard server running?</div>';
      showBanner('fail', 'Scan failed: ' + e.message);
    }).finally(function(){ scanBtn.disabled = false; if (scanSpinner) scanSpinner.hidden = true; });
  }

  if (selectAll) selectAll.addEventListener('change', function(){
    var pkgs = getVisible();
    if (selectAll.checked) pkgs.forEach(function(p){ if (p.Cmd) selected.add(p.Cmd); });
    else pkgs.forEach(function(p){ selected.delete(p.Cmd||''); });
    renderPackages();
  });
  if (sortSel) sortSel.addEventListener('change', function(){ sortMode = sortSel.value; renderPackages(); });
  if (searchInput) searchInput.addEventListener('input', function(){ searchTerm = searchInput.value.trim(); renderPackages(); });
  document.querySelectorAll('.chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      statusFilter = chip.dataset.status;
      document.querySelectorAll('.chip').forEach(function(c){ c.classList.toggle('active', c === chip); });
      renderPackages();
    });
  });
  if (bulkUpdateBtn) bulkUpdateBtn.addEventListener('click', function(){
    var seen = {};
    var cmds = [];
    getVisible().forEach(function(p){
      if (p.Cmd && selected.has(p.Cmd) && !seen[p.Cmd]) { seen[p.Cmd] = true; cmds.push({name:p.Name, cmd:p.Cmd}); }
    });
    if (!cmds.length) return;
    runBulkUpdate(cmds);
  });
  if (clearSelBtn) clearSelBtn.addEventListener('click', resetSelectionUI);
  pkgList.addEventListener('click', function(e){
    var t = e.target.closest('.pu-toggle');
    if (!t) return;
    var panel = findUpdatePanel(t.dataset.cmd);
    if (!panel) return;
    var collapsed = panel.classList.toggle('collapsed');
    t.textContent = collapsed ? '+' : '–';
    t.setAttribute('aria-label', collapsed ? 'Expand log' : 'Collapse log');
  });

  scanBtn.addEventListener('click', runScan);
  loadUpdates();

  // ---- Mermaid (loaded on demand; offline-safe fallback) ----
  var mermaidDone = false;
  function renderMermaid(){
    if (mermaidDone) return;
    mermaidDone = true;
    var diagram = document.getElementById('diagram');
    var fallback = document.getElementById('fallback');
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
      .then(function(mod){
        var mermaid = mod.default;
        mermaid.initialize({ startOnLoad:false, theme:'dark', securityLevel:'loose' });
        return mermaid.run({ nodes:[diagram] });
      })
      .then(function(){ fallback.style.display='none'; })
      .catch(function(){ diagram.style.display='none'; fallback.style.display='block'; });
  }
