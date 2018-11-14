import { _assert, isNatural } from "~/util/debug";

/*
export const typeAt = (diagram, point) => {
  if (point.length == 0) {
    let maxType = null;

    return diagram.getLastPoint();

    for (let t of typesOf(diagram)) {
      _assert(t);
      _assert(isNatural(t.n));
      if (!maxType || t.n > maxType.n) {
        maxType = t;
      }
    }

    return maxType;

  } else {
    let [height, ...rest] = point;

    _assert(!isNaN(height));
    height = Math.max(0, height);
    _assert(!isNaN(height));
    height = Math.min(height, 2 * diagram.data.length);
    _assert(!isNaN(height));

    let slice = diagram.getSlice({
      height: Math.floor(height / 2),
      regular: height % 2 == 0
    });

    return typeAt(slice, rest);
  }
};
*/

export const typeAt = (diagram, point) => {
  return diagram.getActionType(point);
  
}

/*
export const typesOf = function*(diagram) {
  if (diagram.n == 0) {
    _assert(diagram.type);
    yield diagram.type;
    return;
  } else {
    yield* typesOf(diagram.source);

    for (let content of diagram.data) {
      let type = content.forward_limit[0].target_type;
      _assert(type);
      yield type;
    }
  }
};
*/

export const pointsOf = function*(diagram, dimension) {
  _assert(diagram.n >= dimension);

  if (dimension == 0) {
    yield [];
  } else {
    for (let [height, slice] of slicesOf(diagram)) {
      for (let point of pointsOf(slice, dimension - 1)) {
        point.unshift(height);
        _assert(point);
        yield point;
      }
    }
  }
};

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
};

export const slicesOf = function*(diagram) {
  _assert(diagram.n > 0);

  yield [-1, diagram.source];

  for (let height = 0; height < diagram.data.length; height++) {
    yield [height * 2, diagram.getSlice({ height, regular: true })];
    yield [height * 2 + 1, diagram.getSlice({ height, regular: false })];
  }

  yield [diagram.data.length * 2, diagram.target];
  yield [diagram.data.length * 2 + 1, diagram.target];
};

export const unprojectPoint = (diagram, point) => {
  if (point.length >= diagram.n) {
    return point;
  } else {
    diagram = diagram.getSlice(...point);
    return [...point, ...lastPoint(diagram)];
  }
};

export const lastPoint = (diagram) => {
  if (diagram.n == 0) {
    return [];
  }

  if (diagram.data.length == 0) {
    return [0, ...lastPoint(diagram.source)];
  }

  let k = diagram.data.length - 1;

  while (k > 0 && diagram.data[k].forward_limit.length + diagram.data[k].backward_limit.length == 0) {
    k--;
  }

  return [k * 2 + 1, ...lastPoint(diagram.getSlice({
    height: k,
    regular: false
  }))];
};

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
};

export const edgesOf = function*(diagram, dimension) {
  if (dimension == 0) return;

  // Slice edges
  for (let [height, slice] of slicesOf(diagram)) {
    for (let { source, target, codim, dir } of edgesOf(slice, dimension - 1)) {
      source.unshift(height);
      target.unshift(height);
      codim += 1;
      yield { source, target, codim, dir, type: 'slice edge', wire: false };
    }
  }

  // Limit edges
  for (let regular = 0; regular <= diagram.data.length; regular++) {
    let slice = diagram.getSlice({ height: regular, regular: true });
    let points = [...pointsOf(slice, dimension - 1)];

    let backwardLimit = regular > 0 ? diagram.data[regular - 1].backward_limit : null;
    let forwardLimit = regular < diagram.data.length ? diagram.data[regular].forward_limit : null;

    for (let point of points) {
      //_assert(slice.data);
      let point_regular = slice.n > 0 && (point[0] < 0 || point[0] > slice.data.length * 2 || point[0] % 2 == 0);
      for (let target of limitAction(backwardLimit, point)) {
        let obj = {
          source: [regular * 2, ...point],
          target: [regular * 2 - 1, ...target],
          codim: 0,
          dir: -1,
          type: 'limit action backward edge',
          wire: !point_regular
        };
        _assert(obj.source.length == obj.target.length);
        for (let i=0; i<obj.source.length; i++) {
          _assert(obj.source[i] >= -1);
          _assert(obj.target[i] >= -1);
        }
        yield obj;
      }
      for (let target of limitAction(forwardLimit, point)) {
        let obj = {
          source: [regular * 2, ...point],
          target: [regular * 2 + 1, ...target],
          codim: 0,
          dir: 1,
          type: 'limit action forward edge',
          wire: !point_regular
        };
        _assert(obj.source.length == obj.target.length);
        for (let i=0; i<obj.source.length; i++) {
          _assert(obj.source[i] >= -1);
          _assert(obj.target[i] >= -1);
        }
        yield obj;
      }
    }
  }
};

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
  if (height <= limit[0].first * 2) {
    return [point];
  }

  // After the last component
  if (height > limit[limit.length - 1].getLast() * 2) {
    let offset = 0;
    for (let component of limit) {
      offset += component.getLast() * 2 - component.first * 2 - 2;
    }
    _assert(height - offset >= -1);
    return [[height - offset, ...rest]];
  }

  let offset = 0;
  let targets = new Map();

  for (let component of limit) {
    let first = component.first * 2;
    let last = component.getLast() * 2;

    if (height < first) {
      targets.set(height - offset, rest);
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
};