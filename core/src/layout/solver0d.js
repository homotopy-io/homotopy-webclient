import { _assert, _debug } from '../util/debug'

export default function*(dimension, points, edges) {

  yield* [];
  let positions = new Map([['', []]]);
  let minBounds = [];
  let maxBounds = [];
  return { positions, minBounds, maxBounds };

}
