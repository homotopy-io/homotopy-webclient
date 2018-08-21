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
  let content = buildAttachmentContent(boundary, generator, path.point, false);

  // Attach the content to the diagram
  if (path.boundary == "source") {
    diagram.data.unshift(content);
    diagram.source.rewrite(content.reverse(generator.source));
  } else {
    diagram.data.push(content);
  }
}

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
