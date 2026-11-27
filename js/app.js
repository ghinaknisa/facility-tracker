(function () {
  'use strict';
  var root = document.getElementById('root');
  var S = { user: null, profile: null, cats: [], profs: [], complaints: [], history: [], atts: [], flash: '', error: '', mode: 'login', email: '', editing: null, errors: {}, values: {}, f: { status: '', priority: '', category: '' } };
  var PAGES = [['home', 'Home'], ['dashboard', 'Dashboard'], ['complaints', 'Complaints'], ['requests', 'Service Requests'], ['reports', 'Reports'], ['admin', 'Admin']];
  var ICON = { home: 'M3 11l9-8 9 8M5 10v11h5v-6h4v6h5V10', dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 14h8v7H3z', complaints: 'M4 4h16v12H9l-5 4z', requests: 'M4 6h16M4 12h16M4 18h9', reports: 'M5 20V11M12 20V4M19 20v-6', admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[n] + '"/></svg>'; }
  function role() { return S.profile ? S.profile.role : ''; }
  function allowed() { return PAGES.filter(function (p) { return role() === 'admin' || ['reports', 'admin'].indexOf(p[0]) < 0; }); }
  function current() { var h = (location.hash || '#home').slice(1); return allowed().some(function (p) { return p[0] === h; }) ? h : 'home'; }
  function sc(s) { return s === 'Resolved' ? 'done' : s === 'In Progress' ? 'prog' : 'new'; }
  function badge(s) { return '<span class="badge ' + sc(s) + '">' + esc(s) + '</span>'; }
  function who(id) { var p = S.profs.filter(function (x) { return x.user_id === id; })[0]; return p ? p.full_name : ''; }
  function opts(list, sel, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (o) {
      var v = o.v !== undefined ? o.v : o, t = o.t !== undefined ? o.t : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
  }
  function decorate(c) {
    var cat = S.cats.filter(function (x) { return x.category_id === c.category_id; })[0];
    return Object.assign({}, c, { catName: cat ? cat.name : 'Other', title: (cat ? cat.name : 'Complaint') + ' - ' + c.location, reporterName: who(c.reporter_id) || 'Reporter', assigneeName: who(c.assigned_to) });
  }
  // RLS already limits rows per role; this filter is a second safety net.
  function visible() {
    var uid = S.user.id, l = S.complaints;
    if (role() === 'reporter') l = l.filter(function (c) { return c.reporter_id === uid; });
    if (role() === 'technician') l = l.filter(function (c) { return c.assigned_to === uid; });
    return l.map(decorate);
  }
  function technicians() { return S.profs.filter(function (p) { return p.role === 'technician' && p.is_active; }); }

  async function load() {
    var r = await Promise.all([Api.categories(), Api.profiles(), Api.complaints(), Api.history(), Api.attachments()]);
    S.cats = r[0]; S.profs = r[1]; S.complaints = r[2]; S.history = r[3]; S.atts = r[4];
  }
  async function mutate(fn, msg) {
    S.error = ''; S.flash = '';
    try { await fn(); await load(); if (msg) S.flash = msg; } catch (e) { S.error = e.message; }
    render();
  }

  /* ---------- tables ---------- */
  function tblReporter(l) {
    if (!l.length) return '<div class="empty">No complaints yet.</div>';
    return '<table><thead><tr><th>ID</th><th>Title</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>' + l.map(function (c) {
      var a = Store.canEditOwn(c, S.user.id) ? '<div class="actions"><button class="btn ghost sm" data-act="edit" data-id="' + c.complaint_id + '">Edit</button><button class="btn ghost sm" data-act="cancel" data-id="' + c.complaint_id + '">Cancel</button></div>' : '';
      return '<tr><td class="nw">' + esc(c.ticket_code) + '</td><td>' + esc(c.title) + '</td><td class="nw">' + Store.fmtDate(c.created_at) + '</td><td>' + badge(c.status) + '</td><td>' + a + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function tblTech(l) {
    if (!l.length) return '<div class="empty">No complaints are assigned to you yet.</div>';
    return '<table><thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Status</th></tr></thead><tbody>' + l.map(function (c) {
      return '<tr><td class="nw">' + esc(c.ticket_code) + '</td><td>' + esc(c.title) + '</td><td>' + esc(c.priority || '-') + '</td><td><select class="sel" data-act="status" data-id="' + c.complaint_id + '">' + opts(Store.allowedStatuses('technician', c.status), c.status) + '</select></td></tr>';
    }).join('') + '</tbody></table>';
  }
  function tblAdmin(l) {
    l = Store.filterComplaints(l, S.f);
    var techs = technicians().map(function (t) { return { v: t.user_id, t: t.full_name }; });
    var fl = '<div class="filters"><select class="sel" data-filter="status">' + opts(Store.STATUSES, S.f.status, 'All statuses') + '</select><select class="sel" data-filter="priority">' + opts(Store.PRIORITIES.concat([{ v: 'none', t: 'Not set' }]), S.f.priority, 'All priorities') + '</select><select class="sel" data-filter="category">' + opts(S.cats.map(function (c) { return { v: c.category_id, t: c.name }; }), S.f.category, 'All categories') + '</select></div>';
    if (!l.length) return fl + '<div class="empty">No complaints match.</div>';
    return fl + '<table><thead><tr><th>ID</th><th>Title</th><th>Reporter</th><th>Date</th><th>Priority</th><th>Assigned to</th><th>Status</th><th></th></tr></thead><tbody>' + l.map(function (c) {
      var id = ' data-id="' + c.complaint_id + '"';
      return '<tr><td class="nw">' + esc(c.ticket_code) + '</td><td>' + esc(c.title) + '</td><td>' + esc(c.reporterName) + '</td><td class="nw">' + Store.fmtDate(c.created_at) + '</td>' +
        '<td><select class="sel" data-act="priority"' + id + '>' + opts(Store.PRIORITIES, c.priority, 'Not set') + '</select></td>' +
        '<td><select class="sel" data-act="assign"' + id + '>' + opts(techs, c.assigned_to, 'Unassigned') + '</select></td>' +
        '<td><select class="sel" data-act="status"' + id + '>' + opts(Store.STATUSES, c.status) + '</select></td>' +
        '<td><button class="btn ghost sm" data-act="delete"' + id + '>Delete</button></td></tr>';
    }).join('') + '</tbody></table>';
  }

  /* ---------- views ---------- */
  var VIEWS = {
    home: function () {
      var l = visible(), s = Store.summarize(l), first = S.profile.full_name.split(' ')[0], r = role();
      var msg = r === 'admin' ? 'Every facility complaint, in one place.' : r === 'technician' ? 'Your assigned work, with priorities.' : 'Report a facility problem and follow it until it is fixed.';
      return '<div class="bento"><section class="card hero span-8"><h2>Hello, ' + esc(first) + '.</h2><p>' + msg + '</p><div class="row"><a class="btn" href="#complaints">' + (r === 'reporter' ? 'Report a problem' : 'Open complaints') + '</a><a class="btn ghost" href="#dashboard">Open dashboard</a></div></section>' +
        '<section class="card alert span-4"><p class="label">Still unresolved</p><strong class="num">' + s.unresolved + '</strong><p class="muted">out of ' + s.total + ' complaints</p></section>' +
        '<section class="card span-4"><p class="label">How it works</p><ol class="steps"><li>Submit a complaint with its location</li><li>Admin prioritizes and assigns a technician</li><li>Follow the status until resolved</li></ol></section>' +
        '<section class="card span-8"><p class="label">Latest complaints</p>' + (l.length ? '<ul class="feed">' + l.slice(0, 4).map(function (c) { return '<li><span>' + esc(c.title) + '</span>' + badge(c.status) + '</li>'; }).join('') + '</ul>' : '<div class="empty">Nothing here yet.</div>') + '</section></div>';
    },
    dashboard: function () {
      var l = visible(), s = Store.summarize(l);
      var counts = S.cats.filter(function (c) { return c.is_active || s.byCategory[c.name]; }).map(function (c) { return [c.name, s.byCategory[c.name] || 0]; });
      var max = Math.max.apply(null, counts.map(function (x) { return x[1]; }).concat(1));
      var bars = counts.map(function (x) { return '<div class="bar"><span>' + esc(x[0]) + '</span><i><b style="width:' + (x[1] / max * 100) + '%"></b></i><em>' + x[1] + '</em></div>'; }).join('');
      var tri = Store.STATUSES.map(function (n) { return '<div><b>' + s.byStatus[n] + '</b>' + badge(n) + '</div>'; }).join('');
      var feed = l.slice(0, 4).map(function (c) { return '<li><span>' + esc(c.title) + '</span>' + badge(c.status) + '</li>'; }).join('');
      return '<div class="bento"><section class="card span-4"><p class="label">Total complaints</p><strong class="num xl">' + s.total + '</strong><p class="muted">' + s.resolutionRate + '% resolved</p></section>' +
        '<section class="card span-8"><p class="label">By status</p><div class="tri">' + tri + '</div></section>' +
        '<section class="card span-7"><p class="label">By category</p>' + bars + '</section>' +
        '<section class="card span-5"><p class="label">Recent</p>' + (feed ? '<ul class="feed">' + feed + '</ul>' : '<div class="empty">Nothing reported yet.</div>') + '</section></div>';
    },
    complaints: function () {
      var r = role(), l = visible(), e = S.errors, v = S.values, form = '', title = 'My complaints', table;
      if (r === 'reporter') {
        var ed = S.editing ? l.filter(function (c) { return c.complaint_id === S.editing; })[0] : null;
        if (ed && !v.location && !v.description) v = { category_id: ed.category_id, location: ed.location, description: ed.description };
        var er = function (k) { return e[k] ? '<small class="err">' + esc(e[k]) + '</small>' : ''; };
        var cats = S.cats.filter(function (c) { return c.is_active || (ed && c.category_id === ed.category_id); }).map(function (c) { return { v: c.category_id, t: c.name }; });
        form = '<section class="card span-5"><h2>' + (ed ? 'Edit complaint ' + esc(ed.ticket_code) : 'Report a problem') + '</h2><p class="muted">Tell us what is broken and where.</p>' +
          '<form id="f-complaint" novalidate><label>Category<select name="category">' + opts(cats, v.category_id, 'Select a category') + '</select>' + er('category') + '</label>' +
          '<label>Location<input name="location" placeholder="e.g. Building B, Room 204" value="' + esc(v.location || '') + '">' + er('location') + '</label>' +
          '<label>Description<textarea name="description" rows="4">' + esc(v.description || '') + '</textarea>' + er('description') + '</label>' +
          (ed ? '' : '<label>Photo (optional, JPG or PNG, max 2 MB)<input name="photo" type="file" accept="image/jpeg,image/png">' + er('photo') + '</label>') +
          '<div class="actions"><button class="btn">' + (ed ? 'Save changes' : 'Submit complaint') + '</button>' + (ed ? '<button type="button" class="btn ghost" data-act="edit-cancel">Discard</button>' : '') + '</div></form></section>';
        table = tblReporter(l);
      } else if (r === 'technician') { title = 'Assigned to me'; table = tblTech(l); }
      else { title = 'All complaints'; table = tblAdmin(l); }
      return '<div class="bento">' + form + '<section class="card ' + (form ? 'span-7' : 'span-12') + '"><p class="label">' + title + '</p>' + table + '</section></div>';
    },
    requests: function () {
      var l = visible();
      if (!l.length) return '<div class="card empty">No service requests yet.</div>';
      return '<div class="bento">' + l.map(function (c) {
        var i = Store.STATUSES.indexOf(c.status);
        var hist = S.history.filter(function (h) { return h.complaint_id === c.complaint_id; }).map(function (h) {
          return '<li>' + (h.old_status ? 'Status changed from ' + esc(h.old_status) + ' to ' + esc(h.new_status) : 'Submitted as ' + esc(h.new_status)) + ' by ' + esc(who(h.changed_by) || 'a user') + ', ' + Store.fmtDate(h.changed_at) + '</li>';
        }).join('');
        var ph = S.atts.filter(function (a) { return a.complaint_id === c.complaint_id; }).map(function (a) { return '<a href="#" class="photo" data-act="photo" data-path="' + esc(a.file_path) + '">' + esc(a.file_name) + '</a>'; }).join(' ');
        return '<section class="card span-6"><div class="top" style="margin:0"><h2 style="font-size:18px">' + esc(c.title) + '</h2>' + badge(c.status) + '</div>' +
          '<p class="meta">' + esc(c.ticket_code) + ' &middot; ' + Store.fmtDate(c.created_at) + (role() !== 'reporter' ? ' &middot; ' + esc(c.reporterName) : '') + ' &middot; Priority: ' + esc(c.priority || 'not set') + ' &middot; ' + (c.assigneeName ? 'Assigned to ' + esc(c.assigneeName) : 'Not assigned yet') + '</p>' +
          '<p>' + esc(c.description) + '</p>' + (ph ? '<p>Photo: ' + ph + '</p>' : '') +
          '<ul class="track">' + Store.STATUSES.map(function (n, k) { return '<li class="' + (k <= i ? 'done' : '') + (k === i ? ' now' : '') + '">' + n + '</li>'; }).join('') + '</ul>' +
          '<ul class="tl">' + hist + '</ul></section>';
      }).join('') + '</div>';
    },
    reports: function () {
      var s = Store.summarize(visible());
      var seg = Store.STATUSES.map(function (n) { return '<i class="seg ' + sc(n) + '" style="flex:' + s.byStatus[n] + '" title="' + n + '"></i>'; }).join('');
      var rows = function (o) { return Object.keys(o).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + o[k] + '</td></tr>'; }).join(''); };
      return '<div class="bento"><section class="card span-4 alert"><p class="label">Unresolved</p><strong class="num">' + s.unresolved + '</strong></section>' +
        '<section class="card span-4"><p class="label">Resolution rate</p><strong class="num">' + s.resolutionRate + '%</strong></section>' +
        '<section class="card span-4"><p class="label">Total received</p><strong class="num">' + s.total + '</strong></section>' +
        '<section class="card span-6"><p class="label">Status distribution</p>' + (s.total ? '<div class="stack">' + seg + '</div>' : '<div class="empty">No data yet.</div>') + '<p class="muted">' + Store.STATUSES.map(function (n) { return n + ': ' + s.byStatus[n]; }).join(' / ') + '</p><p class="label" style="margin-top:14px">By priority</p><table><tbody>' + rows(s.byPriority) + '</tbody></table></section>' +
        '<section class="card span-6"><p class="label">Complaints per category</p><table><tbody>' + rows(s.byCategory) + '</tbody></table></section></div>';
    },
    admin: function () {
      var cats = S.cats.map(function (c) {
        return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.description || '') + '</td><td><span class="chip">' + (c.is_active ? 'Active' : 'Inactive') + '</span></td><td><div class="actions"><button class="btn ghost sm" data-act="cat-rename" data-id="' + c.category_id + '">Rename</button><button class="btn ghost sm" data-act="cat-toggle" data-id="' + c.category_id + '" data-on="' + c.is_active + '">' + (c.is_active ? 'Deactivate' : 'Activate') + '</button></div></td></tr>';
      }).join('');
      var users = S.profs.map(function (p) {
        var me = p.user_id === S.user.id;
        return '<tr><td>' + esc(p.full_name) + '</td><td>' + esc(p.email) + '</td><td><select class="sel" data-act="user-role" data-id="' + p.user_id + '"' + (me ? ' disabled' : '') + '>' + opts(Store.ROLES, p.role) + '</select></td><td><button class="btn ghost sm" data-act="user-active" data-id="' + p.user_id + '" data-on="' + p.is_active + '"' + (me ? ' disabled' : '') + '>' + (p.is_active ? 'Deactivate' : 'Activate') + '</button></td></tr>';
      }).join('');
      return '<div class="bento"><section class="card span-12"><p class="label">Categories</p><form id="f-cat" class="filters"><input name="name" placeholder="New category name" style="width:220px;margin:0" required><input name="description" placeholder="Description (optional)" style="width:280px;margin:0"><button class="btn sm">Add category</button></form>' +
        '<table><thead><tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead><tbody>' + cats + '</tbody></table></section>' +
        '<section class="card span-12"><p class="label">Users</p><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>' + users + '</tbody></table><p class="muted" style="margin-top:10px">New accounts start as reporters. Promote someone to technician or admin here.</p></section></div>';
    }
  };

  function banner() { return (S.flash ? '<p class="ok" role="status">' + esc(S.flash) + '</p>' : '') + (S.error ? '<p class="banner err" role="alert">' + esc(S.error) + '</p>' : ''); }
  function authView() {
    var m = S.mode, e = S.errors, er = function (k) { return e[k] ? '<small class="err">' + esc(e[k]) + '</small>' : ''; };
    var alt = function (mode, label) { return '<div class="or"><span>or</span></div><button type="button" class="btn ghost block" data-act="mode" data-mode="' + mode + '">' + label + '</button>'; };
    var title, body;
    if (m === 'register') {
      title = 'Create account';
      body = '<form id="f-signup" novalidate><label>Full name<input name="full_name" autocomplete="name">' + er('full_name') + '</label><label>Email<input name="email" type="email" autocomplete="email">' + er('email') + '</label><label>Password<input name="password" type="password" autocomplete="new-password">' + er('password') + '</label><button class="btn block">Create account</button></form>' + alt('login', 'Back to log in');
    } else if (m === 'forgot') {
      title = 'Forgot password';
      body = '<p class="muted">Enter your email and we will send you a link to set a new password.</p><form id="f-forgot" novalidate><label>Email<input name="email" type="email" autocomplete="email" value="' + esc(S.email) + '">' + er('email') + '</label><button class="btn block">Send reset link</button></form>' + alt('login', 'Back to log in');
    } else if (m === 'recovery') {
      title = 'Set a new password';
      body = '<form id="f-recovery" novalidate><label>New password<input name="password" type="password" autocomplete="new-password">' + er('password') + '</label><label>Confirm new password<input name="confirm" type="password" autocomplete="new-password">' + er('confirm') + '</label><button class="btn block">Update password</button></form>';
    } else {
      title = 'Log in';
      body = '<form id="f-login"><label>Email<input name="email" type="email" required autocomplete="email" value="' + esc(S.email) + '"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><div class="forgot"><button type="button" class="linkish" data-act="mode" data-mode="forgot">Forgot password?</button></div><button class="btn block">Log in</button></form>' + alt('register', 'Create account');
    }
    return '<div class="auth"><div class="pane"><h1>Facility problems, fixed in the open.</h1><p>Report a problem, follow its progress, and stop asking in chat.</p></div><div class="form"><section class="card"><h2 style="margin-bottom:14px">' + title + '</h2>' + banner() + body + '</section></div></div>';
  }
  function setupView() {
    return '<div class="auth"><div class="pane"><h1>Almost ready.</h1><p>Connect the app to your Supabase project.</p></div><div class="form"><section class="card"><h2>Supabase is not configured</h2><ol class="steps"><li>Create a free project at supabase.com</li><li>Run <b>supabase/schema.sql</b> in the SQL Editor</li><li>Put your Project URL and anon key in <b>js/config.js</b></li></ol></section></div></div>';
  }

  function render() {
    if (!S.user || !S.profile) { root.innerHTML = authView(); return; }
    var cur = current(), title = PAGES.filter(function (p) { return p[0] === cur; })[0][1];
    var nav = allowed().map(function (p) { return '<a href="#' + p[0] + '"' + (p[0] === cur ? ' class="on" aria-current="page"' : '') + '>' + ico(p[0]) + '<span>' + p[1] + '</span></a>'; }).join('');
    root.innerHTML = '<div class="shell"><aside class="side"><div class="brand"><b>FSRS</b><small>Campus Facilities</small></div><nav>' + nav + '</nav><div class="me">' + esc(S.profile.full_name) + '<small>' + esc(role()) + '</small></div></aside>' +
      '<main class="main"><header class="top"><h1>' + title + '</h1><div class="acts">' + (role() === 'reporter' ? '<a class="btn" href="#complaints">New complaint</a>' : '') + '<button class="btn ghost" data-act="logout">Log out</button></div></header>' + banner() + VIEWS[cur]() + '</main></div>';
  }

  /* ---------- events ---------- */
  async function start(user) {
    S.user = user;
    try { S.profile = await Api.profile(user.id); } catch (e) { S.profile = null; }
    if (!S.profile || !S.profile.is_active) { S.error = 'This account is not active. Contact the facilities admin.'; await Api.signOut(); S.user = null; S.profile = null; return render(); }
    try { await load(); } catch (e) { S.error = e.message; }
    render();
  }
  root.addEventListener('submit', async function (e) {
    e.preventDefault(); var f = e.target; S.error = ''; S.errors = {};
    try {
      if (f.id === 'f-login') { var r = await Api.signIn(f.email.value.trim(), f.password.value); location.hash = '#home'; return start(r.user); }
      if (f.id === 'f-signup') {
        var d = { full_name: f.full_name.value, email: f.email.value, password: f.password.value }; S.errors = Store.validateSignup(d);
        if (Object.keys(S.errors).length) return render();
        var s = await Api.signUp(d.full_name.trim(), d.email.trim(), d.password);
        if (s.session) await Api.signOut();
        S.mode = 'login'; S.email = d.email.trim();
        S.flash = s.session ? 'Account created. Please log in with your new account.' : 'Account created. Check your email to confirm it, then log in.';
        return render();
      }
      if (f.id === 'f-forgot') {
        var em = f.email.value.trim(); S.email = em;
        if (!Store.validateEmail(em)) { S.errors = { email: 'Enter a valid email.' }; return render(); }
        await Api.resetPassword(em); S.mode = 'login';
        S.flash = 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.'; return render();
      }
      if (f.id === 'f-recovery') {
        S.errors = Store.validateNewPassword(f.password.value, f.confirm.value);
        if (Object.keys(S.errors).length) return render();
        await Api.updatePassword(f.password.value); await Api.signOut(); S.mode = 'login';
        S.flash = 'Password updated. Please log in with your new password.'; return render();
      }
      if (f.id === 'f-complaint') {
        var v = { category_id: f.category.value ? Number(f.category.value) : null, location: f.location.value, description: f.description.value };
        S.errors = Store.validateComplaint(v); var file = f.photo ? f.photo.files[0] : null, pv = Store.validatePhoto(file);
        if (!pv.ok) S.errors.photo = pv.error;
        if (Object.keys(S.errors).length) { S.values = v; S.flash = ''; return render(); }
        var base = { category_id: v.category_id, location: v.location.trim(), description: v.description.trim() };
        S.values = {};
        if (S.editing) { var id = S.editing; S.editing = null; return mutate(function () { return Api.updateComplaint(id, base); }, 'Complaint updated.'); }
        return mutate(async function () { var row = await Api.createComplaint(Object.assign({ reporter_id: S.user.id }, base)); if (file) await Api.uploadPhoto(S.user.id, row.complaint_id, file); }, 'Complaint submitted. We will keep you updated here.');
      }
      if (f.id === 'f-cat') { var n = f.name.value.trim(); if (!n) return; return mutate(function () { return Api.addCategory(n, f.description.value.trim()); }, 'Category added.'); }
    } catch (err) { S.error = err.message; render(); }
  });
  async function act(el) {
    var a = el.dataset.act, id = el.dataset.id, val = el.value;
    var num = /^\d+$/.test(id || '') ? Number(id) : id;
    if (a === 'mode') { S.mode = el.dataset.mode; S.error = ''; S.errors = {}; S.flash = ''; return render(); }
    if (a === 'logout') { await Api.signOut(); S.user = S.profile = null; S.mode = 'login'; S.flash = ''; S.error = ''; return render(); }
    if (a === 'edit') { S.editing = num; S.values = {}; S.errors = {}; return render(); }
    if (a === 'edit-cancel') { S.editing = null; S.values = {}; S.errors = {}; return render(); }
    if (a === 'cancel' || a === 'delete') { if (confirm(a === 'cancel' ? 'Cancel this complaint? It will be removed.' : 'Delete this complaint permanently?')) mutate(function () { return Api.deleteComplaint(num); }, 'Complaint removed.'); return; }
    if (a === 'priority') return mutate(function () { return Api.updateComplaint(num, { priority: val || null }); }, 'Priority updated.');
    if (a === 'assign') return mutate(function () { return Api.updateComplaint(num, { assigned_to: val || null }); }, 'Assignment updated.');
    if (a === 'status') return mutate(function () { return Api.updateComplaint(num, { status: val }); }, 'Status updated.');
    if (a === 'photo') { try { var u = await Api.photoUrl(el.dataset.path), l = document.createElement('a'); l.href = u; l.target = '_blank'; l.rel = 'noopener'; l.click(); } catch (err) { S.error = err.message; render(); } return; }
    if (a === 'cat-rename') { var cur = S.cats.filter(function (c) { return c.category_id === num; })[0], nn = prompt('New category name', cur ? cur.name : ''); if (nn && nn.trim()) mutate(function () { return Api.updateCategory(num, { name: nn.trim() }); }, 'Category renamed.'); return; }
    if (a === 'cat-toggle') return mutate(function () { return Api.updateCategory(num, { is_active: el.dataset.on !== 'true' }); }, 'Category updated.');
    if (a === 'user-role') return mutate(function () { return Api.updateProfile(id, { role: val }); }, 'Role updated.');
    if (a === 'user-active') return mutate(function () { return Api.updateProfile(id, { is_active: el.dataset.on !== 'true' }); }, 'User updated.');
  }
  root.addEventListener('click', function (e) { var el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return; if (el.tagName === 'A') e.preventDefault(); act(el); });
  root.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.filter) { S.f[el.dataset.filter] = el.value; return render(); }
    if (el.dataset.act && el.tagName === 'SELECT') act(el);
  });
  window.addEventListener('hashchange', function () { S.flash = ''; S.error = ''; S.editing = null; S.values = {}; S.errors = {}; if (S.user && S.profile) render(); });

  (async function init() {
    if (!Api.configured) { root.innerHTML = setupView(); return; }
    if (Api.recovery) { S.mode = 'recovery'; return render(); }
    if (Api.linkError) { S.mode = 'forgot'; S.error = Api.linkError; }
    try { var s = await Api.session(); if (s) return start(s.user); } catch (e) { S.error = e.message; }
    render();
  })();
})();
