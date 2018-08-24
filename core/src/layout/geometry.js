import { _assert } from "~/util/debug";

export const typeAt = (diagram, point) => {
  if (point.length == 0) {
    return diagram.getLastPoint().type;
  } else {
    let [height, ...rest] = point;

    height = Math.max(0, height);
    height = Math.min(height, 2 * diagram.data.length);

    let slice = diagram.getSlice({
      height: Math.floor(height / 2),
      regular: height % 2 == 0
    });

    return typeAt(slice, rest);
  }
}

export const pointsOf = function*(diagram, dimension) {
  _assert(diagram.n >= dimension);

  if (dimension == 0) {
    yield [];
  } else {
    for (let [height, slice] of slicesOf(diagram)) {
      for (let point of pointsOf(slice, dimension - 1)) {
        point.unshift(height);
        yield point;
      }
    }
  }
}

export const boundaryOf = (diagram, dimension) => {
  _assert(diagram.n >= dimension);

  if (dimension == 0) {
    return [];
  } else {
    let boundary = [];
    for (let [height, slice] of slicesOf(diagram)) {
      boundary.push(boundaryOf(slice, dimension - 1));
    }
    return boundary;
  }
}

export const slicesOf = function*(diagram) {
  _assert(diagram.n > 0);

  yield [-1, diagram.source];

  for (let height = 0; height < diagram.data.length; height++) {
    yield [height * 2, diagram.getSlice({ height, regular: true })];
    yield [height * 2 + 1, diagram.getSlice({ height, regular: false })];
  }

  yield [diagram.data.length * 2, diagram.target];
  yield [diagram.data.length * 2 + 1, diagram.target];
}

export const getSlice = (diagram, ...heights) => {
  if (heights.length == 0) {
    return diagram;
  } else {
    let [height, ...rest] = heights;
    height = Math.max(height, 0);
    height = Math.min(height, diagram.data.length * 2);
    let slice = diagram.getSlice({
      height: Math.floor(height / 2),
      regular: height % 2 == 0
    });
    return getSlice(slice, ...rest);
  }
}

export const edgesOf = function*(diagram, dimension) {
  if (dimension == 0) {
    return;
  } else {
    // Slice edges
    for (let [height, slice] of slicesOf(diagram)) {
      for (let { source, target, codim, dir } of edgesOf(slice, dimension - 1)) {
        source.unshift(height);
        target.unshift(height);
        codim += 1;
        yield { source, target, codim, dir };
      }
    }

    // Limit edges
    for (let regular = 0; regular <= diagram.data.length; regular++) {
      let points = [...pointsOf(diagram.getSlice({ height: regular, regular: true }), dimension - 1)];

      let backwardLimit = regular > 0 ? diagram.data[regular - 1].backward_limit : null;
      let forwardLimit = regular < diagram.data.length ? diagram.data[regular].forward_limit : null;

      for (let point of points) {
        for (let target of limitAction(backwardLimit, point)) {
          yield {
            source: [regular * 2, ...point],
            target: [regular * 2 - 1, ...target],
            codim: 0,
            dir: -1
          };
        }
        for (let target of limitAction(forwardLimit, point)) {
          yield {
            source: [regular * 2, ...point],
            target: [regular * 2 + 1, ...target],
            codim: 0,
            dir: 1
          };
        }
      }
    }
  }
}

const limitAction = (limit, point) => {
  // Special case: the identity limit preserves all points.
  if (!limit || limit.length == 0) {
    return [point];
  }

  // Dimension zero points are always preserved.
  if (point.length == 0) {
    return [point];
  }

  let [height, ...rest] = point;

  // Before the first component
  if (height < limit[0].first * 2) {
    return [point];
  }

  // After the last component
  if (height > limit[limit.length - 1].last * 2) {
    let offset = 0;
    for (let component of limit) {
      offset += component.last * 2 - component.first * 2 - 2;
    }
    return [[height - offset, ...rest]];
  }

  let offset = 0;
  let targets = new Map();

  for (let component of limit) {
    let first = component.first * 2;
    let last = component.last * 2;

    if (height < first) {
      break;
    }

    if (height == first) {
      targets.set(first - offset, rest);
    }

    if (height == last) {
      targets.set(first - offset + 2, rest);
    }
    
    if (height % 2 == 0 && first < height && height < last) {
      // Regular points on the inside of a limit component are sent nowhere.
      // This is important to prevent the generation of spurious extra geometry.
      return [];
    }

    if (height % 2 != 0 && first < height && height < last) {
      // Singular points on the inside of a limit component are sent to
      // the limit's target height and then further processed by the action
      // of the appropriate sublimit.
      let sublimit = component.sublimits[(height - first - 1) / 2];
      return [...limitAction(sublimit, rest)].map(target => [first - offset + 1, ...target]);
    }

    offset += last - first - 2;
  }

  return [...targets].map(([height, target]) => [height, ...target]);
}