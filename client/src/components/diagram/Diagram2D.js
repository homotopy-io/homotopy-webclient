import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import panzoom from "svg-pan-zoom";
import { connect } from "react-redux";

import * as Core from "homotopy-core";
import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";
import * as HSLuv from "hsluv";

import compose from "~/util/compose";
import { _assert, isNatural } from "../../../../core/src/util/debug"; // this is a mess
//import { _assert } from "~/util/debug";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
import withLayout from "~/components/diagram/withLayout";
import { getGenerators } from "~/state/store/signature";
import { ENETDOWN } from "constants";

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
    this.panzoom = panzoom(this.diagramRef.current, {
      panEnabled: /*this.props.interactive*/ false,
      zoomEnabled: this.props.interactive,
      dblClickZoomEnabled: this.props.interactive,
      zoomScaleSensitivity: 0.4,
      minZoom: 0.001,
      maxZoom: 1000
    });
  }

  componentDidUpdate(props) {
    if (this.props.layout != props.layout) {
      this.panzoom.destroy();
      this.componentDidMount();
    }
  }

  componentWillUnmount() {
    this.panzoom.destroy();
  }

  onSelect(e, point) {
    if (this.props.interactive) {
      this.props.onSelect && this.props.onSelect(point);
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
    //let type = Core.Geometry.typeAt(this.diagram, point);
    let type = this.diagram.getActionType(point);
    let id = type.id;
    return this.props.generators[id];
  }

  // Get the display colour of the generator in a given ambient dimension
  getColour(generator, n) {

    _assert(isNatural(n));

    //if (n >= 3) debugger;

    // If the generator is appearing in its native dimension, use the assigned colour
    if (n == generator.generator.n) return generator.color;

    // Otherwise, adjust the lightness cyclically
    var husl = HSLuv.hexToHsluv(generator.color);
    var lightnesses = [30, 50, 70];
    husl[2] = lightnesses[(n - generator.generator.n) % 3];
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

  renderPoint(point) {
    let position = point.position;
    let generator = point.generator;

    if (this.props.dimension == 2 && !point.nontrivial) {
      return null;
    }

    if (generator.generator.n < this.diagram.n) {
      //return null;
    }

    let colour = this.getColour(generator, this.diagram.n);
    let key = `point#${point.point.join(":")}`;
    let fill_opacity = 1;
    let r = 12.5;
    if (point.homotopy) {
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
        onClick={e => this.onSelect(e, point.point)}
        onMouseDown={e => this.onStartDrag(e, point.point)}
        key={key}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );
  }

  coordToObject(p) {
    //_assert(p instanceof Number);
    let regular = (0 == p % 2);
    let height = regular ? p / 2 : (p - 1) / 2;
    return { regular, height };
  }

  coordsToObject(p) {
    _assert(p instanceof Array);
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
    _assert(point.length == 0);
    let ref = '';
    let generator = this.getGenerator(point);
    let position = this.getPosition(point);
    let slice = [];
    let nontrivial = true;
    return { point, generator, position, ref, slice, nontrivial };
  }

  preparePoint1d(point) {
    _assert(point.length == 1);

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

    return { point, generator, position, ref, slice, nontrivial };
  }

  preparePoint2d(point) {
    _assert(point.length == 2);
    _assert(point[0] >= -1);
    _assert(point[1] >= -1);
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
    let homotopy = false;
    if (!slice[0].regular && !slice[1].regular) {
      let data = this.diagram.data[slice[0].height];
      let forward_nontrivial = data.forward_limit.analyzeSingularNeighbourhoods();
      let backward_nontrivial = data.backward_limit.analyzeSingularNeighbourhoods();
      nontrivial = forward_nontrivial[slice[1].height] || backward_nontrivial[slice[1].height];
      if (nontrivial) {
        algebraic = (generator.generator.n == this.diagram.n);
        homotopy = !algebraic;
      }
    }

    return { point, generator, position, ref, nontrivial, algebraic, homotopy, slice };
  }

  // Store the control points for each edge
  prepareEdge(edge, points) {
    let s = edge.source;
    let t = edge.target;
    _assert(s);
    _assert(t);
    let s_ref = s.join(',');
    let t_ref = t.join(',');
    edge.source_point = points.find(v => v.ref == s_ref);
    edge.target_point = points.find(v => v.ref == t_ref);
    _assert(edge.source_point);
    _assert(edge.target_point);
    let sGenerator = edge.source_point.generator;
    let tGenerator = edge.target_point.generator;
    let sPosition = edge.source_point.position;
    let tPosition = edge.target_point.position;
    if (edge.target_point.nontrivial) {
      if (edge.target_point.algebraic) {
        edge.st_control = this.getControlPoint(sGenerator, sPosition, tPosition);
        edge.ts_control = this.getControlPoint(tGenerator, tPosition, sPosition);
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
      _assert(edge.st_control && edge.ts_control);
      if (edge.type == 'triangle edge') {
        edge.svg_path = ` C ${edge.ts_control.join(" ")} ${edge.st_control.join(" ")} ${edge.source_point.position.join(" ")}`;
      } else {
        edge.svg_path = ` C ${edge.st_control.join(" ")} ${edge.ts_control.join(" ")} ${edge.target_point.position.join(" ")}`;
      }  
    } else {
      // Straight line
      if (edge.type == 'triangle edge') {
        edge.svg_path = ' L ' + edge.source_point.position.join(" ");
      } else {
        edge.svg_path = ' L ' + edge.target_point.position.join(" ");
      }
    }
  }

  // Prepare a group of edges with the same nontrivial target
  prepareEdgesAtTarget(edges) {
    if (this.props.dimension != 2) return;
    if (this.diagram.n < 3) return;
    if (edges.length == 0) return;
    let vertex = edges[0].target_point;
    _assert(vertex.slice);
    let wires = this.diagram.getWireDepths(vertex.slice[0].height, vertex.slice[1].height);

    // Separate out the source and target edges
    let source_edges = edges.filter(edge => edge.source_point.point[0] < vertex.point[0]);
    let target_edges = edges.filter(edge => edge.source_point.point[0] > vertex.point[0]);
    _assert(source_edges.length + target_edges.length + 2 == edges.length);

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
    for (let i = 0; i < segments.length; i++) {
      let segment = segments[i];
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

      let c2l = 25;
      let factor = 0.55;
      let c2x_target = vertex.position[0] + c2l * Math.sin(theta);
      let c2x_source = vertex.position[0] - c2l * Math.sin(theta);
      let c2y_target = vertex.position[1] - c2l * factor * Math.cos(theta);
      let c2y_source = vertex.position[1] + c2l * factor * Math.cos(theta);
      let c1l = 20;
      //let mask_mult = 2.5;
      //let mask_url = mask_id ? "url(#" + mask_id + ")" : null;

      for (let j = 0; j < group.length; j++) {
        let segment = group[j];

        // Calculate control points for this segment
        let edge = segment.edge;
        let start_y = vertex.position[1];//edge.source_point.position[1] + (segment.source ? -1 : +1) * 50;
        edge.st_control = [edge.source_point.position[0], start_y + (segment.source ? c1l : -c1l)];
        edge.ts_control = [segment.source ? c2x_source : c2x_target, segment.source ? c2y_source : c2y_target];
        /*
        var segment_str = SVG_move_to({ x: edge.x, y: start_y })
          + SVG_bezier_to({ c1x: edge.x, c1y: start_y + (segment.source ? c1l : -c1l),
            //c2x: edge.x, c2y: vertex.y,
            c2x: segment.source ? c2x_source : c2x_target, c2y: segment.source ? c2y_source : c2y_target,
            x: vertex.x, y: vertex.y });
        */
      }

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
    
    let s = edge.source_point;
    let t = edge.target_point;
    let sGenerator = s.generator;
    let sPosition = s.position;
    let tPosition = t.position;

    let start = edge.type == 'triangle edge' ? tPosition : sPosition;
    let path = 'M ' + start.join(" ") + edge.svg_path;
    let colour = this.getColour(sGenerator, this.diagram.n - 1);
    let key = 'wire#' + s.point.join(":") + '#' + t.point.join(":") + (edge.type == 'triangle edge' ? '#T' : ' ');

    //if (this.diagram.n == 3) debugger;

    return (
      <path
        d={path}
        stroke={colour}
        strokeWidth={10}
        fill="none"
        key={`wire#${s.point.join(":")}#${t.point.join(":")}`}
        onClick={e => this.onSelect(e, s.point, t.point)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  getGeneratorPosition(p) {
    return { generator: this.getGenerator(p), position: this.getPosition(p) };
  }

  renderSurface(sm, mt, st) {

    _assert(sm.source_point === st.source_point);
    _assert(st.target_point === mt.target_point);
    _assert(mt.source_point === sm.target_point);
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

    let path = 'M ' + sPosition.join(" ") + ' ' + sm.svg_path + mt.svg_path + st.svg_path;

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

    /* Remove stroke here to see triangles when debugging */
    return (
      <path
        d={path}
        stroke={'#fff'}
        strokeWidth={1}
        vectorEffect={"non-scaling-stroke"}
        fill={highlight ? "#f1c40f" : colour}
        key={`surface#${s.point.join(":")}#${m.point.join(" ")}#${t.point.join(":")}`}
        onClick={e => this.onSelect(e, s.point, m.point, t.point)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  render() {

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
        _assert(point[j] >= -1);
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
    edges_by_target.map(this.prepareEdgesAtTarget, this);

    // Set svg path strings if missing
    edges.map(this.prepareEdgeSVGPath, this);

    return (
      <DiagramSVG width={this.props.width} height={this.props.height} innerRef={this.diagramRef}>
        <g>
          {surfaces.map(([x, y, z]) => this.renderSurface(x, y, z))}
          {edges.map(edge => this.renderWire(edge))}
          {points.map(point => this.renderPoint(point))}
        </g>
      </DiagramSVG>
    );
  }

  findSurfaces(diagram, edges_raw, edges) {

    _assert(edges);

    for (let edge of edges_raw) {
      edges.push(edge);
    }

    if (diagram.n < 2) return [];
    if (this.props.dimension < 2) return [];

    let graph = new Graph();

    for (let i=0; i<edges_raw.length; i++) {
      let edge = edges_raw[i];
      _assert(edge.source[0] >= -1);
      _assert(edge.source[1] >= -1);
      _assert(edge.target[0] >= -1);
      _assert(edge.target[1] >= -1);
      graph.addEdge(edge.source, edge.target, { edge });
    }

    let surfaces = [];
    for (let [a, b, v] of graph.edges()) {
      //let aType = Core.Geometry.typeAt(diagram, a);

      for (let [c, w] of graph.edgesFrom(b)) {
        let x = graph.getEdge(a, c);
        _assert(x === undefined);
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

}


/*
const findSurfaces = (diagram, edges) => {
  if (diagram.n < 2) return [];

  let graph = new Graph();

  for (let edge of edges) {
    graph.addEdge(edge.source, edge.target, { edge });
  }

  let surfaces = [];
  let new_edges = [];
  for (let [a, b, v] of graph.edges()) {
    //let aType = Core.Geometry.typeAt(diagram, a);

    for (let [c, w] of graph.edgesFrom(b)) {
      let x = graph.getEdge(a, c);
      _assert(x === undefined);
      let new_edge = { source: a, target: b, codim: null, dir: null, type: 'triangle edge', wire: false };
      surfaces.push([a, b, c, v.edge, w.edge, new_edge]); // points then edges
      new_edges.push(new_edge);
    }
  }

  // Add the new edges
  edges = [...edges, ...new_edges];

  return surfaces;
};
*/

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
