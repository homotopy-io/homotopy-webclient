import UnionFind from "union-find";

export const groupSurface = (surface, fn) => {
  let forest = new UnionFind(surface.vertices.size);

  for (let edge of surface.edges.values()) {
    let [a, b] = edge.vertices;

    if (fn(a.annotation, b.annotation)) {
      forest.link(a.index, b.index);
    }
  }

  let groups = new Map();

  for (let vertex of surface.vertices.values()) {
    let id = forest.find(vertex.index);

    if (!groups.has(id)) {
      groups.set(id, new Set());
    }

    groups.get(id).add(vertex);
  }

  return [...groups.values()];
};