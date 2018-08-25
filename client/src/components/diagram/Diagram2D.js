import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import * as Pixi from "pixi.js";
import Spinner from "react-spinkit";
import panzoom from "svg-pan-zoom";
import { connect } from "react-redux";

import * as Core from "homotopy-core";

import compose from "~/util/compose";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
// import withPanZoom from "~/components/misc/PanZoom";
import withLayout from "~/components/diagram/withLayout";
import { getGenerators } from "~/state/store/signature";

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
      panEnabled: this.props.interactive,
      zoomEnabled: this.props.interactive,
      dblClickZoomEnabled: this.props.interactive,
      zoomScaleSensitivity: 0.4,
      minZoom: 0.001,
      maxZoom: 1000
    });
  }

  componentDidUpdate(props) {
    if (this.props.layout != props.layout) {
      this.renderCache = null;
    }
  }

  componentWillUnmount() {
    this.panzoom.destroy();
  }

  onSelect(e, ...points) {
    if (this.props.interactive) {
      // TODO: Consider all points to determine boundary flags.
      console.log(points);
      this.props.onSelect && this.props.onSelect(points);
    }
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

  getGenerator(point) {
    let id = Core.Geometry.typeAt(this.props.diagram, point).id;
    return this.props.generators[id];
  }

  getControlPoint(generator, from, to) {
    if (this.props.diagram.n != 2 || generator.generator.n <= this.props.diagram.n - 2) {
      return from;
    }

    let codim = this.props.diagram.n - generator.generator.n;
    let control = from.slice();
    control[codim] = (control[codim] + to[codim]) / 2;
    return control;
  }

  renderPoint(point) {
    let position = this.getPosition(point);
    let generator = this.getGenerator(point);

    if (generator.generator.n < this.props.diagram.n) {
      return null;
    }

    return (
      <circle
        cx={position[0]}
        cy={position[1]}
        r={10}
        strokeWidth={0}
        fill={generator.color}
        onClick={e => this.onSelect(e, point)}
        key={`point#${point.join(":")}`}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );
  }

  renderWire(s, t) {
    let sGenerator = this.getGenerator(s);
    let tGenerator = this.getGenerator(t);

    if (sGenerator.generator.n < this.props.diagram.n - 1) {
      return null;
    }

    let sPosition = this.getPosition(s);
    let tPosition = this.getPosition(t);
    let stControl = this.getControlPoint(sGenerator, sPosition, tPosition);
    let tsControl = this.getControlPoint(tGenerator, tPosition, sPosition);

    let path = [
      `M ${sPosition.join(" ")}`,
      `C ${stControl.join(" ")}`,
      `  ${tsControl.join(" ")}`,
      `  ${tPosition.join(" ")}`
    ].join(" ");

    return (
      <path
        d={path}
        stroke={sGenerator.color}
        strokeWidth={10}
        fill="none"
        key={`wire#${s.join(":")}#${t.join(":")}`}
        onClick={e => this.onSelect(e, s, t)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  renderSurface(s, m, t) {
    let sGenerator = this.getGenerator(s);
    let mGenerator = this.getGenerator(m);
    let tGenerator = this.getGenerator(t);

    let sPosition = this.getPosition(s);
    let mPosition = this.getPosition(m);
    let tPosition = this.getPosition(t);

    let smControl = this.getControlPoint(sGenerator, sPosition, mPosition);
    let msControl = this.getControlPoint(mGenerator, mPosition, sPosition);

    let mtControl = this.getControlPoint(mGenerator, mPosition, tPosition);
    let tmControl = this.getControlPoint(tGenerator, tPosition, mPosition);

    let tsControl = this.getControlPoint(tGenerator, tPosition, sPosition);
    let stControl = this.getControlPoint(sGenerator, sPosition, tPosition);

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

    return (
      <path
        d={path}
        fill={sGenerator.color}
        key={`surface#${s.join(":")}#${m.join(" ")}#${t.join(":")}`}
        onClick={e => this.onSelect(e, s, m, t)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  render() {  
    if (!this.renderCache) {
      let edges = this.props.layout.edges;
      let points = this.props.layout.points;
      let surfaces = findSurfaces(this.props.diagram, this.props.layout);
      this.renderCache = (
        <g>
          <g shapeRendering="crispEdges">
            {surfaces.map(([a, b, c]) => this.renderSurface(a, b, c))}
          </g>
          {edges.map(({source, target}) => this.renderWire(source, target))}
          {points.map(point => this.renderPoint(point))}
        </g>
      )
    }

    return (
      <svg className={css(styles.diagram)} width={this.props.width} height={this.props.height} ref={this.diagramRef}>
        {this.renderCache}
      </svg>
    );
  }

}

const findSurfaces = (diagram, layout) => {
  let graph = new Graph();

  for (let { source, target, codim, dir } of layout.edges) {
    graph.addEdge(source, target, { codim, dir });
  }

  let surfaces = [];
  for (let [a, b, ab] of graph.edges()) {
    let aType = Core.Geometry.typeAt(diagram, a);

    if (aType.n < diagram.n - 2) {
      continue;
    }

    for (let [c, bc] of graph.edgesFrom(b)) {
      surfaces.push([a, b, c])
    }
  }

  return surfaces;
}

export const Loading = ({ className }) =>
  <div className={`${css(styles.loading)} ${className}`}>
    <Spinner />
  </div>

const styles = StyleSheet.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },

  diagram: {
    position: "absolute"
  }
})