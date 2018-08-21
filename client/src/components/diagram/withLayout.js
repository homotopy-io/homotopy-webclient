import * as RxOps from "rxjs/operators";
import { streamProps } from "react-streams";
import hoc from "~/util/hoc";
import compose from "~/util/compose";
import computeLayout from "~/layout/master";

/**
 * Higher order component that that computes the layout for given `diagram` and
 * `dimension` properties, and makes it available in the `layout` property. While
 * the layout is computing, the layout property will be `null`.
 */
export default hoc(streamProps(compose(
  // Don't recompute layout when the diagram and dimension have not changed.
  RxOps.distinctUntilChanged((a, b) => (
    a.diagram === b.diagram &&
    a.dimension === b.dimension
  )),

  // Run the layout algorithm.
  RxOps.switchMap((props) =>
    computeLayout(props.diagram, props.dimension)
      .pipe(RxOps.startWith(null))
      .pipe(RxOps.map(layout => ({ layout, ...props })))
  )
)));