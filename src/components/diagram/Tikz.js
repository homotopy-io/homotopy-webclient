import * as React from 'react'
import styled from "styled-components"
import { compose } from 'redux'
import { connect } from 'react-redux'

import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'

import { connectModal } from 'redux-modal'

import Diagram2D, {instance as d2d} from "~/components/diagram/Diagram2D"
import { getDiagram, getDisplayDimension, getSlice, getProjection } from "~/state/store/workspace"
import { getGenerators } from "~/state/store/signature"
import computeLayout from "~/layout/master"
import layoutToTikz from "~/layout/tikz"

export const Tikz = ({
  show, handleHide, diagram, dimension, slice, projection, generators
}) =>
{
  const layout$ = computeLayout(diagram.getSlice(...slice), dimension)
  const [tikz, setTikz] = React.useState("Rendering...");
  // const dRef = React.useRef(null) // FIXME: Why are refs always null?
                                     // Have forwarded them to the inner Diagram2D component but still not sufficient
                                     // Having to do a nasty `instance` hack instead
  React.useEffect(() => {
    const subscription = layout$.subscribe(x =>
      setTikz(layoutToTikz(x, generators, d2d))
    )
    return () => {
      subscription.unsubscribe()
    }
  }, [tikz])
  return (
    <Dialog
      open={show}
      onClose={handleHide}
      scroll="paper"
      aria-labelledby="tikz-export-title"
    >
    <DialogTitle id="tikz-export-title">TikZ Export</DialogTitle>
    <DialogContent>
      <Preview>
          <Diagram2D
            diagram={diagram}
            dimension={dimension}
            slice={slice}
            projection={projection}
          />
      </Preview>
        <h2>TikZ</h2>
        <pre>
          {tikz}
        </pre>
        <h2>Preview</h2>
        <script type="text/tikz">
          {tikz}
        </script>
    </DialogContent>
    <DialogActions>
      <Button onClick={handleHide}>Close</Button>
    </DialogActions>
    </Dialog>
  )
}

export default compose(
  connect(
    state => ({
      diagram: getDiagram(state.proof),
      dimension: getDisplayDimension(state.proof),
      slice: getSlice(state.proof),
      projection: getProjection(state.proof),
      generators: getGenerators(state.proof)
    })
  ),
  connectModal({ name: "tikz" })
)(Tikz)

const Preview = styled.div`
  width: 75px;
  height: 75px;
  border: 2px dashed #34495e;
  margin: 8px;
  display: flex;
`;
