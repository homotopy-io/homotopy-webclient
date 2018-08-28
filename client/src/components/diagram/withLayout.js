import * as RxOps from "rxjs/operators";
import streamProps from "~/util/stream-props.js";
import compose from "~/util/compose";
import computeLayout from "~/layout/master";

export default streamProps(compose(
  // Don't recompute layout when the diagram and dimension have not changed.
  RxOps.distinctUntilChanged((a, b) => (
    a.slice === b.slice &&
    a.diagram === b.diagram &&
    a.dimension === b.dimension
  )),

  // Run the layout algorithm.
  RxOps.switchMap((props) =>
    computeLayout(props.diagram.getSlice(...props.slice), props.dimension)
      .pipe(RxOps.startWith(null))
      .pipe(RxOps.map(layout => ({ layout })))
  )
));