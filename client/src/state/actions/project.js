export const SET_PROJECT = 'project/set'
export const SET_PROJECT_ID = 'project/set-id'

export const setProject = (project) => ({
  type: SET_PROJECT,
  payload: { project }
})

export const setProjectID = (id) => ({
  type: SET_PROJECT_ID,
  payload: { id }
})
