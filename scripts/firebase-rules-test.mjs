import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-kyro-v4';
const testEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: await readFile('firestore.rules', 'utf8'),
  },
  storage: {
    host: '127.0.0.1',
    port: 9199,
    rules: await readFile('storage.rules', 'utf8'),
  },
});

try {
  const alice = testEnvironment.authenticatedContext('alice', { email: 'alice@example.test' });
  const bob = testEnvironment.authenticatedContext('bob', { email: 'bob@example.test' });
  const owner = testEnvironment.authenticatedContext('owner', {
    email: 'rmagalhaes90@gmail.com',
  });
  const anonymous = testEnvironment.unauthenticatedContext();

  await assertSucceeds(setDoc(doc(alice.firestore(), 'users/alice/data/profile'), { value: {} }));
  await assertFails(setDoc(doc(bob.firestore(), 'users/alice/data/profile'), { value: {} }));
  await assertFails(setDoc(doc(anonymous.firestore(), 'users/alice/data/profile'), { value: {} }));

  await assertSucceeds(
    setDoc(doc(alice.firestore(), 'sharedUsers/alice'), {
      email: 'alice@example.test',
      createdAt: '2026-08-02T00:00:00.000Z',
      blocked: false,
    }),
  );
  await assertFails(
    setDoc(doc(bob.firestore(), 'sharedUsers/bob'), {
      email: 'bob@example.test',
      createdAt: '2026-08-02T00:00:00.000Z',
      blocked: false,
      isAdmin: true,
    }),
  );
  await assertSucceeds(updateDoc(doc(owner.firestore(), 'sharedUsers/alice'), { isAdmin: true }));
  const aliceAdmin = testEnvironment.authenticatedContext('alice', {
    email: 'alice@example.test',
    admin: true,
  });
  await assertSucceeds(getDocs(collection(aliceAdmin.firestore(), 'sharedUsers')));
  await assertFails(
    updateDoc(doc(aliceAdmin.firestore(), 'sharedUsers/alice'), { isAdmin: false }),
  );
  await assertSucceeds(
    updateDoc(doc(aliceAdmin.firestore(), 'sharedUsers/alice'), { blocked: true }),
  );

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  await assertSucceeds(
    uploadBytes(ref(alice.storage(), 'users/alice/photos/small.jpg'), jpeg, {
      contentType: 'image/jpeg',
    }),
  );
  await assertFails(
    uploadBytes(ref(bob.storage(), 'users/alice/photos/cross-account.jpg'), jpeg, {
      contentType: 'image/jpeg',
    }),
  );
  await assertFails(
    uploadBytes(ref(alice.storage(), 'users/alice/photos/not-jpeg.png'), jpeg, {
      contentType: 'image/png',
    }),
  );
  await assertFails(
    uploadBytes(
      ref(alice.storage(), 'users/alice/photos/too-large.jpg'),
      new Uint8Array(3 * 1024 * 1024 + 1),
      { contentType: 'image/jpeg' },
    ),
  );

  console.log('Firestore/Storage rules: ownership, admin and upload limits passed');
} finally {
  await testEnvironment.cleanup();
}
