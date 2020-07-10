import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import * as THREE from "three";
import OrbitControls from "three-orbit-controls";
import TrackballControls from "three-trackballcontrols";
// import TrackballControls from "~/util/trackballcontrols";
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
import { _assert, _debug, isNatural } from "homotopy-core/src/util/debug";

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
    this.allow_animate = false;
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

    this.subdivide = 3;
    this.draw_controls = true;
    this.wireframe = false;
    this.triangles = true;
    this.transparent = false;
    this.flatShading = false;
    this.polygonOffsetFactor = 1;
    this.polygonOffsetUnits = 1;
    this.opacity = 1;

    let allow_gui = true;
    if (allow_gui) {
      this.gui = this.gui || new dat.GUI();
      this.gui.add(this, 'subdivide', 0, 3).step(1).onChange(this.buildScene.bind(this));
      this.gui.add(this, 'draw_controls').onChange(this.changedGUI.bind(this));
      this.gui.add(this, 'wireframe').onChange(this.changedGUI.bind(this));
      this.gui.add(this, 'triangles').onChange(this.changedGUI.bind(this));
      this.gui.add(this, 'transparent').onChange(this.buildScene.bind(this));
      this.gui.add(this, 'opacity', 0, 1).onChange(this.buildScene.bind(this));
      this.gui.add(this, 'flatShading').onChange(this.changedGUI.bind(this));
      this.gui.add(this, 'polygonOffsetFactor', 0, 3).step(1).onChange(this.buildScene.bind(this));
      this.gui.add(this, 'polygonOffsetUnits', 0, 3).step(1).onChange(this.buildScene.bind(this));
    }

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    let rotate_z = false;
    if (rotate_z) {
      this.camera.position.set(5, 7, 20);
    } else {
      this.camera.position.set(-7, 5, 20);
    }

    this.camera.lookAt(new THREE.Vector3());
    if (rotate_z) {
      new THREE.Matrix4().makeRotationZ( -Math.PI / 2 ).multiplyVector3( this.camera.up );
    }
    this.scene.add(this.camera);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.intersectMeshes = [];

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.diagramRef.current.appendChild(this.renderer.domElement);

    // Create point light
    let point_light_strength = 0x777777;
    this.camera.add(this.createPointLight(point_light_strength, +20, +20, +20));
    //this.scene.add(this.createPointLight(point_light_strength, -20, -20, +20));
    //this.scene.add(this.createPointLight(point_light_strength, +20, -20, -20));
    //this.scene.add(this.createPointLight(point_light_strength, -20, +20, -20));
    this.camera.add(this.createPointLight(point_light_strength, -20, -20, -20));

    // Create ambient light
    this.ambientLight = new THREE.AmbientLight(0xAAAAAA);
    this.scene.add(this.ambientLight);

    // Create controls
    let use_orbit_controls = true;
    if (use_orbit_controls) {
      this.controls = new (OrbitControls(THREE))(this.camera, this.renderer.domElement);
    } else {
      this.controls = new TrackballControls(this.camera, this.renderer.domElement);
      this.controls.dynamicDampingFactor = 0.5; // full damping
      this.controls.rotateSpeed = 2;
    }
    this.controls.addEventListener('change', (function() {
      if (this.animation_in_progress) return;
      //this.update();
      this.renderSceneOnce();
    }).bind(this));

    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false );

    this.axes_helper = new THREE.AxesHelper(0.5);
    this.axes_helper.visible = false;
    this.scene.add(this.axes_helper);

    /*
    this.update = (function() {
      requestAnimationFrame(this.update);
      this.renderer.render(this.scene, this.camera);
    }).bind(this);
    */

    // Build the scene
    this.buildScene();

    //this.update();

    // Start the rendering loop
    //this.startLoop();
  }

  onMouseMove(event) {

    this.mouse.x = ( event.layerX / this.props.width ) * 2 - 1;
    this.mouse.y = - ( event.layerY / this.props.height ) * 2 + 1;

    if (event.shiftKey) {

      // We're finished dragging, so wait for user to release the shift key
      if (this.drag_completed) return;

      if (!this.axes_helper.visible) return;

      // We're dragging the surface. Work out in which direction.
      if (this.mouseStartDrag == null) {
        this.mouseStartDrag = this.mouse.clone();
      }

      // If we haven't dragged far enough, do nothing
      let dx = this.mouseStartDrag.x - this.mouse.x;
      let dy = this.mouseStartDrag.y - this.mouse.y;
      let mouse_distance = 0.1;
      if (dx * dx + dy * dy < mouse_distance * mouse_distance) {
        //console.log(Math.sqrt(dx * dx + dy * dy));
        return;
      }

      // Find the size contact points
      let x_axis = new THREE.Vector3(0.5, 0, 0);
      let y_axis = new THREE.Vector3(0, 0.5, 0);
      let z_axis = new THREE.Vector3(0, 0, 0.5);
      let helper = this.axes_helper.position.clone();
      let helper_x_plus  = helper.clone().addScaledVector(x_axis, +1);
      let helper_x_minus = helper.clone().addScaledVector(x_axis, -1);
      let helper_y_plus  = helper.clone().addScaledVector(y_axis, +1);
      let helper_y_minus = helper.clone().addScaledVector(y_axis, -1);
      let helper_z_plus  = helper.clone().addScaledVector(z_axis, +1);
      let helper_z_minus = helper.clone().addScaledVector(z_axis, -1);
      let helpers = [helper_x_plus, helper_x_minus, helper_y_plus, helper_y_minus, helper_z_plus, helper_z_minus];
      this.camera.updateMatrixWorld();
      let project_helpers = helpers.map(vector => vector.clone().project(this.camera));
      let normalized_helpers = project_helpers.map(vector => {
        let dx = vector.x - this.mouseStartDrag.x;
        let dy = vector.y - this.mouseStartDrag.y;
        let l = Math.sqrt(dx * dx + dy * dy);
        let r = mouse_distance / l;
        return [this.mouseStartDrag.x + (dx * r), this.mouseStartDrag.y + (dy * r)];
      });
      let distances = normalized_helpers.map(h => {
        let dx = h[0] - this.mouse.x;
        let dy = h[1] - this.mouse.y;
        return Math.sqrt(dx * dx + dy * dy);
      });

      // Work out in which of 6 directions we dragged
      let min = Math.min(...distances);
      let direction;
      if (distances[0] == min) {
        direction = [1, 0, 0];
      } else if (distances[1] == min) {
        direction = [-1, 0, 0];
      } else if (distances[2] == min) {
        direction = [0, 1, 0];
      } else if (distances[3] == min) {
        direction = [0, -1, 0];
      } else if (distances[4] == min) {
        direction = [0, 0, 1];
      } else {
        direction = [0, 0, -1];
      }

      // Find the nearest logical point to our start drag
      this.raycaster.setFromCamera( this.mouseStartDrag, this.camera );
      let point = this.raycaster.intersectObjects(this.intersectMeshes)[0].point;
      let nearest_position = null;
      let sq_distance = Number.POSITIVE_INFINITY;
      for (const position in this.originalLayout) {
        let coords = this.originalLayout[position];
        let dx = coords[0] - point.x;
        let dy = coords[1] - point.y;
        let dz = coords[2] - point.z;
        let this_sq_distance = dx * dx + dy * dy + dz * dz;
        if (this_sq_distance < sq_distance) {
          sq_distance = this_sq_distance;
          nearest_position = position;
        }
      }
      _assert(nearest_position);
      this.props.onHomotopy3d(nearest_position.split(',').map(x => Number(x)), direction);
      this.drag_completed = true;
      return;
    }

    // Shift key is not down
    this.drag_completed = false;
    this.mouseStartDrag = null;
    
    this.raycaster.setFromCamera( this.mouse, this.camera );
    let intersections = this.raycaster.intersectObjects(this.intersectMeshes);
    if (intersections.length == 0) {
      if (this.axes_helper.visible) {
        this.axes_helper.visible = false;
        this.intersectionTriangleMesh.visible = false;
        this.renderSceneOnce();
      }
      return;
    }
    let i = intersections[0];
    let vertices = i.object.geometry.vertices;
    let face = i.face;
    let tri_vertices = this.intersectionTriangleGeometry.vertices;
    tri_vertices[0].x = vertices[face.a].x;
    tri_vertices[0].y = vertices[face.a].y;
    tri_vertices[0].z = vertices[face.a].z;
    tri_vertices[1].x = vertices[face.b].x;
    tri_vertices[1].y = vertices[face.b].y;
    tri_vertices[1].z = vertices[face.b].z;
    tri_vertices[2].x = vertices[face.c].x;
    tri_vertices[2].y = vertices[face.c].y;
    tri_vertices[2].z = vertices[face.c].z;
    this.axes_helper.position.x = i.point.x;
    this.axes_helper.position.y = i.point.y;
    this.axes_helper.position.z = i.point.z;
    this.intersectionTriangleGeometry.verticesNeedUpdate = true;
    this.axes_helper.visible = true;
    this.intersectionTriangleMesh.visible = true;
    this.renderSceneOnce();

    //this.intersectionTriangleGeometry.vertices.push(...this.intersectTriangle);

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

    let old_diagram_before_final_slice = this.diagramBeforeFinalSlice;
    let new_diagram_before_final_slice = null;
    if (nextProps.slice.length > 0) {
      new_diagram_before_final_slice = nextProps.diagram.getSlice(...nextProps.slice.slice(0, nextProps.slice.length - 1));
    }


    if (Math.abs(this.props.width - nextProps.width) > 5) return true;
    if (Math.abs(this.props.height - nextProps.height) > 5) return true;
    if (this.props.projection != nextProps.projection) return true;

    //let old_diagram = this.props.diagram;
    //let new_diagram = nextProps.diagram;
    if (old_diagram && !new_diagram) return true;
    if (!old_diagram && new_diagram) return true;
    if (!!old_diagram_before_final_slice != !!new_diagram_before_final_slice) return true;
    if (old_diagram_before_final_slice) {
      if (!old_diagram_before_final_slice.equals(new_diagram_before_final_slice)) return true;
    } else {
      if (!old_diagram.equals(new_diagram)) return true;
    }
    //if (!this.props.diagram.equals(nextProps.diagram)) return true;
    // Check for each generator used in the diagram if its parameters have changed
    for (let id of Object.keys(this.props.generators)) {
      if (!new_diagram.usesId(id)) continue;
      let g_old = this.props.generators[id];
      let g_new = nextProps.generators[id];
      if (g_old.name != g_new.name) return true;
      if (g_old.color != g_new.color) return true;
    }
    if (this.props.slice.length != nextProps.slice.length) return true;
    for (let i=0; i<this.props.slice.length; i++) {
      if (this.props.slice[i] != nextProps.slice[i]) {
        if (i == this.props.slice.length - 1) {
          this.trigger_animation = true;
        }
        return true;
      }
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
    if (this.allow_animate && this.trigger_animation) {
      /*
      && (slice.length > 0)
      && (oldProps.slice.length == slice.length)
      && (slice.every((slice_coordinate, index) => {
        return ((index == slice.length - 1) || (slice_coordinate == oldProps.slice[index]));
      }))
      && diagram.equals(oldProps.diagram)) {
        */

      // It looks like we should be animating the animate_slice parameter
      requestAnimationFrame(this.tick.bind(this));
      if (isNaN(this.animate_slice)) this.animate_slice = slice[slice.length - 1];
      this.animate_start_time = null;
      this.animate_start_slice = this.animate_slice;
      let last_slice = slice[slice.length - 1];
      this.animate_sign = this.animate_slice < last_slice ? +1 : -1;
      this.animate_final = false;
      this.trigger_animation = false;
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
      <DiagramContainer ref={this.diagramRef} />
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

  /**
   * Get the material to display a particular generator in a given ambient dimension
   * @param {Integer} generator
   * @param {Integer} dimension
   * @return {Material}
   */
  getMaterial(generator, dimension) {
    const id = generator.generator.id;
    const key = id + "," + dimension.toString();
    if (!this.materials.has(key)) {
      let material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(this.diagram.getColour(generator, dimension)),
        side: THREE.DoubleSide
      });
      this.materials.set(key, material);
    }
    return this.materials.get(key);
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
    if (this.props.slice.length == 0 || !this.allow_animate) {
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

  getVertexIndexAnimate(buffer, source_data, target_data, point_1_str, point_2_str) {
    if (_debug) {
      _assert(typeof point_1_str === 'string');
      _assert(typeof point_2_str === 'string');
      _assert(source_data);
      _assert(target_data);
      _assert(source_data.loop.layout[point_1_str]);
      _assert(target_data.loop.layout[point_2_str]);
    }
    let ref = point_1_str + ':' + point_2_str;
    let result = buffer.vertex_lookup[ref];
    if (result === undefined) {
      result = buffer.vertex_count;
      buffer.vertex_lookup[ref] = result;
      buffer.vertex_points[buffer.vertex_count] = { point_1: source_data.loop.layout[point_1_str], point_2: target_data.loop.layout[point_2_str] };
      buffer.vertex_count++;
    }
    return result;
  }

  /**
   * Display a diagram in 3D
   */
  buildSceneUnique() {
    let showHomotopies = true;
    // Prepare the simplices
    let diagram = this.diagramToRender;
    let dimension = Math.min(diagram.n, 3);
    let generators = this.props.generators;

    let complex_full = diagram.skeleton({ generators, dimension, max_simplex_size: 3 }).complex;

    let complex = {};
    // Get the geometry we want to display
    if (showHomotopies) {
      // Find the homotopies we want to display.
      let points = diagram.getAllPointsWithData(dimension, dimension, generators);
      let homotopy_points = [];

      for (let point of points) {
        let keep = true;
        let homotopy = [];
        for (let i = 0; i < point.coordinates.length; i++) {
          // Need to keep the boundary points along the highest dimension
          if (i > 0) keep = keep && !point.boundary[i];
          if (point.nontrivial[i] && !point.algebraic[i]) {
            // There are no 1d homotopies on the highest dimensional boundary
            if (i > 0 || !point.boundary[i]) homotopy.push(i + 1);
          }
        }
        keep = keep && homotopy.length > 0; // Remove if boundary or not a homotopy
        if (keep) {
          homotopy_points[point.coordinates] = homotopy;
        }
      }

      // Find the relevant simplicies
      complex = complex_full.trimInvisibleHomotopies(homotopy_points);
    } else { // Display only algebraic geometry. Much faster.
      complex = complex_full.trimInvisible();
    }

    let { layout, boundary } = diagram.layout(dimension);

    // Display
    let loop = new Loop({ complex, layout, boundary, dimension });
    this.originalLayout = { ...layout };

    // Subdivide some number of times
    for (let i=0; i<this.subdivide; i++) {
      loop.subdivide(dimension);
    }

    // Draw the vertices
    for (let i=0; i<loop.draw_vertices.length; i++) {
      let vertex_data = loop.draw_vertices[i];
      let id = vertex_data.id;
      let new_geometry = new THREE.SphereGeometry(0.1, 32, 32);
      let new_mesh = new THREE.Mesh(new_geometry, this.getMaterial(generators[id], diagram.n));
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
    let edge_groups = sorted_edges.map(data => { return [data]; });
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
      let material = this.getMaterial(generator, diagram.n - 1);
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
    this.intersectMeshes = [];
    for (let i=0; i<ids.length; i++) {
      let id = ids[i];
      let geometry = triangle_geometries[id];
      geometry.mergeVertices();
      geometry.computeVertexNormals();
      let material = this.getMaterial(generators[id], diagram.n - 2);
      material.transparent = this.transparent;
      material.opacity = this.opacity;
      let mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.intersectMeshes.push(mesh);
    }

    // Intersection data
    this.intersectTriangle = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.intersectionTriangleGeometry = new THREE.Geometry();
    this.intersectionTriangleGeometry.vertices.push(...this.intersectTriangle);
    this.intersectionTriangleGeometry.faces.push(new THREE.Face3(0, 1, 2));
    let intersect_material = this.getMaterialOfColour('#ffffff');
    intersect_material.wireframe = true;
    intersect_material.polygonOffset = true;
    intersect_material.polygonOffsetFactor = 1;
    intersect_material.polygonOffsetUnits = 1;
    intersect_material.color = new THREE.Color('#ffffff');
    this.intersectionTriangleMesh = new THREE.Mesh(this.intersectionTriangleGeometry, intersect_material);
    this.scene.add(this.intersectionTriangleMesh);
    this.objects.push(this.intersectionTriangleMesh);

    // Relayout original points
    for (let point in this.originalLayout) {
      this.originalLayout[point] = loop.layout[point];
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

    // Get the slices and the pairing data
    let slices = diagram.getSlices();
    let point_pairs = [];
    let limits = [];
    let identity_limit = new Core.Limit({ n: diagram.n - 1, components: [] });
    for (let i=-1; i<diagram.data.length + 1; i++) {
      if (i == -1) {
        limits.push(identity_limit);
        point_pairs.push(identity_limit.getAllPointPairs({ source: slices[0], target: slices[0], dimension: dimension - 1 }));
      } else if (i == diagram.data.length) {
        limits.push(identity_limit);
        point_pairs.push(identity_limit.getAllPointPairs({ target: slices[slices.length - 1], source: slices[slices.length - 1], dimension: dimension - 1 }));
      } else {
        let data = diagram.data[i];
        limits.push(data.forward_limit);
        limits.push(data.backward_limit);
        point_pairs.push(data.forward_limit.getAllPointPairs({ source: slices[2 * i], target: slices[2 * i + 1], dimension: dimension - 1 }));
        point_pairs.push(data.backward_limit.getAllPointPairs({ source: slices[2 * i + 2], target: slices[2 * i + 1], dimension: dimension - 1 }));
      }
    }

    // For each slice, lay it out and get its simplicial complex
    let slice_data = [];
    for (let i=0; i<slices.length; i++) {
      let slice_skeleton = slices[i].skeleton({ generators, dimension: dimension - 1, max_simplex_size: 3 });
      let slice_complex = slice_skeleton.complex.trimInvisible();
      let slice_layout_boundary = slices[i].layout(dimension - 1);
      let slice_loop = new Loop({ complex: slice_complex, layout: slice_layout_boundary.layout, boundary: slice_layout_boundary.boundary, dimension: dimension - 1 });
      slice_data.push({
        complex: slice_complex,
        boundary: slice_layout_boundary.boundary,
        loop: slice_loop
      });
    }

    // Subdivide
    // NOT YET
    /*
    for (let i=0; i<this.subdivide; i++) {
      loop.subdivide();
    }
    layout = loop.layout;
    */

    for (let j=0; j<0; j++) {

      for (let i=0; i<point_pairs.length; i++) {
        let first_slice_data = slice_data[diagram.adjustHeight(i - 1)];
        let second_slice_data = slice_data[diagram.adjustHeight(i)];
        if (i % 2 == 0) [first_slice_data, second_slice_data] = [second_slice_data, first_slice_data];
        point_pairs[i] = this.subdividePointPairs(point_pairs[i], first_slice_data, second_slice_data);
      }
      for (let i=0; i<slices.length; i++) {
        slice_data[i].loop.subdivide(dimension - 1);
      }
    }

    // Build vertex buffers
    this.buffers = [];
    for (let i=0; i<point_pairs.length; i++) {
      this.buffers[i] = {};
    }

    // Turn this 4d data into movie data, see 3019-3-homotopy.io-25
    let instants = [];
    let vertices = [];
    let edges = [];
    let triangles = [];
    let tri_num = 0;

    // Prepare the instants
    for (let i=0; i<diagram.data.length; i++) {
      let data = slice_data[2 * i + 1];
      for (let j=0; j<data.loop.draw_vertices.length; j++) {
        let vertex_data = data.loop.draw_vertices[j];
        let generator = generators[vertex_data.id];
        if (generator.n < diagram.n) continue;
        let point = data.loop.layout[vertex_data.vertex];
        let material = this.getMaterial(generator);
        let mesh = this.createSphere(material, point);
        instants.push({ mesh, point, time: 2 * i + 1 });
      }
    }

    // For each pair of heights, prepare the rendering data
    for (let i=0; i<point_pairs.length; i++) {

      let source_index = (i % 2 == 0) ? i : i - 1;
      let target_index = (i % 2 == 0) ? i - 1 : i;
      let source_index_adjusted = diagram.adjustHeight(source_index);
      let target_index_adjusted = diagram.adjustHeight(target_index);
      let limit = limits[i];
      let pairs = point_pairs[i];
      let buffer_first_index = Math.min(source_index, target_index) + 1;
      let buffer_family = this.buffers[buffer_first_index];
      let source_data = slice_data[source_index_adjusted];
      let target_data = slice_data[target_index_adjusted];

      // Collect forward and backward images under this relation
      let forward = {};
      let backward = {};
      for (let j=0; j<pairs.length; j++) {
        let [first, second] = pairs[j];
        if (!forward[first]) forward[first] = new Set();
        forward[first].add(second);
        if (!backward[second]) backward[second] = new Set();
        backward[second].add(first);
      }

      // Render vertices
      for (let vertex_index = 0; vertex_index < source_data.loop.draw_vertices.length; vertex_index ++) {
        let vertex_data = source_data.loop.draw_vertices[vertex_index];
        let n1 = vertex_data.vertex;
        let n1_forward = forward[n1];
        _assert(n1_forward.size == 1);
        let n2 = n1_forward.values().next().value;
        let material = this.getMaterial(generators[vertex_data.id]);
        let p1 = source_data.loop.layout[n1];
        let p2 = target_data.loop.layout[n2];
        let mesh = this.createSphere(material, p1);
        if (source_index < target_index) {
          vertices.push({ mesh, first_frame: buffer_first_index - 1, point_start: p1, point_finish: p2 });
        } else {
          vertices.push({ mesh, first_frame: buffer_first_index - 1, point_start: p2, point_finish: p1 });
        }

      }


      // Loop through triangles of source slice
      let triangles_done = {};
      for (let tri_index = 0; tri_index < source_data.loop.draw_triangles.length; tri_index++) {
        let tri_data = source_data.loop.draw_triangles[tri_index];
        let id = tri_data.id;
        if (!buffer_family[id]) {
          buffer_family[id] = {
            vertex_lookup: {},
            vertex_points: [],
            indices: [],
            vertex_count: 0
          };
        }
        let buffer = buffer_family[id];
        let indices = buffer.indices;
        let s = tri_data.vertices;
        let t;
        let forward_sets = s.map(name => forward[name]);

        // If any vertex pushes forward to nothing, something's gone wrong
        if (forward_sets.some(elt => elt === undefined)) {
          debugger;
        }

        // If every vertex pushes forward canonically, just do that
        else if (forward_sets.every(set => set.size == 1)) {
          t = forward_sets.map(set => set.values().next().value);
        }

        // If two vertices push forward canonically, search for the correct third vertex
        else if (forward_sets.filter(set => set.size == 1).length == 2) {
          let index = forward_sets.findIndex(set => set.size > 1);
          let source_name = s[index];
          let value = forward_sets[index];
          let options = [...value];

          /*
          let permitted = options.filter(target_point => {
            _assert(backward[target_point].size == 1);
            return backward[target_point].values().next().value === source_name;
          });
          */

          // Find out which of these options pushes forward to a valid triangle
          t = forward_sets.map(set => set.values().next().value);
          let possible_vertices = options.map(value => {
            let vertices = t.slice();
            vertices[index] = value;
            return vertices;
          });
          let face_exists = possible_vertices.map(vertices => {
            let face_name = Loop.getFaceName(vertices);
            return target_data.loop.faces[face_name];
          });
          _assert(face_exists.filter(x => x).length <= 1); // should be just 1 valid triangle
          if (face_exists.some(x => x)) {
            let index = face_exists.findIndex(x => !!x);
            t = possible_vertices[index];
          } else {
            //debugger; // not sure if this is possible
            continue;
          }

          /*
          if (permitted.length == 1) {
            t = forward_sets.map(set => set.values().next().value);
            t[index] = permitted[0];
          } else {
            continue; // probably wrong...
          }
          _assert(permitted.length == 1); // if this passes as expected, replace filter just above with find
          */
        }

        // If only 1 or 0 vertices push forward canonically, ignore it
        else {
          // Do nothing, this triangle will be handled later
          continue;
        }

        // Mark the triangle as handled
        triangles_done[s.join(':')] = true;

        // Prepare the triangle for animation
        let change_order = this.negativeNormal3d(source_data.loop.layout, s);
        let s_render = s.slice();
        let t_render = t.slice();
        if (change_order) {
          [s_render[0], s_render[1]] = [s_render[1], s_render[0]];
          [t_render[0], t_render[1]] = [t_render[1], t_render[0]];
        }
        if (source_index < target_index) {
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[0], t_render[0]));
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[1], t_render[1]));
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[2], t_render[2]));
        } else {
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[0], s_render[0]));
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[1], s_render[1]));
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[2], s_render[2]));
        }

      }

      // Loop through triangles of target slice
      for (let tri_index2 = 0; tri_index2 < target_data.loop.draw_triangles.length; tri_index2++) {
        let tri_data2 = target_data.loop.draw_triangles[tri_index2];
        let id = tri_data2.id;
        if (!buffer_family[id]) {
          buffer_family[id] = {
            vertex_lookup: {},
            vertex_points: [],
            indices: [],
            vertex_count: 0
          };
        }
        let buffer = buffer_family[id];
        let indices = buffer.indices;
        let t2 = tri_data2.vertices;
        let s2;
        let backward_sets2 = t2.map(name => backward[name]);

        // If any vertex pushes backward to nothing, something's gone wrong
        if (backward_sets2.some(elt => elt === undefined)) {
          debugger;
        }

        // If every vertex pushes back canonically, just do that
        else if (backward_sets2.every(set => set.size == 1)) {
          s2 = backward_sets2.map(set => set.values().next().value);
        }

        // If two vertices push back canonically, search for the correct third vertex
        else if (backward_sets2.filter(set => set.size == 1).length == 2) {
          let index = backward_sets2.findIndex(set => set.size > 1);
          let target_name = t2[index];
          let value = backward_sets2[index];
          let options = [...value];

          /*
          let permitted = options.filter(source_point => {
            _assert(forward[source_point].size == 1);
            return forward[source_point].values().next().value === target_name;
          });
          */

          // Find which of these options gives a valid triangle
          s2 = backward_sets2.map(set => set.values().next().value);
          let possible_vertices2 = options.map(value => {
            let vertices = s2.slice();
            vertices[index] = value;
            return vertices;
          });
          let face_exists2 = possible_vertices2.map(vertices => {
            let face_name = Loop.getFaceName(vertices);
            return source_data.loop.faces[face_name];
          });
          _assert(face_exists2.filter(x => x).length <= 1); // should be just 1 valid triangle
          if (face_exists2.some(x => x)) {
            let index = face_exists2.findIndex(x => !!x);
            s2 = possible_vertices2[index];
          } else {
            //debugger; // not sure if this is possible
            continue;
          }


          /*
          if (permitted.length == 1) {
            s2 = backward_sets2.map(set => set.values().next().value);
            s2[index] = permitted[0];
          } else {
            continue;
          }
          */
          //_assert(permitted.length == 1); // if this passes as expected, replace filter just above with find
        }

        // Otherwise do nothing
        else continue;

        // If this triangle has already been prepared for animation, do nothing
        if (triangles_done[s2.join(':')]) continue;

        // Prepare the triangle for animation
        let change_order = this.negativeNormal3d(target_data.loop.layout, t2);
        let s_render = s2.slice();
        let t_render = t2.slice();
        if (change_order) {
          [s_render[0], s_render[1]] = [s_render[1], s_render[0]];
          [t_render[0], t_render[1]] = [t_render[1], t_render[0]];
        }
        if (source_index < target_index) {
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[0], t_render[0]));
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[1], t_render[1]));
          indices.push(this.getVertexIndexAnimate(buffer, source_data, target_data, s_render[2], t_render[2]));
        } else {
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[0], s_render[0]));
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[1], s_render[1]));
          indices.push(this.getVertexIndexAnimate(buffer, target_data, source_data, t_render[2], s_render[2]));
        }

      }

    }

    // Turn triangle index buffers into typed arrays
    for (let i=0; i<this.buffers.length; i++) {

      let buffer_family = this.buffers[i];

      for (const id in buffer_family) {
        let buffer = buffer_family[id];
        buffer.vertices = new Float32Array(3 * buffer.vertex_count);
        buffer.geometry = new THREE.BufferGeometry();
        let geometry = buffer.geometry;
        geometry.setIndex(buffer.indices);
        geometry.addAttribute('position', new THREE.Float32BufferAttribute(buffer.vertices, 3));

        // Triangle mesh      
        let material = this.getMaterial(generators[id]);
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

    }

    this.render_data = { instants, vertices, edges, triangles };

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
      let buffer_family = this.buffers[i];
      for (const id in buffer_family) {
        let buffer = buffer_family[id];
        buffer.mesh.material.flatShading = this.flatShading;
        buffer.mesh.visible = (i == stage) && this.triangles;
        buffer.wireframe_mesh.visible = (i == stage) && this.wireframe;
      }
    }

    // Update the vertex coordinates for this triangle mesh
    let buffer_family = this.buffers[stage];
    for (const id in buffer_family) {
      let buffer = buffer_family[id];
      let pairs = buffer.vertex_points;
      let pos = 0;
      //let vertex_buffer = buffer.vertices;
      let vertex_buffer = buffer.geometry.attributes.position.array;
      for (let i=0; i<pairs.length; i++) {
        let { point_1, point_2 } = pairs[i];
        vertex_buffer[pos++] = (g * point_1[0]) + (f * point_2[0]);
        vertex_buffer[pos++] = (g * point_1[1]) + (f * point_2[1]);
        vertex_buffer[pos++] = (g * point_1[2]) + (f * point_2[2]);
      }
      buffer.geometry.attributes.position.needsUpdate = true;
      buffer.geometry.computeVertexNormals();
    }



    for (let i=0; i<vertices.length; i++) {
      this.updateVertex(vertices[i], t);
    }

    for (let i=0; i<instants.length; i++) {
      this.updateInstant(instants[i], t);
    }

    /*

    for (let i=0; i<edges.length; i++) {
      this.updateEdge(edges[i], t);
    }

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
    let d = Math.abs(t - instant.time);

    // If we're out of range, don't draw it
    if (d > radius_4) {
      instant.mesh.visible = false;
      return;
    }

    // Calculate it's size
    let scale = instant.mesh.scale;
    let f = 2.5 * (radius_4 - d) / radius_4;
    scale.x = f;
    scale.y = f;
    scale.z = f;
    instant.mesh.visible = true;

  }

  updateVertex(vertex, t) {

    if (t < vertex.first_frame || t > vertex.first_frame + 1) {
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
    triangle.mesh.visible = true;
    geometry.verticesNeedUpdate = true;
    geometry.uvsNeedUpdate = true;
    geometry.normalsNeedUpdate = true;

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
  negativeNormal3d(layout, names) {
    let [v1, v2, v3] = names.map(name => layout[name]);
    let ex = v2[0] - v1[0];
    let ey = v2[1] - v1[1];
    let fx = v3[0] - v1[0];
    let fy = v3[1] - v1[1];
    return (ex * fy < ey * fx);
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


  subdividePointPairs(pairs, slice_1_data, slice_2_data) {

    // Collect pairs into forward and backward data
    let forward = {};
    let backward = {};
    for (let i=0; i<pairs.length; i++) {
      let [n1, n2] = pairs[i];
      if (!forward[n1]) forward[n1] = new Set();
      forward[n1].add(n2);
      if (!backward[n2]) backward[n2] = new Set();
      backward[n2].add(n1);
    }

    let new_pairs = pairs.slice();
    for (const edge in slice_1_data.loop.edges) {
      let edge_data = slice_1_data.loop.edges[edge];
      let [n1, n2] = edge_data.vertices;
      let sub_name = Loop.getEdgeSubdivisionName(edge_data.vertices);
      let forward_sets = edge_data.vertices.map(name => forward[name]);

      // If these are both size 1, they should be the same. Use them to map the new edge.
      if (forward_sets.every(set => set.size == 1)) {
        let elements = forward_sets.map(set => set.values().next().value);
        if (elements[0] == elements[1]) {
          new_pairs.push([sub_name, elements[0]]);
        } else {
          let forward_sub = Loop.getEdgeSubdivisionName(elements);
          new_pairs.push([sub_name, forward_sub]);
        }
      } else if (forward_sets[0].size == 1) {
        _assert(forward_sets[1].size > 1);
        let f1 = forward_sets[0].values().next().value;
        let forward_candidates = [...forward_sets[1]];
        let match_candidates = forward_candidates.filter(name => {
          let forward_edge = Loop.getEdgeName([fixed, name]);
          return slice_2_data.loop.edges[forward_edge];
        });
        _assert(match_candidates.length == 1);
        let f2 = match_candidates[0];
        let f_sub_name = Loop.getEdgeSubdivisionName([f1, f2]);
        new_pairs.push([sub_name, f_sub_name]);
      } else if (forward_sets[1].size == 1) {
        _assert(forward_sets[0].size > 1);
        let f2 = forward_sets[1].values().next().value;
        let forward_candidates = [...forward_sets[0]];
        let match_candidates = forward_candidates.filter(name => {
          let forward_edge = Loop.getEdgeName([name, f2]);
          return slice_2_data.loop.edges[forward_edge];
        });
        _assert(match_candidates.length == 1);
        let f1 = match_candidates[0];
        let f_sub_name = Loop.getEdgeSubdivisionName([f1, f2]);
        new_pairs.push([sub_name, f_sub_name]);
      } else {
        //continue;
        _assert(false); // should not happen
      }
    }

    for (const edge2 in slice_2_data.loop.edges) {
      let edge_data2 = slice_2_data.loop.edges[edge2];
      let sub_name2 = Loop.getEdgeSubdivisionName(edge_data2.vertices);
      let backward_sets2 = edge_data2.vertices.map(name => backward[name]);

      // If these are both size 1, they should be the same. Use them to map the new edge.
      if (backward_sets2.every(set => set.size == 1)) {
        let elements = backward_sets2.map(set => set.values().next().value);
        if (elements[0] == elements[1]) {
          new_pairs.push([elements[0], sub_name2]);
        }
      }

    }

    return new_pairs;

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
    debugger;
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
