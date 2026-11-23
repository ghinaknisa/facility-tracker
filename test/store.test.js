const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

const reporter = { id: 1, role: 'reporter' };
const good = { category: 'Electrical', location: 'Building B', description: 'Lamp is broken in room 204' };

test('US-01 login succeeds with valid account and hides password', () => {
  const r = S.login('reporter@campus.test', 'reporter123');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.user.role, 'reporter');
  assert.strictEqual(r.user.password, undefined);
});
test('US-01 login fails with an error message when invalid', () => {
  const r = S.login('reporter@campus.test', 'wrong');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error);
});
test('US-01 admin and reporter get different roles', () => {
  assert.strictEqual(S.login('admin@campus.test', 'admin123').user.role, 'admin');
});
test('US-02 required fields are validated', () => {
  const r = S.createComplaint([], reporter, { category: '', location: '', description: '' });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(Object.keys(r.errors).sort(), ['category', 'description', 'location']);
});
test('US-02 complaint is saved with status New', () => {
  const r = S.createComplaint([], reporter, good);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.complaint.status, 'New');
  assert.strictEqual(r.list.length, 1);
});
test('US-03 list shows only the reporter own complaints with title, date, status', () => {
  let list = S.createComplaint([], reporter, good).list;
  list = S.createComplaint(list, { id: 99 }, good).list;
  const mine = S.complaintsFor(list, reporter);
  assert.strictEqual(mine.length, 1);
  assert.ok(mine[0].title && mine[0].createdAt && mine[0].status);
});
test('admin sees all complaints, reporter only own', () => {
  let list = S.createComplaint([], reporter, good).list;
  list = S.createComplaint(list, { id: 99 }, good).list;
  assert.strictEqual(S.visibleComplaints(list, { id: 2, role: 'admin' }).length, 2);
  assert.strictEqual(S.visibleComplaints(list, reporter).length, 1);
});
test('summarize counts per status and category', () => {
  const list = S.createComplaint([], reporter, good).list;
  const s = S.summarize(list);
  assert.strictEqual(s.total, 1);
  assert.strictEqual(s.byStatus.New, 1);
  assert.strictEqual(s.byCategory.Electrical, 1);
  assert.strictEqual(s.unresolved, 1);
  assert.strictEqual(S.summarize([]).resolutionRate, 0);
});
