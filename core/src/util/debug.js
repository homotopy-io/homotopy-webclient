export const _assert = (condition) => {
  if (!condition) {
    throw new Error("Assertion failed.");
  }
};

export const isNatural = (value) => {
  return Number.isInteger(value) && value >= 0;
};

export const _validate = (object) => {
  if (!object.validate) {
    debugger;
  }
  object.validate();
};

export const _propertylist = (object, properties) => {
  for (let property of properties) {
    if (!object.hasOwnProperty(property)) {
      debugger;
    }
  }
};
