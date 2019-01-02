import { _assert, _debug } from '../util/debug'
import * as Kiwi from "kiwi.js";
import UnionFind from "union-find";

export default function*(dimension, arg_points, arg_edges, diagram) {

  //////////////////////////////////////////////////

  let edges = [];
  let vertices = [];
  let regular_levels = [];
  let singular_levels = [];

  // Can't layout a diagram of dimension less than 2
  if (diagram.n < 2) return;

  // Collect data about input wires
  let current_regular_level = [];
  for (var level = 0; level < diagram.source.data.length; level++) {
      var new_edge = {
          structure: 'edge',
          start_height: 0,
          finish_height: null,
          x: 0,
          start_vertex: null,
          finish_vertex: null,
      };
      edges.push(new_edge);
      current_regular_level.push(new_edge);
  }
  regular_levels.push(current_regular_level.slice());

  // Collect data about intermediate levels
  for (var level = 0; level < diagram.data.length; level++) {

      let data = diagram.data[level];
      let height_is_vertex = [];
      let current_singular_level = current_regular_level.slice();

      // Create the new vertices for this level
      let forward_nontrivial_neighbourhood = data.forward_limit.analyzeSingularNeighbourhoods();
      let backward_nontrivial_neighbourhood = data.backward_limit.analyzeSingularNeighbourhoods();
      let s = diagram.getSlice({ height: level, regular: false });
      let r1 = diagram.getSlice({ height: level, regular: true });
      let r2 = diagram.getSlice({ height: level + 1, regular: true });
      let forward_monotone = data.forward_limit.getMonotone(r1.data.length, s.data.length);
      let backward_monotone = data.backward_limit.getMonotone(r2.data.length, s.data.length);
      let new_vertices = [];
      for (let i = 0; i < s.data.length; i++) {
          if (!forward_nontrivial_neighbourhood[i] && !backward_nontrivial_neighbourhood[i]) continue;
          let structure = 'vertex';
          let x = 0;
          let y = level + 0.5;
          let forward_insert = forward_monotone.preimage(i);
          let backward_insert = backward_monotone.preimage(i);
          let singular_height = i;
          let index = vertices.length;
          let vertex = { structure, level, x, y, forward_insert, backward_insert, singular_height, index };
          vertices.push(vertex);
          new_vertices.push(vertex);
      }

      // Remove the edges that have been consumed, and create new edges as necessary
      let offset = 0;
      for (let i = new_vertices.length - 1; i >= 0; i--) {
          let vertex = new_vertices[i];
          vertex.source_edges = [];
          vertex.target_edges = [];

          // Set the source edges correctly for this vertex
          for (let j = vertex.forward_insert.first; j < vertex.forward_insert.last; j++) {
              var edge = regular_levels[level][j]
              vertex.source_edges[j - vertex.forward_insert.first] = edge;
              edge.finish_vertex = vertex;
              edge.finish_height = vertex.y;
          }

          // Create the new edges that are created by this vertex
          let next_slice = diagram.getSlice({ height: level + 1, regular: true });
          let new_edges = [];
          for (let j = vertex.backward_insert.first; j < vertex.backward_insert.last; j++) {
              let index = j;
              let structure = 'edge';
              //let type = next_slice.getSlice({height: j, regular: false}).getLastPoint();
              //data[j].getLastPoint();
              let start_height = vertex.y;
              let finish_height = null;
              //let succeeding = []; // NEED TO POPULATE!!!
              let x = 0;
              let start_vertex = vertex;
              let finish_vertex = null;
              var new_edge = { structure, start_height, finish_height, x, start_vertex, finish_vertex };
              edges.push(new_edge);
              new_edges.push(new_edge);
              vertex.target_edges[j - vertex.backward_insert.first] = new_edge;
          }

          // Update the current_edges array
          let regular_before = current_regular_level.slice(0, vertex.forward_insert.first);
          let regular_after = current_regular_level.slice(vertex.forward_insert.last);
          current_regular_level = regular_before.concat(new_edges.concat(regular_after));
          let singular_before = current_singular_level.slice(0, vertex.forward_insert.first);
          let singular_after = current_singular_level.slice(vertex.forward_insert.last);
          current_singular_level = singular_before.concat([vertex].concat(singular_after));
      }

      // Remember the list of edges at this level of the diagram
      singular_levels.push(current_singular_level);
      regular_levels.push(current_regular_level.slice());
  }

  // Specify finish height of dangling edges
  for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (edge.finish_height == null) {
          edge.finish_height = Math.max(1, diagram.data.length);
      }
      edge.length = edge.finish_height - edge.start_height;
      edge.fill_right = false;
      edge.adjacent_regions = [];
  }

  /***
  * Calculate the x-coordinates of vertices and edges, following these principles:
  *
  *  - Entities at the same level are at least 1 unit apart
  * 
  *  - Where a vertex has both incoming and outgoing wires, the mean
  *    x-coordinate of the first and last incoming wire equals the mean
  *    x-coordinate of the first and last outgoing wire.
  * 
  *  - The vertex x coordinate is set to be this same mean x-coordinate
  ***/

  const x_spacing = 2;

  while (true) {
      let problem = false;

      // Make sure there's enough space between elements
      for (let i = 0; i < regular_levels.length; i++) {
          let level = regular_levels[i];
          for (let j = 0; j < level.length - 1; j++) {
              if (level[j + 1].x < level[j].x + x_spacing) {
                  problem = true;
                  level[j + 1].x = level[j].x + x_spacing;
              }
          }
      }
      for (let i = 0; i < singular_levels.length; i++) {
          let level = singular_levels[i];
          for (let j = 0; j < level.length - 1; j++) {
              if (level[j + 1].x < level[j].x + x_spacing) {
                  problem = true;
                  level[j + 1].x = level[j].x + x_spacing;
              }
          }
      }

      //} while (problem);

      // Even up inputs and outputs for vertices
      for (var i = 0; i < vertices.length; i++) {
          var vertex = vertices[i];
          /*
          if (vertex.source_edges.length == 0) continue;
          if (vertex.target_edges.length == 0) continue;
          */
          if (vertex.source_edges.length + vertex.target_edges.length == 0) continue;
          let source_mean = vertex.source_edges.length == 0 ? null : (vertex.source_edges[0].x + vertex.source_edges[vertex.source_edges.length - 1].x) / 2;
          let target_mean = vertex.target_edges.length == 0 ? null : (vertex.target_edges[0].x + vertex.target_edges[vertex.target_edges.length - 1].x) / 2;
          let shift_source = 0;
          let shift_target = 0;
          let shift_vertex = 0;
          if (source_mean == null) {
              if (vertex.x > target_mean) {
                  shift_target = vertex.x - target_mean;
              } else if (target_mean > vertex.x) {
                  shift_vertex = target_mean - vertex.x;
              }
          } else if (target_mean == null) {
              if (vertex.x > source_mean) {
                  shift_source = vertex.x - source_mean;
              } else if (source_mean > vertex.x) {
                  shift_vertex = source_mean - vertex.x;
              }
          } else {
              let mean = Math.max(vertex.x, target_mean, source_mean);
              shift_source = mean > source_mean ? mean - source_mean : 0;
              shift_target = mean > target_mean ? mean - target_mean : 0;
              shift_vertex = mean > vertex.x ? mean - vertex.x : 0;
          }
          for (let i = 0; i < vertex.source_edges.length; i++) vertex.source_edges[i].x += shift_source;
          for (let i = 0; i < vertex.target_edges.length; i++) vertex.target_edges[i].x += shift_target;
          vertex.x += shift_vertex;
          if (shift_source > 0 || shift_target > 0 || shift_vertex > 0) problem = true;

      }
      if (!problem) break;
  }

  // Find maximum and minimum x-coordinates
  let max_x = -Number.MAX_VALUE;
  let min_x = Number.MAX_VALUE;
  for (var i = 0; i < regular_levels.length; i++) {
    let level = regular_levels[i];
    for (let j = 0; j < level.length; j++) {
      min_x = Math.min(min_x, level[j].x);
      max_x = Math.max(max_x, level[j].x);
    }
  }
  for (var i = 0; i < singular_levels.length; i++) {
    let level = singular_levels[i];
    for (let j = 0; j < level.length; j++) {
      min_x = Math.min(min_x, level[j].x);
      max_x = Math.max(max_x, level[j].x);
    }
  }

  // Set vertex x-coordinates for non-scalars
  for (var i = 0; i < vertices.length; i++) {
      var vertex = vertices[i];
      if (vertex.source_edges.length + vertex.target_edges.length == 0) continue;
      if (vertex.source_edges.length == 1) {
          vertex.x = vertex.source_edges[0].x;
      } else if (vertex.target_edges.length == 1) {
          vertex.x = vertex.target_edges[0].x;
      } else {
          var total_x = 0;
          for (var j = 0; j < vertex.source_edges.length; j++) {
              total_x += vertex.source_edges[j].x;
          }
          for (var j = 0; j < vertex.target_edges.length; j++) {
              total_x += vertex.target_edges[j].x;
          }
          vertex.x = total_x / (vertex.target_edges.length + vertex.source_edges.length);
      }
  }

  // Compute position data of all regular and singular points of the diagram
  let positions = new Map();
  let left_boundary = { x : min_x - 2 };
  let right_boundary = { x : max_x + 2 };
  for (let y = -1; y <= 2 * diagram.data.length + 1; y++) {

    let y_logical = Math.min(Math.max(y, 0), 2 * diagram.data.length);
    let y_delta = y - y_logical;
    let slice = diagram.getSlice(y);
    let structures = y_logical % 2 == 0 ? regular_levels[y_logical / 2] : singular_levels[(y_logical - 1) / 2];
    let y_coord = y;

    for (let x = -1; x <= 2 * slice.data.length + 1; x++) {

      let coord_string = `${y}:${x}`;
      let x_logical = Math.min(Math.max(x, 0), 2 * slice.data.length);
      //let x_delta = x - x_logical;
      let x_coord;

      // Singular x-coordinate
      if (x_logical % 2 == 1) {

        let object = structures[(x_logical - 1) / 2];
        x_coord = object.x;

      // Regular x-coordinate
      } else {

        if (x == -1) {

          x_coord = left_boundary.x;

        } else if (x == 2 * slice.data.length + 1) {

          x_coord = right_boundary.x;

        } else {

          let left_object;
          if (x_logical == 0) {
            left_object = left_boundary;
          } else {
            left_object = structures[(x_logical / 2) - 1];
          }

          let right_object;
          if (x_logical == 2 * slice.data.length) {
            right_object = right_boundary;
          } else {
            right_object = structures[(x_logical / 2)];
          }

          _assert(left_object);
          _assert(right_object);
          x_coord = (left_object.x + right_object.x) / 2;

        }

      }

      let coordinate = [y_coord, x_coord];
      positions.set(coord_string, coordinate);

    }

  }

  let minBounds = [min_x - 2, -1];
  let maxBounds = [max_x + 2, 2 * diagram.data.length + 1];
  yield* []; // fake the existence of an iterative solver
  return { positions, minBounds, maxBounds };

  ///////////////////////////

  /*
  return { edges, vertices, regular_levels, max_x, max_y: diagram.data.length };

  //////////////////////////////////////////////////

  let bounds = solver.getBounds();
  let minBounds = bounds.min;
  let maxBounds = bounds.max;

  yield* [];
  return { positions, minBounds, maxBounds };
  */
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

      if (codim == this.dimension - 1 && this.dimension > 1) {
        if (source[codim] % 2 == 0) {
          this.addRelation(source, target, codim, dir);
        }

        // Singular target
        if (target[codim] % 2 != 0) {
          this.addRelation(target, source, codim, dir);
        }

        continue;
      }

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
    if (_debug) _assert(relations.get(key));
    relations.get(key).points.push(target);
  }

  getVariableId(point, codim) {
    let pointid = this.points.get(pointId(point));
    if (!pointid) return null;
    if (_debug) _assert(pointid);
    return pointid.variables[codim - 1];
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

    yield* this.createHeightConstraints();
    yield* this.createWidthConstraints();
    yield* this.createHorizontalSpacingConstraints();

    /*
    yield* this.createDistanceConstraints();
    yield* this.createLevelConstraints();
    yield* this.createAverageConstraints();
    yield* this.createSquashingConstraints();
    */
  }

  // Every point must be at its designated height
  *createHeightConstraints() {
    for (let { point } of this.points.values()) {
      if (point.length != 2) debugger;
      let variable = this.getVariable(point, 0);
      yield new Kiwi.Constraint(
        variable,
        Kiwi.Operator.Eq,
        point[0], //point[0], // 1?
        Kiwi.Strength.strong
      );
    }
  }

  // To ensure narrow diagrams, weakly ask every point to have x-coordinate 0
  *createWidthConstraints() {
    for (let { point } of this.points.values()) {
      yield new Kiwi.Constraint(
        this.getVariable(point, 1), // 1?
        Kiwi.Operator.Eq,
        0,
        Kiwi.Strength.weak
      );
    }
  }

  // To ensure sufficient spacing, strongly ask each horizontal edge to be at least length 1
  *createHorizontalSpacingConstraints() {
    for (let { source, target, codim, dir } of this.edges) {
      if (codim == 0) continue;
      yield new Kiwi.Constraint(
        new Kiwi.Expression(
          [-dir, this.getVariable(source, codim)],
          [dir, this.getVariable(target, codim)]
        ),
        Kiwi.Operator.Ge,
        1,
        //Kiwi.Strength.required
        Kiwi.Strength.medium
      );
    }
  }

  // Vertical edges must be straight

  /**
   * Put vertices at the average x-coordinate of incoming wires.
   */
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
              //Kiwi.Strength.required
            );
          }
        }
      }
    }
  }
}
