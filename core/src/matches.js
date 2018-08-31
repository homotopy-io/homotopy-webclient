import { _assert } from "~/util/debug";

/**
 * Find all embeddings of the `subdiagram` in the `diagram`.
 *
 * @param {Diagram} diagram The diagram to search in.
 * @param {Diagram} subdiagram The subdiagram to search for.
 * @return List of the coordinates of all embeddings.
 */
export const getMatches = (diagram, subdiagram) => {
  if (subdiagram.n != diagram.n) {
    return [];
  }

  return diagram.enumerate({ goal: subdiagram });
};

export const getAttachmentOptions = (diagram, generators, inverse, point) => {
  let matches = [];

  for (let generator of generators) {
    if (generator.n == 0) {
      continue;
    }

    let subdiagram = inverse ? generator.target : generator.source;
    for (let match of getMatches(diagram, subdiagram)) {
      if (containsPoint(subdiagram, match, point)) {
        matches.push({ match, generator });
      }
    }
  }

  return matches;
};

/**
 * @param {Diagram} diagram
 * @param {number[]} match Embedding in algebraic coordinates.
 * @param {number[]} point Point in geometric coordinates.
 */
export const containsPoint = (diagram, match, point) => {
  _assert(diagram.n == point.length);
  _assert(diagram.n == match.length);

  if (diagram.n == 0) {
    return true;
  } else {
    let [pointHeight, ...pointRest] = point;
    let [matchHeight, ...matchRest] = match;

    if (pointHeight < matchHeight * 2 || pointHeight > matchHeight * 2 + diagram.data.length * 2) {
      return false;
    } else {
      let slice = diagram.getSlice({
        height: Math.floor(pointHeight / 2 - matchHeight),
        regular: pointHeight % 2 == 0
      });
      return containsPoint(slice, matchRest, pointRest);
    }
  }
};
