import test from "tape";
import { attachGenerator } from "~/attach";
import { Generator } from "~/generator";
import { checkDiagram } from "./util/diagram";

test("Rewrite 0-diagrams via attachment", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let f = new Generator("f", x.diagram, y.diagram);

  let xd = x.diagram;
  let yd = attachGenerator(xd, f, { boundary: null, depth: null, point: [] });

  t.equal(yd.n, 0, "Dimension");
  t.equal(yd.type, y, "Type");
  t.end();
});

test("Attach sequences of 1-diagrams", t => {
  let w = new Generator("w");
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", w.diagram, x.diagram);
  let g = new Generator("g", x.diagram, y.diagram);
  let h = new Generator("h", y.diagram, z.diagram);

  let attach0 = attachGenerator(g.diagram, f, { boundary: "source", depth: 1, point: [] });
  let attach1 = attachGenerator(attach0, h, { boundary: "target", depth: 1, point: [] });

  t.equal(attach0.n, 1, "Dimension of left composition");
  t.equal(attach0.data.length, 2, "Size of left composition");

  checkDiagram(
    t, attach0,
    [[0], w],
    [[1], f],
    [[2], x],
    [[3], g],
    [[4], y]
  );

  t.equal(attach1.n, 1, "Dimension of right composition");
  t.equal(attach1.data.length, 3, "Size of right composition");

  checkDiagram(
    t, attach1,
    [[0], w],
    [[1], f],
    [[2], x],
    [[3], g],
    [[4], y],
    [[5], h],
    [[6], z]
  );

  t.end();
});

test("Whiskering 2-diagrams.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", x.diagram, y.diagram);
  let g = new Generator("g", x.diagram, y.diagram);
  let a = new Generator("a", f.diagram, g.diagram);
  let left = new Generator("left", z.diagram, x.diagram);
  let right = new Generator("right", x.diagram, z.diagram);

  let whiskerLeft = attachGenerator(a.diagram, left, { boundary: "source", depth: 2, point: [] });
  let whiskerRight = attachGenerator(a.diagram, right, { boundary: "target", depth: 2, point: [] });

  t.equal(whiskerLeft.n, 2, "Dimension of left whiskering.");
  t.equal(whiskerRight.n, 2, "Dimension of right whiskering.");

  checkDiagram(
    t, whiskerLeft,
    [[0, 0], z],
    [[0, 1], left],
    [[0, 2], x],
    [[0, 3], f],
    [[0, 4], y],
    [[2, 1], left],
    [[2, 3], g]
  );

  checkDiagram(
    t, whiskerRight,
    [[0, 0], x],
    [[0, 1], f],
    [[0, 2], y],
    [[0, 3], right],
    [[0, 4], z],
    [[2, 1], g],
    [[2, 3], right]
  );

  t.end();
});

// TODO: Build 2-diagram by attaching mutliplication maps.
