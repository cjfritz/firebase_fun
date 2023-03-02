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
  await db.collection('driver-metadata').where('lastStarRatingTimestamp', '==', 0).get().then(snapshot => {
    snapshot.forEach(doc => {
      recordCounter++;
      if (recordCounter < 11) {
        console.log('record data:', doc.data());
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
    const batches = [];
    let batch = db.batch();
    let counter = 0;
    await db.collection('driver-metadata').where('lastStarRatingTimestamp', '==', 0).get().then(snapshot => {
      snapshot.forEach((doc, index) => {
        const timestamp = Timestamp.now();
        console.log('setting timestamp:', timestamp);
        batch.update(doc.ref, { lastStarRatingTimestamp: Timestamp.now() }) // Is this the timestamp we want to use in PROD?
        if(++counter >= 500 || index === snapshot.length - 1) {
          batches.push(batch.commit());
          batch = db.batch();
          counter = 0;
          console.log('batch ended at index', index);
        }
        // counter++
        // console.log('set batch, counter is', counter);
        // doc.ref.set({ lastStarRatingTimestamp: Timestamp.now() }, { merge: true })
      });
    })
    .then(async () => {
      console.log('committing batch writes');
      return await Promise.all(batches);
    })
    .catch(err => {
      console.log('error encountered:', err);
    })
    .finally(() => {
      console.log('done, updated records:', counter);
      res.end()
    });
});