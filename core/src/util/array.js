export const last = (array) => {
  return array[array.length - 1];
};

export const reverse = (array) => {
  let result = [];

  for (let i = array.length - 1; i >= 0; i--) {
    result.push(array[i]);
  }

  return result;
};

export const penultimate = (array) => {
  return array[array.length - 2];
};