import { _assert } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { LimitComponent, ForwardLimit, BackwardLimit, Content } from "~/limit";
import * as Boundary from "~/boundary";

export const attach = (diagram, generator, path) => {
  _assert(generator instanceof Generator);
  _assert(diagram instanceof Diagram);

  if (path.boundary == null) {
    _assert(generator.n - 1 == diagram.n);
    return diagram.rewrite(generator.content);
  }

  _assert(generator.n > 0);
  _assert(generator.n + path.depth - 1 == diagram.n);

  // Follow the path
  if (path.depth > 1) {
    if (path.boundary == "source") {
      diagram = diagram.pad(path.depth);
    }

    let source = attach(diagram.source, generator, { ...path, depth: path.depth - 1 });
    return new Diagram(diagram.n, { source, data: diagram.data });
  }

  // Create attachment content
  let boundary = Boundary.followPath(diagram, path);
  let content = buildAttachmentContent(boundary, generator, path.point, path.boundary == "source");

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
}

export default attach;

/**
 * @param {Diagram} diagram
 * @param {Generator} generator
 * @param {number[]} point Attachment point in algebraic coordinates.
 * @param {boolean} inverse
 */
const buildAttachmentContent = (diagram, generator, point, inverse) => {
  let source = !inverse ? generator.source : generator.target;
  let target = !inverse ? generator.target : generator.source;

  if (diagram.n == 0) {
    let forwardComponent = new LimitComponent(0, { type: generator });
    let backwardComponent = new LimitComponent(0, { type: target.type });

    let forwardLimit = new ForwardLimit(0, [forwardComponent], !inverse);
    let backwardLimit = new BackwardLimit(0, [backwardComponent], inverse);

    return new Content(0, forwardLimit, backwardLimit);
  }

  let forwardLimit = diagram.contractForwardLimit(generator, point, source, !inverse);
  let singularSlice = forwardLimit.rewrite(diagram);
  let backwardLimit = singularSlice.contractBackwardLimit(generator, point, target, inverse);

  return new Content(diagram.n, forwardLimit, backwardLimit);
}
