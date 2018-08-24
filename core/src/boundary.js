import { _assert } from "~/util/debug";

/**
 * @param {Diagram} diagram
 * @param {number[][]} points The points of the simplex in geometric coordinates.
 */
export const getPath = (diagram, points) => {
  if (diagram.n == 0) {
    return {
      boundary: null,
      depth: null,
      point: points[0]
    };
  }

  let height = points[0][0];

  // Ensure that the height is inside the bounds of the diagram.
  height = Math.max(0, height);
  height = Math.min(diagram.data.length * 2, height);

  // Obtain the path in the slice diagram.
  let path = getPath(diagram.getSlice({
    height: Math.floor(height / 2),
    regular: height % 2 == 0
  }), points.map(point => point.slice(1)));

  // Increase the boundary depth
  if (path.boundary) {
    path.depth += 1;
    return path;
  }

  // On the interior in the slice, on the source boundary here.
  if (Math.min(...points.map(point => point[0])) < 0) {
    path.depth = 1;
    path.boundary = "source";
    return path;
  }

  // On the interior in the slice, on the target boundary here.
  if (Math.max(...points.map(point => point[0])) > diagram.data.length * 2) {
    path.depth = 1;
    path.boundary = "target";
    return path;
  }

  // On the interior both in the slice and here.
  return {
    boundary: null,
    depth: null,
    point: points[0]
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