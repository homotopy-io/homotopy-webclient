import * as Kiwi from "kiwi.js";

export default function*(dimension, points, edges) {
  let solver = new Solver(dimension, points, edges);
  let run = solver.run();

  yield* run;

  let positions = point => solver.getPosition(point);
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

    // Create the structures that hold the information about each point.
    for (let point of points) {
      let variables = [];
      let relations = new Map();

      for (let codim = 0; codim < dimension; codim++) {
        variables.push(new Kiwi.Variable());
        relations.set(`${codim}:1`, { points: [], codim });
        relations.set(`${codim}:-1`, { points: [], codim });
      }

      this.points.set(pointId(point), {
        variables,
        relations,
        point
      });
    }

    // Analyze the inputs and outputs that should be averaged over.
    for (let { source, target, codim, dir } of this.edges) {
      for (let codimHigher = codim + 1; codimHigher < this.dimension; codimHigher++) {
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
    for (let codim = 0; codim < this.dimension; codim++) {
      position.push(this.getVariable(point, codim).value());
    }
    return position;
  }

  getBounds() {
    let min = Array(this.dimension).fill(Infinity);
    let max = Array(this.dimension).fill(-Infinity);

    for (let { variables } of this.points.values()) {
      for (let codim = 0; codim < this.dimension; codim++) {
        min[codim] = Math.min(variables[codim].value(), min[codim]);
        max[codim] = Math.max(variables[codim].value(), max[codim]);
      }
    }

    return { min, max };
  }

  *run() {
    for (let constraint of this.createConstraints()) {
      this.solver.addConstraint(constraint);
      yield;
    }
    this.solver.updateVariables();
  }

  addRelation(source, target, codim, dir) {
    let relations = this.points.get(pointId(source)).relations;
    let key = `${codim}:${dir}`;
    relations.get(key).points.push(target);
  }

  getVariable(point, codim) {
    return this.points.get(pointId(point)).variables[codim];
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
    for (let { relations, point } of this.points.values()) {
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

