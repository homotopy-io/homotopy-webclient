import test from "tape";
import attach from "~/attach";
import { getPath, followPath } from "~/boundary";
import { Generator } from "~/generator";

test("Simplex to boundary coordinates in 1-diagram.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", x.diagram, y.diagram);
  let g = new Generator("g", y.diagram, z.diagram);
  let d = attach(f.diagram, g, { boundary: "target", depth: 1, point: [] });

  let pairs = [
    [[[0], [-1]], { boundary: "source", depth: 1, point: [] }],
    [[[0], [1]],  { boundary: null, depth: null, point: [0] }],
    [[[1]],       { boundary: null, depth: null, point: [1] }],
    [[[2], [1]],  { boundary: null, depth: null, point: [2] }],
    [[[2], [3]],  { boundary: null, depth: null, point: [2] }],
    [[[3]],       { boundary: null, depth: null, point: [3] }],
    [[[4], [3]],  { boundary: null, depth: null, point: [4] }],
    [[[4], [5]],  { boundary: "target", depth: 1, point: [] }],
  ];

  for (let [points, path] of pairs) {
    t.deepEqual(getPath(d, points), path);
  }

  t.end();
});

test("Simplex to boundary coordinates in 2-diagram.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", x.diagram, y.diagram);
  let g = new Generator("g", y.diagram, z.diagram);
  let h = new Generator("h", x.diagram, z.diagram);
  let s = attach(f.diagram, g, { boundary: "target", depth: 1, point: [] });
  let a = new Generator("a", s, h.diagram);
  let d = a.diagram;

  let pairs = [
    // TODO
  ];

  for (let [point, path] of pairs) {
    t.deepEqual(getPath(d, point), path);
  }

  t.end();
});