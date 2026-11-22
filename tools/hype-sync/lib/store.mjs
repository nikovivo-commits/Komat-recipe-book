/* The Firestore side, with the Firebase Admin SDK. The key file's path comes from HYPE_SYNC_FIREBASE_KEY. */
import fs from 'node:fs';

export async function openFirestore(cfg) {
  const keyPath = process.env.HYPE_SYNC_FIREBASE_KEY;
  if (!keyPath) throw new Error('the environment variable HYPE_SYNC_FIREBASE_KEY is not set: it must hold the path of the service-account key file (see README.md)');
  let key;
  try { key = JSON.parse(fs.readFileSync(keyPath, 'utf8')); } catch (e) { throw new Error(`could not read the key file ${keyPath}: ${e.message}`); }
  if (cfg.firebaseProject && key.project_id !== cfg.firebaseProject) throw new Error(`the key file is for the Firebase project "${key.project_id}", not "${cfg.firebaseProject}"`);
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(initializeApp({ credential: cert(key) }));
  return { set: (docPath, data) => db.doc(docPath).set(data) };
}

/* used by `--dry`: shows what would be written and writes nothing */
export function dryFirestore() {
  return {
    set: async (docPath, data) => {
      const shown = Array.isArray(data.rows) && data.rows.length > 5 ? { ...data, rows: [...data.rows.slice(0, 5), `... and ${data.rows.length - 5} more rows`] } : data;
      console.log(`\n[dry run] would write ${docPath}:\n${JSON.stringify(shown, null, 2)}`);
    },
  };
}
