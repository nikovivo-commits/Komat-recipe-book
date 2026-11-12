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

console.log(fails ? `\n${fails} FAILED` : '\nall rules checks passed');
process.exit(fails ? 1 : 0);
