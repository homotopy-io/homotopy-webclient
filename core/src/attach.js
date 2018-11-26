import { _assert } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { LimitComponent, Limit, Content } from "~/limit";
import * as Boundary from "~/boundary";

export const attach = (diagram, build, path, slice) => {
  _assert(diagram instanceof Diagram);
  _assert(slice instanceof Array);

  if (path.boundary == null) {
    let content = build(diagram, path.point, null);
    let new_slice = content.updateSlice(slice);
    return { new_diagram: diagram.rewrite(content), new_slice: new_slice }
  }

  if (path.depth > 1) {
    diagram = diagram.pad(path.depth, path.boundary == 'source');

    let eff_slice = slice.slice(1);
    _assert(eff_slice.length == 0 || eff_slice & 2 == 0);
    let target_side = eff_slice.length > 0 && eff_slice[0] > 0;
    if (target_side) {
      eff_slice[0] = 2 * diagram.source.data.length + 1;
      //eff_slice[0] = diagram.source.data.length * 2 + 1; // move eff_sLice to source level
    }

    let {new_diagram, new_slice} = attach(diagram.source, build, { ...path, depth: path.depth - 1}, eff_slice);
    let overall_slice = [...slice.slice(0, 2), ...new_slice.slice(1)];
    if (target_side && overall_slice.length > 1) {
      overall_slice[1] = eff_slice[0];
      overall_slice[1] += 2;
    }

    return { new_diagram: new Diagram(diagram.n, { source: new_diagram, data: diagram.data }), new_slice: overall_slice };
  }

  // Build the content
  let boundary = Boundary.followPath(diagram, path);
  let content = build(boundary, path.point, path.boundary);

  // Attach the content to the diagram
  if (path.boundary == "source") {
    let data = [content.reverse(), ...diagram.data];
    let source = diagram.source.rewrite(content);
    let new_slice;
    if (slice.length == 0) {
      new_slice = [];
    } else {
      let [first, ...rest] = slice;
      _assert(first == -1);
      let new_rest = content.updateSlice(rest);
      new_slice = [first, ...new_rest];
    }
    return { new_diagram: new Diagram(diagram.n, { source, data }), new_slice };
  } else {
    let source = diagram.source;
    let data = [...diagram.data, content];
    let new_slice;
    if (slice.length == 0) {
      new_slice = [];
    } else {
      let [first, ...rest] = slice;
      let new_first = first + 2;
      let new_rest = content.updateSlice(rest);
      new_slice = [new_first, ...new_rest];
    }
    return { new_diagram: new Diagram(diagram.n, { source, data }), new_slice };
  }
};

export const attachGenerator = (diagram, generator, path, slice) => {
  _assert(generator instanceof Generator);
  return attach(diagram, buildAttachmentContent(generator), path, slice);
};

/**
 * @param {Diagram} diagram
 * @param {Generator} generator
 * @param {number[]} point Attachment point in geometric coordinates.
 * @param {string|null} boundary
 */
const buildAttachmentContent = generator => (diagram, point, boundary) => {
  point = point.map(x => x / 2);

  let inverse = boundary == "source";
  let source = !inverse ? generator.source : generator.target;
  let target = !inverse ? generator.target : generator.source;

  if (diagram.n == 0) {
    let forwardComponent = new LimitComponent(0, { source_type: diagram.type, target_type: generator });
    let backwardComponent = new LimitComponent(0, { source_type: target.type, target_type: generator });
    let forwardLimit = new Limit(0, [forwardComponent]);
    let backwardLimit = new Limit(0, [backwardComponent]);
    return new Content(0, forwardLimit, backwardLimit);
  }

  let forwardLimit = diagram.contractForwardLimit(generator, point, source);
  let singularSlice = forwardLimit.rewrite_forward(diagram);
  let backwardLimit = singularSlice.contractBackwardLimit(generator, point, target);

  return new Content(diagram.n, forwardLimit, backwardLimit);
};
