import * as React from "react";
import * as Konva from "react-konva";
import { StyleSheet, css } from "aphrodite";
import Spinner from "react-spinkit";
import SizedContainer from "~/components/SizedContainer";

import * as Core from "homotopy-core";
import computeLayout from "~/layout/master";

import CanvasStage from "~/components/CanvasStage";

export class Diagram2D extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      layout: null,
      width: 100,
      height: 100
    };
    this.stageRef = React.createRef();
  }

  onResize(width, height) {
    console.log(width, height);
    this.setState({ width, height });
  }

  componentDidMount() {
    this.computeLayout(this.props.diagram, this.props.dimension);
  }

  // TODO: Recompute layout if diagram or dimension changed.

  computeLayout(diagram, dimension) {
    if (this.cancelLayout) {
      this.cancelLayout();
      this.cancelLayout = null;
    }

    let points = [...Core.Geometry.pointsOf(diagram, dimension)];
    let edges = [...Core.Geometry.edgesOf(diagram, dimension)];

    // TODO: Run the solver in a webworker.
    let solver = computeLayout(dimension, points, edges);
    this.cancelLayout = solver.cancel;

    solver.wait.then(({ positions, minBounds, maxBounds }) => {
        this.setState({
          layout: {
            points,
            edges,
            positions,
            minBounds,
            maxBounds
          }
        });
      })
      .catch(error => console.error(error));
  }

  render() {
    if (!this.state.layout) {
      return (
        <div className={`${css(styles.loading)} ${this.props.className}`}>
          <Spinner />
        </div>
      );
    }

    let { scale, padding, diagram } = this.props;
    let { width, height } = this.state;

    const layoutPoint = point => {
      let { positions, minBounds, maxBounds } = this.state.layout;

      minBounds = [...minBounds, 0, 0];
      maxBounds = [...maxBounds, 0, 0];

      let position = [...positions.get(point.join(":")), 0, 0];
      position[1] += (maxBounds[1] - minBounds[1]) / 2;
      position[0] += (maxBounds[0] - minBounds[0]) / 2;

      let x = position[1] ;
      let y = -position[0];

      return [x, y];
    }

    return (
      <CanvasStage
        ref={this.stageRef}
        className={`${css(styles.diagram)} ${this.props.className}`}
        zoomFactor={this.props.interactive ? 0.99 : 1}
        draggable={this.props.interactive}
      >
        <Konva.Layer scaleX={scale} scaleY={scale}>
          {this.state.layout.edges.map((edge, index) =>
            <Konva.Line
              points={[
                ...layoutPoint(edge.source),
                ...layoutPoint(edge.target)
              ]}
              stroke="gray"
              strokeWidth={0.01 }
              key={index}
            />
          )}
          {this.state.layout.points.map((point, index) => 
            <Konva.Circle
              x={layoutPoint(point)[0]}
              y={layoutPoint(point)[1]}
              radius={0.1}
              fill="red"
              key={index}
            />
          )}
        </Konva.Layer>
      </CanvasStage>
    );
  }

}

export default Diagram2D;

const styles = StyleSheet.create({
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },

  diagram: {
    flex: 1,
  }
})