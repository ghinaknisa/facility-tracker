const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

const good = { category_id: 1, location: 'Building B', description: 'Lamp is broken in room 204' };
const c = (o) => Object.assign({ complaint_id: 1, reporter_id: 'u1', category_id: 1, catName: 'Electrical', status: 'New', priority: null }, o);

test('complaint form: required fields are validated', () => {
  assert.deepStrictEqual(Object.keys(S.validateComplaint({})).sort(), ['category', 'description', 'location']);
  assert.deepStrictEqual(S.validateComplaint(good), {});
  assert.ok(S.validateComplaint({ ...good, description: 'short' }).description);
});
test('signup: name, email and password rules', () => {
  assert.strictEqual(Object.keys(S.validateSignup({ full_name: '', email: 'x', password: '1' })).length, 3);
  assert.deepStrictEqual(S.validateSignup({ full_name: 'Rina', email: 'rina@campus.test', password: 'secret1' }), {});
});
test('photo: only JPG/PNG up to 2 MB', () => {
  assert.strictEqual(S.validatePhoto(null).ok, true);
  assert.strictEqual(S.validatePhoto({ type: 'image/png', size: 1000 }).ok, true);
  assert.strictEqual(S.validatePhoto({ type: 'image/gif', size: 1000 }).ok, false);
  assert.strictEqual(S.validatePhoto({ type: 'image/jpeg', size: 3 * 1024 * 1024 }).ok, false);
});
test('status rules per role', () => {
  assert.deepStrictEqual(S.allowedStatuses('technician', 'New'), ['New', 'In Progress']);
  assert.deepStrictEqual(S.allowedStatuses('technician', 'In Progress'), ['In Progress', 'Resolved']);
  assert.deepStrictEqual(S.allowedStatuses('technician', 'Resolved'), ['Resolved']);
  assert.strictEqual(S.allowedStatuses('admin', 'New').length, 3);
  assert.deepStrictEqual(S.allowedStatuses('reporter', 'New'), ['New']);
});
test('reporter may edit or cancel only own complaints that are still New', () => {
  assert.strictEqual(S.canEditOwn(c(), 'u1'), true);
  assert.strictEqual(S.canEditOwn(c(), 'u2'), false);
  assert.strictEqual(S.canEditOwn(c({ status: 'In Progress' }), 'u1'), false);
});
test('filters by status, priority and category', () => {
  const l = [c(), c({ complaint_id: 2, status: 'Resolved', priority: 'High', category_id: 2 })];
  assert.strictEqual(S.filterComplaints(l, { status: 'Resolved' }).length, 1);
  assert.strictEqual(S.filterComplaints(l, { priority: 'none' }).length, 1);
  assert.strictEqual(S.filterComplaints(l, { category: '2' }).length, 1);
  assert.strictEqual(S.filterComplaints(l, {}).length, 2);
});
test('summarize counts status, priority and category', () => {
  const s = S.summarize([c(), c({ status: 'Resolved', priority: 'High' }), c({ status: 'In Progress', priority: 'Low', catName: 'Plumbing' })]);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.unresolved, 2);
  assert.strictEqual(s.resolutionRate, 33);
  assert.strictEqual(s.byPriority['Not set'], 1);
  assert.strictEqual(s.byCategory.Plumbing, 1);
  assert.strictEqual(S.summarize([]).resolutionRate, 0);
});

test('email and new-password validation', () => {
  assert.strictEqual(S.validateEmail('a@b.co'), true);
  assert.strictEqual(S.validateEmail('nope'), false);
  assert.deepStrictEqual(S.validateNewPassword('secret1', 'secret1'), {});
  assert.ok(S.validateNewPassword('123', '123').password);
  assert.ok(S.validateNewPassword('secret1', 'other').confirm);
});
