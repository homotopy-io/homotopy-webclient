import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import panzoom from "svg-pan-zoom";
import { connect } from "react-redux";

import * as Core from "homotopy-core";
import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

import compose from "~/util/compose";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
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

    let expand = e.shiftKey;
    let startX = e.clientX;
    let startY = e.clientY;

    move$
      .pipe(RxOps.takeUntil(up$))
      .pipe(RxOps.map(e => {
        let x = e.clientX;
        let y = e.clientY;
        return [x - startX, startY - y];
      }))
      .pipe(RxOps.filter(dirs => dirs.some(dir => Math.abs(dir) > 100)))
      .pipe(RxOps.take(1))
      .pipe(RxOps.map(dirs => dirs.map(dir => {
        if (dir > 80) {
          return 1;
        } else if (dir < -80) {
          return -1;
        } else {
          return 0;
        }
      })))
      .subscribe(dirs => {
        if (!expand && this.props.onContract) {
          this.props.onContract(point, dirs);
        }

        if (expand && this.props.onExpand) {
          this.props.onExpand(point, dirs);
        }
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
    let id = Core.Geometry.typeAt(this.diagram, point).id;
    return this.props.generators[id];
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
    let position = this.getPosition(point);
    let generator = this.getGenerator(point);

    if (generator.generator.n < this.diagram.n) {
      return null;
    }

    return (
      <circle
        cx={position[0]}
        cy={position[1]}
        r={12.5}
        strokeWidth={0}
        fill={generator.color}
        onClick={e => this.onSelect(e, point)}
        onMouseDown={e => this.onStartDrag(e, point)}
        key={`point#${point.join(":")}`}>
        {this.props.interactive && <title>{generator.name}</title>}
      </circle>
    );
  }

  renderWire(s, t) {
    let sGenerator = this.getGenerator(s);
    let tGenerator = this.getGenerator(t);

    if (sGenerator.generator.n < this.diagram.n - 1) {
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

  getGeneratorPosition(p) {
    return { generator: this.getGenerator(p), position: this.getPosition(p) };
  }

  renderSurface(s, m, t) {
    let sGenerator = this.getGenerator(s);
    let mGenerator = this.getGenerator(m);
    let tGenerator = this.getGenerator(t);
    let sPosition = this.getPosition(s);
    let mPosition = this.getPosition(m);
    let tPosition = this.getPosition(t);

    let highlight = (
      this.isPointHighlighted(s) &&
      this.isPointHighlighted(m) &&
      this.isPointHighlighted(t)
    );

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

    /* Remove stroke here to see triangles when debugging */
    return (
      <path
        d={path}
        stroke={sGenerator.color}
        strokeWidth={1}
        vectorEffect={"non-scaling-stroke"}
        fill={highlight ? "#f1c40f" : sGenerator.color}
        key={`surface#${s.join(":")}#${m.join(" ")}#${t.join(":")}`}
        onClick={e => this.onSelect(e, s, m, t)}>
        {this.props.interactive && <title>{sGenerator.name}</title>}
      </path>
    );
  }

  render() {
    let edges = this.props.layout.edges;
    let points = this.props.layout.points;
    let surfaces = findSurfaces(this.diagram, this.props.layout);

    return (
      <DiagramSVG width={this.props.width} height={this.props.height} innerRef={this.diagramRef}>
        <g>
          {surfaces.map(([a, b, c]) => this.renderSurface(a, b, c))}
          {edges.map(({source, target}) => this.renderWire(source, target))}
          {points.map(point => this.renderPoint(point))}
        </g>
      </DiagramSVG>
    );
  }

}


const findSurfaces = (diagram, layout) => {
  let graph = new Graph();

  for (let { source, target, codim, dir } of layout.edges) {
    graph.addEdge(source, target, { codim, dir });
  }

  let surfaces = [];
  for (let [a, b] of graph.edges()) {
    let aType = Core.Geometry.typeAt(diagram, a);

    for (let [c] of graph.edgesFrom(b)) {
      surfaces.push([a, b, c]);
    }
  }

  return surfaces;
};

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
