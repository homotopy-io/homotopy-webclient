import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";

import { clearDiagram, setProjection, setSlice } from "~/state/actions/diagram";
import { getDiagram, getSlice, getProjection, getSliceBounds } from "~/state/store/diagram";

import Tool, { Control } from "~/components/Tool";

export const DiagramTool = ({
  diagram,
  slice,
  sliceBounds,
  projection,
  onClearDiagram,
  onSetSlice,
  onSetProjection
}) => {
  if (diagram == null) {
    return null;
  }

  return (
    <Tool title="Diagram" actions={[
      { label: "Clear diagram", icon: "close", onClick: onClearDiagram }
    ]}>
      <Control label="Dimension">{diagram.n}</Control>
      <ProjectionControl value={projection} dimension={diagram.n} onChange={onSetProjection} />
      <SliceControl slice={slice} bounds={sliceBounds} onChange={onSetSlice} />
    </Tool>
  );
}

export default connect(
  state => ({
    diagram: getDiagram(state),
    slice: getSlice(state),
    projection: getProjection(state),
    sliceBounds: getSliceBounds(state)
  }),
  dispatch => ({
    onClearDiagram: () => dispatch(clearDiagram()),
    onSetProjection: (projection) => dispatch(setProjection(projection)),
    onSetSlice: (index, height) => dispatch(setSlice(index, height))
  })
)(DiagramTool);

export const ProjectionControl = ({
  value,
  dimension,
  onChange
}) => {
  let options = [];
  for (let i = 0; i <= dimension; i++) {
    options.push(i);
  }

  console.log(options);

  return (
    <Control label="Projection">
      <select onChange={e => { console.log("on change"); onChange(Number(e.target.value)) }} value={value}>
        {options.map(option =>
          <option value={option} key={option}>
            {option}
          </option>
        )}
      </select>
    </Control>
  );
}

export const SliceControl = ({
  slice,
  bounds,
  onChange
}) => {
  let selections = [];
  for (let max of bounds) {
    let options = [];
    for (let j = 0; j <= max; j++) {
      options.push(j);
    }
    selections.push(options);
  }

  return (
    <Control label="Slice">
      {selections.map((options, i) =>
        <select onChange={e => onChange(i, Number(e.target.value))} value={slice[i]} key={i}>
          {options.map(option =>
            <option value={option} key={option}>
              {Math.floor(option / 2)}
              {option % 2 == 0 ? "" : "*"}
            </option>
          )}
        </select>
      )}
    </Control>
  );
}
