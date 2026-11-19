// Checks firebase/firestore.rules against the local emulators: who can join, read and write what.
//   npm run emulators   (in another terminal)
//   npm run test:rules
import { initializeApp, setLogLevel } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

setLogLevel('silent');
const PROJECT = 'demo-komat', FS = '127.0.0.1:8085', AUTH = 'http://127.0.0.1:9099';
await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

let n = 0;
function person(name) {
  const app = initializeApp({ apiKey: 'demo', projectId: PROJECT, authDomain: 'demo' }, name + ++n);
  const auth = getAuth(app), db = getFirestore(app);
  connectAuthEmulator(auth, AUTH, { disableWarnings: true });
  connectFirestoreEmulator(db, FS.split(':')[0], +FS.split(':')[1]);
  return { auth, db, d: (p) => doc(db, p) };
}
let fails = 0;
async function expect(label, allowed, fn) {
  let ok = true;
  try { await fn(); } catch (e) { ok = false; if (e.code !== 'permission-denied') console.log('   (' + e.code + ')'); }
  const pass = ok === allowed;
  if (!pass) fails++;
  console.log((pass ? 'ok    ' : 'FAIL  ') + label + (pass ? '' : ' -> ' + (ok ? 'allowed' : 'denied')));
}

const chef = person('chef'), sous = person('sous'), cook = person('cook'), stranger = person('stranger'), intruder = person('intruder');
const nobody = person('nobody');
await expect('signed-out phone cannot read recipes', false, () => getDocs(collection(nobody.db, 'recipes')));

const A = (await createUserWithEmailAndPassword(chef.auth, 'chef@example.com', 'secret1')).user.uid;
await expect('head chef claims the kitchen', true, () => setDoc(chef.d('private/owner'), { uid: A, at: 1 }));
await expect('head chef joins as head chef', true, () => setDoc(chef.d('members/' + A), { name: 'Chef', role: 'admin', at: 1 }));
await expect('head chef sets the kitchen code', true, () => setDoc(chef.d('private/join'), { code: 'basil-42', at: 1 }));
await expect('kitchen code must be 6+ characters', false, () => setDoc(chef.d('private/join'), { code: 'abc', at: 1 }));
await expect('head chef adds a recipe', true, () => setDoc(chef.d('recipes/soup'), { name: 'Soup' }));

const B = (await createUserWithEmailAndPassword(intruder.auth, 'other@example.com', 'secret1')).user.uid;
await expect('a second account cannot take the kitchen over', false, () => setDoc(intruder.d('private/owner'), { uid: B, at: 2 }));
await expect('...nor make itself head chef', false, () => setDoc(intruder.d('members/' + B), { name: 'X', role: 'admin', at: 2 }));

const C = (await signInAnonymously(cook.auth)).user.uid;
await expect('cook with the wrong code cannot join', false, () => setDoc(cook.d('members/' + C), { name: 'Sam', role: 'cook', code: 'nope-00', at: 3 }));
await expect('cook cannot join as head chef', false, () => setDoc(cook.d('members/' + C), { name: 'Sam', role: 'admin', code: 'basil-42', at: 3 }));
await expect('cook cannot sign someone else up', false, () => setDoc(cook.d('members/someone'), { name: 'Bob', role: 'cook', code: 'basil-42', at: 3 }));
await expect('cook joins with the right code', true, () => setDoc(cook.d('members/' + C), { name: 'Sam', role: 'cook', code: 'basil-42', at: 3 }));
await expect('cook reads recipes', true, () => getDoc(cook.d('recipes/soup')));
await expect('cook reads the people list', true, () => getDocs(collection(cook.db, 'members')));
await expect('cook cannot change a recipe', false, () => setDoc(cook.d('recipes/soup'), { name: 'Better soup' }));
await expect('cook cannot change settings', false, () => setDoc(cook.d('settings/kitchen'), { planFrom: '20:00' }));
await expect('cook cannot change the rota', false, () => setDoc(cook.d('schedules/2026-10-26'), { people: [] }));
await expect('cook ticks the mise en place', true, () => setDoc(cook.d('checks/2026-10-26_pass'), { date: '2026-10-26', marks: { a: { d: 'ok' } } }));
await expect('cook adds a task', true, () => setDoc(cook.d('prep/x'), { date: '2026-10-26', name: 'Peel' }));
await expect('cook sends an order', true, () => setDoc(cook.d('orders/2026-10-26_pass'), { date: '2026-10-26', items: [] }));
await expect('cook reports a problem', true, () => setDoc(cook.d('bugs/b1'), { text: 'Broken' }));
await expect('cook adds a photo', true, () => setDoc(cook.d('blobs/p1/p/0'), { d: 'x' }).then(() => setDoc(cook.d('blobs/p1'), { n: 1 })));
await expect('cook cannot read the kitchen code', false, () => getDoc(cook.d('private/join')));

// days off and cover points
await expect('cook asks for a day off', true, () => setDoc(cook.d('dayoff/2026-11-20_sam'), { date: '2026-11-20', person: 'sam', uid: C, kind: 'ask', status: 'ok', note: 'birthday', at: 1, group: '' }));
await expect('cook cannot ask in someone else\'s name', false, () => setDoc(cook.d('dayoff/2026-11-21_bob'), { date: '2026-11-21', person: 'bob', uid: 'someone', kind: 'ask', status: 'ok', at: 1 }));
await expect('cook cannot approve their own paid vacation', false, () => setDoc(cook.d('dayoff/2026-11-22_sam'), { date: '2026-11-22', person: 'sam', uid: C, kind: 'paid', status: 'approved', at: 1 }));
await expect('head chef asks for a day off for anyone', true, () => setDoc(chef.d('dayoff/2026-11-21_bob'), { date: '2026-11-21', person: 'bob', uid: A, kind: 'ask', status: 'ok', at: 1 }));
await expect('cook takes a day with priority: the other request goes back to waiting', true, () => updateDoc(cook.d('dayoff/2026-11-21_bob'), { status: 'waiting', bumpedBy: 'sam' }));
await expect('...and it comes back when they withdraw', true, () => updateDoc(cook.d('dayoff/2026-11-21_bob'), { status: 'ok' }));
await expect('cook cannot approve or refuse someone\'s day off', false, () => updateDoc(cook.d('dayoff/2026-11-21_bob'), { status: 'refused' }));
await expect('cook cannot rewrite someone\'s reason', false, () => updateDoc(cook.d('dayoff/2026-11-21_bob'), { note: 'lazy' }));
await expect('head chef approves', true, () => updateDoc(chef.d('dayoff/2026-11-21_bob'), { status: 'approved', decidedBy: A }));
await expect('cook cannot delete someone else\'s request', false, () => deleteDoc(cook.d('dayoff/2026-11-21_bob')));
await expect('cook withdraws their own request', true, () => deleteDoc(cook.d('dayoff/2026-11-20_sam')));
await expect('cook reads the days off', true, () => getDocs(collection(cook.db, 'dayoff')));
await expect('cook spends points on priority', true, () => setDoc(cook.d('points/spend_2026-11-21_sam'), { person: 'sam', n: -3, kind: 'spend', date: '2026-11-21', reason: 'Priority', at: 1 }));
await expect('cook gives the 2 points for giving way', true, () => setDoc(cook.d('points/gaveway_2026-11-21_bob'), { person: 'bob', n: 2, kind: 'gaveway', date: '2026-11-21', reason: 'Gave way', at: 1 }));
await expect('cook cannot give themselves points', false, () => setDoc(cook.d('points/bonus_x'), { person: 'sam', n: 5, kind: 'bonus', date: '2026-11-21', reason: 'me', at: 1 }));
await expect('cook cannot fake a big "gave way"', false, () => setDoc(cook.d('points/gaveway_x'), { person: 'sam', n: 20, kind: 'gaveway', date: '2026-11-21', at: 1 }));
await expect('cook cannot delete a bonus', false, () => setDoc(chef.d('points/bonus_y'), { person: 'sam', n: 3, kind: 'bonus', at: 1 }).then(() => deleteDoc(cook.d('points/bonus_y'))));
await expect('head chef gives a bonus', true, () => setDoc(chef.d('points/bonus_z'), { person: 'sam', n: 3, kind: 'bonus', date: '2026-11-21', reason: 'stayed late', at: 1 }));
await expect('cook reads the cover board', true, () => getDocs(collection(cook.db, 'points')));
// notifications: each phone's address
const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' }, name: 'Cook', at: 1 };
await expect('cook saves their own phone for notifications', true, () => setDoc(cook.d('pushsubs/' + C), sub));
await expect('cook cannot save a phone for someone else', false, () => setDoc(cook.d('pushsubs/someone'), sub));
await expect('cook cannot read the other phones', false, () => getDocs(collection(cook.db, 'pushsubs')));
await expect('cook cannot add other fields', false, () => setDoc(cook.d('pushsubs/' + C), Object.assign({ role: 'admin' }, sub)));
await expect('head chef reads the phones (the sender does)', true, () => getDocs(collection(chef.db, 'pushsubs')));
await expect('cook turns their notifications off', true, () => deleteDoc(cook.d('pushsubs/' + C)));
await expect('signed-out phone cannot read days off', false, () => getDocs(collection(nobody.db, 'dayoff')));
await expect('cook cannot change the kitchen code', false, () => setDoc(cook.d('private/join'), { code: 'mine-123', at: 4 }));
await expect('cook cannot make themselves head chef', false, () => updateDoc(cook.d('members/' + C), { role: 'admin' }));
await expect('cook renames themselves', true, () => updateDoc(cook.d('members/' + C), { name: 'Sam K' }));
await expect('cook picks their marker and handwriting', true, () => updateDoc(cook.d('members/' + C), { ink: 'green', hand: 'marck' }));
await expect('...but not with a long made-up value', false, () => updateDoc(cook.d('members/' + C), { ink: 'x'.repeat(40) }));
await expect('...and not someone else\'s', false, () => updateDoc(cook.d('members/' + A), { ink: 'red' }));
await expect('cook cannot remove the head chef', false, () => deleteDoc(cook.d('members/' + A)));
await expect('cook cannot write to unknown places', false, () => setDoc(cook.d('secrets/x'), { a: 1 }));

// a viewer: the owner looking in, a helper; reads everything, changes nothing
const watcher = person('watcher');
const V = (await signInAnonymously(watcher.auth)).user.uid;
await expect('a viewer joins with the code like a cook', true, () => setDoc(watcher.d('members/' + V), { name: 'Pancho', role: 'cook', code: 'basil-42', at: 9 }));
await expect('head chef makes them a viewer', true, () => updateDoc(chef.d('members/' + V), { role: 'viewer' }));
await expect('...a viewer cannot make themselves a cook again', false, () => updateDoc(watcher.d('members/' + V), { role: 'cook' }));
await expect('viewer reads the recipes', true, () => getDoc(watcher.d('recipes/soup')));
await expect('viewer reads the board', true, () => getDocs(collection(watcher.db, 'boards')));
await expect('viewer cannot tick', false, () => setDoc(watcher.d('checks/x'), { date: 'x' }));
await expect('viewer cannot write on Ordering', false, () => setDoc(watcher.d('boards/wbx'), { kind: 'item', n: 'лимони' }));
await expect('viewer cannot ask for a day off', false, () => setDoc(watcher.d('dayoff/2026-11-30_pancho'), { kind: 'ask', date: '2026-11-30', person: 'pancho', uid: V, status: 'ok' }));
await expect('viewer cannot add a photo', false, () => setDoc(watcher.d('blobs/p1'), { type: 'image/jpeg' }));
await expect('viewer can still turn notifications on', true, () => setDoc(watcher.d('pushsubs/' + V), { endpoint: 'https://push.example/v', keys: { p256dh: 'k', auth: 'a' }, name: 'Pancho', at: 1 }));
await expect('viewer changes their own name', true, () => updateDoc(watcher.d('members/' + V), { name: 'Pancho K' }));

const E = (await signInAnonymously(stranger.auth)).user.uid;
await expect('signed in but not joined: no recipes', false, () => getDoc(stranger.d('recipes/soup')));
await expect('signed in but not joined: no people list', false, () => getDocs(collection(stranger.db, 'members')));
await expect('signed in but not joined: no ticking', false, () => setDoc(stranger.d('checks/x'), { date: 'x' }));

const S = (await signInAnonymously(sous.auth)).user.uid;
await setDoc(sous.d('members/' + S), { name: 'Sous', role: 'cook', code: 'basil-42', at: 5 });
await expect('head chef makes the sous chef head chef', true, () => updateDoc(chef.d('members/' + S), { role: 'admin' }));
await expect('new head chef changes a recipe', true, () => setDoc(sous.d('recipes/soup'), { name: 'Soup 2' }));
await expect('new head chef reads the kitchen code', true, () => getDoc(sous.d('private/join')));
await expect('...but cannot make the owner a cook', false, () => updateDoc(sous.d('members/' + A), { role: 'cook' }));
await expect('...nor remove the owner', false, () => deleteDoc(sous.d('members/' + A)));
await expect('head chef makes someone dev', true, () => updateDoc(chef.d('members/' + S), { role: 'dev' }));
await expect('a dev changes a recipe', true, () => setDoc(sous.d('recipes/soup'), { name: 'Soup 3' }));
await expect('a dev adds an event', true, () => setDoc(sous.d('events/e1'), { title: 'Dinner', date: '2026-10-27' }));
await expect('the owner can call themselves sous chef', true, () => updateDoc(chef.d('members/' + A), { role: 'sous' }));
await expect('...and still change recipes', true, () => setDoc(chef.d('recipes/soup'), { name: 'Soup 4' }));
await expect('...and still read the kitchen code', true, () => getDoc(chef.d('private/join')));
await expect('nobody can make the owner a cook', false, () => updateDoc(sous.d('members/' + A), { role: 'cook' }));
await expect('the owner cannot make themselves a cook either', false, () => updateDoc(chef.d('members/' + A), { role: 'cook' }));
await expect('no made-up roles', false, () => updateDoc(chef.d('members/' + S), { role: 'boss' }));
await expect('head chef removes a cook', true, () => deleteDoc(chef.d('members/' + C)));
await expect('removed cook can no longer read', false, () => getDoc(cook.d('recipes/soup')));
await expect('cook can leave by themselves', true, () => deleteDoc(sous.d('members/' + S)));

// the floor book: waiters join with the floor code, floor managers run it
const waiter = person('waiter'), manager = person('manager');
await expect('head chef sets the floor code', true, () => setDoc(chef.d('private/floorjoin'), { code: 'merlot-7', at: 1 }));
const W = (await signInAnonymously(waiter.auth)).user.uid;
await expect('waiter with the kitchen code cannot join as a waiter', false, () => setDoc(waiter.d('members/' + W), { name: 'Ana', role: 'waiter', code: 'basil-42', at: 1 }));
await expect('waiter with the floor code cannot join as a cook', false, () => setDoc(waiter.d('members/' + W), { name: 'Ana', role: 'cook', code: 'merlot-7', at: 1 }));
await expect('waiter joins with the floor code', true, () => setDoc(waiter.d('members/' + W), { name: 'Ana', role: 'waiter', code: 'merlot-7', at: 1 }));
await expect('waiter reads the kitchen recipes', true, () => getDoc(waiter.d('recipes/soup')));
await expect('waiter cannot tick the kitchen lists', false, () => setDoc(waiter.d('checks/x'), { date: 'x' }));
await expect('waiter cannot write on Ordering', false, () => setDoc(waiter.d('boards/wbw'), { kind: 'item', n: 'x' }));
await expect('waiter cannot ask for a kitchen day off', false, () => setDoc(waiter.d('dayoff/2026-12-01_ana'), { kind: 'ask', date: '2026-12-01', person: 'ana', uid: W, status: 'ok' }));
await expect('waiter cannot read the floor code', false, () => getDoc(waiter.d('private/floorjoin')));
await expect('head chef adds a wine', true, () => setDoc(chef.d('wines/mavrud'), { name: 'Mavrud' }));
await expect('waiter reads the wines', true, () => getDocs(collection(waiter.db, 'wines')));
await expect('waiter cannot change a wine', false, () => setDoc(waiter.d('wines/mavrud'), { name: 'Cheap' }));
await expect('waiter cannot change the floor rota', false, () => setDoc(waiter.d('fohweeks/2026-11-23'), { people: [] }));
await expect('waiter counts the bottles', true, () => setDoc(waiter.d('cellar/mavrud'), { n: 12, at: 1, by: W }));
await expect('...not a negative count', false, () => setDoc(waiter.d('cellar/mavrud'), { n: -3, at: 1, by: W }));
await expect('waiter sells a bottle', true, () => setDoc(waiter.d('cellarmoves/m1'), { w: 'mavrud', n: -1, at: 2, by: W }));
await expect('...not in someone else\'s name', false, () => setDoc(waiter.d('cellarmoves/m2'), { w: 'mavrud', n: -1, at: 2, by: 'someone' }));
await expect('...and cannot change a sale afterwards', false, () => updateDoc(waiter.d('cellarmoves/m1'), { n: 5 }));
await expect('waiter takes their own sale back', true, () => deleteDoc(waiter.d('cellarmoves/m1')));
await expect('waiter adds a label photo', true, () => setDoc(waiter.d('blobs/lbl/p/0'), { d: 'x' }).then(() => setDoc(waiter.d('blobs/lbl'), { n: 1 })));
await expect('waiter saves their quiz round', true, () => setDoc(waiter.d('quizscores/q1'), { uid: W, name: 'Ana', score: 820, right: 8, of: 10, topic: 'wine', at: 3 }));
await expect('...not for someone else', false, () => setDoc(waiter.d('quizscores/q2'), { uid: 'someone', name: 'Bob', score: 10, right: 1, of: 10, at: 3 }));
await expect('...nor more right answers than questions', false, () => setDoc(waiter.d('quizscores/q3'), { uid: W, name: 'Ana', score: 10, right: 11, of: 10, at: 3 }));
await expect('...and cannot change it afterwards', false, () => updateDoc(waiter.d('quizscores/q1'), { score: 5000 }));
await expect('a chef plays the quiz too', true, () => setDoc(chef.d('quizscores/c1'), { uid: A, name: 'Chef', score: 100, right: 2, of: 10, at: 3 }));
await expect('viewer cannot save a quiz round', false, () => setDoc(watcher.d('quizscores/v2'), { uid: V, name: 'P', score: 1, right: 1, of: 10, at: 3 }));
const M = (await signInAnonymously(manager.auth)).user.uid;
await setDoc(manager.d('members/' + M), { name: 'Mia', role: 'waiter', code: 'merlot-7', at: 1 });
await expect('head chef makes a waiter floor manager', true, () => updateDoc(chef.d('members/' + M), { role: 'manager' }));
await expect('floor manager writes the food bible', true, () => setDoc(manager.d('dishnotes/soup'), { pitch: 'Say this' }));
await expect('floor manager changes a wine', true, () => setDoc(manager.d('wines/mavrud'), { name: 'Mavrud 2021' }));
await expect('floor manager posts the floor rota', true, () => setDoc(manager.d('fohweeks/2026-11-23'), { people: [] }));
await expect('floor manager reads and changes the floor code', true, () => getDoc(manager.d('private/floorjoin')).then(() => setDoc(manager.d('private/floorjoin'), { code: 'syrah-88', at: 2 })));
await expect('floor manager cannot read the kitchen code', false, () => getDoc(manager.d('private/join')));
await expect('floor manager cannot change a recipe', false, () => setDoc(manager.d('recipes/soup'), { name: 'Floor soup' }));
await expect('floor manager cannot tick the kitchen lists', false, () => setDoc(manager.d('checks/y'), { date: 'y' }));
await expect('floor manager makes a waiter a viewer and back', true, () => updateDoc(manager.d('members/' + W), { role: 'viewer' }).then(() => updateDoc(manager.d('members/' + W), { role: 'waiter' })));
await expect('floor manager cannot make anyone a chef', false, () => updateDoc(manager.d('members/' + W), { role: 'admin' }));
const cook2 = person('cook2'), C2 = (await signInAnonymously(cook2.auth)).user.uid;
await setDoc(cook2.d('members/' + C2), { name: 'Dimo', role: 'cook', code: 'basil-42', at: 1 });
await expect('...nor change a cook', false, () => updateDoc(manager.d('members/' + C2), { role: 'waiter' }));
await expect('...nor remove a cook', false, () => deleteDoc(manager.d('members/' + C2)));
await expect('...nor make themselves head chef', false, () => updateDoc(manager.d('members/' + M), { role: 'admin' }));
await expect('floor manager clears a quiz round', true, () => deleteDoc(manager.d('quizscores/q1')));
await expect('waiter cannot clear the scores', false, () => deleteDoc(waiter.d('quizscores/c1')));
await expect('floor manager removes a waiter', true, () => deleteDoc(manager.d('members/' + W)));
await expect('...who can no longer read the wines', false, () => getDocs(collection(waiter.db, 'wines')));
await expect('floor manager cannot remove the head chef', false, () => deleteDoc(manager.d('members/' + A)));

console.log(fails ? `\n${fails} FAILED` : '\nall rules checks passed');
process.exit(fails ? 1 : 0);
