/**
 * Creates a vertex buffer from a surface.
 *
 * @param {Surface} surface
 * @return {Float32Array}
 */
export const vertexBuffer = (surface) => {
  let buffer = new Float32Array(surface.vertices.size * 3);

  for (let vertices of surface.vertices.values()) {
    buffer[vertices.index * 3 + 0] = vertices.position[0];
    buffer[vertices.index * 3 + 1] = vertices.position[1];
    buffer[vertices.index * 3 + 2] = vertices.position[2];
  }

  return buffer;
};

/**
 * Creates an index buffer from a surface by performing a fan triangulation on
 * each face of the surface. The polygons of the faces are required to be convex.
 *
 * @param {Surface} surface
 * @param {Uint32Array}
 */
export const indexBuffer = (surface, filter = () => true) => {
  let faces = [];

  for (let face of surface.faces.values()) {
    let vertices = [...face.vertices];

    if (!filter(...vertices.map(vertex => vertex))) {
      continue;
    }

    for (let index = 1; index <= vertices.length - 2; index++) {
      faces.push(vertices[0].index, vertices[index].index, vertices[index + 1].index);
    }
  }

  return new Uint32Array(faces);
};