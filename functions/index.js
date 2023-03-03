const functions = require('firebase-functions'); // The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers
const { Timestamp } = require('firebase-admin/firestore'); // some Firestore type utilities
const admin = require('firebase-admin'); // The Firebase Admin SDK to access Firestore
const { finished } = require('node:stream'); // trigger effect for finished stream

admin.initializeApp();
let db;
(async () => {
  db = admin.firestore();
})();

/**
 * I changed stuff here mainly just to verify experiments with streams.
 * Changes were unnecessary but I left them because why not. You can run
 * this method after booting up the emulator to count documents with a
 * timestamp of 0. Uncomment line 31 if you want to blow up your terminal logs.
 */
exports.checkForZeroTimestampRecords = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 300,
    memory: "1GB",
  })  
  .https.onRequest(async (req, res) => {
    let recordCounter = 0;
    const docStream = db.collection('driver-metadata').where('lastStarRatingTimestamp', '==', 0).stream();

    docStream.on('data', docSnapshot => {
        recordCounter++
        // console.log(docSnapshot.id);
      }
    );

    docStream.on('end', () => {
      console.log('# of records with value 0 for lastStarRatingTimestamp:', recordCounter);
    });

    res.end();
  });

/**
 * I opted for streaming the data as I read that was more efficient and thought it might help resolve
 * the issues we were encountering. This streams the data and creates batch updates of 500 records (write
 * limit). Every 501st document snapshot causes the previous batch to be closed and added to the batches array.
 * Then the document snapshot is used to create the first update in a new batch. This continues until the
 * data stream has ended. At this point the final batch is checked to see if there are any updates in it and, 
 * if so, pushed to the batches array. Then Promise.all is used to process all batches. Errors in the stream are
 * listened for by docStream.on('error').
 */
exports.updateZeroTimestampRecords = functions
  .runWith({
    // Ensure the function has enough memory and time
    // to process large files
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onRequest(async (req, res) => {
    let totalDocsUpdated = 0;
    let batch = db.batch();
    const batches = [];
    const docStream = db.collection('driver-metadata').where('lastStarRatingTimestamp', '==', 0).stream();

    docStream.on('data', docSnapshot => {
      const batchUpdate = docSnapshotRef => batch.update(docSnapshot.ref, { lastStarRatingTimestamp: Timestamp.now() }); // what value do we want here?
      totalDocsUpdated++;

      if (batch._opCount < 500) {
        batchUpdate(docSnapshot.ref);
      } else {
        batches.push(batch.commit());
        batch = db.batch();
        batchUpdate(docSnapshot.ref);
      }
    });

    docStream.on('end', () => {
      if (batch._opCount) {
        batches.push(batch.commit());
      }
      Promise.all(batches);
    });

    docStream.on('error', err => {
      console.log('Error processing stream', err);
    });

    finished(docStream, err => {
      if (err) {
        console.log('Error that finished stream:', err);
      } else {
        console.log(`Stream finished updating ${totalDocsUpdated} records.`)
      }
    })
    res.end();
});