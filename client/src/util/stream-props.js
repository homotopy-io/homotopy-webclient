import * as React from "react";
import { Subject } from "rxjs";
import * as RxOps from "rxjs/operators";

export default pipe => Component => {
  return class StreamProps extends React.Component {

    constructor(props) {
      super(props);
      this.state = { value: undefined };
      this.props$ = new Subject();
      this.oldProps = null;
    }

    componentDidMount() {
      this.subscription = this.props$.pipe(pipe).subscribe(
        value => this.setState({ value })
      );

      let { children, ...props } = this.props;
      this.props$.next(props);
      this.oldProps = this.props;
    }

    componentDidUpdate(oldProps) {
      if (this.props !== oldProps) {
        let { children, ...props } = this.props;
        this.props$.next(props);
        this.oldProps = this.props;
      }
    }

    componentWillUnmount() {
      this.subscription.unsubscribe();
    }

    render() {
      if (this.state.value !== undefined) {
        return <Component {...this.state.value} />;
      } else {
        return null;
      }
    }

  };
};