import test from "tape";
import { Generator } from "~/generator";

test("usesId detects usage of generator in 1-cell.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let z = new Generator("z");
  let f = new Generator("f", x.diagram, y.diagram);

  t.ok(f.usesId(x.id), "f : x -> y uses x.");
  t.ok(f.usesId(y.id), "f : x -> y uses y.");
  t.ok(!f.usesId(z.id), "f : x -> y does not use z.");

  t.end();
});