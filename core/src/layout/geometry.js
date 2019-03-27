import { _assert, _debug, isNatural } from "~/util/debug";

/*
export const idAt = (diagram, point) => {
  if (point.length == 0) {
    let maxType = null;

    return diagram.getLastPoint();

    for (let t of typesOf(diagram)) {
      if (_debug) _assert(t);
      if (_debug) _assert(isNatural(t.n));
      if (!maxType || t.n > maxType.n) {
        maxType = t;
      }
    }

    return maxType;

  } else {
    let [height, ...rest] = point;

    if (_debug) _assert(!isNaN(height));
    height = Math.max(0, height);
    if (_debug) _assert(!isNaN(height));
    height = Math.min(height, 2 * diagram.data.length);
    if (_debug) _assert(!isNaN(height));

    let slice = diagram.getSlice({
      height: Math.floor(height / 2),
      regular: height % 2 == 0
    });

    return idAt(slice, rest);
  }
};
*/

export const idAt = (diagram, point) => {
  debugger;
  _assert(diagram);
  return diagram.getActionId(point, generators);
  
}

/*
export const typesOf = function*(diagram) {
  if (diagram.n == 0) {
    if (_debug) _assert(diagram.type);
    yield diagram.type;
    return;
  } else {
    yield* typesOf(diagram.source);

    for (let content of diagram.data) {
      let id = content.forward_limit.components[0].target_id;
      if (_debug) _assert(id);
      yield id;
    }
  }
};
*/

export const pointsOf = function*(diagram, dimension) {
  if (_debug) _assert(diagram.n >= dimension);

  if (dimension == 0) {
    yield [];
  } else {
    for (let [height, slice] of slicesOf(diagram)) {
      for (let point of pointsOf(slice, dimension - 1)) {
        point.unshift(height);
        if (_debug) _assert(point);
        yield point;
      }
    }
  }
};

export const boundaryOf = (diagram, dimension) => {
  if (_debug) _assert(diagram.n >= dimension);

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
  if (_debug) {
    _assert(diagram);
    _assert(diagram.n > 0);
  }

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
    let slice = diagram.new_diagram.getSlice(...point);
    //diagram = diagram.getSlice(...point);
    return [...point, ...lastPoint(slice)];
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

  while (k > 0 && diagram.data[k].forward_limit.components.length + diagram.data[k].backward_limit.components.length == 0) {
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
        if (_debug) _assert(obj.source.length == obj.target.length);
        for (let i=0; i<obj.source.length; i++) {
          if (_debug) _assert(obj.source[i] >= -1);
          if (_debug) _assert(obj.target[i] >= -1);
        }
        yield obj;
      }
      for (let target of limitAction(forwardLimit, point)) {
        let obj = {
          source: [regular * 2, ...point],
          target: [regular * 2 + 1, ...target],
          codim: 0,
          dir: 1,
          type: 'limit action forward edge ',
          wire: !point_regular
        };
        if (_debug) _assert(obj.source.length == obj.target.length);
        for (let i=0; i<obj.source.length; i++) {
          if (_debug) _assert(obj.source[i] >= -1);
          if (_debug) _assert(obj.target[i] >= -1);
        }
        yield obj;
      }
    }
  }
};

const limitAction = (limit, point) => {
  // Special case: the identity limit preserves all points.
  if (!limit || limit.components.length == 0) {
    return [point];
  }

  // Dimension zero points are always preserved.
  if (point.length == 0) {
    return [point];
  }

  let monotone = limit.getMonotone();
  let adjoint = monotone.getAdjoint();

  let [height, ...rest] = point;

  // Before the first component
  let cumulative = [];
  if (height <= limit.components[0].first * 2) {
    cumulative.push(point);
    //return [point];
  }

  if (height == -1) return cumulative;
  if (height % 2 == 1 && cumulative.length > 0) return cumulative;

  if (height % 2 == 0) {
    let p = [];
    for (let i=0; i<adjoint.length; i++) {
      if (adjoint[i] == height / 2) {
        p.push([i * 2, ...rest]);
      }
    }
    if (p.length > 0) return p;
  }

  // After the last component
  if (height >= limit.components[limit.components.length - 1].getLast() * 2) {
    let offset = 0;
    for (let component of limit.components) {
      offset += component.getLast() * 2 - component.first * 2 - 2;
    }
    if (_debug) _assert(height - offset >= -1);
    cumulative.push([height - offset, ...rest]);
    //return [[height - offset, ...rest]];
  }
  if (cumulative.length > 0) return cumulative;

  let offset = 0;
  let targets = new Map();

  for (let component of limit.components) {
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