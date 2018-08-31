import * as React from "react";
import { Subject } from "rxjs";

export default pipe => Component => {
  return class StreamProps extends React.Component {

    constructor(props) {
      super(props);
      this.state = { value: undefined };
      this.props$ = new Subject();
    }

    componentDidMount() {
      this.subscription = this.props$.pipe(pipe).subscribe(
        value => this.setState({ value })
      );

      let { children, ...props } = this.props;
      this.props$.next(props);
    }

    componentDidUpdate(oldProps) {
      if (this.props !== oldProps) {
        let { children, ...props } = this.props;
        this.props$.next(props);
      }
    }

    componentWillUnmount() {
      this.subscription.unsubscribe();
    }

    render() {
      if (this.state.value !== undefined) {
        return <Component {...this.props} {...this.state.value} />;
      } else {
        return null;
      }
    }

  };
};