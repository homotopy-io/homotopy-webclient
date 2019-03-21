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

import { BezierTriangleSystem } from "~/util/bezier_triangle";
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

  componentDidMount() {
    let { width, height } = this.props;
    this.gui = new dat.GUI();
    this.gui_controllers = [];
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
        side: THREE.DoubleSide
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
    } else {

      // Otherwise, there are slices, so not only should be render the scene, we must also
      // prepare the necessary data for the scene to be updated.
      this.animate_slice = slice[slice.length - 1];
      this.buildSceneAnimate();
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

  getVertexIndex({ buffer_index, point_1, point_2, point_1_str, point_2_str }) {
    let ref = point_1.join(',') + ':' + point_2.join(',');
    let buffer = this.buffers[buffer_index];
    let result = buffer.vertex_lookup[ref];
    if (result === undefined) {
      result = buffer.vertex_count;
      buffer.vertex_lookup[ref] = result;
      buffer.vertex_points[buffer.vertex_count] = { point_1, point_2 };
      buffer.vertex_count++;
    }
    return result;
  }

  // Build the scene so it is prepared for animation
  buildSceneAnimate() {

    let t0 = performance.now();
    
    let diagram = this.diagramBeforeFinalSlice;
    _assert(diagram instanceof Core.Diagram);
    let dimension = Math.min(diagram.n, 4);
    let generators = this.props.generators;
    let skeleton = diagram.skeleton({ generators, dimension, max_simplex_size: 4 });
    let complex = skeleton.complex;

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


    let t1 = performance.now();
    complex = complex.restrict(4);
    let t2 = performance.now();
    complex = complex.trimInvisible();
    let t3 = performance.now();
    let zero = new THREE.Vector3(0, 0, 0);
    let mat_blue = this.getMaterialOfColour('#0000ff');
    let mat_green = this.getMaterialOfColour('#00ff00');
    let mat_red = this.getMaterialOfColour('#ff0000');
    let mat_pink = this.getMaterialOfColour('#ff9999');

    // Turn this 4d data into movie data, see 3019-3-homotopy.io-25
    let instants = [];
    let vertices = [];
    let edges = [];
    let triangles = [];

    let tri_num = 0;

    for (let i=0; i<complex.simplices.length; i++) {

      let simplex = complex.simplices[i];
      let generator = generators[simplex.id];
      let material = this.getMaterial(generator);
      let first_frame = simplex.points[0][0];
      let last_frame = simplex.points[simplex.points.length - 1][0];
      let reverse = last_frame < first_frame;
      if (reverse) [first_frame, last_frame] = [last_frame, first_frame];

      // A point that appears instantaneously in the movie
      if (simplex.points.length == 1) {
        let point = simplex.points[0].slice(1);
        let mesh = this.createSphere(material, point);
        instants.push({ mesh, first_frame, last_frame, point });
      }
      
      // A point that appears for finite time in the movie
      else if (simplex.points.length == 2) {
        let point_start = simplex.points[0].slice(1);
        let point_finish = simplex.points[1].slice(1);
        let mesh = this.createSphere(material, [0,0,0]);
        if (reverse) [point_start, point_finish] = [point_finish, point_start];
        vertices.push({ mesh, first_frame, last_frame, point_start, point_finish });
      }
      
      // A wire that appears in the movie
      else if (simplex.points.length == 3) {

        //continue;
        //if (edges.length > 0) continue; // just 1 edge for now

        // CASE A
        if (simplex.points[0][0] == simplex.points[1][0]) {
          let point_1_start = simplex.points[0].slice(1);
          let point_1_finish = simplex.points[2].slice(1);
          let point_2_start = simplex.points[1].slice(1);
          let point_2_finish = point_1_finish;
          let mesh = this.createWire(material, [0,0,1], [0,1,1]);
          if (reverse) {
            [point_1_start, point_1_finish, point_2_start, point_2_finish] = [point_1_finish, point_1_start, point_2_finish, point_2_start];
          }
          edges.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish });
          // https://stackoverflow.com/questions/41728656/animating-a-bezier-curve-in-threejs
        }
        
        // CASE B
        else if (simplex.points[1][0] == simplex.points[2][0]) {
          let point_1_start = simplex.points[0].slice(1);
          let point_2_start = point_1_start;
          let point_1_finish = simplex.points[1].slice(1);
          let point_2_finish = simplex.points[2].slice(1);
          let mesh = this.createWire(material, [0,0,1], [0,1,1]);
          if (reverse) {
            [point_1_start, point_1_finish, point_2_start, point_2_finish] = [point_1_finish, point_1_start, point_2_finish, point_2_start];
          }
          edges.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish });
        }

        else {
          console.log('Impossible 3-simplex');
          debugger;
        }

      // Triangles that appear in the movie
      } else if (simplex.points.length == 4) {

        //if (tri_num > 2) continue;

        let source_slice = simplex.points[0][0];
        let target_slice = simplex.points[simplex.points.length - 1][0];
        let buffer_index = first_frame + 1;
        let point_1_index, point_2_index, point_3_index;
        let triangle_points = [];

        // CASE C        
        if ((simplex.points[0][0] == simplex.points[1][0]) && (simplex.points[0][0] == simplex.points[2][0])) {
          //continue;
          //triangle_points.push([3,0], [3,1], [3,2]);
          triangle_points.push([3,2], [3,1], [3,0]);
          triangle_points = triangle_points.map(elt => elt.reverse());
          /*
          point_1_index = this.getVertexIndex({ buffer_index, point_1: simplex.points[0], point_2: simplex.points[3] });
          point_2_index = this.getVertexIndex({ buffer_index, point_1: simplex.points[1], point_2: simplex.points[3] });
          point_3_index = this.getVertexIndex({ buffer_index, point_1: simplex.points[2], point_2: simplex.points[3] });
          */
          tri_num += 1;
        }

        // CASE D
        else if ((simplex.points[0][0] == simplex.points[1][0]) && (simplex.points[2][0] == simplex.points[3][0])) {
          //continue;
          triangle_points.push([0,2], [1,2], [1,3], [0,2], [0,3], [1,3]);
          //triangle_points = triangle_points.map(elt => elt.reverse());
          tri_num += 2;
        }

        // CASE E
        else if ((simplex.points[1][0] == simplex.points[2][0]) && (simplex.points[2][0] == simplex.points[3][0])) {
          //triangle_points.push([0,1], [0,2], [0,3]);
          //continue;
          triangle_points.push([1,0], [2,0], [3,0]);
          triangle_points = triangle_points.map(elt => elt.reverse());
          tri_num += 1;

        } else {
          console.log('Impossible 4-simplex');
          continue;
        }

        triangle_points.forEach(point => {
          if (reverse) point.reverse();
          let point_index = this.getVertexIndex({
            buffer_index,
            point_1: simplex.points[point[0]],
            point_2: simplex.points[point[1]]
          });
          this.buffers[buffer_index].indices.push(point_index);
        });
      }
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
      let material = this.getMaterialOfColour('#0000ff');
      //material.transparent = false;
      //material.opacity = 0.5;
      //material.depthTest = false;
      //material.depthWrite = false;
      /*
      this.gui_controllers.forEach(controller => this.gui.remove(controller));
      this.gui_controllers = []
      //this.gui = new dat.GUI();
      this.gui_controllers.push(this.gui.add(material, 'transparent').onChange(this.renderSceneOnce.bind(this)));
      this.gui_controllers.push(this.gui.add(material, 'opacity').onChange(this.renderSceneOnce.bind(this)));
      this.gui_controllers.push(this.gui.add(material, 'depthTest').onChange(this.renderSceneOnce.bind(this)));
      this.gui_controllers.push(this.gui.add(material, 'depthWrite').onChange(this.renderSceneOnce.bind(this)));
      */

      
      let wireframe_material = this.getMaterialOfColour('#ff0000');
      wireframe_material.wireframe = true;
      wireframe_material.polygonOffset = true;
      wireframe_material.polygonOffsetFactor = 1;
      wireframe_material.polygonOffsetUnits = 1;


      buffer.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(buffer.mesh);
      this.objects.push(buffer.mesh);

      buffer.wireframe_mesh = new THREE.Mesh(geometry, wireframe_material);
      this.scene.add(buffer.wireframe_mesh);
      this.objects.push(buffer.wireframe_mesh);

      // Wireframe mesh
      /*
      buffer.mesh_wireframe = new THREE.Mesh(geometry, mesh_material);
      this.scene.add(buffer, mesh_material);
      this.objects.push(buffer, mesh_material);
      */


        //geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
      //geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

        /*

        //continue;
        //if (triangles.length > 0) continue; // only 1 triangle for now

        // CASE C
        if ((simplex.points[0][0] == simplex.points[1][0]) && (simplex.points[0][0] == simplex.points[2][0])) {
          //continue;
          let point_1_start = simplex.points[0].slice(1);
          let point_2_start = simplex.points[1].slice(1);
          let point_3_start = simplex.points[2].slice(1);
          let point_1_finish = simplex.points[3].slice(1);
          let point_2_finish = point_1_finish;
          let point_3_finish = point_1_finish;
          let mesh = this.createTriangle(material);
          if (reverse) {
            [point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish]
              = [point_1_finish, point_1_start, point_2_finish, point_2_start, point_3_finish, point_3_start];
          }
          triangles.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish });
        }

        // CASE D
        else if ((simplex.points[0][0] == simplex.points[1][0]) && (simplex.points[2][0] == simplex.points[3][0])) {
          //continue;
          // First triangle
          {
            let point_1_start = simplex.points[0].slice(1);
            let point_1_finish = simplex.points[2].slice(1);
            let point_2_start = simplex.points[1].slice(1);
            let point_2_finish = simplex.points[2].slice(1);
            let point_3_start = simplex.points[1].slice(1);
            let point_3_finish = simplex.points[3].slice(1);
            let mesh = this.createTriangle(material);
            if (reverse) {
              [point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish]
                = [point_1_finish, point_1_start, point_2_finish, point_2_start, point_3_finish, point_3_start];
            }
            triangles.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish });
          }
          {
            // Second triangle
            let point_1_start = simplex.points[0].slice(1);
            let point_1_finish = simplex.points[2].slice(1);
            let point_2_start = simplex.points[0].slice(1);
            let point_2_finish = simplex.points[3].slice(1);
            let point_3_start = simplex.points[1].slice(1);
            let point_3_finish = simplex.points[3].slice(1);
            let mesh = this.createTriangle(material);
            if (reverse) {
              [point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish]
                = [point_1_finish, point_1_start, point_2_finish, point_2_start, point_3_finish, point_3_start];
            }
            triangles.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish });
          }
        }

        // CASE E
        else if ((simplex.points[1][0] == simplex.points[2][0]) && (simplex.points[2][0] == simplex.points[3][0])) {
          //continue;
          let point_1_start = simplex.points[0].slice(1);
          let point_2_start = point_1_start;
          let point_3_start = point_1_start;
          let point_1_finish = simplex.points[1].slice(1);
          let point_2_finish = simplex.points[2].slice(1);
          let point_3_finish = simplex.points[3].slice(1);
          let mesh = this.createTriangle(material);
          if (reverse) {
            [point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish]
              = [point_1_finish, point_1_start, point_2_finish, point_2_start, point_3_finish, point_3_start];
          }
          triangles.push({ mesh, first_frame, last_frame, point_1_start, point_1_finish, point_2_start, point_2_finish, point_3_start, point_3_finish });
        }

        else {
          console.log('Impossible 4-simplex');
          debugger;
        }

        */

    this.render_data = { instants, vertices, edges, triangles };

    let t4 = performance.now();
    console.log('Prepared scene for animation (' + Math.floor(t1 - t0) + ' ms):'
      + ' built complex (' + Math.floor(t1-t0) + ' ms),'
      + ' reduced (' + Math.floor(t2-t1) + ' ms),'
      + ' trimmed (' + Math.floor(t3-t2) + ' ms),'
      + ' sequentialized (' + Math.floor(t4-t1) + ' ms)');

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
      buffer.mesh.visible = (i == stage);
      if (buffer.wireframe_mesh) {
        buffer.wireframe_mesh.visible = (i == stage);
      }
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
    //buffer.geometry.computeVertexNormals();
    buffer.geometry.attributes.position.needsUpdate = true;



    for (let i=0; i<instants.length; i++) {
      this.updateInstant(instants[i], t);
    }

    for (let i=0; i<vertices.length; i++) {
      this.updateVertex(vertices[i], t);
    }

    for (let i=0; i<edges.length; i++) {
      this.updateEdge(edges[i], t);
    }

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

  buildSceneUnique() {

    // Prepare the simplices
    let diagram = this.diagramToRender;
    let dimension = Math.min(diagram.n, 3);
    let generators = this.props.generators;
    let complex = diagram.skeleton({ generators, dimension, max_simplex_size: 3 }).complex.trimInvisible();
    console.log(complex.getByDimension());

    let { layout, freeze } = diagram.layout(dimension);

    let bezier = new BezierTriangleSystem({ complex, layout, freeze, construct_controls: true });
    bezier = bezier.subdivide();
    //bezier = bezier.subdivide();
    //let { complex, layout } = bezier;


    for (let simplex of bezier.complex.simplices) {
      let generator = generators[simplex.id];
      let material = this.getMaterial(generator);
      material.transparent = false;
      material.opacity = 1;
      material.depthTest = true;
      material.depthWrite = true;

      /*
      material.blending = THREE.CustomBlending;
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      */

      let material_wireframe = material.clone();
      material_wireframe.wireframe = true;
      material_wireframe.polygonOffset = true;
      material_wireframe.polygonOffsetFactor = 1;
      material_wireframe.polygonOffsetUnits = 1;
      material_wireframe.color = new THREE.Color('#ff0000');

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
        let geom = new THREE.Geometry();
        let vertices = simplex.point_names.map(name => Diagram3D.to3Vector(bezier.layout[name]));
        //let vectors = Diagram3D.to3VectorArray(simplex.point_names, layout);        
        geom.vertices.push(vertices[0]);
        geom.vertices.push(vertices[1]);
        geom.vertices.push(vertices[2]);
        geom.faces.push(new THREE.Face3(0, 1, 2));
        geom.computeFaceNormals();        
        let mesh = new THREE.Mesh(geom, material);
        this.scene.add(mesh);
        this.objects.push(mesh);

        let geom_wf = new THREE.Geometry();
        geom_wf.vertices.push(vertices[0]);
        geom_wf.vertices.push(vertices[1]);
        geom_wf.vertices.push(vertices[2]);
        geom_wf.faces.push(new THREE.Face3(0, 1, 2));
        geom_wf.computeFaceNormals();        
        let mesh_wf = new THREE.Mesh(geom, material_wireframe);
        this.scene.add(mesh_wf);
        this.objects.push(mesh_wf);

      }

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
