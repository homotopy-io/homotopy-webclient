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
    diagram.rewrite(generator.getContent());
    return;
  }

  _assert(generator.n > 0);
  _assert(generator.n + path.depth - 1 == diagram.n);

  // Follow the path
  if (path.depth > 1) {
    if (path.boundary == "source") {
      diagram.pad(path.depth);
    }

    attach(diagram.source, generator, { ...path, depth: path.depth - 1 });
  }

  // Create attachment content
  let boundary = Boundary.followPath(diagram, path);
  let attachPoint = path.point.map(x => Math.floor(x / 2));
  let content = buildAttachmentContent(boundary, generator, attachPoint, false);

  // Attach the content to the diagram
  if (path.boundary == "source") {
    diagram.data.unshift(content);
    diagram.source.rewrite(content.reverse(generator.source));
  } else {
    diagram.data.push(content);
  }
}

/**

    let forward_limit = this.contractForwardLimit(type, position, source, !flip);
    let singular_diagram = forward_limit.rewrite(this.copy());
    let backward_limit = singular_diagram.contractBackwardLimit(type, position, target, flip);
return new Content(this.n, forward_limit, backward_limit);
*/

/**
 * @param {Diagram} diagram
 * @param {Generator} generator
 * @param {number[]} point Attachment point in algebraic coordinates.
 * @param {boolean} inverse
 */
export const buildAttachmentContent = (diagram, generator, point, inverse) => {
  let source = !inverse ? generator.getSource() : generator.getTarget();
  let target = !inverse ? generator.getTarget() : generator.getSource();

  if (diagram.n == 0) {
    let forwardComponent = new LimitComponent(0, { type: generator });
    let backwardComponent = new LimitComponent(0, { type: target.type });

    let forwardLimit = new ForwardLimit(0, [forwardComponent], !inverse);
    let backwardLimit = new BackwardLimit(0, [backwardComponent], inverse);

    return new Content(0, forwardLimit, backwardLimit);
  }

  let forwardLimit = diagram.contractForwardLimit(generator, point, source, !inverse);
  let singularSlice = forwardLimit.rewrite(diagram.copy());
  let backwardLimit = singularSlice.contractBackwardLimit(generator, point, target, inverse);

  return new Content(diagram.n, forwardLimit, backwardLimit);
}
