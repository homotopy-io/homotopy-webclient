import cycle from "../cycle";

export class Surface {

  constructor() {
    this.vertices = new Map();
    this.faces = new Map();
    this.edges = new Map();
    this.halfEdges = new Map();
  }

  static fromCells(vertices, cells) {
    let surface = new Surface();

    // Add vertices
    for (let i = 0; i < vertices.length; i++) {
      let vertex = new Vertex(vertices[i]);
      vertex.index = i;
      surface.vertices.set(i, vertex);
    }

    // Add faces and their half edges.
    for (let i = 0; i < cells.length; i++) {
      let face = new Face();
      face.index = i;
      surface.faces.set(i, face);

      // Add half edges
      let halfEdges = [];
      for (let [a, b] of cycle(cells[i])) {
        let halfEdgeIndex = `${a}-${b}`;
        let halfEdgeTwinIndex = `${b}-${a}`;

        let vertex = surface.vertices.get(a);
        let halfEdge = new HalfEdge(surface.vertices.get(a));
        halfEdge.index = halfEdgeIndex;
        halfEdge.vertex = vertex;
        halfEdge.face = face;
        halfEdges.push(halfEdge);
        vertex.halfEdge = halfEdge;

        surface.halfEdges.set(halfEdgeIndex, halfEdge);

        let twin = surface.halfEdges.get(halfEdgeTwinIndex);
        if (twin) {
          twin.twin = halfEdge;
          halfEdge.twin = twin;
          halfEdge.edge = twin.edge;
        } else {
          let edgeIndex = surface.edges.size;
          let edge = new Edge();
          edge.halfEdge = halfEdge;
          edge.index = edgeIndex;
          halfEdge.edge = edge;
          surface.edges.set(edgeIndex, edge);
        }
      }

      // Connect face to half edge
      face.halfEdge = halfEdges[0];

      // Connect half edges around face.
      for (let [a, b] of cycle(halfEdges)) {
        a.next = b;
        b.prev = a;
      }
    }

    // Set vertex half edges correctly
    for (let vertex of surface.vertices.values()) {
      let halfEdge = vertex.halfEdge;

      if (halfEdge == null) {
        throw new Error(`Isolated vertex ${vertex.index}.`);
      }

      while (halfEdge.twin && halfEdge.twin.next && halfEdge.twin.next != vertex.halfEdge) {
        halfEdge = halfEdge.twin.next;
      }

      vertex.halfEdge = halfEdge;
    }

    return surface;
  }

}

export default Surface;

/**
 * Invariant: point.edge.point == point
 *
 * Invariant: All the edges adjacent to this point must be reachable via the
 * prev chain of the specified adjacent halfedge.
 */
export class Vertex {

  constructor(vector) {
    this.index = null;
    this.vector = vector;
    this.halfEdge = null;
  }

  *edges() {
    let last = null;

    for (let halfEdge of this.halfEdges()) {
      yield halfEdge.edge;
      last = halfEdge;
    }

    if (last.prev && !last.prev.twin) {
      yield last.prev.edge;
    }
  }

  *halfEdges() {
    let halfEdge = this.halfEdge;

    do {
      yield halfEdge;
      halfEdge = halfEdge.prev ? halfEdge.prev.twin : null;
    } while (halfEdge != null && halfEdge != this.halfEdge);
  }

  *faces() {
    for (let halfEdge of this.halfEdges()) {
      yield halfEdge.face;
    }
  }

  onBoundary() {
    let last = null;
    for (let halfEdge of this.halfEdges()) {
      last = halfEdge;
    }

    return last.prev.twin != this.halfEdge;
  }

}

export class HalfEdge {

  constructor(vertex) {
    this.vertex = vertex;
    this.face = null;
    this.twin = null;
    this.next = null;
    this.prev = null;
    this.edge = null;
  }

}

export class Edge {

  constructor() {
    this.index = null;
    this.halfEdge = null;
  }

}

export class Face {

  constructor() {
    this.index = null;
    this.halfEdge = null;
  }

  /**
   * Half edges surrounding this face.
   */
  *halfEdges() {
    let halfEdge = this.halfEdge;
    do {
      yield halfEdge;
      halfEdge = halfEdge.next;
    } while (halfEdge != null && halfEdge != this.halfEdge);
  }

  /**
   * Vertices adjacent to this face.
   */
  *vertices() {
    for (let halfEdge of this.halfEdges()) {
      yield halfEdge.vertex;
    }
  }

}