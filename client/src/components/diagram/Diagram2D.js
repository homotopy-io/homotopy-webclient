import * as React from "react";
import * as Konva from "react-konva";
import { StyleSheet, css } from "aphrodite";
import Spinner from "react-spinkit";
import { connect } from "react-redux";

import * as Core from "homotopy-core";

import compose from "~/util/compose";
import CanvasStage from "~/components/misc/CanvasStage";
import withLayout from "~/components/diagram/withLayout";

import { getGenerators } from "~/state/store/signature";

export default compose(
  connect(
    // TODO: Only get generators that appear in the diagram
    state => ({ generators: getGenerators(state) })
  ),
  withLayout
)(props => {
  return (props.layout
  ? <Diagram2D {...props} />
  : <Loading {...props} />);
});

const pointPosition = layout => point => {
  let { positions, minBounds, maxBounds } = layout;

  minBounds = [...Array(2 - point.length).fill(0), ...minBounds];
  maxBounds = [...Array(2 - point.length).fill(0), ...maxBounds];

  let position = [...Array(2 - point.length).fill(0), ...positions.get(point.join(":"))];
  position[1] += (maxBounds[1] - minBounds[1]) / 2;
  position[0] += (maxBounds[0] - minBounds[0]) / 2;

  let x = position[1];
  let y = -position[0];

  return [x, y];
}

export const Diagram2D = ({
  diagram,
  dimension,
  layout,
  interactive,
  scale,
  className,
  generators
}) => 
  <CanvasStage
    className={`${css(styles.diagram)} ${className}`}
    zoomFactor={interactive ? 0.99 : 1}
    draggable={interactive}>
    <Konva.Layer scaleX={scale} scaleY={scale}>
      {layout.edges.map(edge => {
        let generator = generators[Core.Geometry.typeAt(diagram, edge.source).id];

        if (generator.generator.n < dimension - 1) {
          return null;
        }

        return (
          <Wire
            key={`edge#${edge.source.join(":")}#${edge.target.join(":")}`}
            source={edge.source}
            target={edge.target}
            layout={layout}
            diagram={diagram}
            generator={generator}
          />
        );
      })}
      {layout.points.map(point => {
        let generator = generators[Core.Geometry.typeAt(diagram, point).id];

        if (generator.generator.n < dimension) {
          return null;
        }

        return (
          <Point
            key={`point#${point.join(":")}`}
            point={point}
            layout={layout}
            generator={generator}
          />
        );
      })}
    </Konva.Layer>
  </CanvasStage>

export const Wire = ({
  source,
  target,
  layout,
  diagram,
  generator
}) =>
  <Konva.Line
    points={[
      ...pointPosition(layout)(source),
      ...pointPosition(layout)(target)
    ]}
    stroke={generator.color}
    strokeWidth={0.05}
  />

export const Point = ({
  point,
  layout,
  generator
}) =>
  <Konva.Circle
    x={pointPosition(layout)(point)[0]}
    y={pointPosition(layout)(point)[1]}
    radius={0.1}
    fill={generator.color}
  />

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
    flex: 1,
    position: "relative"
  }
})