import { computeLayout } from "homotopy-core";

let jobs = new Map();
let wakeUp = null;

self.onmessage = ({ data }) => {
  if (data.type == "start") {
    let { id, dimension, points, edges } = data.payload;
    let state = computeLayout(dimension, points, edges);
    jobs.set(id, state);

    if (wakeUp != null) {
      wakeUp();
    }
  } else if (data.type == "stop") {
    let { id } = data.payload;
    jobs.delete(id);
  }
}

const work = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));


  try {
    if (jobs.size == 0) {
      await new Promise(resolve => {
        wakeUp = () => setTimeout(resolve, 0)
      });
    } else {
      let [id, job] = jobs.entries().next().value;
      let fuel = 100;

      while (fuel-- >= 0) {
        let step = job.next();

        if (step.done) {
          self.postMessage({
            type: "completed",
            payload: {
              id,
              result: step.value
            }
          });

          jobs.delete(id);
          break;
        }
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error.toString()
    })
    return;
  }

  work();
}

work();