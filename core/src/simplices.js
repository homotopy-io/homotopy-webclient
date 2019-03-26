import { _assert, _debug, _validate, isNatural, isInteger, _propertylist } from "~/util/debug";

export class Simplex {

  constructor({ point_names, id }) {
    if (_debug) {
      _assert(point_names instanceof Array);
      _assert(point_names.length > 0);
    }
    this.point_names = point_names;
    this.id = id;
    this.first_point = this.point_names[0];
    this.last_point = this.point_names[this.point_names.length - 1];
  }

  compose(simplex2) {
    let simplex1 = this;
    if (_debug) {
      _assert(simplex1.first_point === simplex2.last_point);
    }
    let point_names = [...simplex2.point_names, ...simplex1.point_names.slice(1)];
    let id = simplex2.id;
    return new Simplex({ point_names, id });
  }

  prependCoordinate(coordinate) {
    if (_debug) {
      _assert(isInteger(coordinate));
    }
    let point_names = [];
    let prefix = coordinate.toString();
    if (this.point_names[0].length > 0) prefix = prefix + ',';
    for (let i = 0; i < this.point_names.length; i++) {
      point_names.push(prefix + this.point_names[i]);
    }
    let id = this.id;
    return new Simplex({ point_names, id });
  }

}

export class Complex {

  constructor({ n, simplices, generators }) {
    if (_debug) {
      _assert(isNatural(n));
      _assert(generators);
      _assert(simplices instanceof Array);
    }
    this.n = n;
    this.simplices = simplices;
    this.generators = generators;

  }

  addDisjointSimplices(new_complex) {
    let simplices = [...this.simplices, ...new_complex.simplices];
    return new Complex({ simplices, generators: this.generators, n: this.n });
  }

  addEdges(edges, max_simplex_size) {
    if (_debug) {
      _assert(isNatural(max_simplex_size))
    }
    let complex = this;
    for (let i = 0; i < edges.length; i++) {
      let edge = edges[i];
      complex = complex.addEdge(edge, max_simplex_size);
    }
    return complex;
  }

  // Add an edge to the simplex, composing it with all existing simplices
  addEdge(edge, max_simplex_size) {

    if (_debug) {
      _assert(isNatural(max_simplex_size))
    }
    let simplices = this.simplices.slice();

    // Precompose edge with all possible existing simplices
    let before = simplices.filter(simplex => {
      return (simplex.last_point === edge.first_point)
    });
    let after = simplices.filter(simplex => {
      return (simplex.first_point === edge.last_point)
    });
    for (let i=0; i<before.length; i++) {
      let before_simplex = before[i];
      for (let j=0; j<after.length; j++) {
        let after_simplex = after[j];
        if (after_simplex.point_names.length + edge.point_names.length + before_simplex.point_names.length - 2 > max_simplex_size) {
          continue;
        }
        let new_simplex = after_simplex.compose(edge).compose(before_simplex);
        if (new_simplex.point_names.length > max_simplex_size) debugger;
        simplices.push(new_simplex);
      }
    }
    return new Complex({ simplices, generators: this.generators, n: this.n });

  }

  trimInvisible() {
    let simplices = [];
    for (let i=0; i<this.simplices.length; i++) {
      let simplex = this.simplices[i];
      let id = simplex.id;
      let generator = this.generators[id];
      if (simplex.point_names.length + generator.generator.n > this.n) {
        simplices.push(simplex);
      }
    }
    return new Complex({ simplices, generators: this.generators, n: this.n });
  }

  prependCoordinate(coordinate) {
    if (_debug) {
      _assert(isInteger(coordinate));
    }
    let simplices = [];
    for (let i = 0; i < this.simplices.length; i++) {
      simplices.push(this.simplices[i].prependCoordinate(coordinate));
    }
    return new Complex({ simplices, generators: this.generators, n: this.n });
  }

  getByDimension() {
    let simplices = [];
    for (let i=0; i<this.simplices.length; i++) {
      let simplex = this.simplices[i];
      let length = simplex.point_names.length;
      if (simplices[length - 1] === undefined) simplices[length - 1] = [];
      simplices[length - 1].push(simplex);
    }
    return simplices;
  }

  // Restrict the complex to simplices up to a given size
  restrict(size) {
    let simplices = this.simplices.filter(simplex => simplex.point_names.length <= size);
    return new Complex({ simplices, generators: this.generators, n: this.n });
  }


}