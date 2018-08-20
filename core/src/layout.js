import * as Kiwi from "kiwi.js";
import { _assert } from "~/util/debug";

import "babel-polyfill";

export default async (diagram, dimension) => {
  const data = preprocess(diagram, dimension);
  const layout = new Layout(data);

  let counter = 0;
  for (let step of layout.run()) {
    if (counter++ % 100 == 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return {
    positions: point => layout.getPosition(point),
    points: data.points,
    edges: data.edges,
    boundary: data.boundary
  };
}

const preprocess = (diagram, dimension) => {
  const boundary = getBoundary(diagram, dimension);
  const points = [...getPoints(diagram, dimension)];
  const edges = [...getEdges(diagram, dimension)];

  return { dimension, boundary, points, edges };
}

const pointId = point => point.join(":");

class Layout {

  constructor({ dimension, boundary, points, edges }) {
    this._dimension = dimension;
    this._boundary = boundary;
    this._edges = edges;
    this._points = new Map();
    this._solver = new Kiwi.Solver();

    // Create the structures that hold the information about each point.
    for (let point of points) {
      let variables = [];
      let relations = new Map();

      for (let codim = 0; codim < dimension; codim++) {
        variables.push(new Kiwi.Variable());
        relations.set(`${codim}:1`, { points: [], codim });
        relations.set(`${codim}:-1`, { points: [], codim });
      }

      this._points.set(pointId(point), {
        variables,
        relations,
        point
      });
    }

    for (let { source, target, codim, dir } of this._edges) {
      for (let codimHigher = codim + 1; codimHigher < this._dimension; codimHigher++) {
        // Regular source
        if (source[codimHigher] % 2 == 0) {
          this.addRelation(source, target, codimHigher, dir);
        }

        // Singular target
        if (target[codimHigher] % 2 != 0) {
          this.addRelation(target, source, codimHigher, dir);
        }
      }
    }
  }

  getPosition(point) {
    let position = [];
    for (let codim = 0; codim < this._dimension; codim++) {
      position.push(this.getVariable(point, codim).value());
    }
    return position;
  }

  *run() {
    for (let constraint of this.createConstraints()) {
      this._solver.addConstraint(constraint);
      yield;
    }
  }

  addRelation(source, target, codim, dir) {
    let relations = this._points.get(pointId(source)).relations;
    let key = `${codim}:${dir}`;
    relations.get(key).points.push(target);
  }

  getVariable(point, codim) {
    return this._points.get(pointId(point)).variables[codim];
  }

  *createConstraints() {
    yield* this.createVariableConstraints();
    yield* this.createDistanceConstraints();
    yield* this.createLevelConstraints();
    yield* this.createAverageConstraints();
    this._solver.updateVariables();
  }

  *createVariableConstraints() {
    for (let { variables } of this._points.values()) {
      for (let variable of variables) {
        yield new Kiwi.Constraint(
          variable,
          Kiwi.Operator.Ge,
          0,
          Kiwi.Strength.required
        );
      }
    }
  }

  /**
   * Constrain points that are connected by an edge to have a distance of at
   * least 1 in the dimension of the edge.
   */
  *createDistanceConstraints() {
    for (let { source, target, codim, dir } of this._edges) {
      yield new Kiwi.Constraint(
        new Kiwi.Expression(
          [-dir, this.getVariable(source, codim)],
          [dir, this.getVariable(target, codim)]
        ),
        Kiwi.Operator.Ge,
        1,
        Kiwi.Strength.required
      );
    }
  }

  *createLevelConstraints() {
    for (let { source, target, codim } of this._edges) {
      for (let codimLower = 0; codimLower < codim; codimLower++) {
        yield new Kiwi.Constraint(
          this.getVariable(source, codimLower),
          Kiwi.Operator.Eq,
          this.getVariable(target, codimLower),
          Kiwi.Strength.required
        );
      }
    }
  }

  *createAverageConstraints() {
    for (let { relations, point } of this._points.values()) {
      for (let { points, codim } of relations.values()) {
        if (points.length > 0) {
          yield new Kiwi.Constraint(
            new Kiwi.Expression(
              ...points.map(p => [1 / points.length, this.getVariable(p, codim)])
            ),
            Kiwi.Operator.Eq,
            this.getVariable(point, codim),
            Kiwi.Strength.medium + codim
          );
        }
      }
    }
  }

}

const getPoints = function*(diagram, dimension) {
  if (dimension == 0) {
    yield [];
  } else {
    // for (let point of getPoints(diagram.source, dimension - 1)) {
    //   point.unshift(-1);
    //   yield point;
    // }

    for (let [height, slice] of slices(diagram)) {
      for (let point of getPoints(slice, dimension - 1)) {
        point.unshift(height);
        yield point;
      }
    }

    // for (let point of getPoints(diagram.target, dimension - 1)) {
    //   point.unshift(diagram.data.length * 2 + 1);
    //   yield point;
    // }
  }
}

const getEdges = function*(diagram, dimension) {
  if (dimension == 0) {
    return;
  } else {
    // Slice edges
    for (let [height, slice] of slices(diagram)) {
      for (let { source, target, codim, dir } of getEdges(slice, dimension - 1)) {
        source.unshift(height);
        target.unshift(height);
        codim += 1;
        yield { source, target, codim, dir };
      }
    }

    // Limit edges
    for (let regular = 0; regular <= diagram.data.length; regular++) {
      let points = [...getPoints(diagram.getSlice({ height: regular, regular: true }), dimension - 1)];

      let backwardLimit = regular > 0 ? diagram.data[regular - 1].backward_limit : null;
      let forwardLimit = regular < diagram.data.length ? diagram.data[regular].forward_limit : null;

      for (let point of points) {
        for (let target of limitAction(backwardLimit, point)) {
          yield {
            source: [regular * 2, ...point],
            target: [regular * 2 - 1, ...target],
            codim: 0,
            dir: -1
          };
        }
        for (let target of limitAction(forwardLimit, point)) {
          yield {
            source: [regular * 2, ...point],
            target: [regular * 2 + 1, ...target],
            codim: 0,
            dir: 1
          };
        }
      }
    }
  }
}

const limitAction = (limit, point) => {
  // Special case: the identity limit preserves all points.
  if (!limit || limit.length == 0) {
    return [point];
  }

  // Dimension zero points are always preserved.
  if (point.length == 0) {
    return [point];
  }

  let [height, ...rest] = point;
  let offset = 0;
  let targets = new Map();

  for (let component of limit) {
    let first = component.first * 2;
    let last = component.last * 2;

    if (first == last && last == height) {
      // Regular points that are split to make space for the introduction
      // of a singular point are sent to two heights, but stay otherwise
      // the same.
      targets.set(first - offset, rest);
      targets.set(first - offset + 2, rest);

    } else if (height <= first) {
      targets.set(height - offset, rest);

    } else if (height % 2 == 0 && height < last) {
      // Regular points on the inside of a limit component are sent nowhere.
      // This is important to prevent the generation of spurious extra geometry.
      break;

    } else if (height % 2 != 0 && height < last) {
      // Singular points on the inside of a limit component are sent to
      // the limit's target height and then further processed by the action
      // of the appropriate sublimit.
      let sublimit = component.sublimits[(height - first - 1) / 2];
      for (let target of limitAction(sublimit, rest)) {
        targets.set(first - offset + 1, target);
      }
      break;
    }

    offset += last - first - 2;
  }

  if (height >= limit[limit.length - 1].last * 2) {
    targets.set(height - offset, rest);
  }

  let targetPoints = [];
  for (let [targetHeight, targetRest] of targets) {
    targetPoints.push([targetHeight, ...targetRest]);
  }
  return targetPoints;
}

const getBoundary = (diagram, dimension) => {
  if (dimension == 0) {
    return [];
  } else {
    let boundary = [];
    for (let [height, slice] of slices(diagram)) {
      boundary.push(getBoundary(slice, dimension - 1));
    }
    return boundary;
  }
}

const slices = function*(diagram) {
  _assert(diagram.n > 0);
  yield [-1, diagram.source];

  for (let height = 0; height < diagram.data.length; height++) {
    yield [height * 2, diagram.getSlice({ height, regular: true })];
    yield [height * 2 + 1, diagram.getSlice({ height, regular: false })];
  }

  yield [diagram.data.length * 2, diagram.target];
  yield [diagram.data.length * 2 + 1, diagram.target];
}