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

export const getAttachmentOptions = (diagram, generators, inverse, points) => {
  let matches = [];
  _assert(points instanceof Array);

  for (let generator of generators) {
    if (generator.n == 0) {
      continue;
    }

    let subdiagram = inverse ? generator.target : generator.source;
    for (let match of getMatches(diagram, subdiagram)) {
      if (points.some(point => containsPoint(subdiagram, match, point))) {
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
export const containsPoint = (subdiagram, match, point) => {
  if (point.length == 0) return true;
  //_assert(subdiagram.n == point.length);
  _assert(subdiagram.n == match.length);

  if (subdiagram.n == 0) {
    return true;
  } else {
    let [pointHeight, ...pointRest] = point;
    let [matchHeight, ...matchRest] = match;

    // For thin subdiagrams, a boundary match is sufficient
    if (subdiagram.data.length == 0) {
      if (pointHeight < matchHeight * 2 || pointHeight > matchHeight * 2 + subdiagram.data.length * 2) {
        return false;
      }
    }

    // For thick subdiagrams, a boundary match is insufficient
    else {
      if (pointHeight <= matchHeight * 2 || pointHeight >= matchHeight * 2 + subdiagram.data.length * 2) {
        return false;
      }
    }

    let slice = subdiagram.getSlice({
      height: Math.floor(pointHeight / 2 - matchHeight),
      regular: pointHeight % 2 == 0
    });
    return containsPoint(slice, matchRest, pointRest);
  }
};
