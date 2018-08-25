import test from "tape";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";

test("Identity of 0-diagram.", t => {
  let x = new Generator("x");

  let xd = x.diagram;
  let xi = xd.boost();
  t.equal(xi.n, 1, "Dimension");
  t.deepEqual(xi.data, [], "Data");
  t.equal(xi.source, xd, "Source");

  t.end();
});

test("Identity of 1-diagram.", t => {
  let x = new Generator("x");
  let f = new Generator("f", x.diagram, x.diagram);

  let fd = f.diagram;
  let fi = fd.boost();
  t.equal(fi.n, 2, "Dimension");
  t.deepEqual(fi.data, [], "Data");
  t.equal(fi.source, fd, "Source");

  t.end();
});

test("Rewrite of 0-diagram.", t => {
  let x = new Generator("x");
  let y = new Generator("y");
  let f = new Generator("f", x.diagram, y.diagram);

  let fd = f.diagram;
  let xd = x.diagram;
  let yd = xd.rewrite(fd.data[0]);

  t.equal(yd.type, y, "Type");
  t.end();
});

test("Rewrite of 1-diagram.", t => {
  // TODO
  t.end();
});

test("Rewrite of 2-diagram.", t => {
  // TODO
  t.end();
});