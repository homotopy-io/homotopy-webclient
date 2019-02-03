import { _assert, _debug } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { LimitComponent, Limit, Content } from "~/limit";
import * as Boundary from "~/boundary";

export const attach = (generators, diagram, build, path, slice) => {
  if (_debug) {
    _assert(diagram instanceof Diagram);
    _assert(slice instanceof Array);
    _assert(generators);
  }

  if (path.boundary == null) {
    let content = build(diagram, path.point, null);
    if (content.error) return content;
    let new_slice = content.updateSlice(slice);
    let new_diagram = diagram.rewrite(content);
    if (_debug) _assert(new_diagram.typecheck(generators));
    return { new_diagram, new_slice: new_slice }
  }

  if (path.depth > 1) {
    //diagram = diagram.pad(path.depth, path.boundary == 'source');
    let source_boundary = path.boundary == 'source';
    let padded_data = diagram.data.map(content => content.pad(path.depth - 1, source_boundary));

    let eff_slice = slice.slice(1);
    if (_debug) _assert(eff_slice.length == 0 || eff_slice & 2 == 0);
    let target_side = eff_slice.length > 0 && eff_slice[0] > 0;
    if (target_side) {
      eff_slice[0] = 2 * diagram.source.data.length + 1;
      //eff_slice[0] = diagram.source.data.length * 2 + 1; // move eff_sLice to source level
    }

    let {new_diagram, new_slice} = attach(generators, diagram.source, build, { ...path, depth: path.depth - 1}, eff_slice);
    let overall_slice = [...slice.slice(0, 2), ...new_slice.slice(1)];
    if (target_side && overall_slice.length > 1) {
      overall_slice[1] = eff_slice[0];
      overall_slice[1] += 2;
    }

    let new_diagram_total = new Diagram({ n: diagram.n, source: new_diagram, data: padded_data /*diagram.data*/ });
    if (_debug) _assert(new_diagram.typecheck(generators));
    return { new_diagram: new_diagram_total, new_slice: overall_slice };
  }

  // Build the content
  let boundary = Boundary.followPath(diagram, path);
  let content = build(boundary, path.point, path.boundary);
  if (content.error) return content;

  // Attach the content to the diagram
  let source, data, new_slice;
  if (path.boundary == "source") {
    data = [content.reverse(), ...diagram.data];
    source = diagram.source.rewrite(content);
    if (slice.length == 0) {
      new_slice = [];
    } else {
      let [first, ...rest] = slice;
      if (_debug) _assert(first == -1);
      let new_rest = content.updateSlice(rest);
      new_slice = [first, ...new_rest];
    }
  } else {
    source = diagram.source;
    data = [...diagram.data, content];
    if (slice.length == 0) {
      new_slice = [];
    } else {
      let [first, ...rest] = slice;
      let new_first = first + 2;
      let new_rest = content.updateSlice(rest);
      new_slice = [new_first, ...new_rest];
    }
  }
  let new_diagram = new Diagram({ n: diagram.n, source, data });
  if (_debug) _assert(new_diagram.typecheck(generators));
  return { new_diagram, new_slice };
};

export const attachGenerator = (generators, diagram, id, path, slice) => {
  if (_debug) _assert(typeof id === 'string');
  let type = generators[id];
  return attach(generators, diagram, buildAttachmentContent(type), path, slice);
};

/**
 * @param {Diagram} diagram
 * @param {Generator} generator
 * @param {number[]} point Attachment point in geometric coordinates.
 * @param {string|null} boundary
 */
const buildAttachmentContent = type => (diagram, point, boundary) => {
  point = point.map(x => x / 2);

  let inverse = boundary == "source";
  let source = !inverse ? type.generator.source : type.generator.target;
  let target = !inverse ? type.generator.target : type.generator.source;

  if (diagram.n == 0) {
    let forwardComponent = new LimitComponent({ n: 0, source_id: diagram.id, target_id: type.generator.id });
    let backwardComponent = new LimitComponent({ n: 0, source_id: target.id, target_id: type.generator.id });
    let forward_limit = new Limit({ n: 0, components: [forwardComponent] });
    let backward_limit = new Limit({ n: 0, components: [backwardComponent] });
    return new Content({ n: 0, forward_limit, backward_limit });
  }

  let forward_limit = diagram.contractForwardLimit(type.generator.id, point, source);
  let singularSlice = forward_limit.rewrite_forward(diagram);
  let backward_limit = singularSlice.contractBackwardLimit(type.id, point, target);

  return new Content({ n: diagram.n, forward_limit, backward_limit });
};
