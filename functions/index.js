const functions = require('firebase-functions');
const admin = require('firebase-admin');
const path = require('path');

admin.initializeApp();

exports.makePublic = functions.storage.object().onMetadataUpdate((object) => {
  const blob = object.name; // looks like /{userId}/{projectId}/{version}.proof
  console.log("Metadata changed on ", blob);
  const id = path.dirname(blob).substring(path.dirname(blob).lastIndexOf('/')+1);
  return admin.firestore().collection('projects').doc(id).update({public: object.metadata.public ? true : false}).then(() => {
    console.log("Updated public");
  });
});
