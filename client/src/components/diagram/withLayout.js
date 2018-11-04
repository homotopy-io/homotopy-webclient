import { of as observableOf } from "rxjs";
import * as RxOps from "rxjs/operators";
import streamProps from "~/util/stream-props.js";
import compose from "~/util/compose";
import computeLayout from "~/layout/master";

export default streamProps(props$ =>
  props$.pipe(
    RxOps.withLatestFrom(computeLayout$(props$)),
    RxOps.map(([props, layout]) => ({...props, layout}))
  )
);

const computeLayout$ = compose(
  // Don't recompute layout when the diagram and dimension have not changed.
  RxOps.distinctUntilChanged((a, b) => {
    return (
      a.slice.join(":") === b.slice.join(":") &&
      a.diagram === b.diagram &&
      a.dimension === b.dimension
    );
  }),

  // Run the layout algorithm.
  RxOps.switchMap((props) =>
    computeLayout(props.diagram.getSlice(...props.slice), props.dimension)
      .pipe(RxOps.startWith(null))
  )
);