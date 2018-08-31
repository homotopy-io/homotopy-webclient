import test from "tape";
import { attachGenerator } from "~/attach";
import { Generator } from "~/generator";

test("usesCell detects usage of generator in 1-cell.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", x.diagram, y.diagram);

  t.ok(f.usesCell(x), "f : x -> y uses x.");
  t.ok(f.usesCell(y), "f : x -> y uses y.");
  t.ok(!f.usesCell(z), "f : x -> y does not use z.");

  t.end();
});