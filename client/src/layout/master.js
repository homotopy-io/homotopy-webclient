import { computeLayout, Geometry } from "homotopy-core";
import * as Rx from "rxjs";

class LayoutWorker {

  constructor() {
    this.nextId = 0;
    this.waiting = new Map();
    this.worker = new Worker("./worker.js");
    this.worker.onmessage = this.onMessage.bind(this);
  }

  start(data, onComplete) {
    let id = this.nextId++;

    this.worker.postMessage({
      type: "start",
      payload: { id, ...data }
    });

    this.waiting.set(id, onComplete);
    return id;
  }

  stop(id) {
    this.worker.postMessage({
      type: "stop",
      payload: { id }
    });
  }

  onMessage({ data }) {
    if (data.type == "completed") {
      let { id, result } = data.payload;

      if (this.waiting.has(id)) {
        this.waiting.get(id)(result);
        this.waiting.delete(id);
      }
    } else if (data.type == "error") {
      console.error(data.payload);
    }
  }

}

// Create a layout worker globally and make it survive hot reloads.
if (!window.layoutWorker) {
  window.layoutWorker = new LayoutWorker();
}

export default (diagram, dimension) => {
  let points = [...Geometry.pointsOf(diagram, dimension)];
  let edges = [...Geometry.edgesOf(diagram, dimension)];

  return Rx.Observable.create(observer => {
    let onComplete = result => {
      observer.next({
        ...result,
        points,
        edges
      });
      observer.complete();
    };

    let id = window.layoutWorker.start({
      dimension,
      points,
      edges
    }, onComplete);

    return () => {
      window.layoutWorker.stop(id);
    }
  });
}
