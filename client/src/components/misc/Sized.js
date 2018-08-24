import * as React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { StyleSheet, css } from "aphrodite";

export default Component => props =>
  <Sized>
    {(width, height) =>
      <Component
        width={width}
        height={height}
        {...props}
      />
    }
  </Sized>

export class Sized extends React.Component {

  constructor(props) {
    super(props);
    this.containerRef = React.createRef();
    this.state = { width: 0, height: 0 };
  }

  componentDidMount() {
    this.observer = new ResizeObserver((entries) => {
      for (let { contentRect } of entries) {
        this.setState({
          width: contentRect.width,
          height: contentRect.height
        });
      }
    });
    this.observer.observe(this.containerRef.current);

    this.setState({
      width: this.containerRef.current.clientWidth,
      height: this.containerRef.current.clientHeight
    });
  }

  componentWillUnmount() {
    this.observer.disconnect();
  }

  render() {
    let { width, height } = this.state;

    return (
      <div className={css(styles.container)} ref={this.containerRef}>
        { width && height ? this.props.children(width, height) : null }
      </div>
    )
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    display: "flex",
    overflow: "hidden"
  }
})