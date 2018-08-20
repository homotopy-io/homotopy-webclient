import * as React from "react";
import * as Konva from "react-konva";
import { StyleSheet, css } from "aphrodite";
import SizedContainer from "~/components/SizedContainer";

export class CanvasStage extends React.Component {

  constructor(props) {
    super(props);
    this.stageRef = React.createRef();
    this.state = { width: null, height: null };
    this.onResize = this.onResize.bind(this);
    this.onWheel = this.onWheel.bind(this);
  }

  get stage() {
    if (!this.stageRef.current) {
      return null;
    } else {
      return this.stageRef.current.getStage();
    }
  }

  get width() {
    return this.state.width;
  }

  get height() {
    return this.state.height;
  }

  onResize(width, height) {

    if (this.stage && this.state.width && this.state.height) {
      let stage = this.stage;
    }

    this.setState({ width, height });
  }

  onWheel(event) {
    let delta = event.evt.deltaY;
    let scaleBy = this.props.zoomFactor || 1;
    let stage = this.stage;
    let factor = Math.pow(scaleBy, delta);

    stage.scale({
      x: stage.scaleX() * factor,
      y: stage.scaleY() * factor
    });

    stage.position({
      x: (1 - factor) * stage.getPointerPosition().x + stage.x() * factor,
      y: (1 - factor) * stage.getPointerPosition().y + stage.y() * factor
    });

    stage.batchDraw();
  }

  componentDidUpdate() {
    if (this.stage && this.props.onReady) {
      this.props.onReady(this.stage);
    }
  }

  render() {
    let ready = this.state.width && this.state.height;

    return (
      <SizedContainer className={this.props.className} onResize={this.onResize} onClick={this.props.onClick}>
        { ready ?
          <Konva.Stage
            width={this.state.width}
            height={this.state.height}
            ref={this.stageRef}
            onWheel={this.onWheel}
            draggable={this.props.draggable}
            offsetX={-this.state.width / 2}
            offsetY={-this.state.height / 2}
            className={css(styles.canvas)}
          >
            {this.props.children}
          </Konva.Stage> : null
        }
      </SizedContainer>
    );
  }

}

export default CanvasStage;

const styles = StyleSheet.create({
  canvas: {
    position: "absolute"
  }
})