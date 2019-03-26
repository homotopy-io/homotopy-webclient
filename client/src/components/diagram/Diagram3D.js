import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import * as THREE from "three";
import OrbitControls from "three-orbit-controls";
import { connect } from "react-redux";
import * as Core from "homotopy-core";
import * as dat from "dat.gui";

import compose from "~/util/compose";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
import withLayout from "~/components/diagram/withLayout";
import { getGenerators } from "~/state/store/signature";

import { BezierTriangleSystem, Loop } from "~/util/bezier_triangle";
import { Surface } from "~/util/3d/surface";
import { subdivideSurface } from "~/util/3d/subdivision";
import { groupSurface } from "~/util/3d/group";
import { indexBuffer, vertexBuffer } from "~/util/3d/buffers";
import { _assert, _debug, isNatural } from "../../../../core/src/util/debug"; // this is a mess

/*
export default compose(
  //withLayout,
  connect(
    state => ({ generators: getGenerators(state.proof) }),
  ),
  withSize
)(props => props.layout
  ? <Diagram3D {...props} />
  : <Loading {...props} />
);
*/
export default compose(
  //withLayout,
  connect(
    state => ({ generators: getGenerators(state.proof) }),
  ),
  withSize
)(props => <Diagram3D {...props}/>
);

export class Diagram3D extends React.Component {

  constructor(props) {
    super(props);
    this.objects = [];
    this.materials = new Map();
    this.diagramRef = React.createRef();
  }

  changedGUI() {
    if (this.animated) {
      this.updateScene();
    } else {
      this.buildScene();
    }
  }

  componentDidMount() {
    let { width, height } = this.props;
    //this.gui = new dat.GUI();

    // Add style controls
    /*
    this.subdivide = 0;           this.gui.add(this, 'subdivide', 0, 3).step(1).onChange(this.buildScene.bind(this));
    this.draw_controls = true;    this.gui.add(this, 'draw_controls').onChange(this.changedGUI.bind(this));
    this.wireframe = true;        this.gui.add(this, 'wireframe').onChange(this.changedGUI.bind(this));
    this.triangles = true;        this.gui.add(this, 'triangles').onChange(this.changedGUI.bind(this));
    this.transparent = false;     this.gui.add(this, 'transparent').onChange(this.buildScene.bind(this));
    this.flatShading = true;      this.gui.add(this, 'flatShading').onChange(this.changedGUI.bind(this));
    this.polygonOffsetFactor = 1; this.gui.add(this, 'polygonOffsetFactor', 0, 3).step(1).onChange(this.buildScene.bind(this));
    this.polygonOffsetUnits = 1;  this.gui.add(this, 'polygonOffsetUnits', 0, 3).step(1).onChange(this.buildScene.bind(this));
    */

    this.subdivide = 0;
    this.draw_controls = true;
    this.wireframe = true;
    this.triangles = true;
    this.transparent = false;
    this.flatShading = true;
    this.polygonOffsetFactor = 1;
    this.polygonOffsetUnits = 1;


    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    this.camera.position.set(0, 0, -10);
    this.camera.lookAt(new THREE.Vector3());
    this.scene.add(this.camera);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.diagramRef.current.appendChild(this.renderer.domElement);

    // Create point light
    let point_light_strength = 0xBBBBBB;
    this.camera.add(this.createPointLight(point_light_strength, +20, +20, +20));
    //this.scene.add(this.createPointLight(point_light_strength, -20, -20, +20));
    //this.scene.add(this.createPointLight(point_light_strength, +20, -20, -20));
    //this.scene.add(this.createPointLight(point_light_strength, -20, +20, -20));
    this.camera.add(this.createPointLight(point_light_strength, -20, -20, -20));

    // Create ambient light
    this.ambientLight = new THREE.AmbientLight(0xAAAAAA);
    this.scene.add(this.ambientLight);

    // Create controls
    this.controls = new (OrbitControls(THREE))(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', (function() {
      if (this.animation_in_progress) return;
      this.renderSceneOnce();
    }).bind(this));

    // Build the scene
    this.buildScene();

    // Start the rendering loop
    //this.startLoop();
  }

  createPointLight(colour, x, y, z) {
    let light = new THREE.PointLight(colour);
    light.position.x = x;
    light.position.y = y;
    light.position.z = z;
    return light;
  }

  shouldComponentUpdate(nextProps, nextState) {
    let old_diagram = this.diagramToRender;
    let new_diagram = nextProps.diagram.getSlice(...nextProps.slice);

    if (this.props.width != nextProps.width) return true;
    if (this.props.height != nextProps.height) return true;
    if (this.props.projection != nextProps.projection) return true;

    //let old_diagram = this.props.diagram;
    //let new_diagram = nextProps.diagram;
    if (old_diagram && !new_diagram) return true;
    if (!old_diagram && new_diagram) return true;
    if (!old_diagram.equals(new_diagram)) return true;
    //if (!this.props.diagram.equals(nextProps.diagram)) return true;
    if (this.props.slice.length != nextProps.slice.length) return true;
    for (let i=0; i<this.props.slice.length; i++) {
      if (this.props.slice[i] != nextProps.slice[i]) return true;
    }
    // Check for each generator used in the diagram if its parameters have changed
    for (let id of Object.keys(this.props.generators)) {
      if (!new_diagram.usesId(id)) continue;
      let g_old = this.props.generators[id];
      let g_new = nextProps.generators[id];
      if (g_old.name != g_new.name) return true;
      if (g_old.color != g_new.color) return true;
    }
    return false;


/*

    let old_diagram = this.props.diagram;
    let new_diagram = nextProps.diagram;
    if (old_diagram && !new_diagram) return true;
    if (!old_diagram && new_diagram) return true;
    return (!this.props.diagram.equals(nextProps.diagram));
    */
  }

  componentDidUpdate(oldProps, oldState) {

    // Dimensions changed
    let { width, height } = this.props;
    if (height != oldProps.height || width != oldProps.width) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    // Maybe we need to animate
    let { diagram, dimension, slice, generators } = this.props;
    if ((slice.length > 0)
      && (oldProps.slice.length == slice.length)
      && (slice.every((slice_coordinate, index) => {
        return ((index == slice.length - 1) || (slice_coordinate == oldProps.slice[index]));
      }))
      && diagram.equals(oldProps.diagram)) {

      // It looks like we should be animating the animate_slice parameter
      requestAnimationFrame(this.tick.bind(this));
      if (isNaN(this.animate_slice)) this.animate_slice = slice[slice.length - 1];
      this.animate_start_time = null;
      this.animate_start_slice = this.animate_slice;
      let last_slice = slice[slice.length - 1];
      this.animate_sign = this.animate_slice < last_slice ? +1 : -1;
      this.animate_final = false;
      return;
    }

    // Build the scene
    this.buildScene();

  }

  tick(timestamp) {

    if (this.animate_start_time == null) this.animate_start_time = timestamp;
    let progress = (timestamp - this.animate_start_time) / 2000;
    this.animate_slice = this.animate_start_slice + (progress * this.animate_sign); // fractional slice to display
    let last_slice = this.props.slice[this.props.slice.length - 1];
    this.animation_in_progress = true;

    // Check whether the animation has finished
    this.animate_final =
      ((this.animate_sign == -1 && this.animate_slice < last_slice)
      ||
      (this.animate_sign == +1 && this.animate_slice > last_slice));
    if (this.animate_final) {
      this.animate_slice = last_slice;
      this.animation_in_progress = false;
    }

    /*
    if (Math.abs(this.animate_slice - last_slice) < 0.5) {
      this.animate_final = true;
      this.animation_in_progress = false;
    }
    */

    // Update the render
    this.updateScene();

    // If necessary, call another animation frame
    if (!this.animate_final) {
      requestAnimationFrame(this.tick.bind(this));
    }

  }

  componentWillUnmount() {
    this.stopLoop();
    this.renderer.forceContextLoss();
  }

  get diagram() {
    return this.diagramToRender;
  }

  render() {
    this.diagramToRender = this.props.diagram.getSlice(...this.props.slice);
    return (
      <DiagramContainer innerRef={this.diagramRef} />
    );
  }

  renderSceneOnce() {
    this.renderer.render(this.scene, this.camera);
  }

  renderScene(timestamp) {
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.renderScene.bind(this));
  }

  startLoop() {
    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(this.renderScene.bind(this));
    }
  }

  stopLoop() {
    cancelAnimationFrame(this.animationFrame);
  }

  getMaterial(generator) {
    const id = generator.generator.id;

    if (!this.materials.has(id)) {
      let material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(generator.color),
        side: THREE.DoubleSide,
        flatShading: false
      });
      this.materials.set(id, material);
    }

    return this.materials.get(id);
  }

  getMaterialOfColour(colour) {
    let material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(colour),
      side: THREE.DoubleSide
    });
    return material;
  }

  static to3Vector(coordinates) {
    if (_debug) {
      _assert(coordinates instanceof Array);
    }
    let coord0 = isNaN(coordinates[0]) ? 0 : coordinates[0];
    let coord1 = isNaN(coordinates[1]) ? 0 : coordinates[1];
    let coord2 = isNaN(coordinates[2]) ? 0 : coordinates[2];
    return new THREE.Vector3(coord0, coord1, coord2);
  }

  buildScene() {

    // Contents changed
    let slice = this.props.slice;
    this.diagramToRender = this.props.diagram.getSlice(...this.props.slice);
    if (slice.length > 0) {
      this.diagramBeforeFinalSlice = this.props.diagram.getSlice(...slice.slice(0, slice.length - 1));
    } else {
      this.diagramBeforeFinalSlice = null;
    }

    // Remove all previous objects from the scene
    for (let object of this.objects) {
      this.scene.remove(object);
    }
    this.objects = [];

    // Discard all the materials because they may have changed
    this.materials.clear();
    
    // If there are no slices, we can't animate, so just render the scene uniquely
    if (this.props.slice.length == 0) {
      this.buildSceneUnique();
      this.animated = false;
    } else {

      // Otherwise, there are slices, so not only should be render the scene, we must also
      // prepare the necessary data for the scene to be updated.
      this.animate_slice = slice[slice.length - 1];
      this.buildSceneAnimate();
      this.updateScene();
      this.animated = true;
    }

    this.renderSceneOnce();
  }

  createTriangle(material) {
    let geometry = new THREE.Geometry();
    geometry.vertices = [new THREE.Vector3(0,0,1), new THREE.Vector3(0,1,0), new THREE.Vector3(1,0,0)];
    geometry.faces = [new THREE.Face3(0, 1, 2)];
    //geom.computeFaceNormals();        
    let mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.objects.push(mesh);
    return mesh;
  }

  createWireGeometry(point_1, point_2) {
    let curve = new THREE.CurvePath();
    let line = new THREE.LineCurve3(new THREE.Vector3(point_1[0], point_1[1], point_1[2]), new THREE.Vector3(point_2[0], point_2[1], point_2[2]));
    curve.add(line);
    let geometry = new THREE.TubeGeometry(line, 1, 0.05, 8, false);
    return geometry;
  }

  createWire(material, point_1, point_2) {
    let geometry = this.createWireGeometry(point_1, point_2);
    let mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.objects.push(mesh);
    return mesh;
  }

  createSphere(material, point) {
    let geometry = new THREE.SphereGeometry(0.1, 32, 32);
    let sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(point[0], point[1], point[2]);
    sphere.visible = false;
    this.scene.add(sphere);
    this.objects.push(sphere);
    return sphere;
  }

  getVertexIndex({ layout, buffer_index, point_1_str, point_2_str }) {
    if (_debug) {
      _assert(isNatural(buffer_index));
      _assert(typeof point_1_str === 'string');
      _assert(typeof point_2_str === 'string');
      _assert(layout instanceof Object);
    }
    let ref = point_1_str + ':' + point_2_str;
    let buffer = this.buffers[buffer_index];
    let result = buffer.vertex_lookup[ref];
    if (result === undefined) {
      result = buffer.vertex_count;
      buffer.vertex_lookup[ref] = result;
      buffer.vertex_points[buffer.vertex_count] = { point_1: layout[point_1_str], point_2: layout[point_2_str] };
      buffer.vertex_count++;
    }
    return result;
  }

  buildSceneUnique() {

    // Prepare the simplices
    let diagram = this.diagramToRender;
    let dimension = Math.min(diagram.n, 3);
    let generators = this.props.generators;
    let complex = diagram.skeleton({ generators, dimension, max_simplex_size: 3 }).complex.trimInvisible();
    console.log(complex.getByDimension());

    let { layout, boundary } = diagram.layout(dimension);

    let loop = new Loop({ complex, layout, boundary, dimension });

    // Subdivide some number of times
    /*
    for (let i=0; i<this.subdivide; i++) {
      loop.subdivide(dimension);
    }
    */
    loop.subdivide(dimension);
    loop.subdivide(dimension);
    loop.subdivide(dimension);


    //bezier = bezier.subdivide();
    //let { complex, layout } = bezier;

    // Declare the geometries
    //let point_geometries = {};
    //let line_geometries = {};
    //let triangle_geometries = {}; // triangle geometries by material

    // Draw the vertices
    for (let i=0; i<loop.draw_vertices.length; i++) {
      let vertex_data = loop.draw_vertices[i];
      let id = vertex_data.id;
      let new_geometry = new THREE.SphereGeometry(0.1, 32, 32);
      let new_mesh = new THREE.Mesh(new_geometry, this.getMaterial(generators[id]));
      let point = loop.layout[vertex_data.vertex];
      let vector = Diagram3D.to3Vector(point);
      new_mesh.position.set(vector.x, vector.y, vector.z);
      this.scene.add(new_mesh);
      this.objects.push(new_mesh);
    }

    // Sort the vertices in each edge by height
    let sorted_edges = loop.draw_edges.map(edge_data => {
      let [n1, n2] = edge_data.vertices;
      let p1 = loop.layout[n1];
      let p2 = loop.layout[n2];
      if (p1[0] < p2[0]) return edge_data;
      return { vertices: [n2, n1], id: edge_data.id };
    });

    // Sort the edge segments into maximal chains
    let edge_groups = sorted_edges.map(data => { return [data] });
    console.log(edge_groups);
    let merged;
    do {
      merged = false;
      let new_edge_groups = [];
      for (let i=0; i<edge_groups.length; i++) {
        let group1 = edge_groups[i];

        // Find a group to postcompose with
        let postcompose_group = new_edge_groups.filter((xgroup2) => {
          //console.log({group1, xgroup2});
          return (group1[0].id == xgroup2[0].id) && (xgroup2[xgroup2.length - 1].vertices[1] == group1[0].vertices[0]);
        });
        if (postcompose_group.length > 0) {
          postcompose_group[0].push(...group1);
          merged = true;
          continue;
        }

        // Find a group to precompose with
        let precompose_group = new_edge_groups.filter(group2 => {
          return (group2[0].id == group2[0].id) && (group2[0].vertices[0] == group1[group1.length - 1].vertices[1]);
        });
        if (precompose_group.length > 0) {
          precompose_group[0].unshift(...group1);
          merged = true;
          continue;
        }

        // Couldn't compose group, so just add it as it stands
        new_edge_groups.push(group1);
      }

      edge_groups = new_edge_groups;
    } while (merged);

    // Render the maximal chains
    console.log('Rendering ' + edge_groups.length + ' edge groups');
    for (let i=0; i<edge_groups.length; i++) {
      let group = edge_groups[i];
      let curve = new THREE.CurvePath();
      let path_names = [group[0].vertices[0], ...group.map(edge => edge.vertices[1])];
      let path_points = path_names.map(name => loop.layout[name]);
      for (let j=0; j<path_points.length - 1; j++) {
        curve.add(new THREE.LineCurve3(Diagram3D.to3Vector(path_points[j]), Diagram3D.to3Vector(path_points[j+1])));
      }
      let geometry = new THREE.TubeGeometry(curve, path_points.length * 20, 0.05, 8, false, true);
      let generator = generators[group[0].id];
      let material = this.getMaterial(generator);
      let wire = new THREE.Mesh(geometry, material);
      this.scene.add(wire);
      this.objects.push(wire);
    }
    
    // Sort the triangles into geometries according to their id
    let triangle_geometries = {};
    for (let i=0; i<loop.draw_triangles.length; i++) {
      let tri_data = loop.draw_triangles[i];
      let vertices = tri_data.vertices;
      let id = tri_data.id;
      if (!triangle_geometries[id]) {
        triangle_geometries[id] = new THREE.Geometry();
      }
      let xgeometry = triangle_geometries[id];
      let num = xgeometry.vertices.length;
      let points = vertices.map(name => Diagram3D.to3Vector(loop.layout[name]));
      let sorted_points = this.orderVertices(points);
      xgeometry.vertices.push(...sorted_points);
      xgeometry.faces.push(new THREE.Face3(num, num+1, num+2));
    }

    // Render the geometries as meshes
    let ids = Object.keys(triangle_geometries);
    for (let i=0; i<ids.length; i++) {
      let id = ids[i];
      let geometry = triangle_geometries[id];
      console.log({id, geometry});
      geometry.mergeVertices();
      geometry.computeVertexNormals();
      let material = this.getMaterial(generators[id]);
      let mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      this.objects.push(mesh);
    }

/*
    if (this.triangles) {

      let material = this.getMaterialOfColour('#d1940f');
      material.transparent = this.transparent;
      if (this.transparent) {
        material.opacity = 0.5;
        material.depthTest = false;
        material.depthWrite = false;
      }
      triangle_geometry.mergeVertices();
      //triangle_geometry.computeFaceNormals();
      triangle_geometry.computeVertexNormals();
      let mesh = new THREE.Mesh(triangle_geometry, material);
      this.scene.add(mesh);
      this.objects.push(mesh);

    }

    if (this.wireframe) {

      let material = this.getMaterialOfColour('#ffffff');
      let material_wireframe = material.clone();
      material_wireframe.wireframe = true;
      material_wireframe.polygonOffset = true;
      material_wireframe.polygonOffsetFactor = this.polygonOffsetFactor;
      material_wireframe.polygonOffsetUnits = this.polygonOffsetUnits;
      material_wireframe.color = new THREE.Color('#ffffff');
      let mesh = new THREE.Mesh(triangle_geometry, material_wireframe);
      this.scene.add(mesh);
      this.objects.push(mesh);

    }

    if (this.draw_controls) {

      let point_mat = new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1 });
      point_mat.polygonOffset = true;
      point_mat.polygonOffsetFactor = 1;
      point_mat.polygonOffsetUnits = 1;
      let point_cloud = new THREE.Points(point_geometry, point_mat);
      this.scene.add(point_cloud);
      this.objects.push(point_cloud);

      //let point_mat = new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1 });
      //point_mat.polygonOffset = true;
      //point_mat.polygonOffsetFactor = 1;
      //point_mat.polygonOffsetUnits = 1;
      var line_mat = new THREE.LineBasicMaterial( {
          color: 0x000000,
          linewidth: 3,
          linecap: 'round', //ignored by WebGLRenderer
          linejoin:  'round' //ignored by WebGLRenderer
      } );
      let lines = new THREE.LineSegments(line_geometry, line_mat);
      this.scene.add(lines);
      this.objects.push(lines);
    }

    */

  }

  // Build the scene so it is prepared for animation
  buildSceneAnimate() {

    let diagram = this.diagramBeforeFinalSlice;
    _assert(diagram instanceof Core.Diagram);
    let dimension = Math.min(diagram.n, 4);
    let generators = this.props.generators;
    let skeleton = diagram.skeleton({ generators, dimension, max_simplex_size: 4 });
    let complex = skeleton.complex.trimInvisible();
    let { layout, boundary } = diagram.layout(dimension);
    let loop = new Loop({ complex, layout, boundary });

    // Subdivide some number of times
    for (let i=0; i<this.subdivide; i++) {
      loop.subdivide();
    }
    layout = loop.layout;

    // Build vertex buffers
    this.buffers = [];
    for (let i=0; i<diagram.data.length * 2 + 2; i++) {
      this.buffers[i] = {
        vertex_count: 0,
        vertex_lookup: {},
        vertex_points: [],
        indices: [],
        normals: [] // unused
      };
    }

    // Turn this 4d data into movie data, see 3019-3-homotopy.io-25
    let instants = [];
    let vertices = [];
    let edges = [];
    let triangles = [];
    let tri_num = 0;

    // Faces
    for (const triangle in loop.draw_triangles) {

      let tri_data = loop.draw_triangles[triangle];
      let names = tri_data.face_vertex_names;
      let points = names.map(name => layout[name]);
      let extra_name = tri_data.extra_vertex_name;
      let extra_point = layout[extra_name];
      _assert(extra_point instanceof Array);
      let first_frame = Math.min(extra_point[0], points[0][0]);
      let buffer_index = first_frame;
      let indices = this.buffers[buffer_index].indices;
      let sorted_names = this.orderNames4d(layout, names);
      
      // Growing triangle
      if (extra_point[0] < points[0][0]) {
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: extra_name, point_2_str: sorted_names[0] }));
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: extra_name, point_2_str: sorted_names[1] }));
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: extra_name, point_2_str: sorted_names[2] }));
      }

      // Shrinking triangle
      else if (extra_point[0] > points[0][0]) {
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: sorted_names[0], point_2_str: extra_name }));
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: sorted_names[1], point_2_str: extra_name }));
        indices.push(this.getVertexIndex({ layout, buffer_index, point_1_str: sorted_names[2], point_2_str: extra_name }));
      }
      
    }

    // Interposed faces
    for (let i=0; i<loop.draw_triangle_fillers.length; i++) {
      let tet = loop.draw_triangle_fillers[i];
      let sn = tet.source_names;
      let tn = tet.target_names;
      let sp = sn.map(name => layout[name]);
      let tp = tn.map(name => layout[name]);
      let local_buffer_index = Math.min(sp[0][0], tp[0][0]);
      let indices = this.buffers[local_buffer_index].indices;
      let t1_names_1 = [sn[0], sn[0], sn[1]];
      let t1_names_2 = [tn[0], tn[1], tn[1]];
      let t2_names_1 = [sn[0], sn[1], sn[1]];
      let t2_names_2 = [tn[0], tn[0], tn[1]];
      /*
      if (sp[0][0] > tp[0][0]) {
        [t1_names_1, t1_names_2] = [t1_names_2, t1_names_1];
        [t2_names_1, t2_names_2] = [t2_names_2, t2_names_1];
      }
      */
      let t1_sorted = this.orderNamesMixture4d(layout, t1_names_1, t1_names_2);
      let t2_sorted = this.orderNamesMixture4d(layout, t2_names_1, t2_names_2);
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t1_sorted[0][0], point_2_str: t1_sorted[0][1] }));
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t1_sorted[1][0], point_2_str: t1_sorted[1][1] }));
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t1_sorted[2][0], point_2_str: t1_sorted[2][1] }));
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t2_sorted[0][0], point_2_str: t2_sorted[0][1] }));
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t2_sorted[1][0], point_2_str: t2_sorted[1][1] }));
      indices.push(this.getVertexIndex({ layout, buffer_index: local_buffer_index, point_1_str: t2_sorted[2][0], point_2_str: t2_sorted[2][1] }));
    }

    // Turn triangle index buffers into typed arrays
    for (let i=0; i<this.buffers.length; i++) {
      let buffer = this.buffers[i];
      buffer.vertices = new Float32Array(3 * buffer.vertex_count);
      buffer.geometry = new THREE.BufferGeometry();
      let geometry = buffer.geometry;
      geometry.setIndex(buffer.indices);
      geometry.addAttribute('position', new THREE.Float32BufferAttribute(buffer.vertices, 3));
      buffer.geometry.attributes.position.dynamic = true;

      // Triangle mesh      
      let material = this.getMaterialOfColour('#d1940f');
      buffer.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(buffer.mesh);
      this.objects.push(buffer.mesh);

      // Wireframe mesh
      let wireframe_material = this.getMaterialOfColour('#ffffff');
      buffer.wireframe_mesh = new THREE.Mesh(geometry, wireframe_material);
      wireframe_material.wireframe = true;
      wireframe_material.polygonOffset = true;
      wireframe_material.polygonOffsetFactor = this.polygonOffsetFactor;
      wireframe_material.polygonOffsetUnits = this.polygonOffsetUnits;
      this.scene.add(buffer.wireframe_mesh);
      this.objects.push(buffer.wireframe_mesh);

    }



    this.render_data = { instants, vertices, edges, triangles };

    let t4 = performance.now();
    /*
    console.log('Prepared scene for animation (' + Math.floor(t1 - t0) + ' ms):'
      + ' built complex (' + Math.floor(t1-t0) + ' ms),'
      + ' reduced (' + Math.floor(t2-t1) + ' ms),'
      + ' trimmed (' + Math.floor(t3-t2) + ' ms),'
      + ' sequentialized (' + Math.floor(t4-t1) + ' ms)');
    */
  }

  updateScene() {

    let { instants, vertices, edges, triangles } = this.render_data;
    let t = this.animate_slice;
    let start_time = performance.now();
    let stage = Math.min(Math.floor(t + 1), this.buffers.length - 1);
    let f = t - stage + 1;
    let g = 1 - f;

    // Only show the triangle mesh corresponding to our current stage
    for (let i=0; i<this.buffers.length; i++) {
      let buffer = this.buffers[i];
      buffer.mesh.material.flatShading = this.flatShading;
      buffer.mesh.visible = (i == stage) && this.triangles;
      buffer.wireframe_mesh.visible = (i == stage) && this.wireframe;
    }

    // Update the vertex coordinates for this triangle mesh
    let buffer = this.buffers[stage];
    let pairs = buffer.vertex_points;
    let pos = 0;
    //let vertex_buffer = buffer.vertices;
    let vertex_buffer = buffer.geometry.attributes.position.array;
    for (let i=0; i<pairs.length; i++) {
      let { point_1, point_2 } = pairs[i];
      vertex_buffer[pos++] = (g * point_1[1]) + (f * point_2[1]);
      vertex_buffer[pos++] = (g * point_1[2]) + (f * point_2[2]);
      vertex_buffer[pos++] = (g * point_1[3]) + (f * point_2[3]);
    }
    buffer.geometry.attributes.position.needsUpdate = true;
    if (buffer.geometry.attributes.normal) {
      //buffer.geometry.attributes.normal.needsUpdate = true;
    }
    //buffer.geometry.computeVertexNormals();



    /*
    for (let i=0; i<instants.length; i++) {
      this.updateInstant(instants[i], t);
    }

    for (let i=0; i<vertices.length; i++) {
      this.updateVertex(vertices[i], t);
    }

    for (let i=0; i<edges.length; i++) {
      this.updateEdge(edges[i], t);
    }
    */
    /*t
    for (let i=0; i<triangles.length; i++) {
      this.updateTriangle(triangles[i], t);
    }
    */

    this.renderSceneOnce();

    let finish_time = performance.now();
    //console.log('Animation loop took ' + Math.floor((finish_time - start_time)) + ' ms, slice ' + t);

  }

  updateInstant(instant, t) {

    // Set the 4d radius of the vertex
    let radius_4 = 0.4;
    let d = Math.abs(t - instant.first_frame);

    // If we're out of range, don't draw it
    if (d > radius_4) {
      instant.mesh.visible = false;
      return;
    }

    // Calculate it's size
    let scale = instant.mesh.scale;
    let f = 2 * (radius_4 - d) / radius_4;
    scale.x = f;
    scale.y = f;
    scale.z = f;
    instant.mesh.visible = true;

  }

  updateVertex(vertex, t) {

    if (t < vertex.first_frame || t > vertex.last_frame) {
      vertex.mesh.visible = false;
      return;
    }

    let point = this.interpolatePoints(vertex.point_start, vertex.point_finish, t - vertex.first_frame);
    vertex.mesh.position.set(...point);
    vertex.mesh.visible = true;

  }

  updateEdge(edge, t) {

    if (t < edge.first_frame || t > edge.last_frame) {
      edge.mesh.visible = false;
      return;
    }

    let f = t - edge.first_frame;
    let point_1 = this.interpolatePoints(edge.point_1_start, edge.point_1_finish, f);
    let point_2 = this.interpolatePoints(edge.point_2_start, edge.point_2_finish, f);
    if (point_1[0] == point_2[0] && point_1[1] == point_2[1] && point_1[2] == point_2[2]) {
      edge.mesh.visible = false;
      return;
    }
    edge.mesh.geometry.dispose();
    edge.mesh.geometry = this.createWireGeometry(point_1, point_2);
    edge.mesh.visible = true;

  }

  updateTriangle(triangle, t) {

    if (t < triangle.first_frame || t > triangle.last_frame) {
      triangle.mesh.visible = false;
      return;
    }

    let f = t - triangle.first_frame;
    let point_1 = this.interpolatePoints(triangle.point_1_start, triangle.point_1_finish, f);
    let point_2 = this.interpolatePoints(triangle.point_2_start, triangle.point_2_finish, f);
    let point_3 = this.interpolatePoints(triangle.point_3_start, triangle.point_3_finish, f);
    let geometry = triangle.mesh.geometry;
    let v = geometry.vertices;
    v[0].x = point_1[0];
    v[0].y = point_1[1];
    v[0].z = point_1[2];
    v[1].x = point_2[0];
    v[1].y = point_2[1];
    v[1].z = point_2[2];
    v[2].x = point_3[0];
    v[2].y = point_3[1];
    v[2].z = point_3[2];
    //console.log('Updated visible triangle');
    triangle.mesh.visible = true;
    geometry.verticesNeedUpdate = true;
    //geometry.elementsNeedUpdate = true;
    //geometry.morphTargetsNeedUpdate = true;
    geometry.uvsNeedUpdate = true;
    geometry.normalsNeedUpdate = true;
    //geometry.colorsNeedUpdate = true;
    //geometry.tangentsNeedUpdate = true; 
   //triangle.mesh.geometry.computeFaceNormals();

    /*
    var geom = new THREE.Geometry();
    let vectors = Diagram3D.to3VectorArray(simplex.points);        
    geom.vertices.push(vectors[0]);
    geom.vertices.push(vectors[1]);
    geom.vertices.push(vectors[2]);
    geom.faces.push(new THREE.Face3(0, 1, 2));
    geom.computeFaceNormals();        
    let mesh = new THREE.Mesh(geom, material);
    this.scene.add(mesh);
    this.objects.push(mesh);
    */

  }

  // Interpolate between two 3-vectors, with t=0 giving p1, and t=1 giving p2.
  interpolatePoints(p1, p2, f) {

    if (_debug) {
      _assert(p1 instanceof Array);
      _assert(p2 instanceof Array);
      _assert(p1.length == 3);
      _assert(p2.length == 3);
      _assert(!isNaN(f));
      _assert(f >= 0);
      _assert(f <= 1);
    }
    let g = 1-f;
    return [g*p1[0] + f*p2[0], g*p1[1] + f*p2[1], g*p1[2] + f*p2[2]];

  }


  buildSceneUnique_OLD() {

    // Prepare the simplices
    let diagram = this.diagramToRender;
    let dimension = Math.min(diagram.n, 3);
    let generators = this.props.generators;
    let complex = diagram.skeleton({ generators, dimension, max_simplex_size: 3 }).complex.trimInvisible();
    console.log(complex.getByDimension());

    let { layout, freeze } = diagram.layout(dimension);

    let bezier = new BezierTriangleSystem({ complex, layout, freeze, construct_controls: true });
    for (let i=0; i<this.subdivide; i++) {
      bezier = bezier.subdivide();
    }
    //bezier = bezier.subdivide();
    //let { complex, layout } = bezier;

    // Declare the geometries
    let point_geometry = new THREE.Geometry();
    let line_geometry = new THREE.Geometry();
    let triangle_geometries = {}; // triangle geometries by material

    for (let simplex of bezier.complex.simplices) {
      let generator = generators[simplex.id];
      let material = this.getMaterial(generator);
      if (!triangle_geometries[simplex.id]) {
        triangle_geometries[simplex.id] = new THREE.Geometry();
      }
      let triangle_geometry = triangle_geometries[simplex.id];

      // 1-simplices
      if (simplex.point_names.length == 1) {
        let sphere = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), material);
        let point = bezier.layout[simplex.point_names[0]];
        let vector = Diagram3D.to3Vector(point)
        sphere.position.set(vector.x, vector.y, vector.z);
        this.scene.add(sphere);
        this.objects.push(sphere);
      }

      // 2-simplices
      else if (simplex.point_names.length == 2) {
        let curve = new THREE.CurvePath();
        let vertices = simplex.point_names.map(name => Diagram3D.to3Vector(bezier.layout[name]));
        curve.add(new THREE.LineCurve3(...vertices));
        let geometry = new THREE.TubeGeometry(curve, vertices.length, 0.05, 8, false, true);
        let wire = new THREE.Mesh(geometry, material);
        this.scene.add(wire);
        this.objects.push(wire);
      }

      // 3-simplices
      else if (simplex.point_names.length == 3) {
        let vertices = simplex.point_names.map(name => Diagram3D.to3Vector(bezier.layout[name]));

        let num = triangle_geometry.vertices.length;
        let [v0, v1, v2] = this.orderVertices(vertices);
        triangle_geometry.vertices.push(v0);
        triangle_geometry.vertices.push(v1);
        triangle_geometry.vertices.push(v2);
        triangle_geometry.faces.push(new THREE.Face3(num, num+1, num+2));

        // Add the control points to point_geometry
        let [n1, n2, n3] = simplex.point_names;
        if (complex.n == 3) {
          let c1 = bezier.getEdgeControlNames(n1, n2).map(name => Diagram3D.to3Vector(bezier.layout[name]));
          let c2 = bezier.getEdgeControlNames(n1, n3).map(name => Diagram3D.to3Vector(bezier.layout[name]));
          let c3 = bezier.getEdgeControlNames(n2, n3).map(name => Diagram3D.to3Vector(bezier.layout[name]));
          let p = Diagram3D.to3Vector(bezier.layout[bezier.getTriangleControlName(simplex.point_names)]);
          point_geometry.vertices.push(...c1, ...c2, ...c3, p);
          line_geometry.vertices.push(vertices[0], c1[0], vertices[1], c1[1], vertices[0], c2[0], vertices[2], c2[1], vertices[1], c3[0], vertices[2], c3[1]);
        }

      }

    }


    if (this.triangles) {

      Object.entries(triangle_geometries).forEach(entry => {
        let [id, triangle_geometry] = entry;
        let generator = generators[id];
        let material = this.getMaterial(generator);
        material.transparent = this.transparent;
        if (this.transparent) {
          material.opacity = 0.5;
          material.depthTest = false;
          material.depthWrite = false;
        }
        triangle_geometry.mergeVertices();
        //triangle_geometry.computeFaceNormals();
        triangle_geometry.computeVertexNormals();
        let mesh = new THREE.Mesh(triangle_geometry, material);
        this.scene.add(mesh);
        this.objects.push(mesh);
      });

    }

    if (this.wireframe) {

      Object.entries(triangle_geometries).forEach(entry => {
        let [id, triangle_geometry] = entry;
        let generator = generators[id];
        let material = this.getMaterial(generator);
        let material_wireframe = material.clone();
        material_wireframe.wireframe = true;
        material_wireframe.polygonOffset = true;
        material_wireframe.polygonOffsetFactor = this.polygonOffsetFactor;
        material_wireframe.polygonOffsetUnits = this.polygonOffsetUnits;
        material_wireframe.color = new THREE.Color('#material_wireframe');
        let mesh = new THREE.Mesh(triangle_geometry, material_wireframe);
        this.scene.add(mesh);
        this.objects.push(mesh);
      });

    }

    if (this.draw_controls) {

      let point_mat = new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1 });
      point_mat.polygonOffset = true;
      point_mat.polygonOffsetFactor = 1;
      point_mat.polygonOffsetUnits = 1;
      let point_cloud = new THREE.Points(point_geometry, point_mat);
      this.scene.add(point_cloud);
      this.objects.push(point_cloud);

      //let point_mat = new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1 });
      //point_mat.polygonOffset = true;
      //point_mat.polygonOffsetFactor = 1;
      //point_mat.polygonOffsetUnits = 1;
      var line_mat = new THREE.LineBasicMaterial( {
          color: 0x000000,
          linewidth: 3,
          linecap: 'round', //ignored by WebGLRenderer
          linejoin:  'round' //ignored by WebGLRenderer
      } );
      let lines = new THREE.LineSegments(line_geometry, line_mat);
      this.scene.add(lines);
      this.objects.push(lines);
    }

  }

  // Reorder vertices to have normal with positive z coefficient using a cross-product test
  orderVertices(vertices) {
    let [v1, v2, v3] = vertices;
    let ex = v2.x - v1.x;
    let ey = v2.y - v1.y;
    let fx = v3.x - v1.x;
    let fy = v3.y - v1.y;
    if (ex * fy > ey * fx) {
      return vertices;
    } else {
      return [v2, v1, v3];
    }
  }

  // Reorder vertices to have normal with positive z coefficient using a cross-product test
  orderNames4d(layout, names) {
    let [v1, v2, v3] = names.map(name => layout[name]);
    let ex = v2[1] - v1[1];
    let ey = v2[2] - v1[2];
    let fx = v3[1] - v1[1];
    let fy = v3[2] - v1[2];
    if (ex * fy > ey * fx) {
      return names;
    } else {
      return [names[1], names[0], names[2]];
    }
  }

  // Reorder vertices to have normal with positive z coefficient using a cross-product test,
  // assuming a uniform mixture of the provided point pairs
  orderNamesMixture4d(layout, names_1, names_2) {
    let [v1, v2, v3] = names_1.map(name => layout[name]);
    let [u1, u2, u3] = names_2.map(name => layout[name]);
    let ex = v2[1] - v1[1] + u2[1] - u1[1];
    let ey = v2[2] - v1[2] + u2[2] - u1[2];
    let fx = v3[1] - v1[1] + u3[1] - u1[1];
    let fy = v3[2] - v1[2] + u3[2] - u1[2];
    if (ex * fy > ey * fx) {
      return [[names_1[0], names_2[0]], [names_1[1], names_2[1]], [names_1[2], names_2[2]]];
    } else {
      return [[names_1[1], names_2[1]], [names_1[0], names_2[0]], [names_1[2], names_2[2]]];
    }
  }

  buildScene_OLD() {
    // Remove all previous objects from the scene
    for (let object of this.objects) {
      this.scene.remove(object);
    }

    // Discard all the materials because they may have changed
    this.materials.clear();

    // In dimension 0, do nothing
    if (this.props.dimension == 0) return;

    // Create edge graph
    let graph = new Graph(p => p.join(":"));
    for (let { source, target, codim, dir } of this.props.layout.edges) {
      graph.addEdge(source, target, { codim, dir });
    }

    // Obtain quads
    let quads = [];

    for (let [a, b, ab] of graph.edges()) {
      for (let [c, ac] of graph.edgesFrom(a)) {
        for (let [d, bd] of graph.edgesFrom(b)) {
          let cd = graph.getEdge(c, d);

          if (!cd || b.join(":") == c.join(":")) {
            continue;
          }

          quads.push({ a, b, c, d, ab, ac, bd, cd });
        }
      }
    }

    let vertices = [];
    let annotations = [];
    let pointIndices = new Map();
    let cells = [];

    for (let point of this.props.layout.points) {
      let generator = this.getGenerator(point);

      if (generator.generator.n >= this.props.dimension - 2) {
        pointIndices.set(point.join(":"), vertices.length);
        vertices.push(this.getPosition(point));
        annotations.push(generator);
      }
    }

    // Render quads
    for (let quad of quads) {
      let ordinary = (
        quad.ab.codim == 0 &&
        quad.cd.codim == 0 &&
        quad.ac.codim == 1 &&
        quad.bd.codim == 1
      );

      let expand = (
        quad.ab.codim == 0 &&
        quad.ac.codim == 0 &&
        quad.bd.codim == 1 &&
        quad.cd.codim == 1 &&
        quad.bd.dir > 0
      );

      let contract = (
        quad.ab.codim == 1 &&
        quad.ac.codim == 1 &&
        quad.bd.codim == 0 &&
        quad.cd.codim == 0 &&
        quad.ab.dir > 0
      );

      if (!ordinary && !expand && !contract) {
        continue;
      }

      let { a, b, c, d } = quad;

      let aGenerator = this.getGenerator(a);
      if (aGenerator.generator.n < this.props.dimension - 2) {
        continue;
      }

      if (ordinary) {
        if (quad.ab.dir < 0) {
          [a, b, c, d] = [b, a, d, c];
        }

        if (quad.ac.dir < 0) {
          [a, b, c, d] = [c, d, a, b];
        }

      }

      if (contract) {
        if (quad.bd.dir > 0) {
          [a, b, c, d] = [a, c, b, d];
        }
      }

      if (expand) {
        if (quad.ab.dir < 0) {
          [a, b, c, d] = [d, b, c, a];
        }
      }

      cells.push([
        pointIndices.get(a.join(":")),
        pointIndices.get(b.join(":")),
        pointIndices.get(d.join(":")),
        pointIndices.get(c.join(":"))
      ]);
    }

    let merge = (...generators) => {
      generators.sort((a, b) => a.generator.n - b.generator.n);
      return generators[0];
    };

    let surface = Surface.fromCells(vertices.map(v => [v.x, v.y, v.z]), cells, annotations);
    surface = subdivideSurface(surface, merge, merge);
    surface = subdivideSurface(surface, merge, merge);
    surface = subdivideSurface(surface, merge, merge);
    if (!surface) return;
    
    let groups = groupSurface(surface, (a, b) => a.generator.n == b.generator.n);

    for (let group of groups) {
      let generator = group.values().next().value.annotation;
      let codimension = this.diagram.n - generator.generator.n;

      if (codimension == 2) {
        let filter = (...vs) => vs.some(v => group.has(v));

        let bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setIndex(new THREE.BufferAttribute(indexBuffer(surface, filter), 3));
        bufferGeometry.addAttribute("position", new THREE.BufferAttribute(vertexBuffer(surface), 3));
        bufferGeometry.computeVertexNormals();
        bufferGeometry.computeFaceNormals();

        let geometry = new THREE.Geometry();
        geometry.fromBufferGeometry(bufferGeometry);
        geometry.computeVertexNormals();
        geometry.computeFaceNormals();

        let material = this.getMaterial(generator);

        let mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.objects.push(mesh);
      } else if (codimension == 1) {
        let vertices = getWireVertices(surface, group, this.diagram.n);
        let curve = new THREE.CurvePath();

        for (let i = 0; i < vertices.length - 1; i++) {
          curve.add(new THREE.LineCurve3(
            new THREE.Vector3(...vertices[i].position),
            new THREE.Vector3(...vertices[i + 1].position)
          ));
        }

        let geometry = new THREE.TubeGeometry(curve, vertices.length, 0.05, 8, false, true);
        let material = this.getMaterial(generator)
        let wire = new THREE.Mesh(geometry, material);

        this.scene.add(wire);
        this.objects.push(wire);
      } else if (codimension == 0) {
        let sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 32, 32),
          this.getMaterial(generator)
        );

        sphere.position.set(...group.values().next().value.position);
        this.scene.add(sphere);
        this.objects.push(sphere);
      }
    }

  }

  createScaffold() {
    for (let { source, target } of this.props.layout.edges) {
      const sourceVec = this.getPosition(source);
      const targetVec = this.getPosition(target);
      const dirVec = targetVec.clone();
      dirVec.sub(sourceVec);
      const length = dirVec.length();
      dirVec.normalize();

      const arrow = new THREE.ArrowHelper(dirVec, sourceVec, length, 0xFFFFFF, 0.05, 0.05);
      this.scene.add(arrow);
    }
  }

  getGenerator(point) {
    let diagram = this.diagram;
    let id = Core.Geometry.idAt(diagram, point);
    return this.props.generators[id];
  }

  getPosition(point) {
    let positions = this.props.layout.positions;
    let position = positions.get(point.join(":")).slice();

    while (position.length < 3) {
      position.unshift(0);
    }

    return new THREE.Vector3(position[2], position[1], position[0]);
  }

}


const getWireVertices = (surface, group, dimension) => {
  let edgesFrom = new Map();
  let edgesTo = new Map();

  let condition = vertex => (
    group.has(vertex) ||
    vertex.annotation.generator.n == dimension
  );

  for (let vertex of group) {
    for (let edge of vertex.edges.values()) {
      if (condition(edge.vertices[0]) && condition(edge.vertices[1])) {
        edgesFrom.set(edge.vertices[0], edge.vertices[1]);
        edgesTo.set(edge.vertices[1], edge.vertices[0]);
      }
    }
  }

  // Find first vertex
  let first = null;

  for (let vertex of edgesFrom.keys()) {
    if (!edgesTo.has(vertex)) {
      first = vertex;
      break;
    }
  }

  // Now traverse in order
  let current = first;
  let wire = [current];

  while (edgesFrom.has(current)) {
    current = edgesFrom.get(current);
    wire.push(current);
  }

  return wire;
};

export const Loading = () =>
  <LoadingWrapper>
    <Spinner />
  </LoadingWrapper>;

const DiagramContainer = styled.div`
  position: absolute;
`;

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`;
