import * as React from "react";
import styled from "styled-components";
import { BlockPicker } from "react-color";

export class ColorPicker extends React.Component {

  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
    this.pickerRef = React.createRef();
    this.state = { open: false };
  }

  componentDidMount() {
    document.addEventListener("mousedown", this.onClick, false);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onClick, false);
  }

  onClick(e) {
    if (this.pickerRef.current && !this.pickerRef.current.contains(e.target)) {
      this.setState({ open: false });
    }
  }

  openPicker() {
    this.setState({ open: true });
  }

  onChange(color) {
    this.setState({ open: false });
    this.props.onChange(color.hex);
  }

  render() {
    return (
      <Preview
        style={{ background: this.props.color }}
        onClick={() => this.openPicker()}
        ref={this.pickerRef}>
        {this.state.open &&
          <Picker>
            <BlockPicker
              color={this.props.color}
              colors={this.props.colors}
              width={150}
              onChangeComplete={color => this.onChange(color)}
            />
          </Picker>
        }
      </Preview>
    );
  }

}

export default ColorPicker;

const Preview = styled.div`
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 10;
  cursor: pointer;
  margin: 4px;
`;

const Picker = styled.div`
  position: absolute;
  top: 30;
  left: ${-0.5 * (150 - 20)};
  zIndex: 10;
`;
