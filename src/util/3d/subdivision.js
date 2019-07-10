import { Surface } from "./surface";
import * as Vector from "./vectors";
import cycle from "../cycle";

/**
 * Perform Catmull-Clark subdivision on the provided surface.
 *
 * @param {Surface} surface The surface to subdivide.
 * @return {Surface} The subdivided surface.
 */
export const subdivideSurface = (surface, mergeFace = (a) => a, mergeEdge = (a) => a) => {
  if (!surface) return null;
  let vertices = [];
  let annotations = [];
  let cells = [];

  // Create a face point for every face.
  let faceVertices = new Map();

  if (!surface) debugger;

  for (let face of surface.faces.values()) {
    //if (face.vertices.length == 0) continue;
    let position = Vector.average(...[...face.vertices].map(p => p.position));
    let annotation = mergeFace(...[...face.vertices].map(v => v.annotation));

    faceVertices.set(face.index, vertices.length);
    vertices.push(position);
    annotations.push(annotation);
  }

  // Create an edge point for each edge.
  let edgeVertices = new Map();

  for (let edge of surface.edges.values()) {
    let faces = (edge.isBoundary())
      ? []
      : edge.faces; 

    let position = Vector.average(
      ...edge.vertices.map(v => v.position),
      ...faces.map(face => vertices[faceVertices.get(face.index)])
    );

    let annotation = mergeEdge(
      ...edge.vertices.map(v => v.annotation)
    );

    edgeVertices.set(edge.index, vertices.length);
    vertices.push(position);
    annotations.push(annotation);
  }

  // Control points
  let controlPoints = new Map();

  for (let vertex of surface.vertices.values()) {

    if (!vertex.isBoundary()) {
      let faces = [...vertex.faces];
      let edges = [...vertex.edges.values()];

      let Q = Vector.average(...faces.map(face => vertices[faceVertices.get(face.index)]));
      let R = Vector.average(...edges.map(edge => vertices[edgeVertices.get(edge.index)]));
      let S = vertex.position;

      if (!Q || !R) return surface;

      let vector = [0, 0, 0];
      Vector.addScaled(vector, Q, 1 / edges.length);
      Vector.addScaled(vector, R, 2 / edges.length);
      Vector.addScaled(vector, S, (edges.length - 3) / edges.length);

      controlPoints.set(vertex.index, vertices.length);
      vertices.push(vector);
      annotations.push(vertex.annotation);
    } else if (vertex.isBoundary()) {
      let edges = [...vertex.edges.values()].filter(edge => edge.isBoundary());

      let R = Vector.average(...edges.map(edge => vertices[edgeVertices.get(edge.index)]));
      let S = vertex.position;

      let vector = [0, 0, 0];
      Vector.addScaled(vector, R, 2 / edges.length);
      Vector.addScaled(vector, S, (edges.length - 2) / edges.length);

      controlPoints.set(vertex.index, vertices.length);
      vertices.push(vector);
      annotations.push(vertex.annotation);
    } else {
      controlPoints.set(vertex.index, vertices.length);
      vertices.push(vertex.position);
      annotations.push(vertex.annotation);
    }
  }

  // Create cells
  for (let face of surface.faces.values()) {
    let index = 0;
    for (let [a, b] of cycle(face.edges)) {
      cells.push([
        edgeVertices.get(a.index),
        controlPoints.get(face.vertices[(index + 1) % face.vertices.length].index),
        edgeVertices.get(b.index),
        faceVertices.get(face.index)
      ]);
      index += 1;
    }
  }

  return Surface.fromCells(vertices, cells, annotations);
};