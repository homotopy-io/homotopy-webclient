import test from "tape";
import { attachGenerator, attach } from "~/attach";
import { Generator } from "~/generator";
import { checkDiagram } from "./util/diagram";

test("Upwards contraction of parallel beads.", t => {
  let x = new Generator("x");
  let f = new Generator("f", x.diagram, x.diagram);
  let g = new Generator("g", x.diagram, x.diagram);
  let a = new Generator("a", f.diagram, g.diagram);

  let diagram = a.diagram;
  diagram = attachGenerator(diagram, f, { boundary: "source", depth: 2, point: [] });
  diagram = attachGenerator(diagram, a, { boundary: "target", depth: 1, point: [0] });

  let result = attach(
    diagram.boost(),
    (diagram, point) => diagram.contract(point.slice(0, -1), [0, 1]),
    { boundary: "target", depth: 1, point: [1, 3] }
  );

  t.equal(result.n, 3, "Dimension.");
  t.equal(result.data.length, 1, "Height.");
  t.equal(result.source.data.length, 2, "Slice 0 height.");
  t.equal(result.getSlice(1).data.length, 1, "Slice 1 height.");
  t.equal(result.getSlice(2).data.length, 1, "Slice 2 height.");
  t.ok(result.getSlice(1).equals(result.getSlice(2)), "Slice 1 and 2 agree.");

  checkDiagram(
    t, result,
    [[1, 0, 0], x],
    [[1, 0, 1], f],
    [[1, 0, 2], x],
    [[1, 0, 3], f],
    [[1, 0, 4], x],

    [[1, 1, 0], x],
    [[1, 1, 1], a],
    [[1, 1, 2], x],
    [[1, 1, 3], a],
    [[1, 1, 4], x],

    [[1, 2, 0], x],
    [[1, 2, 1], g],
    [[1, 2, 2], x],
    [[1, 2, 3], g],
    [[1, 2, 4], x],
  );

  t.end();
});
