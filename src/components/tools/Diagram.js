import * as React from "react";
import { connect } from "react-redux";

// import { clearDiagram, setProjection, setSlice, setRenderer } from "~/state/actions/workspace";
import { getDiagram, getSlice, getProjection, getSliceBounds, getRenderer, getDisplayHomotopies } from "~/state/store/workspace";

import Tool, { Control } from "~/components/Tool";
import styled from "styled-components";

export const DiagramTool = ({
  diagram,
  slice,
  sliceBounds,
  projection,
  renderer,
  displayHomotopies,
  onClearDiagram,
  onSetSlice,
  onSetProjection,
  onSetRenderer,
  onSetDisplayHomotopies
}) => {
  if (diagram == null) {
    return null;
  }

  return (
    <Tool
      title="Diagram"
      actions={[
      { label: "Clear diagram", icon: "close", onClick: onClearDiagram }
    ]}>
      <Control label="Dimension">{diagram.n}</Control>
      <RendererControl value={renderer} onChange={onSetRenderer} />
      <ProjectionControl value={projection} dimension={diagram.n} onChange={onSetProjection} />
      <SliceControl slice={slice} bounds={sliceBounds} onChange={onSetSlice} />
      {renderer != 2 ? <DisplayHomotopiesControl value={displayHomotopies} onChange={onSetDisplayHomotopies} /> : null}
    </Tool>
  );
};

export default connect(
  state => ({
    diagram: getDiagram(state.proof),
    slice: getSlice(state.proof),
    projection: getProjection(state.proof),
    sliceBounds: getSliceBounds(state.proof),
    renderer: getRenderer(state.proof),
    displayHomotopies: getDisplayHomotopies(state.proof)
  }),
  dispatch => ({
    onClearDiagram: () => dispatch({ type: 'workspace/clear-diagram' }),
    onSetProjection: (projection) => dispatch({ type: 'workspace/set-projection', payload: { projection } }),
    onSetSlice: (index, height) => dispatch({ type: 'workspace/set-slice', payload: { index, height } }),
    onSetRenderer: (renderer) => dispatch({ type: 'workspace/set-renderer', payload: { renderer } }),
    onSetDisplayHomotopies: (displayHomotopies) => dispatch({ type: 'workspace/set-display-homotopies', payload: { displayHomotopies } }),
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

  return (
    <Control label="Projection">
      <select onChange={e => onChange(Number(e.target.value))} value={value}>
        {options.map(option =>
          <option value={option} key={option}>
            {option}
          </option>
        )}
      </select>
    </Control>
  );
};

export const SliceControl = ({
  slice,
  bounds,
  onChange
}) => {
  let selections = [];
  for (let max of bounds) {
    let options = [];
    for (let j = -1; j <= max + 1; j++) {
      options.push({index: j, boundary: j == -1 ? 'S' : j == max + 1 ? 'T' : null});
      /*
      if (j == max + 1) {
        options.push(-2);
      } else {
        options.push(j);
      }
      */
    }
    selections.push(options);
  }

  return (
    <Control label="Slice">
      {selections.map((options, i) =>
        <select onChange={e => onChange(i, Number(e.target.value))} value={slice[i]} key={i}>
          {options.map(option =>
            <option value={option.index} key={option.index}>
              {option.boundary ? option.boundary : Math.floor(option.index / 2) + (option.index % 2 == 0 ? '' : '*')}
            </option>
          )}
        </select>
      )}
    </Control>
  );
};

export const RendererControl = ({
  value,
  onChange
}) => {
  return (
    <Control label="Renderer">
      <select onChange={e => onChange(Number(e.target.value))} value={value}>
        <option value={2}>2D</option>
        <option value={3}>3D</option>
      </select>
    </Control>
  );
}

export const DisplayHomotopiesControl = ({
  value,
  onChange
}) => {
  return (
      <Control label="Display homotopies">
        <input type="checkbox" checked={value} onChange={e => onChange(!value)} value={value}>
        </input>
      </Control>
  );
}
