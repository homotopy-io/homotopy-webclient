export default function*(cycle) {
  let iterator = cycle[Symbol.iterator]();

  // Keep hold of the first element
  let step = iterator.next();
  if (step.done) {
    return;
  }

  let first = step.value;
  let current = step.value;

  for (let value of iterator) {
    yield [current, value];
    current = value;
  }

  yield [current, first];
}