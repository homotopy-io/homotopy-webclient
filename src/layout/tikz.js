import { preparePoints, prepareEdges } from "~/components/diagram/Diagram2D"

export default (layout, generators, d2d) => {
  const wires = layout.edges.filter((edge) => edge.wire)
  const slice_edges = layout.edges.filter((edge) => edge.codim == 1)
  /* We have a reference to the instance of the Diagram2D component, which is
   * totally evil but for some reason the prepare* methods aren't static so
   * this nasty hack is semi-necessary */
  const points = d2d.preparePoints(layout.points, generators)
  // necessary?
  var edges = []
  const surfaces = d2d.findSurfaces(d2d.diagram, layout.edges, edges)
  edges.map(edge => d2d.prepareEdge(edge, points))
  const edges_nontrivial_target = edges.filter(edge => edge.target_point.nontrivial)
  //

  console.log("layout: ", layout)
  console.log("data: ", {points, edges, surfaces})
  const points_nontrivial = points.filter(point => point.nontrivial)

// ${slice_edges.map((e) => `\\draw[red] (${e.source.join('x')}) to (${e.target.join('x')});`).join('\n')}
//
// ${edges_nontrivial_target.map((e) => `\\draw[blue] (${e.source.join('x')}) to (${e.target.join('x')});`).join('\n')}

  const transform = ([zzx, zzy]) => layout.positions.get(`${zzx}:${zzy}`)

  return `\\begin{tikzpicture}
  ${points_nontrivial.map(point => `\\node[draw,circle] (${point.ref.replace(',','x')}) at (${transform(point.ref.split(',')).join(',')}) {};`).join('\n')}
  \\begin{scope}[on background layer]
    ${wires.map((e) => `\\draw (${transform(e.source).join(',')}) to (${transform(e.target).join(',')});`).join('\n')}
  \\end{scope}
\\end{tikzpicture}`
}
