import * as Core from "homotopy-core";
import { _assert, _debug, isNatural } from "../../../core/src/util/debug"; // this is a mess

/*
    Literature on Bezier triangles

    https://www.gamasutra.com/view/feature/131389/b%EF%BF%BDzier_triangles_and_npatches.php
    https://en.wikipedia.org/wiki/B%C3%A9zier_triangle
*/

export class Loop {

  constructor({ complex, layout, boundary, dimension }) {
    _assert(complex instanceof Core.Complex);
    this.complex = complex;
    this.layout = { ...layout };

    if (dimension <= 3) {
      this.prepare3(boundary);
    } else if (dimension == 4) {
      this.prepare4(boundary);
    } else {
      console.log('Invalid complex dimension');
      debugger;
    }
  }

  prepare3(boundary) {

    // Need to know all vertices, faces and edges
    // For each vertex, need to know its edges
    // For each edge, need to know its vertices and faces
    // For each face, need to know its vertices
    let vertices = {};
    let edges = {};
    let faces = {};

    // The stuff to actually draw, with its type
    let draw_vertices = [];
    let draw_edges = [];
    let draw_triangles = [];

    let complex = this.complex;

    for (let i=0; i<complex.simplices.length; i++) {

      let simplex = complex.simplices[i];

      if (simplex.point_names.length == 1) {

        Loop.addNewVertex(vertices, simplex.point_names[0], 0);
        draw_vertices.push({ vertex: simplex.point_names[0], id: simplex.id });

      } else if (simplex.point_names.length == 2) {

        let edge_name = Loop.getEdgeName(simplex.point_names);
        Loop.addEdge(edges, simplex.point_names, edge_name, 1);
        let [point_1_name, point_2_name] = simplex.point_names;
        Loop.addNewVertex(vertices, point_1_name, 1);
        Loop.addNewVertex(vertices, point_2_name, 1);
        vertices[point_1_name].edges[edge_name] = true;
        vertices[point_2_name].edges[edge_name] = true;
        draw_edges.push({ vertices: simplex.point_names, id: simplex.id });
        
      } else if (simplex.point_names.length == 3) {

        let ns = simplex.point_names;
        let face_name = Loop.getFaceName(ns);
        let edge_1_name = Loop.getEdgeName([ns[0], ns[1]]);
        let edge_2_name = Loop.getEdgeName([ns[0], ns[2]]);
        let edge_3_name = Loop.getEdgeName([ns[1], ns[2]]);
        Loop.addEdge(edges, [ns[0], ns[1]], edge_1_name, 2);
        Loop.addEdge(edges, [ns[0], ns[2]], edge_2_name, 2);
        Loop.addEdge(edges, [ns[1], ns[2]], edge_3_name, 2);
        edges[edge_1_name].faces.add(face_name);
        edges[edge_2_name].faces.add(face_name);
        edges[edge_3_name].faces.add(face_name);
        Loop.addNewVertex(vertices, ns[0], 2);
        Loop.addNewVertex(vertices, ns[1], 2);
        Loop.addNewVertex(vertices, ns[2], 2);
        vertices[ns[0]].edges[edge_1_name] = true;
        vertices[ns[0]].edges[edge_2_name] = true;
        vertices[ns[1]].edges[edge_1_name] = true;
        vertices[ns[1]].edges[edge_3_name] = true;
        vertices[ns[2]].edges[edge_2_name] = true;
        vertices[ns[2]].edges[edge_3_name] = true;
        faces[face_name] = { vertices: ns, id: simplex.id, dimension: 2 /*, edges: [edge_1_name, edge_2_name, edge_3_name]*/ };
        draw_triangles.push({ vertices: simplex.point_names, id: simplex.id });

      }
    }

    // Add boundary flags for vertices and edges
    for (const edge_name in edges) {
      let edge_data = edges[edge_name];
      //edge_data.boundary = (edge_data.faces.size == 1);
      let b1 = boundary[edge_data.vertices[0]];
      let b2 = boundary[edge_data.vertices[0]];
      edge_data.boundary = (b1[0] && b2[0]) || (b1[1] && b2[1]);
    }
    for (const vertex_name in vertices) {
      let vertex_data = vertices[vertex_name];
      //vertex_data.boundary = Object.keys(vertex_data.edges).map(edge_name => edges[edge_name]).some(edge_data => edge_data.boundary);
      let b = boundary[vertex_name];
      vertex_data.boundary = b[0] || b[1];
      vertex_data.extremal = b[0] && b[1];
    }

    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    this.draw_vertices = draw_vertices;
    this.draw_edges = draw_edges;
    this.draw_triangles = draw_triangles;
  }

  static addNewVertex(vertices, name, dimension) {
    if (_debug) {
      _assert(vertices instanceof Object);
      _assert(typeof name === 'string');
    }
    if (!vertices[name]) {
      vertices[name] = { edges: {}, dimension };
    } else {
      vertices[name].dimension = Math.min(vertices[name].dimension, dimension);
    }
  }

  static addEdge(edges, edge_vertex_names, edge_name, dimension) {
    if (!edges[edge_name]) {
      edges[edge_name] = { vertices: edge_vertex_names, faces: new Set(), dimension };
    } else {
      edges[edge_name].dimension = Math.min(edges[edge_name].dimension, dimension);
    }
  }

  prepare4(boundary) {

    let vertices = {}; // edges, extra_vertex
    let edges = {};    // vertices, faces, extra_vertex
    let faces = {};    // vertices, extra_vertex
    let draw_instants = [];
    let draw_points = [];
    let draw_edges = [];
    let draw_triangles = [];
    let draw_triangle_fillers = [];
    let complex = this.complex;

    for (let i=0; i<complex.simplices.length; i++) {

      let simplex = complex.simplices[i];
      let names = simplex.point_names;
      let points = names.map(name => this.layout[name]);

      // Instanton
      if (names.length == 1) {
        draw_instants.push(names[0]);
      }

      // Moving vertex
      else if (names.length == 2) {
        draw_points.push(names);
        Loop.addNewVertex(vertices, names[0]);
        Loop.addNewVertex(vertices, names[1]);
      }
      
      // Growing edge or shrinking edge
      else if (names.length == 3) {

        // Shrinking edge
        if (points[0][0] == points[1][0]) {
          let edge_point_names = [names[0], names[1]];
          let edge_name = Loop.getEdgeName(edge_point_names);
          Loop.addEdge(edges, edge_point_names, edge_name);
          Loop.addNewVertex(vertices, names[0]);
          Loop.addNewVertex(vertices, names[1]);
          vertices[names[0]].edges[edge_name] = true;
          vertices[names[1]].edges[edge_name] = true;
          draw_edges.push({ edge_vertex_names: edge_point_names, extra_vertex_name: names[2] });
        }

        // Growing edge
        else if (points[1][0] == points[2][0]) {
          let edge_point_names = [names[1], names[2]];
          let edge_name = Loop.getEdgeName(edge_point_names);
          Loop.addEdge(edges, edge_point_names, edge_name);
          Loop.addNewVertex(vertices, names[1]);
          Loop.addNewVertex(vertices, names[2]);
          vertices[names[1]].edges[edge_name] = true;
          vertices[names[2]].edges[edge_name] = true;
          draw_edges.push({ edge_vertex_names: edge_point_names, extra_vertex_name: names[0] });
        }
        
      // Growing triangle, shrinking triangle, or interposed tetrahedron
      } else if (names.length == 4) {

        // Shrinking triangle
        if ((points[0][0] == points[1][0]) && (points[0][0] == points[2][0])) {
          let face_name = Loop.addNewFace(vertices, edges, faces, [names[0], names[1], names[2]])
          draw_triangles.push({ face_vertex_names: [names[0], names[1], names[2]], extra_vertex_name: names[3] });
        }

        // Growing triangle
        else if ((points[1][0] == points[2][0]) && (points[2][0] == points[3][0])) {
          let face_name = Loop.addNewFace(vertices, edges, faces, [names[1], names[2], names[3]]);
          draw_triangles.push({ face_vertex_names: [names[1], names[2], names[3]], extra_vertex_name: names[0] });
        }

        // Interposed triangles
        else {
          if (_debug) {
            _assert(points[0][0] == points[1][0]);
            _assert(points[2][0] == points[3][0]);
          }
          let source_names = points[0][0] < points[2][0] ? [names[0], names[1]] : [names[2], names[3]];
          let target_names = points[0][0] < points[2][0] ? [names[2], names[3]] : [names[0], names[1]];
          let tetrahedron = { source_names, target_names };
          draw_triangle_fillers.push(tetrahedron);
        }

      }
    }

    // Add boundary flags for vertices and edges
    for (const edge_name in edges) {
      let edge_data = edges[edge_name];
      edge_data.boundary = (edge_data.faces.size == 1);
    }
    for (const vertex_name in vertices) {
      let vertex_data = vertices[vertex_name];
      vertex_data.boundary = Object.keys(vertex_data.edges).map(edge_name => edges[edge_name]).some(edge_data => edge_data.boundary);
      let boundary_data = boundary[vertex_name];
      vertex_data.extremal = boundary_data[1] && boundary_data[2];
    }

    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    this.draw_instants = draw_instants;
    this.draw_points = draw_points;
    this.draw_edges = draw_edges;
    this.draw_triangles = draw_triangles;
    this.draw_triangle_fillers = draw_triangle_fillers;


        // Sanity check on the face/edge relations
    for (const edge_name in this.edges) {
      let xedge_data = this.edges[edge_name];
      let xpoint_1 = xedge_data.vertices[0];
      let xpoint_2 = xedge_data.vertices[1];
      let xface_array = [...xedge_data.faces];
      for (let i=0; i<xface_array.length; i++) {
        let xface_name = xface_array[i];
        let xface = this.faces[xface_name];
        if (xface.vertices.indexOf(xpoint_1) < 0) {
          console.log({xpoint_1, xface});
          debugger;
        }
        if (xface.vertices.indexOf(xpoint_2) < 0) {
          console.log({xpoint_2, xface});
          debugger;
        }
      }
    }
  }

  static addNewFace(vertices, edges, faces, point_names) {
    let ns = point_names;
    let face_name = Loop.getFaceName(ns);
    let edge_1_name = Loop.getEdgeName([ns[0], ns[1]]);
    let edge_2_name = Loop.getEdgeName([ns[0], ns[2]]);
    let edge_3_name = Loop.getEdgeName([ns[1], ns[2]]);
    Loop.addEdge(edges, [ns[0], ns[1]], edge_1_name);
    Loop.addEdge(edges, [ns[0], ns[2]], edge_2_name);
    Loop.addEdge(edges, [ns[1], ns[2]], edge_3_name);
    edges[edge_1_name].faces.add(face_name);
    edges[edge_2_name].faces.add(face_name);
    edges[edge_3_name].faces.add(face_name);
    Loop.addNewVertex(vertices, ns[0]);
    Loop.addNewVertex(vertices, ns[1]);
    Loop.addNewVertex(vertices, ns[2]);
    vertices[ns[0]].edges[edge_1_name] = true;
    vertices[ns[0]].edges[edge_2_name] = true;
    vertices[ns[1]].edges[edge_1_name] = true;
    vertices[ns[1]].edges[edge_3_name] = true;
    vertices[ns[2]].edges[edge_2_name] = true;
    vertices[ns[2]].edges[edge_3_name] = true;
    faces[face_name] = { vertices: ns };
    return face_name;
  }

  subdivide(dimension) {
    if (dimension <= 3) {
      this.subdivide3();
    } else if (dimension == 4) {
      this.subdivide4();
    } else {
      console.log("Can't subdivide this geometry");
    }
  }

  // Perform loop subdivision in the Warren style
  // http://www.cs.cmu.edu/afs/cs/academic/class/15462-s14/www/lec_slides/Subdivision.pdf
  subdivide4() {

    let vertices = {};
    let edges = {};
    let faces = {};
    let layout = { ...this.layout };

    // Loop over every original edge, subdividing it
    for (const edge_name in this.edges) {
      let edge_data = this.edges[edge_name];
      let sub_name = Loop.getEdgeSubdivisionName(edge_data.vertices);
      let [point_1_name, point_2_name] = edge_data.vertices;
      let point_1 = this.layout[point_1_name];
      let point_2 = this.layout[point_2_name];
      if (edge_data.faces.size != 2) {
        let points = edge_data.vertices.map(name => this.layout[name]);
        let sub_point = Loop.getVectorConvexSum(points, [0.5, 0.5]);
        layout[sub_name] = sub_point;
      } else {
        let face_array = [...edge_data.faces];
        let face_1_name = face_array[0];
        let face_2_name = face_array[1];
        let face_1_data = this.faces[face_1_name];
        let face_2_data = this.faces[face_2_name];
        let extra_vertex_names = [...face_1_data.vertices, ...face_2_data.vertices].filter(name => {
          return (name != point_1_name && name != point_2_name);
        });
        if (extra_vertex_names.length != 2) {
          console.log('extra_vertex_names.length = ' + extra_vertex_names.length);
          console.log(face_array);
          console.log(extra_vertex_names);
        }
        _assert(extra_vertex_names.length == 2);
        let extra_points = extra_vertex_names.map(name => this.layout[name])
        let new_point = Loop.getVectorConvexSum([point_1, point_2, ...extra_points], [0.375, 0.375, 0.125, 0.125]);
        layout[sub_name] = new_point;
      }
      let edge_1_name = Loop.getEdgeName([point_1_name, sub_name]);
      let edge_2_name = Loop.getEdgeName([sub_name, point_2_name]);
      let point_1_data = this.vertices[point_1_name];
      let point_2_data = this.vertices[point_2_name];
      if (!vertices[point_1_name]) vertices[point_1_name] = { edges: {}, boundary: point_1_data.boundary, extremal: this.vertices[point_1_name].extremal };
      if (!vertices[point_2_name]) vertices[point_2_name] = { edges: {}, boundary: point_2_data.boundary, extremal: this.vertices[point_2_name].extremal };
      vertices[sub_name] = { edges: {}, boundary: point_1_data.boundary && point_2_data.boundary, extremal: false };
      vertices[point_1_name].edges[edge_1_name] = true;
      vertices[sub_name].edges[edge_1_name] = true;
      vertices[sub_name].edges[edge_2_name] = true;
      vertices[point_2_name].edges[edge_2_name] = true;
      edges[edge_1_name] = { vertices: [point_1_name, sub_name], faces: new Set(), boundary: edge_data.boundary };
      edges[edge_2_name] = { vertices: [sub_name, point_2_name], faces: new Set(), boundary: edge_data.boundary };
    }

    // Loop over every original vertex, adjusting its position
    for (const vertex_name in this.vertices) {

      let vertex_data = this.vertices[vertex_name];
      let vertex_edges = Object.keys(vertex_data.edges);
      // Get the neighbouring boundary vertices
      let neighbouring_vertices = vertex_edges
        .map(edge_name => this.edges[edge_name].vertices)
        .flat().filter(name => name != vertex_name);

      // Extremal vertices don't change position
      if (vertex_data.extremal) {

        layout[vertex_name] = this.layout[vertex_name];

      // Boundary vertices are attracted to neighbouring boundary vertices
      } else if (vertex_data.boundary) {

        // Get the neighbouring boundary vertices
        let neighbouring_boundary_vertices = neighbouring_vertices
          .filter(vertex_name => this.vertices[vertex_name].boundary);
        _assert(neighbouring_boundary_vertices.length >= 2);
        let points = [vertex_name, ...neighbouring_boundary_vertices].map(name => this.layout[name]);
        let weights = [3/4];
        let neighbour_weight = 1/(4 * neighbouring_boundary_vertices.length);
        while (weights.length < points.length) {
          weights.push(neighbour_weight);
        }
        let new_point = Loop.getVectorConvexSum(points, weights);
        layout[vertex_name] = new_point;

      // Use the loop weighting rule
      } else {

        if (neighbouring_vertices.length < 3) {
          layout[vertex_name] = this.layout[vertex_name];
        } else {

          // Use the standard loop coordinate update rule, in the Warren version
          let beta = (neighbouring_vertices.length == 3)
            ? (3 / 16)
            : (3 / (8 * neighbouring_vertices.length));

          let points = [vertex_name, ...neighbouring_vertices].map(name => this.layout[name]);
          let weights = new Array(neighbouring_vertices.length + 1).fill(beta);
          weights[0] = 1 - (neighbouring_vertices.length * beta);
          let new_point = Loop.getVectorConvexSum(points, weights);
          layout[vertex_name] = new_point;

        }

      }

    }

    // Loop over every original face, creating 4 new faces
    // See 2019-1-homotopy.io-94
    for (const face_name in this.faces) {
      let face_data = this.faces[face_name];
      let [p1, p2, p3] = face_data.vertices;
      let e1c = Loop.getEdgeSubdivisionName([p1, p2]);
      let e2c = Loop.getEdgeSubdivisionName([p2, p3]);
      let e3c = Loop.getEdgeSubdivisionName([p1, p3]);
      let e4_name = Loop.getEdgeName([p1, e1c]);
      let e5_name = Loop.getEdgeName([e1c, p2]);
      let e6_name = Loop.getEdgeName([p2, e2c]);
      let e7_name = Loop.getEdgeName([e2c, p3]);
      let e8_name = Loop.getEdgeName([p1, e3c]);
      let e9_name = Loop.getEdgeName([e3c, p3]);
      let e10_name = Loop.getEdgeName([e1c, e2c]);
      let e11_name = Loop.getEdgeName([e1c, e3c]);
      let e12_name = Loop.getEdgeName([e2c, e3c]);
      let f1_name = Loop.getFaceName([e1c, p2, e2c]);
      let f2_name = Loop.getFaceName([e2c, e3c, p3]);
      let f3_name = Loop.getFaceName([p1, e1c, e3c]);
      let f4_name = Loop.getFaceName([e1c, e2c, e3c]);

      // Create new edges in the middle of the face
      edges[e10_name] = { vertices: [e1c, e2c], faces: new Set([f1_name, f4_name]), boundary: false };
      edges[e11_name] = { vertices: [e1c, e3c], faces: new Set([f3_name, f4_name]), boundary: false };
      edges[e12_name] = { vertices: [e2c, e3c], faces: new Set([f2_name, f4_name]), boundary: false };

      // Add the new faces to the boundary edges
      edges[e4_name].faces.add(f3_name);
      edges[e5_name].faces.add(f1_name);
      edges[e6_name].faces.add(f1_name);
      edges[e7_name].faces.add(f2_name);
      edges[e9_name].faces.add(f2_name);
      edges[e8_name].faces.add(f3_name);

      // Add the new faces
      faces[f1_name] = { vertices: [e1c, p2, e2c] };
      faces[f2_name] = { vertices: [e2c, e3c, p3] };
      faces[f3_name] = { vertices: [p1, e1c, e3c] };
      faces[f4_name] = { vertices: [e1c, e2c, e3c] };

    }

    // Now subdivide the drawing data

    // Preserve every instant & point

    // Subdivide the drawn edges
    let draw_edges = [];
    for (let i=0; i<this.draw_edges.length; i++) {
      let edge_data = this.draw_edges[i];
      let [n1, n2] = edge_data.edge_vertex_names;
      let s = Loop.getEdgeSubdivisionName(edge_data.edge_vertex_names);
      draw_edges.push(
        { edge_vertex_names: [n1, s], extra_vertex_name: edge_data.extra_vertex_name },
        { edge_vertex_names: [s, n1], extra_vertex_name: edge_data.extra_vertex_name }
      );
    }

    // Subdivide the drawn triangles
    let draw_triangles = [];
    for (let i=0; i<this.draw_triangles.length; i++) {
      let tri_data = this.draw_triangles[i];
      let [n1, n2, n3] = tri_data.face_vertex_names;
      let n12 = Loop.getEdgeSubdivisionName([n1, n2]);
      let n23 = Loop.getEdgeSubdivisionName([n2, n3]);
      let n13 = Loop.getEdgeSubdivisionName([n1, n3]);
      let extra_vertex_name = tri_data.extra_vertex_name;
      draw_triangles.push(
        { face_vertex_names: [n1 , n12, n13], extra_vertex_name },
        { face_vertex_names: [n12, n2 , n23], extra_vertex_name },
        { face_vertex_names: [n23, n13, n3 ], extra_vertex_name },
        { face_vertex_names: [n12, n23, n13], extra_vertex_name }
      );
    }

    // Subdivide the triangle fillers
    let draw_triangle_fillers = [];
    for (let i=0; i<this.draw_triangle_fillers.length; i++) {
      let filler_data = this.draw_triangle_fillers[i];
      let sn = filler_data.source_names;
      let tn = filler_data.target_names;
      let old_edge_1c = Loop.getEdgeSubdivisionName(sn);
      let old_edge_2c = Loop.getEdgeSubdivisionName(tn);
      let new_tet_1 = { source_names: [sn[0], old_edge_1c], target_names: [tn[0], old_edge_2c] };
      let new_tet_2 = { source_names: [sn[0], old_edge_1c], target_names: [old_edge_2c, tn[1]] };
      let new_tet_3 = { source_names: [old_edge_1c, sn[1]], target_names: [tn[0], old_edge_2c] };
      let new_tet_4 = { source_names: [old_edge_1c, sn[1]], target_names: [old_edge_2c, tn[1]] };
      draw_triangle_fillers.push(new_tet_1, new_tet_2, new_tet_3, new_tet_4);
    }

    // Retain the subdivided data
    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    //this.draw_instants = draw_instants; unchanged
    //this.draw_points = draw_points; unchanged
    this.draw_edges = draw_edges;
    this.draw_triangles = draw_triangles;
    this.draw_triangle_fillers = draw_triangle_fillers;
    this.layout = layout;

    // Sanity check on the face/edge relations
    for (const edge_name in this.edges) {
      let xedge_data = this.edges[edge_name];
      let xpoint_1 = xedge_data.vertices[0];
      let xpoint_2 = xedge_data.vertices[1];
      let xface_array = [...xedge_data.faces];
      for (let i=0; i<xface_array.length; i++) {
        let xface_name = xface_array[i];
        let xface = this.faces[xface_name];
        if (xface.vertices.indexOf(xpoint_1) < 0) {
          console.log({xpoint_1, xface});
          debugger;
        }
        if (xface.vertices.indexOf(xpoint_2) < 0) {
          console.log({xpoint_2, xface});
          debugger;
        }
      }
    }



  }

  // Perform loop subdivision in the Warren style
  // http://www.cs.cmu.edu/afs/cs/academic/class/15462-s14/www/lec_slides/Subdivision.pdf
  subdivide3() {

    let vertices = {};
    let edges = {};
    let faces = {};
    let layout = { ...layout };
    let draw_edges = [];
    let draw_triangles = [];

    // Loop over every original edge, subdividing it
    for (const edge_name in this.edges) {
      let edge_data = this.edges[edge_name];
      let sub_name = Loop.getEdgeSubdivisionName(edge_data.vertices);
      let [point_1_name, point_2_name] = edge_data.vertices;
      let point_1 = this.layout[point_1_name];
      let point_2 = this.layout[point_2_name];

      if (edge_data.dimension == 1) {

        let points = edge_data.vertices.map(name => this.layout[name]);
        let sub_point = Loop.getVectorConvexSum(points, [0.5, 0.5]);
        layout[sub_name] = sub_point;

      } else if (edge_data.dimension == 2) {

        if (edge_data.faces.size == 2) {
          let face_array = [...edge_data.faces];
          let face_1_name = face_array[0];
          let face_2_name = face_array[1];
          let face_1_data = this.faces[face_1_name];
          let face_2_data = this.faces[face_2_name];
          let extra_vertex_names = [...face_1_data.vertices, ...face_2_data.vertices].filter(name => {
            return (name != point_1_name && name != point_2_name);
          });
          _assert(extra_vertex_names.length == 2);
          let extra_points = extra_vertex_names.map(name => this.layout[name])
          let new_point = Loop.getVectorConvexSum([point_1, point_2, ...extra_points], [0.375, 0.375, 0.125, 0.125]);
          layout[sub_name] = new_point;
        } else {
          _assert(edge_data.boundary); // shouldn't happen -- never nonmanifold in generic position
          let points = edge_data.vertices.map(name => this.layout[name]);
          let sub_point = Loop.getVectorConvexSum(points, [0.5, 0.5]);
          layout[sub_name] = sub_point;
        }
      } else _assert(false);

      let edge_1_name = Loop.getEdgeName([point_1_name, sub_name]);
      let edge_2_name = Loop.getEdgeName([sub_name, point_2_name]);
      let point_1_data = this.vertices[point_1_name];
      let point_2_data = this.vertices[point_2_name];
      if (!vertices[point_1_name]) vertices[point_1_name] = { edges: {}, boundary: point_1_data.boundary, extremal: point_1_data.extremal, dimension: point_1_data.dimension };
      if (!vertices[point_2_name]) vertices[point_2_name] = { edges: {}, boundary: point_2_data.boundary, extremal: point_2_data.extremal, dimension: point_2_data.dimension };
      vertices[sub_name] = { edges: {}, boundary: point_1_data.boundary && point_2_data.boundary, dimension: edge_data.dimension };
      vertices[point_1_name].edges[edge_1_name] = true;
      vertices[sub_name].edges[edge_1_name] = true;
      vertices[sub_name].edges[edge_2_name] = true;
      vertices[point_2_name].edges[edge_2_name] = true;
      edges[edge_1_name] = { vertices: [point_1_name, sub_name], faces: new Set(), boundary: edge_data.boundary, dimension: edge_data.dimension };
      edges[edge_2_name] = { vertices: [sub_name, point_2_name], faces: new Set(), boundary: edge_data.boundary, dimension: edge_data.dimension };
    }

    // Loop over every original vertex, adjusting its position, and adding the appropriate faces
    for (const vertex_name in this.vertices) {

      let vertex_data = this.vertices[vertex_name];
      let vertex_edges = Object.keys(vertex_data.edges);

      // Get the neighbouring vertices
      let neighbouring_vertices = vertex_edges
        .map(edge_name => this.edges[edge_name].vertices)
        .flat().filter(name => name != vertex_name);

      if (vertex_data.dimension == 0) {

        // Never move diagram vertices
        layout[vertex_name] = this.layout[vertex_name]

      } else if (vertex_data.dimension == 1) {

        // If it's a boundary vertex, don't move it
        if (vertex_data.boundary) {

          layout[vertex_name] = this.layout[vertex_name];

        } else {

          // Get the neighbouring 1d vertices
          let neighbouring_1d_vertices = neighbouring_vertices
            .filter(vertex_name => this.vertices[vertex_name].dimension <= 1);

          // There should be exactly 2 of them
          _assert(neighbouring_1d_vertices.length == 2);

          let points = [vertex_name, ...neighbouring_1d_vertices].map(name => this.layout[name]);
          let weights = [3/4, 1/8, 1/8];
          let new_point = Loop.getVectorConvexSum(points, weights);
          layout[vertex_name] = new_point;

        }

      } else if (vertex_data.dimension == 2) {

        // Extremal vertices are right at the corners and don't get moved at all
        if (vertex_data.extremal) {

          layout[vertex_name] = this.layout[vertex_name];

        } else if (vertex_data.boundary) {

          // Get the neighbouring boundary vertices
          let neighbouring_boundary_vertices = neighbouring_vertices
            .filter(vertex_name => this.vertices[vertex_name].boundary);
          _assert(neighbouring_boundary_vertices.length >= 2);
          let points = [vertex_name, ...neighbouring_boundary_vertices].map(name => this.layout[name]);
          let weights = [3/4];
          let neighbour_weight = 1/(4 * neighbouring_boundary_vertices.length);
          while (weights.length < points.length) {
            weights.push(neighbour_weight);
          }
          let new_point = Loop.getVectorConvexSum(points, weights);
          layout[vertex_name] = new_point;

        } else {

          // Use the standard loop coordinate update rule, in the Warren version
          let beta = (neighbouring_vertices.length == 3)
            ? (3 / 16)
            : (3 / (8 * neighbouring_vertices.length));

          let points = [vertex_name, ...neighbouring_vertices].map(name => this.layout[name]);
          let weights = new Array(neighbouring_vertices.length + 1).fill(beta);
          weights[0] = 1 - (neighbouring_vertices.length * beta);
          let new_point = Loop.getVectorConvexSum(points, weights);
          layout[vertex_name] = new_point;

        }

      } else _assert(false);


    }

    // Loop over every original face, creating 4 new faces
    for (const face_name in this.faces) {
      let face_data = this.faces[face_name];
      let [p1, p2, p3] = face_data.vertices;
      let p12 = Loop.getEdgeSubdivisionName([p1, p2]);
      let p23 = Loop.getEdgeSubdivisionName([p2, p3]);
      let p13 = Loop.getEdgeSubdivisionName([p1, p3]);
      let e4_name = Loop.getEdgeName([p1, p12]);
      let e5_name = Loop.getEdgeName([p12, p2]);
      let e6_name = Loop.getEdgeName([p2, p23]);
      let e7_name = Loop.getEdgeName([p23, p3]);
      let e8_name = Loop.getEdgeName([p1, p13]);
      let e9_name = Loop.getEdgeName([p13, p3]);
      let e10_name = Loop.getEdgeName([p12, p23]);
      let e11_name = Loop.getEdgeName([p12, p13]);
      let e12_name = Loop.getEdgeName([p23, p13]);
      let f1_name = Loop.getFaceName([p12, p2, p23]);
      let f2_name = Loop.getFaceName([p23, p13, p3]);
      let f3_name = Loop.getFaceName([p1, p12, p13]);
      let f4_name = Loop.getFaceName([p12, p23, p13]);

      // Create new edges in the middle of the face
      edges[e10_name] = { vertices: [p12, p23], faces: new Set([f1_name, f4_name]), boundary: false, dimension: 2 };
      edges[e11_name] = { vertices: [p12, p13], faces: new Set([f3_name, f4_name]), boundary: false, dimension: 2 };
      edges[e12_name] = { vertices: [p23, p13], faces: new Set([f2_name, f4_name]), boundary: false, dimension: 2 };
      //if (e10_name == '((0,0,1)-(-1,-1,1).S.)-((0,-1,1)-(-1,-1,1).S.).S.') debugger;
      //if (e11_name == '((0,0,1)-(-1,-1,1).S.)-((0,-1,1)-(-1,-1,1).S.).S.') debugger;
      //if (e12_name == '((0,0,1)-(-1,-1,1).S.)-((0,-1,1)-(-1,-1,1).S.).S.') debugger;

      // Add the new faces to the boundary edges
      edges[e4_name].faces.add(f3_name);
      edges[e5_name].faces.add(f1_name);
      edges[e6_name].faces.add(f1_name);
      edges[e7_name].faces.add(f2_name);
      edges[e9_name].faces.add(f2_name);
      edges[e8_name].faces.add(f3_name);

      // Add the new faces
      faces[f1_name] = { vertices: [p12, p2, p23], dimension: 2 };
      faces[f2_name] = { vertices: [p23, p13, p3], dimension: 2 };
      faces[f3_name] = { vertices: [p1, p12, p13], dimension: 2 };
      faces[f4_name] = { vertices: [p12, p23, p13], dimension: 2 };

    }

    // Update the data of edges to draw
    for (let i=0; i<this.draw_edges.length; i++) {
      let edge_data = this.draw_edges[i];
      let [n1, n2] = edge_data.vertices;
      let id = edge_data.id;
      let s = Loop.getEdgeSubdivisionName(edge_data.vertices);
      draw_edges.push(
        { vertices: [n1, s], id },
        { vertices: [s, n2], id }
      );
    }

    // Update the data of triangles to draw
    for (let i=0; i<this.draw_triangles.length; i++) {
      let tri_data = this.draw_triangles[i];
      let [p1, p2, p3] = tri_data.vertices;
      let id = tri_data.id;
      let p12 = Loop.getEdgeSubdivisionName([p1, p2]);
      let p13 = Loop.getEdgeSubdivisionName([p1, p3]);
      let p23 = Loop.getEdgeSubdivisionName([p2, p3]);
      draw_triangles.push(
        { vertices: [p12, p2, p23], id },
        { vertices: [p23, p13, p3], id },
        { vertices: [p1, p12, p13], id },
        { vertices: [p12, p23, p13], id }
      );
    }

    // Retain the subdivided data
    this.layout = layout;
    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    this.draw_edges = draw_edges;
    this.draw_triangles = draw_triangles;

  }

  static getEdgeName(points) {
    if (_debug) {
      _assert(points instanceof Array);
      _assert(points.length == 2);
      _assert(typeof points[0] === 'string');
      _assert(typeof points[1] === 'string');
    }
    return '(' + points[0] + ')-(' + points[1] + ')';
  }

  static getEdgeSubdivisionName(points) {
    if (_debug) {
      _assert(points instanceof Array);
      _assert(points.length == 2);
      _assert(typeof points[0] === 'string');
      _assert(typeof points[1] === 'string');
    }
    return '(' + points[0] + ')-(' + points[1] + ').S.';
  }

  static getFaceName(points) {
    if (_debug) {
      _assert(points instanceof Array);
      _assert(points.length == 3);
      _assert(typeof points[0] === 'string');
      _assert(typeof points[1] === 'string');
      _assert(typeof points[2] === 'string');
    }
    return '(' + points[0] + ')-(' + points[1] + ')-(' + points[2] + ')';
  }

  /* Get a mixture of the given points, controlled by a weight vector */  
  static getVectorConvexSum(points, weights) {
    if (_debug) {
      _assert(points instanceof Array);
      _assert(weights instanceof Array);
      _assert(points.length == weights.length);
      for (let i=0; i<points.length; i++) {
        _assert(points[i] instanceof Array);
        _assert(points[i].length == 3 || points[i].length == 4);
        if (isNaN(weights[i])) debugger;
        _assert(!isNaN(weights[i]));
        _assert(weights[i] >= 0);
        _assert(weights[i] <= 1);
      }
    }
    let size = points[0].length;
    if (size == 3) {
      let vector = [0, 0, 0];
      for (let i=0; i<points.length; i++) {
        let point = points[i];
        let weight = weights[i];
        vector[0] += weight * point[0];
        vector[1] += weight * point[1];
        vector[2] += weight * point[2];
      }
      return vector;
    } else { // size == 4
      let vector = [points[0][0], 0, 0, 0]; // Hack, since the first vector is always constant
      for (let i=0; i<points.length; i++) {
        let point = points[i];
        let weight = weights[i];
        vector[1] += weight * point[1];
        vector[2] += weight * point[2];
        vector[3] += weight * point[3];
      }
      return vector;
    }
  }

}

/* This class holds a simplicial complex, along with a layout for it, and control points for the
   edges and triangles, making them cubic Bezier curves and patches respectively. This data is
   then used to subdivide all the data.
*/

export class BezierTriangleSystem {

  constructor({ complex, layout, freeze, construct_controls }) {

    _assert(complex instanceof Core.Complex);
    this.complex = complex;
    this.layout = { ...layout };
    if (construct_controls) {
      let controls = this.getControls(layout, freeze);
      this.layout = { ...this.layout, ...controls };
    }

  }

  /* Builds a new BezierTriangleSystem instance, which
     is derived from this one by subdivision. */ 
  subdivide() {
    if (this.complex.n == 3) return this.subdivide3();
    if (this.complex.n == 4) return this.subdivide4();
    return this;
  }

  layoutStore(layout, name, point) {
    if (_debug) {
      _assert(point instanceof Array);
      _assert(layout instanceof Object);
      _assert(typeof name === 'string');
    }
    layout[name] = point;
  }

  /* For a 3d complex:
      - Each 2-simplex (edge) becomes 4 2-simplices
      - Each 3-simplex (triangle) becomes 16 3-simplces */
  subdivide3() {

    let new_simplices = []; // the new simplices
    let new_layout = { ...this.layout };    // the new layout

    // Iterate over each simplex, subdividing as necessary
    for (let i=0; i<this.complex.simplices.length; i++) {
      let simplex = this.complex.simplices[i];

      if (simplex.point_names.length == 1) {

        // Vertex. Retain it along with its layout
        new_simplices.push(simplex);
        this.layoutStore(new_layout, simplex.first_point, this.layout[simplex.first_point]);

      } else if (simplex.point_names.length == 2) {

        // Retain edges.
        new_simplices.push(simplex);
        // Edge. Subdivide it.
        //this.subdivideEdge(new_simplices, new_layout, simplex.point_names, simplex.id);

      } else if (simplex.point_names.length == 3) {

        // Triangle. Subdivide its edges into 4, and the triangle itself into 16
        this.subdivideTriangle(new_simplices, new_layout, simplex.point_names, simplex.id);

      }

    }

    let complex = new Core.Complex({ simplices: new_simplices, n: this.complex.n, generators: this.complex.generators });
    let layout = new_layout;
    return new BezierTriangleSystem({ complex, layout, use_default_controls: false });
    
  }

  subdivideEdge(new_simplices, new_layout, point_names, id) {

    // Get the name of the subdivision point
    let subdivision_point_name = this.getSubdivisionPointName(point_names);

    // If this already exists, there's nothing to do
    if (new_layout[subdivision_point_name]) return;

    // Create the new simplices and store them
    /*
    let simplex_1 = new Simplex({ id, point_names: [point_names[0], subdivision_point_name] });
    let simplex_2 = new Simplex({ id, point_names: [subdivision_point_name, point_names[1]] });
    new_simplices.push(simplex_1, simplex_2);
    */

    // Get the control points of the existing edge
    let point_1 = this.layout[point_names[0]];
    let point_2 = this.layout[point_names[1]];
    let [c1_name, c2_name] = this.getEdgeControlNames(point_names[0], point_names[1]);
    let c1 = this.layout[c1_name];
    let c2 = this.layout[c2_name];

    // Get the new points and their names
    let subdivision_point = this.getSubdivisionPoint(point_1, point_2, c1, c2);
    let [edge1_c1, edge1_c2, edge2_c1, edge2_c2] = this.getSubdivisionControlPoints(point_1, point_2, c1, c2);
    let [edge1_c1_name, edge1_c2_name] = this.getEdgeControlNames(point_names[0], subdivision_point_name);
    let [edge2_c1_name, edge2_c2_name] = this.getEdgeControlNames(subdivision_point_name, point_names[1]);

    // Store the data
    this.layoutStore(new_layout, subdivision_point_name, subdivision_point);
    this.layoutStore(new_layout, edge1_c1_name, edge1_c1);
    this.layoutStore(new_layout, edge1_c2_name, edge1_c2);
    this.layoutStore(new_layout, edge2_c1_name, edge2_c1);
    this.layoutStore(new_layout, edge2_c2_name, edge2_c2);

    // These may already be stored, but that doesn't matter
    this.layoutStore(new_layout, point_names[0], point_1);
    this.layoutStore(new_layout, point_names[0], point_2);

    return [edge1_c1_name, edge1_c2_name, subdivision_point_name, edge2_c1_name, edge2_c2_name];

  }

  subdivideTriangle(new_simplices, new_layout, point_names, id) {

    // Get points of triangle to be subdivided
    let n1 = point_names[0];
    let n2 = point_names[1];
    let n3 = point_names[2];
    let p1 = this.layout[n1];
    let p2 = this.layout[n2];
    let p3 = this.layout[n3];
    let [nV, nQ] = this.getEdgeControlNames(n1, n2);
    let [nR, nS] = this.getEdgeControlNames(n2, n3);
    let [nT, nU] = this.getEdgeControlNames(n1, n3);
    let nW = this.getTriangleControlName([n1, n2, n3]);
    let [pV, pQ, pR, pS, pT, pU, pW] = [nV, nQ, nR, nS, nT, nU, nW].map(name => this.layout[name]);

    // Subdivide. The choice of variables is absurd, it happened by accident. If anyone works on this code again it should be cleaned up.
    let [p90 , p91 , p6  , p92 , p93 , p94 , p95 , p96 , p97 ] = this.getSubdivisionData(p1  , pV  , pQ  , p2  , pR  , pS  , p3  , pU  , pT  , pW  );
    let [p98 , p99 , p100, p101, p102, p103, p104, p105, p106] = this.getSubdivisionData(p1  , p90 , p91 , p6  , p94 , p95 , p2  , pQ  , pV  , p96 );
    let [p107, p108, p109, p110, p111, p112, p113, p114, pXX ] = this.getSubdivisionData(p3  , p93 , p92 , p6  , p94 , p95 , p2  , pR  , pS  , p97 );
    let [p115, p116, p117, p118, p119, p120, p121, p122, p123] = this.getSubdivisionData(p6  , p104, p103, p100, p99 , p98 , p1  , p90 , p91 , p105);
    let [p124, p125, p126, p127, p128, p129, p130, p131, p132] = this.getSubdivisionData(p1  , p119, p118, p117, p120, p121, p100, p99 , p98 , p123);
    let [p133, p134, p135, p136, p137, p138, p139, p140, p141] = this.getSubdivisionData(p6  , p115, p116, p117, p120, p121, p100, p103, p104, p122);
    let [p142, p143, p144, p145, p146, p147, p148, p149, p150] = this.getSubdivisionData(p6  , p104, p103, p100, p101, p102, p2  , p95 , p94 , p106);
    let [p151, p152, p153, p154, p155, p156, p157, p158, p159] = this.getSubdivisionData(p2  , p146, p145, p144, p147, p148, p100, p101, p102, p150);
    let [p160, p161, p162, p163, p164, p165, p166, p167, p168] = this.getSubdivisionData(p100, p148, p147, p144, p143, p142, p6  , p104, p103, p149);
    let [p169, p170, p171, p172, p173, p174, p175, p176, p177] = this.getSubdivisionData(p2  , p111, p110, p109, p112, p113, p6  , p94 , p95 , pXX );
    let [p178, p179, p180, p181, p182, p183, p184, p185, p186] = this.getSubdivisionData(p2  , p169, p170, p171, p174, p175, p109, p110, p111, p176);
    let [p187, p188, p189, p190, p191, p192, p193, p194, p195] = this.getSubdivisionData(p6  , p173, p172, p171, p174, p175, p109, p112, p113, p177);
    let [p196, p197, p198, p199, p200, p201, p202, p203, p204] = this.getSubdivisionData(p6  , p113, p112, p109, p108, p107, p3  , p93 , p92 , p114);
    let [p205, p206, p207, p208, p209, p210, p211, p212, p213] = this.getSubdivisionData(p6  , p196, p197, p198, p201, p202, p109, p112, p113, p203);
    let [p214, p215, p216, p217, p218, p219, p220, p221, p222] = this.getSubdivisionData(p3  , p200, p199, p198, p201, p202, p109, p108, p107, p204);

    // Get the names for the new vertices
    let n100 = this.getSubdivisionPointName([n1  , n2  ]);
    let n126 = this.getSubdivisionPointName([n1  , n100]);
    let n153 = this.getSubdivisionPointName([n100, n2  ]);
    let n6   = this.getSubdivisionPointName([n1  , n3  ]);
    let n171 = this.getSubdivisionPointName([n2  , n6  ]);
    let n117 = this.getSubdivisionPointName([n1  , n6  ]);
    let n109 = this.getSubdivisionPointName([n2  , n3  ]);
    let n180 = this.getSubdivisionPointName([n2  , n109]);
    let n216 = this.getSubdivisionPointName([n109, n3  ]);
    let n198 = this.getSubdivisionPointName([n6  , n3  ]);
    let n207 = this.getSubdivisionPointName([n6  , n109]);
    let n162 = this.getSubdivisionPointName([n100, n6  ]);

    // Store the new vertex positions
    this.layoutStore(new_layout, n126, p126);
    this.layoutStore(new_layout, n100, p100);
    this.layoutStore(new_layout, n153, p153);
    this.layoutStore(new_layout, n117, p117);
    this.layoutStore(new_layout, n162, p162);
    this.layoutStore(new_layout, n171, p171);
    this.layoutStore(new_layout, n180, p180);
    this.layoutStore(new_layout, n6, p6);
    this.layoutStore(new_layout, n207, p207);
    this.layoutStore(new_layout, n109, p109);
    this.layoutStore(new_layout, n198, p198);
    this.layoutStore(new_layout, n216, p216);

    /*
    // Store the main vertex positions
    this.layoutStore(new_layout, n1, p1);
    this.layoutStore(new_layout, n2, p2);
    this.layoutStore(new_layout, n3, p3);
    */

    // Store edge data

    // Diagonal edges sw->ne
    this.storeEdgeControlPoints(new_layout, n1  , n126, p124, p125);
    this.storeEdgeControlPoints(new_layout, n126, n100, p127, p128);
    this.storeEdgeControlPoints(new_layout, n100, n153, p155, p154);
    this.storeEdgeControlPoints(new_layout, n153, n2  , p152, p151);
    this.storeEdgeControlPoints(new_layout, n117, n162, p139, p138);
    this.storeEdgeControlPoints(new_layout, n162, n171, p165, p166);
    this.storeEdgeControlPoints(new_layout, n171, n180, p184, p183);
    this.storeEdgeControlPoints(new_layout, n6  , n207, p205, p206);
    this.storeEdgeControlPoints(new_layout, n207, n109, p208, p209);
    this.storeEdgeControlPoints(new_layout, n198, n216, p220, p219);

    // Diagonal edges nw->se
    this.storeEdgeControlPoints(new_layout, n2  , n180, p178, p179);
    this.storeEdgeControlPoints(new_layout, n180, n109, p181, p182);
    this.storeEdgeControlPoints(new_layout, n109, n216, p218, p217);
    this.storeEdgeControlPoints(new_layout, n216, n3  , p215, p214);
    this.storeEdgeControlPoints(new_layout, n153, n171, p156, p157);
    this.storeEdgeControlPoints(new_layout, n171, n207, p193, p192);
    this.storeEdgeControlPoints(new_layout, n207, n198, p210, p211);
    this.storeEdgeControlPoints(new_layout, n100, n162, p160, p161);
    this.storeEdgeControlPoints(new_layout, n162, n6  , p163, p164);
    this.storeEdgeControlPoints(new_layout, n126, n117, p129, p130);

    // Horizontal edges
    this.storeEdgeControlPoints(new_layout, n1  , n117, p119, p118);
    this.storeEdgeControlPoints(new_layout, n117, n6  , p116, p115);
    this.storeEdgeControlPoints(new_layout, n6  , n198, p196, p197);
    this.storeEdgeControlPoints(new_layout, n198, n3  , p199, p200);
    this.storeEdgeControlPoints(new_layout, n100, n171, p148, p147);
    this.storeEdgeControlPoints(new_layout, n171, n109, p174, p175);

    // Vertical edges
    this.storeEdgeControlPoints(new_layout, n100, n117, p121, p120);
    this.storeEdgeControlPoints(new_layout, n2  , n171, p169, p170);
    this.storeEdgeControlPoints(new_layout, n171, n6  , p172, p173);
    this.storeEdgeControlPoints(new_layout, n109, n198, p202, p201);

    // Store triangle central control point data
    let t1  = [n1  , n126, n117];
    let t2  = [n117, n162, n6  ];
    let t3  = [n6  , n207, n198];
    let t4  = [n198, n216, n3  ];
    let t5  = [n126, n100, n117];
    let t6  = [n100, n117, n162];
    let t7  = [n162, n171, n6  ];
    let t8  = [n171, n6  , n207];
    let t9  = [n207, n109, n198];
    let t10 = [n109, n198, n216];
    let t11 = [n100, n162, n171];
    let t12 = [n171, n207, n109];
    let t13 = [n100, n153, n171];
    let t14 = [n171, n180, n109];
    let t15 = [n153, n2  , n171];
    let t16 = [n2  , n171, n180];

    this.storeTriangleControlPoint(new_layout, t1, p131); // T1
    this.storeTriangleControlPoint(new_layout, t2, p140); // T2
    this.storeTriangleControlPoint(new_layout, t3, p212); // T3
    this.storeTriangleControlPoint(new_layout, t4, p221); // T4
    this.storeTriangleControlPoint(new_layout, t5, p132); // T5
    this.storeTriangleControlPoint(new_layout, t6, p141); // T6
    this.storeTriangleControlPoint(new_layout, t7, p168); // T7
    this.storeTriangleControlPoint(new_layout, t8, p194); // T8
    this.storeTriangleControlPoint(new_layout, t9, p213); // T9
    this.storeTriangleControlPoint(new_layout, t10, p222); // T10
    this.storeTriangleControlPoint(new_layout, t11, p167); // T11
    this.storeTriangleControlPoint(new_layout, t12, p195); // T12
    this.storeTriangleControlPoint(new_layout, t13, p159); // T13
    this.storeTriangleControlPoint(new_layout, t14, p186); // T14
    this.storeTriangleControlPoint(new_layout, t15, p158); // T15
    this.storeTriangleControlPoint(new_layout, t16, p185); // T16

    // Store the 3-simplices
    new_simplices.push({ point_names: t1, id }); // T1
    new_simplices.push({ point_names: t2, id }); // T2
    new_simplices.push({ point_names: t3, id }); // T3
    new_simplices.push({ point_names: t4, id }); // T4
    new_simplices.push({ point_names: t5, id }); // T5
    new_simplices.push({ point_names: t6, id }); // T6
    new_simplices.push({ point_names: t7, id }); // T7
    new_simplices.push({ point_names: t8, id }); // T8
    new_simplices.push({ point_names: t9, id }); // T9
    new_simplices.push({ point_names: t10, id }); // T10
    new_simplices.push({ point_names: t11, id }); // T11
    new_simplices.push({ point_names: t12, id }); // T12
    new_simplices.push({ point_names: t13, id }); // T13
    new_simplices.push({ point_names: t14, id }); // T14
    new_simplices.push({ point_names: t15, id }); // T15
    new_simplices.push({ point_names: t16, id }); // T16

  }

  storeEdgeControlPoints(layout, n1, n2, p1, p2) {
    if (_debug) {
      _assert(typeof n1 === 'string');
      _assert(typeof n2 === 'string');
      _assert(p1 instanceof Array);
      _assert(p2 instanceof Array);
    }
    let [control_name_1, control_name_2] = this.getEdgeControlNames(n1, n2);
    this.layoutStore(layout, control_name_1, p1);
    this.layoutStore(layout, control_name_2, p2);
  }

  storeTriangleControlPoint(layout, triangle_vertices, p) {
    if (_debug) {
      _assert(layout instanceof Object);
      _assert(triangle_vertices instanceof Array);
      _assert(p instanceof Array);
    }
    let name = this.getTriangleControlName(triangle_vertices);
    this.layoutStore(layout, name, p);
  }

  getSubdivisionData(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) {
    if (_debug) {
      [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10].map(p => _assert(p instanceof Array));
    }

    let a = this.getVectorConvexSum([p1, p9], [0.5, 0.5]);
    let b = this.getVectorConvexSum([p1, p9, p8], [0.25, 0.5, 0.25]);
    let c = this.getVectorConvexSum([p1, p9, p8, p7], [0.125, 0.375, 0.375, 0.125]);
    let d = this.getVectorConvexSum([p9, p8, p7], [0.25, 0.5, 0.25]);
    let e = this.getVectorConvexSum([p8, p7], [0.5, 0.5]);
    let f = this.getVectorConvexSum([p2, p10, p6], [0.25, 0.5, 0.25]);
    let g = this.getVectorConvexSum([p3, p5], [0.5, 0.5]);
    let h = this.getVectorConvexSum([p2, p10], [0.5, 0.5]);
    let i = this.getVectorConvexSum([p6, p10], [0.5, 0.5]);
    return [a, b, c, d, e, f, g, h, i];

  }

  getSubdivisionPointName(point_names) {
    if (_debug) {
      _assert(point_names instanceof Array);
    }
    return '(' + point_names[0] + ')-(' + point_names[1] + ').S.';
  }

  getSubdivisionPoint(point_1, point_2, control_1, control_2) {
    if (_debug) {
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(control_1 instanceof Array);
      _assert(control_2 instanceof Array);
    }
    return this.getVectorConvexSum([point_1, control_1, control_2, point_2], [0.125, 0.375, 0.375, 0.125]);
  }

  getSubdivisionControlPoints(point_1, point_2, control_1, control_2) {
    if (_debug) {
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(control_1 instanceof Array);
      _assert(control_2 instanceof Array);
    }
    return [
      this.getVectorConvexSum([point_1, control_1], [0.50, 0.50]),                  // edge 1 control 1
      this.getVectorConvexSum([point_1, control_1, control_2], [0.25, 0.50, 0.25]), // edge 1 control 2
      this.getVectorConvexSum([control_1, control_2, point_2], [0.25, 0.50, 0.25]), // edge 2 control 1
      this.getVectorConvexSum([control_2, point_2], [0.50, 0.50])                   // edge 2 control 2
    ];
  }

  /* Subdivides a 4d system as follows:
      - Each (2,1) simplex becomes 4 (2,1) simplices
      - Each (1,2) simplex becomes 4 (1,2) simplices
      - Each (3,1) simplex becomes 16 (3,1) simplices
      - Each (1,3) simplex becomes 16 (3,1) simplices
      - Each (2,2) simplex becomes 4 (2,2) simplices */
  subdivide4() {
  }

    /*
    Computes control points for simplices as follows. In dimension 3:
      - For every 2-simplex (wire), adds 2 control points
      - For every 3-simplex (triangle), adds 1 control point in the centre, and 2 control points for each edge
  */
  getControls(layout, freeze) {
    if (this.complex.n == 3) return this.getControls3(layout, freeze);
    if (this.complex.n == 4) return this.getControls4(layout, freeze);
    return null;
  }

  getControls3(layout, freeze) {

    let control_layout = {};

    for (let i=0; i<this.complex.simplices.length; i++) {

      let simplex = this.complex.simplices[i];

      if (simplex.point_names.length < 2) {

        continue; // nothing to do

      } else if (simplex.point_names.length == 2) {

        let point_name_1 = simplex.point_names[0];
        let point_name_2 = simplex.point_names[1];
        let point_1 = layout[point_name_1];
        let point_2 = layout[point_name_2];
        let freeze_1 = freeze[point_name_1];
        let freeze_2 = freeze[point_name_2];

        this.addEdgeControlPoints(control_layout, point_1, point_2, point_name_1, point_name_2, freeze_1, freeze_2);

      } else if (simplex.point_names.length == 3) {

        let [point_name_1, point_name_2, point_name_3] = simplex.point_names;
        let point_1 = layout[point_name_1];
        let point_2 = layout[point_name_2];
        let point_3 = layout[point_name_3];
        let freeze_1 = freeze[point_name_1];
        let freeze_2 = freeze[point_name_2];
        let freeze_3 = freeze[point_name_3];
        this.addTriangleControlPoints(control_layout, point_1, point_2, point_3, point_name_1, point_name_2, point_name_3, freeze_1, freeze_2, freeze_3);

      } else {

        debugger; // impossible

      }

    }

    return control_layout;

  }

  /* Computes control points as follows:
      - For each 1-simplex (instant), adds nothing
      - For each (1,1)-simplex (travelling vertex), adds nothing
      - For each (2,1)-simplex (shrinking wire), adds 2 control points
      - For each (1,2)-simplex (growing wire), adds 2 control points
      - For each (3,1)-simplex (shrinking triangle), adds 1 central control point, and 2 control points for each edge
      - For each (1,3)-simplex (growing triangle), adds 1 central control point, and 2 control points for each edge
      - For each (2,2)-simplex (interstitial triangle pair), adds 2 control points for each edge
  */

  getControls4(layout) {

    let control_layout = {};

    for (let i=0; i<this.simplices.length; i++) {

      let simplex = this.simplices[i];

      if (simplex.point_names.length == 1) {

        continue; // nothing to do

      } else if (simplex.point_names.length == 2) {

        continue; // nothing to do

      } else if (simplex.point_names.length == 3) {

        // Determine growing or shrinking
        let [point_name_1, point_name_2, point_name_3] = simplex.point_names;
        let point_1 = layout[point_name_1];
        let point_2 = layout[point_name_2];
        let point_3 = layout[point_name_3];

        if (point_1[0] == point_2[0]) {
          
          // Shrinking edge
          this.addEdgeControlPoints(control_layout, point_1, point_2, point_name_1, point_name_2);

        } else {
          
          // Growing edge
          this.addEdgeControlPoints(control_layout, point_2, point_3, point_name_2, point_name_3);
        }

      } else if (simplex.points == 3) {

        let [point_name_1, point_name_2, point_name_3, point_name_4] = simplex.point_names;
        let point_1 = layout[point_name_1];
        let point_2 = layout[point_name_2];
        let point_3 = layout[point_name_3];
        let point_4 = layout[point_name_4];

        if ((point_1[0] == point_2[0]) && (point_1[0] == point_3[0])) {

          // Shrinking triangle
          this.addTriangleControlPoints(control_layout, point_1, point_2, point_3, point_name_1, point_name_2, point_name_3);

        } else if ((point_1[0] == point_2[0]) && (point_3[0] == point_4[0])) {

          // Interstitial triangle pair
          this.addEdgeControlPoints(control_layout, point_1, point_2, point_name_1, point_name_2);
          this.addEdgeControlPoints(control_layout, point_3, point_4, point_name_3, point_name_4);

        } else { // must have ((point_2[0] == point_3[0]) && (point_3[0] == point_4[0]))

          // Growing triangle
          this.addTriangleControlPoints(control_layout, point_2, point_3, point_4, point_name_2, point_name_3, point_name_4);

        }
      }
    }
  }

  addEdgeControlPoints(layout, point_1, point_2, point_name_1, point_name_2, freeze_1, freeze_2) {

    if (_debug) {
      _assert(layout instanceof Object);
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(typeof point_name_1 === 'string');
      _assert(typeof point_name_2 === 'string');
      _assert(freeze_1 instanceof Array);
      _assert(freeze_2 instanceof Array);
    }

    // We need to add 2 control points. Get their names.
    let [control_name_1, control_name_2] = this.getEdgeControlNames(point_name_1, point_name_2);

    // If they are already defined (only need to check one), there's nothing to do
    if (layout[control_name_1]) return [layout[control_name_1], layout[control_name_2]];

    // Compute the control points
    let [control_point_1, control_point_2] = this.getEdgeControlPoints(point_1, point_2, freeze_1, freeze_2);

    // Store the control points
    this.layoutStore(layout, control_name_1, control_point_1);
    this.layoutStore(layout, control_name_2, control_point_2);

    return [control_point_1, control_point_2];

  }

  addTriangleControlPoints(layout, point_1, point_2, point_3, point_name_1, point_name_2, point_name_3, freeze_1, freeze_2, freeze_3) {

    if (_debug) {
      _assert(layout instanceof Object);
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(point_3 instanceof Array);
      _assert(typeof point_name_1 === 'string');
      _assert(typeof point_name_2 === 'string');
      _assert(typeof point_name_3 === 'string');
      _assert(freeze_1 instanceof Array);
      _assert(freeze_2 instanceof Array);
      _assert(freeze_3 instanceof Array);
    }

    // Add edge control points
    let e1 = this.addEdgeControlPoints(layout, point_1, point_2, point_name_1, point_name_2, freeze_1, freeze_2, freeze_3);
    let e2 = this.addEdgeControlPoints(layout, point_1, point_3, point_name_1, point_name_3, freeze_1, freeze_2, freeze_3);
    let e3 = this.addEdgeControlPoints(layout, point_2, point_3, point_name_2, point_name_3, freeze_1, freeze_2, freeze_3);

    // Add triangle control point
    this.addTriangleCentralControlPoint(layout, point_1, point_2, point_3, point_name_1, point_name_2, point_name_3, [...e1, ...e2, ...e3]);

  }

  addTriangleCentralControlPoint(layout, point_1, point_2, point_3, point_name_1, point_name_2, point_name_3, edge_controls) {

    if (_debug) {
      _assert(layout instanceof Object);
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(point_3 instanceof Array);
      _assert(typeof point_name_1 === 'string');
      _assert(typeof point_name_2 === 'string');
      _assert(typeof point_name_3 === 'string');
    }

    // Get the name of the control point
    let control_name = this.getTriangleControlName([point_name_1, point_name_2, point_name_3]);

    // If it's already stored, there's nothing to do
    if (layout[control_name]) return;

    // Compute the control point
    let control_point = this.getTriangleControlPoint(point_1, point_2, point_3, edge_controls);

    // Store the control point
    this.layoutStore(layout, control_name, control_point);

  }

  getEdgeControlNames(point_name_1, point_name_2) {
    if (_debug) {
      _assert(typeof point_name_1 === 'string');
      _assert(typeof point_name_2 === 'string');
    }
    let prefix = '(' + point_name_1 + ')-(' + point_name_2 + ').C';
    return [ prefix + '1', prefix + '2' ];
  }

  getTriangleControlName([point_name_1, point_name_2, point_name_3]) {
    if (_debug) {
      _assert(typeof point_name_1 === 'string');
      _assert(typeof point_name_2 === 'string');
      _assert(typeof point_name_3 === 'string');
    }
    return '(' + point_name_1 + ')-(' + point_name_2 + ')-(' + point_name_3 + ').C';
  }

  getEdgeControlPoints(point_1, point_2, freeze_1, freeze_2) {
    if (_debug) {
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(freeze_1 instanceof Array);
      _assert(freeze_2 instanceof Array);
    }
    let points = [point_1, point_2];
    //let control_1 = this.getVectorConvexSum(points, [0.75, 0.25]);
    //let control_2 = this.getVectorConvexSum(points, [0.25, 0.75]);
    //let control_2 = this.getVectorConvexSum(points, [0.5, 0.5]);
    let control_2 = point_2;

    let control_1 = point_1.slice();
    for (let d=0; d<point_1.length; d++) {
      if (d < 2) {
        control_1[d] = (point_1[d] + point_2[d]) / 2;
      }
    }

    /*
    // What's the highest changing dimension?
    let control_1 = point_1.slice();
    let d;
    for (d=0; d<point_1.length; d++) {
      control_1[d] = (point_1[d] + point_2[d])/2;
      if (point_1[d] != point_2[d]) break;
    }
    for (; d<point_1.length; d++) {
//      control_1[d] = (point_1[d] + point_2[d])/2;
    }
    */




    /*
    if (freeze_1.some(x => x)) {
      for (let i=0; i<freeze_1.length; i++) {
        if (!freeze_1[i]) {
          control_1[i] = point_1[i]
        }
      }
    }
    if (freeze_2.some(x => x)) {
      for (let i=0; i<freeze_2.length; i++) {
        if (!freeze_2[i]) {
          control_2[i] = point_2[i]
        }
      }
    }
    */
    return [control_1, control_2];
  }

  getTriangleControlPoint(point_1, point_2, point_3, edge_controls) {
    if (_debug) {
      _assert(point_1 instanceof Array);
      _assert(point_2 instanceof Array);
      _assert(point_3 instanceof Array);
    }
    //let points = [point_1, point_2, point_3];
    //return this.getVectorConvexSum(points, [1/3,1/3,1/3]);
    //return this.getVectorConvexSum(edge_controls, [1/6, 1/6, 1/6, 1/6, 1/6, 1/6]);
    //return this.getVectorConvexSum(edge_controls, [1/3, 0, 1/3, 0, 1/3, 0]);
    let all_points = [point_1, point_2, point_2, ...edge_controls];
    //return this.getVectorConvexSum(all_points, [1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9]);
    //return this.getVectorConvexSum(all_points, [1/6,1/6,1/6,1/6,0,1/6,0,1/6,0]);
    return this.getVectorConvexSum(all_points, [0,0,0,1/2,0,1/2,0,0,0]);
  }

  /* Get a mixture of the given points, controlled by a weight vector */  
  getVectorConvexSum(points, weights) {
    if (_debug) {
      _assert(points instanceof Array);
      _assert(weights instanceof Array);
      _assert(points.length == weights.length);
      for (let i=0; i<points.length; i++) {
        _assert(points[i] instanceof Array);
        _assert(points[i].length == 3 || points[i].length == 4);
        _assert(!isNaN(weights[i]));
        _assert(weights[i] >= 0);
        _assert(weights[i] <= 1);
      }
    }
    let size = points[0].length;
    if (size == 3) {
      let vector = [0, 0, 0];
      for (let i=0; i<points.length; i++) {
        let point = points[i];
        let weight = weights[i];
        vector[0] += weight * point[0];
        vector[1] += weight * point[1];
        vector[2] += weight * point[2];
      }
      return vector;
    } else { // size == 4
      let vector = [point[0][0], 0, 0, 0]; // Hack, since the first vector is always constant
      for (let i=0; i<points.length; i++) {
        let point = points[i];
        let weight = weights[i];
        vector[1] += weight * point[1];
        vector[2] += weight * point[2];
        vector[3] += weight * point[3];
      }
    }
  }

  getNumberConvexSum(numbers, weights) {
    if (_debug) {
      _assert(numbers instanceof Array);
      _assert(weights instanceof Array);
      _assert(numbers.length == weights.length);
      for (let i=0; i<numbers.length; i++) {
        _assert(!isNaN(numbers[i]));
        _assert(!isNaN(weights[i]));
        _assert(weights[i] >= 0);
        _assert(weights[i] <= 1);
      }
    }
    let total = 0;
    for (let i=0; i<numbers.length; i++) {
      total += numbers[i] * weights[i];
    }
    return total;
  }

}