import { computeLayout0d, computeLayout1d, computeLayout2d, computeLayout3d, Geometry } from "homotopy-core";
import * as Rx from "rxjs";
import Worker from "worker-loader!./worker.js";

class LayoutWorker {

  constructor() {
    this.nextId = 0;
    this.waiting = new Map();
    this.worker = new Worker();
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
      throw new Error(data.payload);
    }
  }

}

// Create a layout worker globally and make it survive hot reloads.
const layoutWorker = new LayoutWorker();

export default (diagram, dimension) => {
  let t0 = performance.now();

  let points = [...Geometry.pointsOf(diagram, dimension)];
  let edges = [...Geometry.edgesOf(diagram, dimension)];

  let t1 = performance.now();

  let job;
  if (dimension == 0) {
    job = computeLayout0d(dimension, points, edges);
  } else if (dimension == 1) {
    job = computeLayout3d(dimension, points, edges);
  } else if (dimension == 2) {
    job = computeLayout3d(dimension, points, edges);
  } else if (dimension == 3) {
    job = computeLayout3d(dimension, points, edges);
  } else throw Error("Invalid dimension for layout engine");
  let result;
  while (true) {
    let step = job.next();
    if (step.done) {
      result = step.value;
      break;
    }
  }

  let t2 = performance.now();

  console.log(`${dimension}d layout for ${diagram.n}d diagram, prepared (${Math.floor(t1-t0)} ms), solved (${Math.floor(t2-t1)} ms)`);

  return Rx.Observable.create(observer => {
    // let onComplete = result => {
    //   let endTime = new Date().getTime();
    observer.next({
      ...result,
      points,
      edges
    });
    observer.complete();
    // };

    // let id = window.layoutWorker.start({
    //   dimension,
    //   points,
    //   edges
    // }, onComplete);

    return () => {
      // window.layoutWorker.stop(id);
    };
  });
};

// TODO: Hot reloading
