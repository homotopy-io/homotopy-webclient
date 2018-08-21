import * as React from "react";
import ResizeObserver from "resize-observer-polyfill";

export class Sized extends React.Component {

  constructor(props) {
    super(props);
    this.containerRef = React.createRef();
  }

  componentDidMount() {
    let container = this.containerRef.current;
    this.props.onResize(container.clientWidth, container.clientHeight);

    this.observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        let { contentRect } = entry;
        this.props.onResize(contentRect.width, contentRect.height);
      }
    });

    this.observer.observe(container);
  }

  componentWillUnmount() {
    this.observer.disconnect();
  }

  render() {
    return (
      <div className={this.props.className} ref={this.containerRef}>
        {this.props.children}
      </div>
    )
  }

}

export default Sized;