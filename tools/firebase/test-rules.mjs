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
await expect('cook cannot change the kitchen code', false, () => setDoc(cook.d('private/join'), { code: 'mine-123', at: 4 }));
await expect('cook cannot make themselves head chef', false, () => updateDoc(cook.d('members/' + C), { role: 'admin' }));
await expect('cook renames themselves', true, () => updateDoc(cook.d('members/' + C), { name: 'Sam K' }));
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
await expect('...but cannot demote the owner', false, () => updateDoc(sous.d('members/' + A), { role: 'cook' }));
await expect('...nor remove the owner', false, () => deleteDoc(sous.d('members/' + A)));
await expect('head chef makes someone dev', true, () => updateDoc(chef.d('members/' + S), { role: 'dev' }));
await expect('a dev changes a recipe', true, () => setDoc(sous.d('recipes/soup'), { name: 'Soup 3' }));
await expect('a dev adds an event', true, () => setDoc(sous.d('events/e1'), { title: 'Dinner', date: '2026-10-27' }));
await expect('a dev cannot make the owner a dev', false, () => updateDoc(sous.d('members/' + A), { role: 'dev' }));
await expect('no made-up roles', false, () => updateDoc(chef.d('members/' + S), { role: 'boss' }));
await expect('head chef removes a cook', true, () => deleteDoc(chef.d('members/' + C)));
await expect('removed cook can no longer read', false, () => getDoc(cook.d('recipes/soup')));
await expect('cook can leave by themselves', true, () => deleteDoc(sous.d('members/' + S)));

console.log(fails ? `\n${fails} FAILED` : '\nall rules checks passed');
process.exit(fails ? 1 : 0);
