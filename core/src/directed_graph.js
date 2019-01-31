import { _assert, _debug, _validate, isNatural, _propertylist } from "~/util/debug";

/* Tool to work with irreflexive directed graphs and their quotients */

export class DirectedQuotientGraph {
  
  constructor() {
    this.nodes = new Map();
    this.aliases = new Map(); // remember old node names
  }

  addNode(node, bias) {
    let nodeData = this.nodes.get(node);
    if (nodeData) return;
    this.nodes.set(node, { predecessors: new Set(), successors: new Set(), bias });
  }

  addEdge(source, target) {
    if (_debug) _assert(source != target);
    //this.addNode(source);
    //this.addNode(target);
    this.nodes.get(source).successors.add(target);
    this.nodes.get(target).predecessors.add(source);
  }

  hasEdge(source, target) {
    if (_debug) _assert(source != target);
    return this.nodes.get(source).successors.has(target);
  }

  addLinearGraph(list, bias) {
    if (_debug) _assert(list instanceof Array);
    for (let i=0; i<list.length; i++) {
      this.addNode(list[i], bias);
      if (i == 0) continue;
      this.addEdge(list[i - 1], list[i]);
    }
    if (_debug) _assert(this.isIrreflexive());
  }
  
  /* Quotient the directed graph making the given nodes the same,
     by replacing a's with b's everywhere. */
  quotient(a_raw, b_raw) {
    let a = this.aliases.has(a_raw) ? this.aliases.get(a_raw) : a_raw;
    let b = this.aliases.has(b_raw) ? this.aliases.get(b_raw) : b_raw;
    if (a == b) return;
    if (_debug) _assert(this.nodes.get(a));
    if (_debug) _assert(this.nodes.get(b));
    let a_data = this.nodes.get(a);
    let b_data = this.nodes.get(b);
    let final_bias = a_data.bias || b_data.bias;
    let a_predecessors = [...a_data.predecessors.keys()];
    for (let i=0; i<a_predecessors.length; i++) {
      let predecessor = a_predecessors[i];
      let pred_data = this.nodes.get(predecessor);
      if (_debug) _assert(pred_data);
      if (_debug) _assert(pred_data.successors.has(a));
      pred_data.successors.delete(a);
      if (predecessor != b) {        
        pred_data.successors.add(b);
        b_data.predecessors.add(predecessor);
      }
    }
    let a_successors = [...a_data.successors.keys()];
    for (let i=0; i<a_successors.length; i++) {
      let successor = a_successors[i];
      let succ_data = this.nodes.get(successor);
      if (_debug) _assert(succ_data);
      if (_debug) _assert(succ_data.predecessors.has(a));
      succ_data.predecessors.delete(a);
      if (successor != b) {
        succ_data.predecessors.add(b);
        b_data.successors.add(successor);
      }
    }
    this.nodes.delete(a);
    this.aliases.forEach(function(value, key) {
      if (value == a) {
        this.aliases.set(key, b);
      }
    }, this);
    this.aliases.set(a, b);
    b_data.bias = final_bias;
    if (_debug) _assert(this.isIrreflexive());
  }

  // Return a Set of successors of start_node.
  // Can handle acyclic graphs.
  getSuccessors(start_node, slave) {
    // Mark all nodes as unvisited
    if (!slave) {
      this.nodes.forEach(function(data, node) {
        data.marked = false;
      });
    }
    let nodeData = this.nodes.get(start_node);
    if (_debug) _assert(nodeData);
    let successors = new Set();
    nodeData.marked = true;
    for (let succ_node of nodeData.successors) {
      let succ_node_data = this.nodes.get(succ_node);
      if (succ_node_data.marked) continue;
      let local_successors = this.getSuccessors(succ_node, true);
      successors.add(succ_node);
      for (let local_succ_node of local_successors) {
        //_assert(local_succ_node != base_node);
        successors.add(local_succ_node);
      }
      succ_node_data.marked = true;
    }
    return successors;
  }

  isIrreflexive() {
    for (let [node, data] of this.nodes) {
      if (data.successors.has(node)) return false;
      if (data.predecessors.has(node)) return false;
    }
    return true;
  }

  // Take the transitive closure of the graph
  transitiveClosure() {
    let global_successors = new Map();
    let edges_to_add = [];
    this.nodes.forEach(function(data, node) {
      let successors = this.getSuccessors(node);
      //global_successors.set(node, successors);
      for (let target of successors) {
        edges_to_add.push({source: node, target});
        //graph_t.addEdge(node, target);
      }
    }, this);
    for (let i=0; i<edges_to_add.length; i++) {
      let edge = edges_to_add[i];
      this.addEdge(edge.source, edge.target);
    }
    if (_debug) _assert(this.isIrreflexive());
    return this;
  }

  // Return a new graph which is the acylic quotient of this graph. ASSUME TRANSITIVELY CLOSED.
  acyclicQuotient() {

    // Find the equivalence relation
    let skeleton_nodes = new Set();
    let quotients = [];
    this.nodes.forEach(function(data, node) {
      for (let skeleton of skeleton_nodes) {
        if (this.hasEdge(node, skeleton) && this.hasEdge(skeleton, node)) {
          //data.skeleton = skeleton;f
          quotients.push({node, skeleton});
          return;
        }
      }
      // First visit to this equivalence class
      skeleton_nodes.add(node);
    }, this);

    // Quotient the graph
    for (let i=0; i<quotients.length; i++) {
      let q = quotients[i];
      this.quotient(q.node, q.skeleton);
    }
    if (_debug) _assert(this.isIrreflexive());
  }

  getInitialElements() {
    let initial = new Set();
    this.nodes.forEach(function(data, node) {
      if (data.predecessors.size == 0) {
        initial.add(node);
      }
    });
    if (_debug) _assert(initial.size > 0);
    return initial;
  }

  // Get the successors which are not successors of any other successor
  getImmediateSuccessors(node) {
    let successors = this.nodes.get(node).successors;
    let immediate = new Set();
    for (let successor of successors) {

      // Is this the successor of any other successor?
      let invalid = false;
      for (let t of successors) {
        if (this.nodes.get(t).successors.has(successor)) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;

      // This is one of the immediate successors
      immediate.add(successor);
    }

    return immediate;
  }

  getLinearOrder() {

    // Store the linear order that we compute
    let linear_order = new Map();

    // Get the first candidate elements which are initial in the graph
    let next_elements = this.getInitialElements();

    // Iteratively select from and update this list of candidate elements
    while (next_elements.size > 0) {

      // Check if first node has zero bias
      let require_unique = (this.nodes.values().next().value.bias === 0);

      // See if any of them are acceptable
      let chosen_node;
      let failure = false;
      for (let node of next_elements) {

        // Is this node the successor of any other next_element?
        let invalid = false;
        let elements = next_elements.entries()
        for (let a of next_elements) {
          if (a == node) continue;
          if (this.nodes.get(a).successors.has(node)) {
            invalid = true; break;
          }
        }
        if (invalid) continue;

        // Check for non-unique linear order
        if (require_unique && chosen_node !== undefined) {
          failure = true;
          break;
        }

        // Possibly choose this node
        if (chosen_node === undefined) chosen_node = node;

        // Is the new node preferable?
        else if (this.nodes.get(node).bias < this.nodes.get(chosen_node).bias) {
          chosen_node = node;
        }

        // If the chosen node has bias -1, it's the winner
        if (this.nodes.get(chosen_node).bias === -1) break;
      }

      if (failure) return { error: 'not contractible' };

      // There should always be a chosen node
      //if (_debug) _assert(chosen_node !== undefined);
      if (chosen_node === null) return null;

      // Set this node as next in the linear order
      linear_order.set(chosen_node, linear_order.size);

      // Remove it from the possible next elements, and add its immediate successors
      let immediate_successors = this.getImmediateSuccessors(chosen_node);
      next_elements.delete(chosen_node);
      for (let a of immediate_successors) {
        next_elements.add(a);
      }
    }

    // We should have ordered all the elements
    if (_debug) _assert(linear_order.size == this.nodes.size);

    // Add the aliased elements to the linear order
    for (let [key, value] of this.aliases) {
      linear_order.set(key, linear_order.get(value));
    }

    // Return the linear order
    return linear_order;
  }

  getNumNodes() {
    //return [...this.nodes.keys()].length;
    return this.nodes.size;
  }
}