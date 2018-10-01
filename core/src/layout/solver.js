import * as Kiwi from "kiwi.js";
import UnionFind from "union-find";

export default function*(dimension, points, edges) {
  let solver = new Solver(dimension, points, edges);
  let run = solver.run();

  yield* run;

  let positions = new Map();
  for (let point of points) {
    positions.set(pointId(point), solver.getPosition(point));
  }

  let bounds = solver.getBounds();
  let minBounds = bounds.min;
  let maxBounds = bounds.max;

  return { positions, minBounds, maxBounds };
}

const pointId = point => point.join(":");

class Solver {

  constructor(dimension, points, edges) {
    this.dimension = dimension;
    this.edges = edges;
    this.points = new Map();
    this.solver = new Kiwi.Solver();
    this.variables = new Map();

    // Create the structures that hold the information about each point.
    let variableId = 0;

    for (let point of points) {
      let variables = [];
      let relations = new Map();

      for (let codim = 1; codim < dimension; codim++) {
        variables.push(variableId++);
      }

      for (let codim = 0; codim < dimension; codim++) {
        relations.set(`${codim}:1`, { points: [], codim });
        relations.set(`${codim}:-1`, { points: [], codim });
      }

      this.points.set(pointId(point), { variables, relations, point });
    }

    // Analyze the inputs and outputs that should be averaged over.
    for (let { source, target, codim, dir } of this.edges) {
      if (codim >= this.dimension - 1) {
        continue;
      }

      // Regular source
      if (source[codim + 1] % 2 == 0) {
        this.addRelation(source, target, codim, dir);
      }

      // Singular target
      if (target[codim + 1] % 2 != 0) {
        this.addRelation(target, source, codim, dir);
      }
    }

    // Unify variables along unary relations of highest dimension.
    this.forest = new UnionFind(variableId);

    for (let { relations, point } of this.points.values()) {
      for (let [key, { points, codim }] of relations) {
        if (codim == 0 && points.length == 1) {
          for (let codimHigher = 1; codimHigher < this.dimension; codimHigher++) {
            this.forest.link(
              this.getVariableId(point, codimHigher),
              this.getVariableId(points[0], codimHigher)
            );
          }
          relations.delete(key);
        }
      }
    }
  }

  getPosition(point) {
    let position = [];
    for (let codim = 0; codim < this.dimension; codim++) {
      position.push(this.getValue(point, codim));
    }
    return position;
  }

  getBounds() {
    let min = Array(this.dimension).fill(Infinity);
    let max = Array(this.dimension).fill(-Infinity);

    for (let { point } of this.points.values()) {
      for (let codim = 0; codim < this.dimension; codim++) {
        let value = this.getValue(point, codim);
        min[codim] = Math.min(value, min[codim]);
        max[codim] = Math.max(value, max[codim]);
      }
    }

    //console.log(min, max);

    return { min, max };
  }

  *run() {
    for (let constraint of this.createConstraints()) {
      this.solver.addConstraint(constraint);
    }
    this.solver.updateVariables();
  }

  addRelation(source, target, codim, dir) {
    let relations = this.points.get(pointId(source)).relations;
    let key = `${codim}:${dir}`;
    relations.get(key).points.push(target);
  }

  getVariableId(point, codim) {
    return this.points.get(pointId(point)).variables[codim - 1];
  }

  getVariable(point, codim) {
    let id = this.forest.find(this.getVariableId(point, codim));
    if (!this.variables.has(id)) {
      this.variables.set(id, new Kiwi.Variable());
    }
    return this.variables.get(id);
  }

  getValue(point, codim) {
    if (codim == 0) {
      return point[0];
    } else {
      let variable = this.getVariable(point, codim);
      return variable.value();
    }
  }

  *createConstraints() {
    yield* this.createDistanceConstraints();
    yield* this.createLevelConstraints();
    yield* this.createAverageConstraints();
  }

  /**
   * Constrain points that are connected by an edge to have a distance of at
   * least 1 in the dimension of the edge.
   */
  *createDistanceConstraints() {
    for (let { source, target, codim, dir } of this.edges) {
      if (codim == 0) {
        continue;
      }

      if (codim == 1 && source[0] % 2 == 1) {
        continue;
      }

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
    for (let { source, target, codim } of this.edges) {
      for (let codimLower = 1; codimLower < codim; codimLower++) {
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
    for (let { relations, point } of this.points.values()) {
      for (let { points, codim } of relations.values()) {
        if (points.length >= 1) {
          for (let codimHigher = codim + 1; codimHigher < this.dimension; codimHigher++) {
            yield new Kiwi.Constraint(
              new Kiwi.Expression(
                ...points.map(p => [1 / points.length, this.getVariable(p, codimHigher)])
              ),
              Kiwi.Operator.Eq,
              this.getVariable(point, codimHigher),
              Kiwi.Strength.medium - codim * 10
            );
          }
        }
      }
    }
  }
}
