import test from "tape";
import { attachGenerator } from "~/attach";
import { Generator } from "~/generator";
import { unprojectPoint } from "~/layout/geometry";

test("Unproject point in projected 2-diagram.", t => {
  let x = new Generator("x");
  let f = new Generator("f", x.diagram, x.diagram);
  let g = attachGenerator(f.diagram, f, { boundary: "source", depth: 1, point: [] });
  let a = new Generator("a", g, f.diagram);
  let diagram = a.diagram;

  let pairs = [
    [[-1], [-1, 3]],
    [[0], [0, 3]],
    [[1], [1, 1]],
    [[2], [2, 1]],
    [[3], [3, 1]]
  ];

  for (let [input, output] of pairs) {
    t.deepEqual(unprojectPoint(diagram, input), output);
  }

  t.end();
});

test.skip("Edges of 1-diagram.");
test.skip("Edges of 2-diagram.");
test.skip("Edges of 2-diagram with multiple parallel scalars.");
test.skip("Edges of 3-diagram.");
