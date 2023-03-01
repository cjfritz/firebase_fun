// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
const { Timestamp } = require('firebase-admin/firestore');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();
let db;
(async () => {
  db = await admin.firestore();
})();

exports.checkForZeroTimestampRecords = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 300,
    memory: "1GB",
  })  
  .https.onRequest(async (req, res) => {
  let recordCounter = 0;
  await db.collection('driver-metadata').get().then(snapshot => {
    snapshot.forEach(doc => {
      const { lastStarRatingTimestamp } = doc.data();
      if (lastStarRatingTimestamp === 0) {
        recordCounter++;
        if (recordCounter < 11) {
          console.log('record data:', doc.data());
        }
      }
    });
  })
  console.log('# of records with value 0 for lastStarRatingTimestamp:', recordCounter);
  res.end();
});

exports.updateZeroTimestampRecords = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onRequest(async (req, res) => {
    const batch = db.batch();
    let counter = 0;
    await db.collection('driver-metadata').get().then(snapshot => {
      snapshot.forEach(doc => {
        const { lastStarRatingTimestamp } = doc.data();
        if (lastStarRatingTimestamp === 0) {
          const timestamp = Timestamp.now();
          console.log('setting timestamp:', timestamp);
          batch.set(doc.ref, { lastStarRatingTimestamp: Timestamp.now() }, { merge: true })
          counter++
          console.log('set batch, counter is', counter);
          // doc.ref.set({ lastStarRatingTimestamp: Timestamp.now() }, { merge: true })
        }
      });
    })
    .then(() => {
      console.log('committing batch writes');
      return batch.commit();
    })
    .catch(err => {
      console.log('error encountered:', err);
    })
    .finally(() => {
      console.log('done, updated records:', counter);
      res.end()
    });
});