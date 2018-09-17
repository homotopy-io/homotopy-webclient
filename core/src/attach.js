import { _assert } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { SLimitComponent, SLimit, Content } from "~/slimit";
import * as Boundary from "~/boundary";

export const attach = (diagram, build, path) => {
  _assert(diagram instanceof Diagram);

  if (path.boundary == null) {
    let content = build(diagram, path.point, null);
    return diagram.rewrite(content);
  }

  if (path.depth > 1) {
    if (path.boundary == "source") {
      diagram = diagram.pad(path.depth);
    }

    let source = attach(diagram.source, build, { ...path, depth: path.depth - 1});
    return new Diagram(diagram.n, { source, data: diagram.data });
  }

  // Build the content
  let boundary = Boundary.followPath(diagram, path);
  let content = build(boundary, path.point, path.boundary);

  // Attach the content to the diagram
  if (path.boundary == "source") {
    let data = [content.reverse(diagram.source), ...diagram.data];
    let source = diagram.source.rewrite(content);
    return new Diagram(diagram.n, { source, data });
  } else {
    let source = diagram.source;
    let data = [...diagram.data, content];
    return new Diagram(diagram.n, { source, data });
  }
};

export const attachGenerator = (diagram, generator, path) => {
  _assert(generator instanceof Generator);
  return attach(diagram, buildAttachmentContent(generator), path);
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

  if (diagram.n == 0) { // Confused about how to convert this to SLimitComponent
    let forwardComponent = new LimitComponent(0, {  type: generator });
    let backwardComponent = new LimitComponent(0, { type: target.type });

    let forwardLimit = new ForwardLimit(0, [forwardComponent]);
    let backwardLimit = new BackwardLimit(0, [backwardComponent]);

    return new Content(0, forwardLimit, backwardLimit);
  }

  let forwardLimit = diagram.contractForwardLimit(generator, point, source, !inverse);
  let singularSlice = forwardLimit.rewrite_forward(diagram);
  let backwardLimit = singularSlice.contractBackwardLimit(generator, point, target, inverse);

  return new Content(diagram.n, forwardLimit, backwardLimit);
};
