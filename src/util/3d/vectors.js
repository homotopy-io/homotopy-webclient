export const average = (...vectors) => {
  if (vectors.length == 0) return null;
  let average = Array(vectors[0].length).fill(0);

  for (let vector of vectors) {
    addScaled(average, vector, 1 / vectors.length);
  }

  return average;
};

export const addScaled = (target, vector, scale) => {
  for (let dim = 0; dim < vector.length; dim++) {
    target[dim] += scale * vector[dim];
  }
};