export const REMOVE_GENERATOR = "signature/remove-generator";
export const RENAME_GENERATOR = "signature/rename-generator";
export const CREATE_GENERATOR = "signature/create-generator";
export const SELECT_GENERATOR = "signature/select-generator";

export const removeGenerator = (id) => ({
  type: REMOVE_GENERATOR,
  payload: { id }
});

export const renameGenerator = (id, name) => ({
  type: RENAME_GENERATOR,
  payload: { id, name }
});

export const createGenerator = () => ({
  type: CREATE_GENERATOR
});

export const selectGenerator = (id) => ({
  type: SELECT_GENERATOR,
  payload: { id }
});