(function () {
  var KEY = 'fsrs.complaints', SESSION = 'fsrs.session';
  var root = document.getElementById('root'), flash = '';
  var PAGES = [['home', 'Home'], ['dashboard', 'Dashboard'], ['complaints', 'Complaints'], ['requests', 'Service Requests'], ['reports', 'Reports'], ['admin', 'Admin']];
  var ICON = { home: 'M3 11l9-8 9 8M5 10v11h5v-6h4v6h5V10', dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 14h8v7H3z', complaints: 'M4 4h16v12H9l-5 4z', requests: 'M4 6h16M4 12h16M4 18h9', reports: 'M5 20V11M12 20V4M19 20v-6', admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function read(st, k, f) { try { var v = st.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
  function write(st, k, v) { try { st.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('Storage unavailable', e); } }
  var complaints = read(window.localStorage, KEY, []), user = read(window.sessionStorage, SESSION, null);

  function ico(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[n] + '"/></svg>'; }
  function allowed() { return PAGES.filter(function (p) { return user.role === 'admin' || ['reports', 'admin'].indexOf(p[0]) < 0; }); }
  function current() { var h = (location.hash || '#home').slice(1); return allowed().some(function (p) { return p[0] === h; }) ? h : 'home'; }
  function sc(s) { return s === 'Resolved' ? 'done' : s === 'In Progress' ? 'prog' : 'new'; }
  function badge(s) { return '<span class="badge ' + sc(s) + '">' + esc(s) + '</span>'; }
  function fdate(i) { return new Date(i).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function who(id) { var u = Store.USERS.filter(function (x) { return x.id === id; })[0]; return u ? u.name : 'Unknown'; }
  function vis() { return Store.visibleComplaints(complaints, user); }
  function isAdmin() { return user.role === 'admin'; }

  function tbl(list, showWho) {
    if (!list.length) return '<div class="empty">No complaints yet. ' + (isAdmin() ? '' : '<a href="#complaints">Report a problem</a>') + '</div>';
    return '<table><thead><tr><th>ID</th><th>Title</th>' + (showWho ? '<th>Reporter</th>' : '') + '<th>Date</th><th>Status</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.title) + '</td>' + (showWho ? '<td>' + esc(who(c.reporterId)) + '</td>' : '') + '<td>' + fdate(c.createdAt) + '</td><td>' + badge(c.status) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  var VIEWS = {
    home: function () {
      var l = vis(), s = Store.summarize(l), first = user.name.split(' ')[0];
      return '<div class="bento"><section class="card hero span-8"><h2>Hello, ' + esc(first) + '.</h2><p>' +
        (isAdmin() ? 'Every facility complaint, in one place.' : 'Report a facility problem and follow it until it is fixed.') + '</p><div class="row"><a class="btn" href="#complaints">' +
        (isAdmin() ? 'View complaints' : 'Report a problem') + '</a><a class="btn ghost" href="#dashboard">Open dashboard</a></div></section>' +
        '<section class="card alert span-4"><p class="label">Still unresolved</p><strong class="num">' + s.unresolved + '</strong><p class="muted">out of ' + s.total + ' complaints</p></section>' +
        '<section class="card span-4"><p class="label">How it works</p><ol class="steps"><li>Submit a complaint with its location</li><li>Staff review and assign it</li><li>Follow the status until resolved</li></ol></section>' +
        '<section class="card span-8"><p class="label">Latest complaints</p>' + tbl(l.slice(0, 4), isAdmin()) + '</section></div>';
    },
    dashboard: function () {
      var l = vis(), s = Store.summarize(l);
      var max = Math.max.apply(null, Store.CATEGORIES.map(function (c) { return s.byCategory[c]; }).concat(1));
      var bars = Store.CATEGORIES.map(function (c) { var n = s.byCategory[c]; return '<div class="bar"><span>' + esc(c) + '</span><i><b style="width:' + (n / max * 100) + '%"></b></i><em>' + n + '</em></div>'; }).join('');
      var tri = Store.STATUSES.map(function (n) { return '<div><b>' + s.byStatus[n] + '</b>' + badge(n) + '</div>'; }).join('');
      var feed = l.slice(0, 4).map(function (c) { return '<li><span>' + esc(c.title) + '</span>' + badge(c.status) + '</li>'; }).join('');
      return '<div class="bento"><section class="card span-4"><p class="label">Total complaints</p><strong class="num xl">' + s.total + '</strong><p class="muted">' + s.resolutionRate + '% resolved</p></section>' +
        '<section class="card span-8"><p class="label">By status</p><div class="tri">' + tri + '</div></section>' +
        '<section class="card span-7"><p class="label">By category</p>' + bars + '</section>' +
        '<section class="card span-5"><p class="label">Recent</p>' + (feed ? '<ul class="feed">' + feed + '</ul>' : '<div class="empty">Nothing reported yet.</div>') + '</section></div>';
    },
    complaints: function (ctx) {
      var e = ctx.errors || {}, v = ctx.values || {}, form = '';
      if (!isAdmin()) {
        var opts = Store.CATEGORIES.map(function (c) { return '<option' + (v.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
        function er(k) { return e[k] ? '<small class="err">' + esc(e[k]) + '</small>' : ''; }
        form = '<section class="card span-5"><h2>Report a problem</h2><p class="muted">Tell us what is broken and where.</p>' + (flash ? '<p class="ok" role="status">' + esc(flash) + '</p>' : '') +
          '<form id="f-complaint" novalidate><label>Category<select name="category"><option value="">Select a category</option>' + opts + '</select>' + er('category') + '</label>' +
          '<label>Location<input name="location" placeholder="e.g. Building B, Room 204" value="' + esc(v.location || '') + '">' + er('location') + '</label>' +
          '<label>Description<textarea name="description" rows="4">' + esc(v.description || '') + '</textarea>' + er('description') + '</label>' +
          '<button class="btn">Submit complaint</button></form></section>';
      }
      return '<div class="bento">' + form + '<section class="card ' + (form ? 'span-7' : 'span-12') + '"><p class="label">' + (isAdmin() ? 'All complaints' : 'My complaints') + '</p>' + tbl(vis(), isAdmin()) + '</section></div>';
    },
    requests: function () {
      var l = vis();
      if (!l.length) return '<div class="card empty">No service requests yet. <a href="#complaints">Report a problem</a> to start one.</div>';
      return '<div class="bento">' + l.map(function (c) {
        var i = Store.STATUSES.indexOf(c.status);
        return '<section class="card span-6"><div class="top" style="margin:0"><h2 style="font-size:18px">' + esc(c.title) + '</h2>' + badge(c.status) + '</div><p class="muted">' + esc(c.id) + ' &middot; ' + fdate(c.createdAt) + (isAdmin() ? ' &middot; ' + esc(who(c.reporterId)) : '') + '</p><p>' + esc(c.description) + '</p><ul class="track">' +
          Store.STATUSES.map(function (n, k) { return '<li class="' + (k <= i ? 'done' : '') + (k === i ? ' now' : '') + '">' + n + '</li>'; }).join('') + '</ul></section>';
      }).join('') + '</div>';
    },
    reports: function () {
      var s = Store.summarize(vis());
      var seg = Store.STATUSES.map(function (n) { return '<i class="seg ' + sc(n) + '" style="flex:' + s.byStatus[n] + '" title="' + n + '"></i>'; }).join('');
      var rows = Store.CATEGORIES.map(function (c) { return '<tr><td>' + esc(c) + '</td><td>' + s.byCategory[c] + '</td></tr>'; }).join('');
      return '<div class="bento"><section class="card span-4 alert"><p class="label">Unresolved</p><strong class="num">' + s.unresolved + '</strong></section>' +
        '<section class="card span-4"><p class="label">Resolution rate</p><strong class="num">' + s.resolutionRate + '%</strong></section>' +
        '<section class="card span-4"><p class="label">Total received</p><strong class="num">' + s.total + '</strong></section>' +
        '<section class="card span-7"><p class="label">Status distribution</p>' + (s.total ? '<div class="stack">' + seg + '</div>' : '<div class="empty">No data yet.</div>') +
        '<p class="muted">' + Store.STATUSES.map(function (n) { return n + ': ' + s.byStatus[n]; }).join(' / ') + '</p></section>' +
        '<section class="card span-5"><p class="label">Complaints per category</p><table><tbody>' + rows + '</tbody></table></section></div>';
    },
    admin: function () {
      var rows = Store.USERS.map(function (u) { return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td>' + badge(u.role === 'admin' ? 'In Progress' : 'New').replace(/>[^<]*</, '>' + esc(u.role) + '<') + '</td></tr>'; }).join('');
      return '<div class="bento"><section class="card span-7"><p class="label">Users</p><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>' + rows + '</tbody></table></section>' +
        '<section class="card span-5"><p class="label">Categories</p><div class="chips">' + Store.CATEGORIES.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        '</div><p class="muted" style="margin-top:14px">Adding, editing and deactivating categories and technicians arrives in Sprint 3 (US-15).</p><button class="btn ghost" disabled>Manage categories</button></section></div>';
    }
  };

  function loginView(error) {
    return '<div class="auth"><div class="pane"><h1>Facility problems, fixed in the open.</h1><p>Report a problem, follow its progress, and stop asking in chat.</p></div>' +
      '<div class="form"><section class="card"><h2>Log in</h2>' + (error ? '<p class="err" role="alert">' + esc(error) + '</p>' : '') +
      '<form id="f-login"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button class="btn">Log in</button></form>' +
      '<p class="muted" style="margin-top:14px;font-size:13px">Demo: reporter@campus.test / reporter123<br>admin@campus.test / admin123</p></section></div></div>';
  }

  function render(ctx) {
    ctx = ctx || {};
    if (!user) {
      root.innerHTML = loginView(ctx.error);
      document.getElementById('f-login').onsubmit = function (e) {
        e.preventDefault();
        var f = e.target, r = Store.login(f.email.value, f.password.value);
        if (!r.ok) return render({ error: r.error });
        user = r.user; write(window.sessionStorage, SESSION, user); location.hash = '#home'; render();
      };
      return;
    }
    var cur = current(), title = PAGES.filter(function (p) { return p[0] === cur; })[0][1];
    var nav = allowed().map(function (p) { return '<a href="#' + p[0] + '"' + (p[0] === cur ? ' class="on" aria-current="page"' : '') + '>' + ico(p[0]) + '<span>' + p[1] + '</span></a>'; }).join('');
    root.innerHTML = '<div class="shell"><aside class="side"><div class="brand"><b>FSRS</b><small>Campus Facilities</small></div><nav>' + nav + '</nav><div class="me">' + esc(user.name) + '<small>' + esc(user.role) + '</small></div></aside>' +
      '<main class="main"><header class="top"><h1>' + title + '</h1><div class="acts">' + (isAdmin() ? '' : '<a class="btn" href="#complaints">New complaint</a>') + '<button class="btn ghost" id="logout">Log out</button></div></header>' + VIEWS[cur](ctx) + '</main></div>';
    document.getElementById('logout').onclick = function () { user = null; flash = ''; write(window.sessionStorage, SESSION, null); render(); };
    var f = document.getElementById('f-complaint');
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var d = { category: f.category.value, location: f.location.value, description: f.description.value };
      var r = Store.createComplaint(complaints, user, d);
      if (!r.ok) { flash = ''; return render({ errors: r.errors, values: d }); }
      complaints = r.list; write(window.localStorage, KEY, complaints);
      flash = 'Complaint ' + r.complaint.id + ' submitted with status "New".'; render();
    };
  }

  window.addEventListener('hashchange', function () { flash = ''; if (user) render(); });
  render();
})();
