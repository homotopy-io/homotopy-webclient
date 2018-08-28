import { _assert } from "~/util/debug";
import * as Match from "~/matches";

/**
 * @param {Diagram} diagram
 * @param {number[]} point The point in geometric coordinates.
 */
export const getPath = (diagram, point) => {
  if (diagram.n == 0) {
    return {
      boundary: null,
      depth: null,
      point: point
    };
  }

  let [height, ...rest] = point;

  // Ensure that the height is inside the bounds of the diagram.
  height = Math.max(0, height);
  height = Math.min(diagram.data.length * 2, height);

  // Obtain the path in the slice diagram.
  let path = getPath(diagram.getSlice(height), rest);

  // Increase the boundary depth
  if (path.boundary) {
    path.depth += 1;
    return path;
  }

  // On the interior in the slice, on the target boundary here.
  if (height >= diagram.data.length * 2) {
    path.depth = 1;
    path.boundary = "target";
    return path;
  }

  // On the interior in the slice, on the source boundary here.
  if (height <= 0) {
    path.depth = 1;
    path.boundary = "source";
    return path;
  }

  // On the interior both in the slice and here.
  return {
    boundary: null,
    depth: null,
    point: point
  };
}

export const followPath = (diagram, path) => {
  if (path.boundary != null) {
    for (let i = 0; i < path.depth - 1; i++) {
      diagram = diagram.source;
    }

    diagram = path.boundary == "source" ? diagram.source : diagram.target;
  }

  return diagram;
}

export const containsPoint = (diagram, point, path, subdiagram) => {
  if (diagram.n == 0) {
    return true;
  } else if (point.length == 0) {
    return true;
  }

  let [height, ...rest] = point;

  if (path.depth == 1) {
    if (path.boundary == "source" && height > 0) {
      return false;
    } else if (path.boundary == "target" && height < diagram.data.length * 2) {
      return false;
    }

    let slice = path.boundary == "source" ? diagram.source : diagram.target;
    return containsPoint(slice, rest, {
      ...path,
      boundary: null,
      depth: null,
    }, subdiagram);
  }

  if (path.boundary && path.depth > 1) {
    let slice = diagram.source;
    return containsPoint(slice, rest, {
      ...path,
      depth: path.depth - 1
    }, subdiagram);
  }

  return Match.containsPoint(subdiagram, path.point, point);
}

export const shiftPath = (path, depth) => {
  if (depth <= 0) {
    return path;
  }

  if (path.depth == 1) {
    return shiftPath({
      boundary: null,
      depth: null,
      point: path.point
    }, depth - 1); 
  }

  if (path.boundary && path.depth > 1) {
    return shiftPath({
      boundary: path.boundary,
      depth: path.depth - 1,
      point: path.point
    }, depth - 1);
  }

  return {
    boundary: null,
    depth: null,
    point: path.point.slice(depth)
  };
}