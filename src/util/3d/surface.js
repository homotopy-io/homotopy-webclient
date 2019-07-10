import cycle from "../cycle";

export class Surface {

  constructor() {
    this.vertices = new Map();
    this.edges = new Map();
    this.faces = new Map();
  }

  static fromCells(vertices, cells, annotations = []) {
    let surface = new Surface();

    // Vertices
    for (let i = 0; i < vertices.length; i++) {
      let vertex = new Vertex(i, vertices[i], annotations[i]);
      surface.vertices.set(i, vertex);
    }

    // Cells
    for (let cell of cells) {
      // Create edges
      let edges = [];

      for (let [a, b] of cycle(cell)) {
        let aVertex = surface.vertices.get(a);
        let bVertex = surface.vertices.get(b);

        let edge = aVertex.edges.get(b);

        if (!edge) {
          let edgeIndex = surface.edges.size;
          edge = new Edge(edgeIndex);
          surface.edges.set(edgeIndex, edge);
          edge.vertices = [aVertex, bVertex];

          aVertex.edges.set(b, edge);
          bVertex.edges.set(a, edge);
        }

        edges.push(edge);
      }

      // Create face
      let faceIndex = surface.faces.size;
      let face = new Face(faceIndex);
      face.edges.push(...edges);
      face.vertices.push(...cell.map(index => surface.vertices.get(index)));
      surface.faces.set(faceIndex, face);

      // Associate face to edges
      for (let edge of edges) {
        edge.faces.push(face);
      }
    }

    return surface;
  }

}

export class Edge {

  constructor(index) {
    this.index = index;
    this.faces = [];
    this.vertices = [];
  }

  isBoundary() {
    return this.faces.length < 2;
  }

  isSingular() {
    return this.faces.length > 2;
  }

}

export class Face {

  constructor(index) {
    this.index = index;
    this.edges = [];
    this.vertices = [];
  }

}

export class Vertex {

  constructor(index, position, annotation = null) {
    this.index = index;
    this.edges = new Map();
    this.position = position;
    this.annotation = annotation;
  }

  get faces() {
    let faces = new Set();

    for (let edge of this.edges.values()) {
      for (let face of edge.faces) {
        faces.add(face);
      }
    }

    return faces;
  }

  isBoundary() {
    for (let edge of this.edges.values()) {
      if (edge.isBoundary()) {
        return true;
      }
    }

    return false;
  }

  isSingular() {
    // TODO
    for (let edge of this.edges.values()) {
      if (edge.isSingular()) {
        return true;
      }
    }

    return false;
  }

}