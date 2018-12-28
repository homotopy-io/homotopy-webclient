import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import panzoom from "svg-pan-zoom";
import { connect } from "react-redux";

import * as Core from "homotopy-core";
import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";
import * as HSLuv from "hsluv";
import BezierCubic from "~/util/bezier";

import compose from "~/util/compose";
import { _assert, _debug, isNatural } from "../../../../core/src/util/debug"; // this is a mess
//import { _assert } from "~/util/debug";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
import withLayout from "~/components/diagram/withLayout";
import { getGenerators } from "~/state/store/signature";
import { ENETDOWN } from "constants";
import { mask } from "ip";

export default compose(
  withLayout,
  connect(
    // TODO: Only get the generators that appear in the diagram
    state => ({ generators: getGenerators(state) }),
  ),
  withSize,
)(props => props.layout
  ? <Diagram2D {...props} />
  : <Loading {...props} />
);

export class Diagram2D extends React.Component {

  constructor(props) {
    super(props);
    this.diagramRef = React.createRef();
  }

  componentDidMount() {
    /*
    this.panzoom = panzoom(this.diagramRef.current, {
      panEnabled: this.props.interactive,
      zoomEnabled: this.props.interactive,
      dblClickZoomEnabled: this.props.interactive,
      zoomScaleSensitivity: 0.4,
      minZoom: 0.001,
      maxZoom: 1000
    });
    */
  }


  componentDidUpdate(props) {
    if (this.props.layout != props.layout) {
      //this.panzoom.destroy();
      this.componentDidMount();
    }
    /*
    let sc = new Core.SerializeCyclic();
    sc.update(store.getState());
    console.log('State length ' + sc.stringify().length);
    */
  }

  componentWillUnmount() {
    //this.panzoom.destroy();
  }

  onSelect(e, points) {
    if (this.props.interactive) {
      this.props.onSelect && this.props.onSelect(points);
    }
  }

  onStartDrag(e, point) {
    let move$ = Rx.fromEvent(window, "pointermove");
    let up$ = Rx.fromEvent(window, "pointerup");

    //let expand = e.shiftKey;
    let startX = e.clientX;
    let startY = e.clientY;

    move$
      .pipe(RxOps.takeUntil(up$))
      .pipe(RxOps.map(e => {
        let x = e.clientX;
        let y = e.clientY;
        return [x - startX, startY - y];
      }))
      .pipe(RxOps.filter(dirs => dirs.some(dir => Math.abs(dir) > 100))) // move at least 100 px in some direction
      .pipe(RxOps.take(1)) // take the first cursor position that matches this
      .subscribe(dirs => {
        // Work out which quadrant we're in
        let [x, y] = dirs;
        let compass;
        if (x > y) { // ene, ese, sse, ssw
          if (x > -y) { // ene, ese
            compass = y > 0 ? 'ene' : 'ese';
          } else { // sse, ssw
            compass = x > 0 ? 'sse' : 'ssw';
          }
        } else { // nne, nnw, wnw, wsw
          if (x > -y) { // nnw, nne
            compass = x > 0 ? 'nne' : 'nnw';
          } else { 
            compass = y > 0 ? 'wnw' : 'wsw';
          }
        }
        this.props.onHomotopy(point, compass);
      });

  }

  getPosition(point) {
    let { positions, minBounds, maxBounds } = this.props.layout;

    minBounds = [...Array(2 - point.length).fill(0), ...minBounds];
    maxBounds = [...Array(2 - point.length).fill(0), ...maxBounds];

    let position = [...Array(2 - point.length).fill(0), ...positions.get(point.join(":"))];
    position[1] += (maxBounds[1] - minBounds[1]) / 2;
    position[0] += (maxBounds[0] - minBounds[0]) / 2;

    let x = position[1] * 50;
    let y = -position[0] * 50;

    return [x, y];
  }

  isPointHighlighted(point) {
    if (!this.props.highlight) {
      return false;
    }

    let { path, subdiagram } = this.props.highlight;
    return Core.Boundary.containsPoint(
      this.props.diagram,
      [...this.props.slice, ...point],
      path,
      subdiagram
    );
  }

  get diagram() {
    return this.props.diagram.getSlice(...this.props.slice);
  }

  getGenerator(point) {
    //let type = Core.Geometry.idAt(this.diagram, point);
    let id = this.diagram.getActionId(point);
    //let id = type.id;
    return this.props.generators[id];
  }

  // Get the display colour of the generator in a given ambient dimension
  getColour(generator, n) {

    if (_debug) _assert(isNatural(n));
    if (_debug) _assert(generator);

    //if (n >= 3) debugger;

    // If the generator is appearing in its native dimension, use the assigned colour
    if (n <= generator.generator.n) return generator.color;

    // Otherwise, adjust the lightness cyclically
    var husl = HSLuv.hexToHsluv(generator.color);
    var lightnesses = [30, 50, 70];
    //husl[2] = lightnesses[(n - generator.generator.n) % 3];
    husl[2] = 20 + ((husl[2] + (n - generator.generator.n) * 17.8309886184) % 60);
    return HSLuv.hsluvToHex(husl);

  }

  getControlPoint(generator, from, to) {
    if (this.diagram.n < 2 || generator.generator.n <= this.diagram.n - 2) {
      return from;
    }

    let codim = this.diagram.n - generator.generator.n;
    let control = from.slice();
    if (codim == 0) {
      control[codim] = to[codim];
    } else if (codim == 1) {
      control[codim] = (4 * control[codim] + 1 * to[codim]) / 5;
    }
    return control;
  }

  renderPoint0d(point) {

    let position = point.position;
    let generator = point.generator;

    if (_debug) _assert(point.slice.length == 0);

    if (_debug) _assert(generator);

    let colour = this.getColour(generator, this.diagram.n);
    let key = `point`;
    let fill_opacity = 1;
    let r = 12.5;
    return (
      <circle
        cx={position[0]}
        cy={position[1]}
        r={r}
        strokeWidth={0}
        fill={colour}
        fillOpacity={fill_opacity}
        onClick={e => this.onSelect(e, [point.point])}
        onMouseDown={e => this.onStartDrag(e, point.point)}
        key={key}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );

  }

  renderPoint1d(point) {

    let position = point.position;
    let generator = point.generator;

    if (_debug) _assert(point.slice.length == 1);

    // Don't show boundary points
    if (point.boundary) {
      return null; // keep showing these for now
    }

    // No points on regular slices of 1d diagrams
    else if (point.slice[0].regular) {
      return null;
    }

    if (_debug) _assert(generator);

    if (generator.generator.n < this.diagram.n) {
      //return null;
    }

    let colour = this.getColour(generator, this.diagram.n);
    let key = `point#${point.position.join(":")}`;
    let fill_opacity = 1;
    let r = 12.5;
    return (
      <circle
        cx={position[0]}
        cy={position[1]}
        r={r}
        strokeWidth={0}
        fill={colour}
        fillOpacity={fill_opacity}
        onClick={e => this.onSelect(e, [point.point])}
        onMouseDown={e => this.onStartDrag(e, point.point)}
        key={key}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );

  }

  renderPoint2d(point) {

    let position = point.position;
    let generator = point.generator;

    if (this.props.dimension == 2) {
      if (_debug) _assert(point.slice.length == 2);

      // Don't show boundary points
      if (point.boundary) {
        return null;
      }

      // No points on regular-regular or singular-regular slices
      else if (point.slice[1].regular) {
        return null;
      }
    }

    if (_debug) _assert(generator);

    if (generator.generator.n < this.diagram.n) {
      //return null;
    }

    let colour = this.getColour(generator, this.diagram.n);
    let key = `point#${point.position.join(":")}`;
    let fill_opacity = 1;
    let r = 12.5;
    if (point.nontrivial && !point.algebraic) {
      if (point.count_depths == null) {
        fill_opacity = 0;
        r = 20;
      } else if (point.count_depths <= 1) {
        fill_opacity = 1;
        r = 12.5;
        colour = this.getColour(generator, this.diagram.n - 1);
      } else {
        fill_opacity = 0;
        r = 20;
      }
    }
    else if (!point.algebraic) {
      fill_opacity = 0;
      r = 20;
    }
    return (
      <circle
        cx={position[0]}
        cy={position[1]}
        r={r}
        strokeWidth={0}
        fill={colour}
        fillOpacity={fill_opacity}
        onClick={e => this.onSelect(e, [point.point])}
        onMouseDown={e => this.onStartDrag(e, point.point)}
        key={key}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );
  }

  renderPoint(point) {
    if (this.props.dimension == 0) {
      return this.renderPoint0d(point)
    } else if (this.props.dimension == 1) {
      return this.renderPoint1d(point);
    } else if (this.props.dimension == 2) {
      return this.renderPoint2d(point);
    } else _assert(false);
  }

  coordToObject(p) {
    //_assert(p instanceof Number);
    let regular = (0 == p % 2);
    let height = regular ? p / 2 : (p - 1) / 2;
    return { regular, height };
  }

  coordsToObject(p) {
    if (_debug) _assert(p instanceof Array);
    let r = [];
    for (let i=0; i<p.length; i++) {
      //_assert(p[i] instanceof Number);
      r.push(this.coordToObject(p[i]));
    }
    return r;
  }

  regularizePoint(p) {
    let [y,x] = p;
    y = Math.max(y, 0);
    y = Math.min(y, 2 * this.diagram.data.length);
    x = Math.max(x, 0);
    x = Math.min(x, 2 * this.diagram.getSlice(y).data.length);
    return this.coordsToObject([y,x]);
  }

  preparePoint(point) {
    if (this.props.dimension == 0) {
      return this.preparePoint0d(point)
    } else if (this.props.dimension == 1) {
      return this.preparePoint1d(point);
    } else if (this.props.dimension == 2) {
      return this.preparePoint2d(point);
    } else _assert(false);
  }

  preparePoint0d(point) {
    if (_debug) _assert(point.length == 0);
    let ref = '';
    let generator = this.getGenerator(point);
    let position = this.getPosition(point);
    let slice = [];
    let nontrivial = true;
    return { point, generator, position, ref, slice, nontrivial };
  }

  preparePoint1d(point) {
    if (_debug) _assert(point.length == 1);

    let ref = point.join(',').toString();
    let generator = this.getGenerator(point);
    let position = this.getPosition(point);

    // Compute some logical data about the point
    let boundary = false;
    let h = point[0];
    if (h < 0) {
      boundary = true;
      h = 0;
    } else if (h > this.diagram.data.length * 2) {
      boundary = true;
      h = this.diagram.data.length * 2;
    }

    let regular = (h % 2 == 0);
    let height = regular ? h / 2 : (h - 1) / 2;
    let slice = [{regular, height}];
    let nontrivial = !regular;

    return { point, generator, position, ref, slice, nontrivial, boundary };
  }

  preparePoint2d(point) {
    if (_debug) _assert(point.length == 2);
    if (_debug) _assert(point[0] >= -1);
    if (_debug) _assert(point[1] >= -1);
    let ref = point.join(',').toString();
    let generator = this.getGenerator(point);
    let position = this.getPosition(point);

    // Compute some logical data about the point
    let slice = [];
    let d = this.diagram;
    let boundary = false;
    for (let i=0; i<2; i++) {
      let p = point[i];
      if (p < 0) {
        boundary = true;
        p = 0;
      }
      if (p > d.data.length * 2) {
        boundary = true;
        p = d.data.length * 2;
      }
      let regular = (p % 2 == 0);
      let height = regular ? p / 2 : (p - 1) / 2;
      let sub = { height, regular };
      slice.push(sub);
      if (i == 0) d = d.getSlice(sub);
    }

    // See if the neighbourhood of this point is nontrivial, and if so,
    // whether it's algebraic.
    let nontrivial = false;
    let algebraic = false;
    //let homotopy = false;
    if (!slice[0].regular && !slice[1].regular) {
      let data = this.diagram.data[slice[0].height];
      let forward_nontrivial = data.forward_limit.analyzeSingularNeighbourhoods();
      let backward_nontrivial = data.backward_limit.analyzeSingularNeighbourhoods();
      nontrivial = forward_nontrivial[slice[1].height] || backward_nontrivial[slice[1].height];
      if (nontrivial) {
        algebraic = (generator.generator.n >= this.diagram.n);
        //homotopy = !algebraic;
      }
    }

    return { point, generator, position, ref, nontrivial, algebraic, /* homotopy, */ slice, boundary };
  }

  // Store the control points for each edge
  prepareEdge(edge, points) {
    let s = edge.source;
    let t = edge.target;
    if (_debug) _assert(s);
    if (_debug) _assert(t);
    let s_ref = s.join(',');
    let t_ref = t.join(',');
    edge.source_point = points.find(v => v.ref == s_ref);
    edge.target_point = points.find(v => v.ref == t_ref);
    if (_debug) _assert(edge.source_point);
    if (_debug) _assert(edge.target_point);
    let sGenerator = edge.source_point.generator;
    let tGenerator = edge.target_point.generator;
    let sPosition = edge.source_point.position;
    let tPosition = edge.target_point.position;
    if (edge.target_point.nontrivial) {
      if (edge.target_point.algebraic && sPosition[1] != tPosition[1]) {

        edge.st_control = sPosition.slice();
        edge.st_control[1] = (4 * edge.st_control[1] + tPosition[1]) / 5;
        edge.ts_control = tPosition.slice();
        edge.ts_control[0] = sPosition[0];


        //edge.st_control = this.getControlPoint(sGenerator, sPosition, tPosition);
        //edge.ts_control = this.getControlPoint(tGenerator, tPosition, sPosition);
        /*
        if (edge.type == 'triangle edge') {
          edge.svg_path = ` C ${edge.ts_control.join(" ")} ${st_control.join(" ")} ${sPosition.join(" ")}`;
        } else {
          edge.svg_path = ` C ${edge.st_control.join(" ")} ${ts_control.join(" ")} ${tPosition.join(" ")}`;
        } 
        */
      } else {
        // We set the control points for homotopies later on
      }
    } else { // straight line is OK
      /*
      if (edge.type == 'triangle edge') {
        edge.svg_path = ` L ${sPosition.join(" ")}`;
      } else {
        edge.svg_path = ` L ${tPosition.join(" ")}`;
      }
      */
    }
    return edge;
  }

  prepareEdgeSVGPath(edge) {
    if (edge.svg_path) return edge;
    if (edge.st_control || edge.ts_control) {    
      if (_debug) _assert(edge.st_control && edge.ts_control);
      if (edge.type == 'triangle edge') {
        edge.svg_path = ` C ${edge.ts_control.join(" ")} ${edge.st_control.join(" ")} ${edge.source_point.position.join(" ")}`;
      } else {
        edge.svg_path = ` C ${edge.st_control.join(" ")} ${edge.ts_control.join(" ")} ${edge.target_point.position.join(" ")}`;
      }  
    } else {
      // Straight line
      if (edge.type == 'triangle edge') {
        edge.svg_path = ' L  ' + edge.source_point.position.join(" ");
      } else {
        edge.svg_path = ' L ' + edge.target_point.position.join(" ");
      }
    }
  }

  // Prepare a group of edges with the same nontrivial target
  prepareEdgesAtTarget(edges, masks) {
    if (this.props.dimension != 2) return;
    if (this.diagram.n < 3) return;
    if (edges.length == 0) return;
    let vertex = edges[0].target_point;
    if (_debug) _assert(vertex.slice);
    let wires = this.diagram.getWireDepths(vertex.slice[0].height, vertex.slice[1].height);

    // Separate out the source and target edges
    let source_edges = edges.filter(edge => edge.source_point.point[0] < vertex.point[0]);
    let target_edges = edges.filter(edge => edge.source_point.point[0] > vertex.point[0]);
    if (_debug) _assert(source_edges.length + target_edges.length + 2 == edges.length);

    // Order these edges
    source_edges = source_edges.sort((a, b) => a.source_point.point[1] - b.source_point.point[1]); 
    target_edges = target_edges.sort((a, b) => a.source_point.point[1] - b.source_point.point[1]); 

    // Sort the wire segments by depth
    let segments = [];
    for (let i = 0; i < wires.source_depths.length; i++) {
      segments.push({ source: true, index: i, depth: wires.source_depths[i], edge: source_edges[2 * i + 1] });
    }
    for (let j = 0; j < wires.target_depths.length; j++) {
      segments.push({ source: false, index: j, depth: wires.target_depths[j], edge: target_edges[2 * j + 1] });
    }
    segments.sort((a, b) => a.depth - b.depth );

    // Group them by common depth
    let groups_temp = [];
    let left = Number.MAX_VALUE;
    let right = -Number.MAX_VALUE;
    for (let i = 0; i < segments.length; i++) {
      let segment = segments[i];
      left = Math.min(left, segment.edge.source_point.position[0]);
      right = Math.max(right, segment.edge.source_point.position[0]);
      if (!groups_temp[segment.depth]) {
        groups_temp[segment.depth] = [segment]
      } else {
        groups_temp[segment.depth].push(segment);
      }
    }

    // Ignore unrepresented depths -- are there any of these??
    let groups = [];
    for (let i=0; i<groups_temp.length; i++) {
      if (!groups_temp[i]) {
        continue;
      }
      groups.push(groups_temp[i]);
    }

    // Tell the vertex how many depths there are
    vertex.count_depths = groups.length;

    // Don't add homotopy data for flat algebraic vertices
    if (vertex.count_depths == 1 && vertex.algebraic) {
      return;
    }

    // Draw the groups nearest-first
    let mask_edges = [];
    for (let i = 0; i < groups.length; i++) {
      let group = groups[i];

      /* Decide the common tangent vector for elements of this group.
      If any element is vertical, use a vertical tangent.
      If all elements are on left or right, use a vertical tangent.
      If all elements are above or below, use a vertical tangent.
      Otherwise, find the mean incidence angle.
      */
      let theta = null;
      let theta_sum = 0;
      let unique_sign = 0;
      if (group.filter(segment => segment.source).length == 0 || group.filter(segment => !segment.source).length == 0) {
        theta = 0;
      } else {

        for (let j=0; j<group.length; j++) {
          let segment = group[j];
          let dx = segment.edge.source_point.position[0] - vertex.position[0];
          if (dx == 0) { // compare horizontal positions
            theta = 0;
            break;
          }
          let sign = dx < 0 ? -1 : +1;
          if (unique_sign != null) {
            if (unique_sign == 0 && sign != 0) unique_sign = sign;
            if (unique_sign != 0 && sign != 0 && unique_sign != sign) unique_sign = null;                
          }
          theta_sum += (segment.source ? -1 : +1) * Math.atan(dx / 25);
        }
        if (theta == null) {
          if (unique_sign != null) {
            theta = 0;
          } else {
            theta = theta_sum / group.length;
          }
        }
      }
      //g.appendChild(mask[0]);

      let c2l = 35;
      let factor = 0.35;
      let c2x_target = vertex.position[0] + c2l * Math.sin(theta);
      let c2x_source = vertex.position[0] - c2l * Math.sin(theta);
      let c2y_target = vertex.position[1] - c2l * factor * Math.cos(theta);
      let c2y_source = vertex.position[1] + c2l * factor * Math.cos(theta);
      let c1l = 20;
      let mask_mult = 125;
      let mask_url = (masks.length > 0 && i > 0) ? "url(#mask" + (masks.length - 1) + ")" : null;

      mask_edges = mask_edges.slice();

      for (let j = 0; j < group.length; j++) {
        let segment = group[j];

        // Calculate control points for this segment
        let edge = segment.edge;
        let start_y = vertex.position[1];//edge.source_point.position[1] + (segment.source ? -1 : +1) * 50;
        //_assert(!edge.st_control);
        //_assert(!edge.ts_control);
        edge.st_control = [edge.source_point.position[0], start_y + (segment.source ? c1l : -c1l)];
        edge.ts_control = [segment.source ? c2x_source : c2x_target, segment.source ? c2y_source : c2y_target];
        edge.mask = mask_url;
        mask_edges.push(edge);
      }

      if (i == groups.length - 1) break;
      let height = vertex.position[1];
      //let mask_point = (vertex.algebraic /*&& i > 0*/) ? vertex : null;
      let mask_point = vertex;
      let mask_algebraic = vertex.algebraic;
      masks.push({ mask_edges, left, right, height, mask_point, mask_algebraic });
    }

    // Assign control points to the intermediate regular edges
    for (let i=0; i<=wires.source_depths.length; i++) {
      if (wires.source_depths.length == 0) break;
      let edge = source_edges[2 * i];
      let st_controls = [];
      let ts_controls = [];
      if (i > 0) {
        st_controls.push(source_edges[2 * i - 1].st_control);
        ts_controls.push(source_edges[2 * i - 1].st_control);
      }
      if (i < wires.source_depths.length) {
        st_controls.push(source_edges[2 * i + 1].st_control);
        ts_controls.push(source_edges[2 * i + 1].ts_control);
      }
      //_assert(!edge.st_control);
      //_assert(!edge.ts_control);
      if (st_controls.length == 1) {
        edge.st_control = st_controls[0];
        edge.ts_control = ts_controls[0];
      } else {
        edge.st_control = [(st_controls[0][0] + st_controls[1][0]) / 2, (st_controls[0][1] + st_controls[1][1]) / 2];
        edge.ts_control = [(ts_controls[0][0] + ts_controls[1][0]) / 2, (ts_controls[0][1] + ts_controls[1][1]) / 2];
      }
    }
    for (let i=0; i<=wires.target_depths.length; i++) {
      if (wires.target_depths.length == 0) break;
      let edge = target_edges[2 * i];
      let st_controls = [];
      let ts_controls = [];
      if (i > 0) {
        st_controls.push(target_edges[2 * i - 1].st_control);
        ts_controls.push(target_edges[2 * i - 1].st_control);
      }
      if (i < wires.target_depths.length) {
        st_controls.push(target_edges[2 * i + 1].st_control);
        ts_controls.push(target_edges[2 * i + 1].ts_control);
      }
      //_assert(!edge.st_control);
      //_assert(!edge.ts_control);
      if (st_controls.length == 1) {
        edge.st_control = st_controls[0];
        edge.ts_control = ts_controls[0];
      } else {
        edge.st_control = [(st_controls[0][0] + st_controls[1][0]) / 2, (st_controls[0][1] + st_controls[1][1]) / 2];
        edge.ts_control = [(ts_controls[0][0] + ts_controls[1][0]) / 2, (ts_controls[0][1] + ts_controls[1][1]) / 2];
      }
    }

  }

  renderWire(edge) {

    if (!edge.wire) return;
    
    let path = ' M ' + edge.source_point.position.join(" ") + this.getPathTo({point: edge.target_point, st_control: edge.st_control, ts_control: edge.ts_control});
    let colour = this.getColour(edge.source_point.generator, this.diagram.n - 1);
    //let key = 'wire#' + s.point.join(":") + '#' + t.point.join(":") + (edge.type == 'triangle edge' ? '#T' : ' ');
    let key = 'wire#' + edge.source_point.position.join(":") + '#' + edge.target_point.position.join(":") + (edge.type == 'triangle edge' ? '#T' : ' ');
    let stroke_width = edge.wire ? 10 : 2;
    if (!edge.wire) colour = '#000';

    ///if (this.diagram.n == 3) debugger;

    let points = [edge.source_point, edge.target_point];

    // If any points are boundary, then only take boundary
    if (points.some(point => point.boundary)) {
      points = points.filter(point => point.boundary);
    }

    // We only want the raw coordinates
    points = points.map(point => point.point);

    // Choose the trigger point for click-and-drag
    let drag_point;
    if ([edge.source_point, edge.target_point].some(point => point.boundary)) {
      drag_point = edge.target_point.point;
    } else {
      drag_point = edge.source_point.point;
    }

    // This little filler path at the bottom end prevents artifacts where wire segments meet
    let filler_point = edge.source_point.point[0] < edge.target_point.point[0]
      ? edge.source_point : edge.target_point;
    let fpos = filler_point.position;
    let filler_path =
      ` M ${fpos[0] - stroke_width / 2} ${fpos[1]}`
      + ` L ${fpos[0] + stroke_width / 2} ${fpos[1]}`;
  
  /*
  return (<path
        d={path}
        stroke={colour}
        strokeWidth={stroke_width}
        fill="none"
        key={key}
        mask={edge.mask || ''}
        onMouseDown={e => this.onStartDrag(e, drag_point)}
        onClick={e => this.onSelect(e, points)}>
        {this.props.interactive && <title>{edge.source_point.generator.name}</title>}
      </path>);
      */

    let paths = [];
    paths.push(<path
      d={path}
      stroke={colour}
      strokeWidth={stroke_width}
      fill="none"
      key={key}
      mask={edge.mask || ''}
      shapeRendering='crispEdges'
      onMouseDown={e => this.onStartDrag(e, drag_point)}
      onClick={e => this.onSelect(e, points)}>
      {this.props.interactive && <title>{edge.source_point.generator.name}</title>}
    </path>);
    if (!filler_point.boundary && !edge.mask) {
      paths.push(<circle
        cx={fpos[0]}
        cy={fpos[1]}
        r={stroke_width / 2}
        shapeRendering='crispEdges'
        fill={colour}
        fillOpacity={1}
        key={'fragment#filllercircle#' + key}>
      </circle>);
    }

    return (
      <React.Fragment key={'fragment#' + key}>
        {paths}      
      </React.Fragment>
    );


      /*
      <path
        d={filler_path}
        key={'filler#' + key}
        mask={edge.mask || ''}
        vectorEffect={"non-scaling-stroke"}
        strokeWidth={2}
        stroke={colour}>
      </path>
      */
  }

  getPathTo({point, st_control, ts_control}) {
    if (st_control == null) {
      return ' L ' + point.position.join(' ');
    } else {
      return ' C ' + st_control.join(' ') + ' ' + ts_control.join(' ') + ' ' + point.position.join(' ');
    }
  }

  getGeneratorPosition(p) {
    return { generator: this.getGenerator(p), position: this.getPosition(p) };
  }

  renderSurface(sm, mt, st) {
//return;
    if (_debug) _assert(sm.source_point === st.source_point);
    if (_debug) _assert(st.target_point === mt.target_point);
    if (_debug) _assert(mt.source_point === sm.target_point);
    let s = sm.source_point;
    let t = st.target_point;
    let m = sm.target_point;

    let sPosition = s.position;
    let mPosition = m.position;
    let tPosition = t.position;
    let smControl = sm.st_control;
    let msControl = sm.ts_control;
    let mtControl = mt.st_control;
    let tmControl = mt.ts_control;
    let stControl = st.st_control;
    let tsControl = st.ts_control;

    let highlight = (
      this.isPointHighlighted(s.point) &&
      this.isPointHighlighted(m.point) &&
      this.isPointHighlighted(t.point)
    );

    let path = 'M ' + sPosition.join(" ")// + ' ' + sm.svg_path + mt.svg_path + st.svg_path;
      + this.getPathTo({point: m, st_control: sm.st_control, ts_control: sm.ts_control})
      + this.getPathTo({point: t, st_control: mt.st_control, ts_control: mt.ts_control})
      + this.getPathTo({point: s, st_control: st.ts_control, ts_control: st.st_control});

    /*
    let path = [
      `M ${sPosition.join(" ")}`,
      `C ${smControl.join(" ")}`,
      `  ${msControl.join(" ")}`,
      `  ${mPosition.join(" ")}`,
      `C ${mtControl.join(" ")}`,
      `  ${tmControl.join(" ")}`,
      `  ${tPosition.join(" ")}`,
      `C ${tsControl.join(" ")}`,
      `  ${stControl.join(" ")}`,
      `  ${sPosition.join(" ")}`,
    ].join(" ");
    */

    let sGenerator = s.generator;
    let colour = this.getColour(sGenerator, this.diagram.n - 2);
    //let key = 'surface#' + s.point.join(":") + '#' + m.point.join(":") + '#' + t.point.join(":")';
    let key = 'surface#' + s.position.join(":")
      + '#' + m.position.join(":")
      + '#' + t.position.join(":");

    // Choose the points to trigger on click
    let points = [s, m, t];

    // If any point is a boundary point, only allow boundary points
    if (points.some(point => point.boundary)) {
      points = points.filter(point => point.boundary);
    }

    // We only need to pass the coordinates through
    points = points.map(point => point.point);

    /* Remove stroke here to see triangles when debugging */
    return (
      <path
        d={path}
        stroke={/*'#fff'*/ colour }
        strokeWidth={1}
        vectorEffect={"non-scaling-stroke"}
        shapeRendering='crispEdges'
        fill={highlight ? "#f1c40f" : colour}
        key={key}
        onClick={e => this.onSelect(e, points)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  render() {

    if (this.props.highlight) {
      //debugger;
    }

    let edges_raw = this.props.layout.edges;
    let points_raw = this.props.layout.points;

    // Prepare points
    let points = [];
    for (let i=0; i<points_raw.length; i++) {
      points.push(this.preparePoint(points_raw[i]));
    }

    // Prepare surfaces
    let edges = [];
    let surfaces = this.findSurfaces(this.diagram, edges_raw, edges);

    // Consistency check on points
    for (let i=0; i<points.length; i++) {
      let point = points[i].point;
      for (let j=0; j<point.length; j++) {
        if (_debug) _assert(point[j] >= -1);
      }
    }

    // Prepare edges
    for (let i=0; i<edges.length; i++) {
      edges[i] = this.prepareEdge(edges[i], points);
    }

    // Group edges by target nontrivial vertex, and set control points
    let edges_nontrivial_target = edges.filter(edge => edge.target_point.nontrivial);
    let edges_by_target = edges_nontrivial_target.reduce((acc, currValue, currIndex, array) => {
      let ref = currValue.target_point.ref;
      for (let i=0; i<acc.length; i++) {
        if (acc[i][0].target_point.ref == ref) {
          acc[i].push(currValue);
          return acc;
        }
      }
      acc.push([currValue]);
      return acc;
    }, []);
    let masks = [];
    for (let i=0; i<edges_by_target.length; i++) {
      this.prepareEdgesAtTarget(edges_by_target[i], masks);
    }

    /*
    let subdivide = false;

    if (subdivide) {

      // Subdivide everything
      let subdivision = this.subdivideEdges({ surfaces, edges, points });

      // Set svg path strings if missing
      //subdivision.edges.map(this.prepareEdgeSVGPath, this);
      surfaces = subdivision.surfaces;
      edges = subdivision.edges;
      points = subdivision.points;

    }
    */

    edges.map(this.prepareEdgeSVGPath, this);
    let x_coords = points.map(point => point.position[0]);
    let y_coords = points.map(point => point.position[1]);
    
    let delta = 25;
    let min_x = Math.min(...x_coords) - delta;
    let max_x = Math.max(...x_coords) + delta;
    let min_y = Math.min(...y_coords) - delta;
    let max_y = Math.max(...y_coords) + delta;
    let dx = max_x - min_x;
    let dy = max_y - min_y;

    return (
      <DiagramSVG
        width={this.props.width}
        height={this.props.height}
        innerRef={this.diagramRef}
        preserveAspectRatio="xMidYMid meet"
        viewBox={min_x + ' ' + min_y + ' ' + dx + ' ' + dy}
        >
          <defs>
            {masks.map((mask, index) => this.renderMask(mask, index, min_x, min_y, dx, dy), this)}
          </defs>
        <g>
          {surfaces.map(([x, y, z]) => this.renderSurface(x, y, z))}
          {edges.map(edge => this.renderWire(edge))}
          {points.map(point => this.renderPoint(point))}
        </g>
      </DiagramSVG>
    );
  }

  renderMask(mask, index, min_x, min_y, dx, dy) {

    let outline_d =
      [`M ${mask.left - 125} ${mask.height - 60}`,
       `L ${mask.left - 125} ${mask.height + 60}`,
       `L ${mask.right + 125} ${mask.height + 60}`,
       `L ${mask.right + 125} ${mask.height - 60}`,
       `L ${mask.left - 125} ${mask.height - 60}`].join(' ');
    let paths = [(
      <path
        key={'mask' + index + '-transparent'}
        d={outline_d}
        stroke={"none"}
        fill={"white"}
        strokeOpacity={1}
        fillOpacity={1}
        >
      </path>
    )];

    //if (mask.mask_point)
    {
      paths.push(
        <circle
          cx={mask.mask_point.position[0]}
          cy={mask.mask_point.position[1]}
          r={mask.mask_algebraic ? 20 : 10}
          strokeWidth={0}
          fill={'#000'}
          fillOpacity={1}
          //onClick={e => this.onSelect(e, [point.point])}
          //onMouseDown={e => this.onStartDrag(e, point.point)}
          key={'mask' + index + '-point'}>
        </circle>
      );
    }

    for (let i=0; i<mask.mask_edges.length; i++) {
      paths.push(this.renderMaskEdge(mask.mask_edges[i], index, i));
    }

    return (
      <mask
        id={"mask" + index}
        key={'#key#mask' + index}
        maskUnits="userSpaceOnUse"
        //maskContentUnits='userSpaceOnUse'
        x={min_x}
        y={min_y}
        width={dx}
        height={dy}
        //x="0"
        //y="0"
        //width="100"
        //height="100"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
        >
        {paths}
      </mask>
    );
  }

  renderMaskEdge(edge, index, subindex) {
    let source_point = edge.type == 'triangle edge' ? edge.target_point : edge.source_point;
    let edge_path = 'M ' + source_point.position.join(' ') + ' ' + edge.svg_path;
    return (
      <path
        key={'mask' + index + '-path' + subindex}
        d={edge_path}
        stroke={"black"}
        //fill={"none"}
        strokeOpacity={1}
        fillOpacity={1}
        strokeWidth = {25}
      />
    )
  }

  findSurfaces(diagram, edges_raw, edges) {

    if (_debug) _assert(edges);

    for (let edge of edges_raw) {
      edges.push(edge);
    }

    if (diagram.n < 2) return [];
    if (this.props.dimension < 2) return [];

    let graph = new Graph();

    for (let i=0; i<edges_raw.length; i++) {
      let edge = edges_raw[i];
      if (_debug) _assert(edge.source[0] >= -1);
      if (_debug) _assert(edge.source[1] >= -1);
      if (_debug) _assert(edge.target[0] >= -1);
      if (_debug) _assert(edge.target[1] >= -1);
      graph.addEdge(edge.source, edge.target, { edge });
    }

    let surfaces = [];
    for (let [a, b, v] of graph.edges()) {
      //let aType = Core.Geometry.idAt(diagram, a);

      for (let [c, w] of graph.edgesFrom(b)) {
        let x = graph.getEdge(a, c);
        if (_debug) _assert(x === undefined);
        let edge = edges.find(edge => edge.source === a && edge.target === c);
        if (!edge) {
          edge = { source: a, target: c, codim: null, dir: null, type: 'triangle edge', wire: false };          
          edges.push(edge);
        }
        surfaces.push([v.edge, w.edge, edge]); // just the edges
      }
    }
    return surfaces;
  }

  subdivideEdges({ surfaces, edges, points }) {

    let new_edges = [];
    let new_surfaces = [];
    let new_points = points.slice();

    let temp_vertex = points.filter(p => {return p.position[0] == 0 && p.position[1] == -150})[0];

    // Subdivide the edges
    for (let i=0; i<edges.length; i++) {

      let edge = edges[i];

      if (edge.source_point === temp_vertex || edge.target_point === temp_vertex) {
        console.log('Edge to algebraic point ');
      }

      let edge_type = edge.edge_type;
      let wire = edge.wire;
      let parent_edge = edge;
      let new_point, edge_1, edge_2;

      if (edge.st_control == null) { // Linear
        let position = this.getMeanPoint(edge.source_point.position, edge.target_point.position);
        new_point = { position, parent_edge: edge, generator: edge.source_point.generator };
        edge_1 = { source_point: edge.source_point, target_point: new_point, parent_edge, subdivide_source: true, edge_type, wire };
        edge_2 = { source_point: new_point, target_point: edge.target_point, parent_edge, subdivide_source: false, edge_type, wire };
      } else { // Bezier
        let bezier = new BezierCubic({ p1: edge.source_point.position, c1: edge.st_control, c2: edge.ts_control, p2: edge.target_point.position });
        let split = bezier.splitAtMidHeight();
        new_point = { position: split[0].p2, parent_edge: edge, generator: edge.source_point.generator };
        edge_1 = { source_point: edge.source_point, target_point: new_point, parent_edge, st_control: split[0].c1, ts_control: split[0].c2, edge_type, wire };
        edge_2 = { source_point: new_point, target_point: edge.target_point, parent_edge, st_control: split[1].c1, ts_control: split[1].c2, edge_type, wire };
      }

      if (_debug) _assert(new_point.position instanceof Array);
      for (let i=0; i<new_point.position.length; i++) {
        if (_debug) _assert(!isNaN(new_point.position[i]));
      }
      new_points.push(new_point);
      new_edges.push(edge_1);
      new_edges.push(edge_2);
      edge.child_1 = edge_1;
      edge.child_2 = edge_2;
      edge.child_point = new_point;
    }

    // Subdivide the surfaces
    for (let i=0; i<surfaces.length; i++) {


      let surface = surfaces[i];
      let sm = surface[0];
      let mt = surface[1];
      let st = surface[2];
      //let [sm, mt, st] = surfaces[i];
      if (_debug) _assert(sm);
      if (_debug) _assert(mt);
      if (_debug) _assert(st);

      // Create new edges internal to the surface
      let edge_s = { source_point: sm.child_point, target_point: st.child_point };
      let edge_m = { source_point: sm.child_point, target_point: mt.child_point, type: 'triangle edge' };
      let edge_t = { source_point: st.child_point, target_point: mt.child_point };
      let [s, m, t] = [sm.source_point, mt.source_point, st.target_point]; 
      new_edges.push(edge_s, edge_m, edge_t);


      // Create new surfaces
      let surface_1 = [ sm.child_1, edge_s, st.child_1 ];
      this.validateSurface(surface_1);
      let surface_2 = [ sm.child_2, mt.child_1, edge_m ];
      this.validateSurface(surface_2);
      let surface_3 = [ edge_t, mt.child_2, st.child_2 ];
      this.validateSurface(surface_3);
      let surface_4 = [ edge_s, edge_t, edge_m ];
      this.validateSurface(surface_4);
      new_surfaces.push(surface_1, surface_2, surface_3, surface_4);

    }

    return { points: new_points, edges: new_edges, surfaces: new_surfaces };
  }

  validateSurface([sm, mt, st]) {
    if (!_debug) return;
    if (_debug) _assert(sm.source_point === st.source_point);
    if (_debug) _assert(sm.target_point === mt.source_point);
    if (_debug) _assert(mt.target_point === st.target_point);
  }

  getMeanPoint(p, q) {
    let m = [];
    if (_debug) _assert(p.length == q.length);
    for (let i=0; i<p.length; i++) {
      m[i] = (p[i] + q[i]) / 2;
      if (_debug) _assert(!isNaN(m[i]));
    }
    return m;
  }
  
}

export const Loading = () =>
  <LoadingWrapper>
    <Spinner />
  </LoadingWrapper>;

const DiagramSVG = styled.svg`
  position: absolute;
`;

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`;
