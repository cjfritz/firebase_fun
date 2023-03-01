// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
const { Timestamp } = require('firebase-admin/firestore');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

exports.testFunction = functions.https.onRequest(async (req, res) => {
  let counter = 0;
  const result = await admin.firestore().collection('driver-metadata').get().then(snapshot => {
    snapshot.forEach(doc => {
      // console.log('document:', doc.data());
      counter++;
    });
  })
  console.log('# of records so far:', counter);
  res.end();
});