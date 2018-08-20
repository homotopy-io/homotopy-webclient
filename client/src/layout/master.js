import { computeLayout } from "homotopy-core";

if (window.layoutWorker) {
  window.layoutWorker.terminate();
}

const worker = new Worker("./worker.js");
window.layoutWorker = worker;

worker.onmessage = ({ data }) => {
  if (data.type == "completed") {
    let { id, result } = data.payload;
    if (waiting.has(id)) {
      waiting.get(id)(result);
      waiting.delete(id);
    }
  } else if (data.type == "error") {
    console.error(data.error);
  }
}

worker.postMessage({
  "type": "test"
});

let nextId = 0;
let waiting = new Map();

export default (dimension, points, edges) => {
  let id = nextId++;

  worker.postMessage({
    type: "start",
    payload: { id, dimension, points, edges }
  });

  let wait = new Promise(resolve => {
    waiting.set(id, resolve);
  });

  let cancel = () => {
    worker.postMessage({
      type: "stop",
      payload: { id } 
    });
    waiting.delete(id);
  };

  return { wait, cancel };
}