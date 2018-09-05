export class Geometry {

  constructor(subdivisions) {
    this.subdivisions = subdivisions;
    this.vertices = [];
    this.indices = new Map();
    this.neighbours = [];
    this.fixed = new Set();
    this.distance = [];
  }

  addVertex(vertex) {
    let index = this.vertices.length;
    let point = new Point([{ weight: 1, index }]);
    this.indices.set(point.id, index);
    this.vertices.push(vertex);
    this.neighbours.push(new Set());
    this.distance.push([]);
    return index;
  }

  requireDistance(a, b, dimension, distance) {
    this.distance[a].push([b, dimension, distance]);
    this.distance[b].push([a, dimension, distance]);
  }

  interpolate(point) {
    let vertex = [0, 0, 0];

    for (let { index, weight } of point.support) {
      for (let dim = 0; dim < 3; dim++) {
        vertex[dim] += weight * this.vertices[index][dim];
      }
    }

    return vertex;
  }

  getIndex(point) {
    if (this.indices.has(point.id)) {
      return this.indices.get(point.id);
    } else {
      let index = this.vertices.length;
      this.indices.set(point.id, index);
      this.vertices.push(this.interpolate(point));
      this.neighbours.push(new Set());
      this.distance.push([]);
      return index;
    }
  }

  addSurface(a, b, c) {
    let faces = sampleTriangle(this.subdivisions, (u, v, w) => {
      return this.getIndex(new Point([
        { index: a, weight: u },
        { index: b, weight: v },
        { index: c, weight: w }
      ]));
    });

    for (let [i, j, k] of faces) {
      this.neighbours[i].add(j);
      this.neighbours[i].add(k);
      this.neighbours[j].add(i);
      this.neighbours[j].add(k);
      this.neighbours[k].add(i);
      this.neighbours[k].add(j);
    }

    return faces;
  } 

  optimize(steps) {
    const constant = 0.1;

    for (let step = 0; step < steps; step++) {
      for (let i = 0; i < this.vertices.length; i++) {
        let neighbours = this.neighbours[i];
        let vertex = this.vertices[i];

        if (this.fixed.has(i)) {
          continue;
        }

        for (let j of neighbours) {
          let neighbour = this.vertices[j];
          let factor = constant;
          vertex[0] = (1 - factor) * vertex[0] + factor * neighbour[0];
          vertex[1] = (1 - factor) * vertex[1] + factor * neighbour[1];
          vertex[2] = (1 - factor) * vertex[2] + factor * neighbour[2];
        }
      }
    }
  }

  fixLine(source, target) {
    let n = Math.pow(2, this.subdivisions);

    for (let u = 0; u <= n; u++) {
      let index = this.getIndex(new Point([
        { index: source, weight: u / n },
        { index: target, weight: 1 - u / n }
      ]));
      this.fixed.add(index);
    }
  }

}

class Point {

  constructor(support) {
    support = support.filter(({ weight }) => weight > 0);
    support.sort((a, b) => a.index - b.index);
    this.support = support;
  }

  get id() {
    return (
      this.support
        .map(({ index, weight }) => `${index} * ${weight}`)
        .join(" + ")
    );
  }

}

const sampleTriangle = (subdivisions, fn) => {
  let faces = [];

  for (let [a, b, c] of subdividedTriangle(subdivisions, [1, 0, 0], [0, 1, 0], [0, 0, 1])) {
    faces.push([fn(...a), fn(...b), fn(...c)]);
  }

  return faces;
};

const subdividedTriangle = function*(n, a, b, c) {
  if (n == 0) {
    yield [a, b, c];
  } else {
    const ab = midpoint(a, b);
    const ac = midpoint(a, c);
    const bc = midpoint(b, c);

    yield* generateTriangles(n - 1, a, ac, ab);
    yield* generateTriangles(n - 1, ac, c, bc);
    yield* generateTriangles(n - 1, ab, bc, b);
    yield* generateTriangles(n - 1, ac, bc, ab);
  }
};

const midpoint = (a, b) => {
  return [
    0.5 * (a[0] + b[0]),
    0.5 * (a[1] + b[1]),
    0.5 * (a[2] + b[2])
  ];
};

const interpolate = (points, weights) => {
  let point = [];

  for (let dimension = 0; dimension < 3; dimension++) {
    let value = 0;
    for (let i = 0; i < points.length; i++) {
      value += points[i] * weights[i];
    }
    point.push(value);
  }

  return point;
};

const ensureDistance = (a, b, distance = 0) => {
  if (a >= b) {
    return Math.max(a, b + distance);
  } else if (a < b) {
    return Math.min(a, b - distance);
  } else {
    return a;
  }
};

// const pointId = (point) => {
//   return point.join(":");
// };