
export const save = ({ storage }, firestore, { uid, docid, metadata, proof }, callback) => {
  if (proof) {
    const sanitizedMetadata = {
      title: metadata.title || "",
      author: metadata.author || "",
      abstract: metadata.abstract || ""
    }
    // build saveable object
    const project = {
      date: Date.now(), // last modified date
      uid, // uid of owner
      versions: [{
        version: 0, // version number
        metadata: { ...sanitizedMetadata }, // title, author, abstract
      }]
    }
    // path to proof in firebase storage is `/${uid}/${docid}/${versions.version}`
    const storageRef = storage().ref()

    // now, in the following order
    // 1. create or locate a firestore entry for this proof object, containing all
    //    the metadata (firestore is our database to run queries against)
    // 2. upload the proof blob to firebase storage
    // 3. set the metadata for the proof blob on firebase storage
    if (!docid)
      // create object and update docid
      // TODO: handle add errors
      firestore.add({ collection: 'projects' }, project)
        .then(result => {
          console.log('Result', result)
          const id = result.id
          // upload blob to firebase storage
          const fileRef = storageRef.child(`${uid}/${id}/0.proof`)
          callback(id) // set project id
          return fileRef.putString(proof, "raw", { customMetadata: { ...sanitizedMetadata, version: 0 }})
            .then(res => console.log('Proof uploaded successfully', res))
            .catch(err => console.error('Error uploading proof', err))
        })
    else
      // update existing doc
      // TODO: handle update errors
      firestore.update({ collection: 'projects', doc: docid }, project)
        .then(result => {
          // upload blob to firebase storage
          const fileRef = storageRef.child(`${uid}/${docid}/0.proof`)
          return fileRef.putString(proof, "raw", { customMetadata: { ...sanitizedMetadata, version: 0 }})
            .then(res => console.log('Proof uploaded successfully', res))
            .catch(err => console.error('Error uploading proof', err))
        })
  } else
    alert('No proof to save!')
}

export const load = ({ storage, auth }, project, callback) => {
  // download the proof blob corresponding to this project
  // see: https://firebase.google.com/docs/storage/web/download-files
  const uid = auth().getUid()
  const storageRef = storage().ref()
  const fileRef = storageRef.child(`${uid}/${project.id}/0.proof`)
  fileRef.getDownloadURL().then(url => {
    const xhr = new XMLHttpRequest()
    xhr.onload = (evt => {
      callback({
        ...project.versions[0], // set metadata from firestore
        id: project.id,
        proof: xhr.response
      })
    })
    xhr.open('GET', url) // get proof blob from firebase storage
    xhr.send()
  })
    .catch(err => console.error('Error downloading proof', err))
}

