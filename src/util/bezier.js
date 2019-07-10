import { _assert, _debug } from "homotopy-core/dist/src/util/debug";

/* Class representing a cubic Bezier curve. All nontrivial code taken from
https://www.particleincell.com/wp-content/uploads/2013/08/cubic-line.svg */

export class BezierCubic {

  constructor({p1, p2, c1, c2}) {
    if (_debug) _assert(p1 instanceof Array);
    if (_debug) _assert(p2 instanceof Array);
    if (_debug) _assert(c1 instanceof Array);
    if (_debug) _assert(c2 instanceof Array);
    if (_debug) _assert(p1.length == 2 && p2.length == 2 && c1.length == 2 && c2.length == 2);
    this.p1 = p1;
    this.p2 = p2;
    this.c1 = c1;
    this.c2 = c2;
  }

  reverse() {
    let p1 = this.p2;
    let p2 = this.p1;
    let c1 = this.c2;
    let c2 = this.c1;
    return new BezierCubic({ p1, p2, c1, c2 });
  }

  // Returns an initial part of a bezier using de Casteljau's algorithm
  // See http://stackoverflow.com/questions/11703283/cubic-bezier-curve-segment
  getInitialPart(t) {
    var b = this;
    var u = 1 - t;
    var uu = u * u;
    var uuu = uu * u;
    var tt = t * t;
    var ttt = tt * t;
    var p1 = b.p1.slice();
    var c1 = [u * b.p1[0] + t * b.c1[0], u * b.p1[1] + t * b.c1[1]];
    var c2 = [uu * b.p1[0] + 2 * t * u * b.c1[0] + tt * b.c2[0], uu * b.p1[1] + 2 * t * u * b.c1[1] + tt * b.c2[1]];
    var p2 = [uuu * b.p1[0] + 3 * t * uu * b.c1[0] + 3 * tt * u * b.c2[0] + ttt * b.p2[0], uuu * b.p1[1] + 3 * t * uu * b.c1[1] + 3 * tt * u * b.c2[1] + ttt * b.p2[1]];
    return new BezierCubic({ p1, p2, c1, c2});
  }

  // Splits the Bezier at half its height, returning two Beziers
  splitAtMidHeight() {

    // Find the parameter value where it reaches half the height
    let y = [this.p1[1], this.c1[1], this.c2[1], this.p2[1]];
    let a = y[0] - 3*y[1] + 3 * y[2] - y[3];
    let b = -3 * y[0] + 6 * y[1] - 3 * y[2];
    let c = 3 * y[0] - 3 * y[1];
    let d = (y[3] - y[0]) / 2;
    let r = this.cubicRoots(a, b, c, d).filter(x => x >= 0 && x <= 1);
    if (_debug) _assert(r.length == 1);
    let t = r[0];

    // Return the parts
    return [ this.getInitialPart(t), this.reverse().getInitialPart(1-t).reverse() ];

  }

  /*based on http://mysite.verizon.net/res148h4j/javascript/script_exact_cubic.html#the%20source%20code*/
  cubicRoots(a, b, c, d) {
    var A = b / a;
    var B = c / a;
    var C = d / a;
    var Q, R, D, S, T, Im;
    var Q = (3 * B - Math.pow(A, 2)) / 9;
    var R = (9 * A * B - 27 * C - 2 * Math.pow(A, 3)) / 54;
    var D = Math.pow(Q, 3) + Math.pow(R, 2);    // polynomial discriminant
    var t = Array();

    if (D >= 0) { // complex or duplicate roots

      var S = this.sgn(R + Math.sqrt(D)) * Math.pow(Math.abs(R + Math.sqrt(D)), (1 / 3));
      var T = this.sgn(R - Math.sqrt(D)) * Math.pow(Math.abs(R - Math.sqrt(D)), (1 / 3));

      t[0] = -A / 3 + (S + T);                    // real root
      t[1] = -A / 3 - (S + T) / 2;                  // real part of complex root
      t[2] = -A / 3 - (S + T) / 2;                  // real part of complex root
      Im = Math.abs(Math.sqrt(3) * (S - T) / 2);    // complex part of root pair   

      /* discard complex roots */
      if (Im != 0) {
        t[1] = -1;
        t[2] = -1;
      }

    }

    else { // distinct real roots
      var th = Math.acos(R / Math.sqrt(-Math.pow(Q, 3)));

      t[0] = 2 * Math.sqrt(-Q) * Math.cos(th / 3) - A / 3;
      t[1] = 2 * Math.sqrt(-Q) * Math.cos((th + 2 * Math.PI) / 3) - A / 3;
      t[2] = 2 * Math.sqrt(-Q) * Math.cos((th + 4 * Math.PI) / 3) - A / 3;
      Im = 0.0;
    }

    /*discard out of spec roots*/
    for (var i = 0; i < 3; i++) {
      if (t[i] < 0 || t[i] > 1.0) t[i] = -1;
    }

    /*sort but place -1 at the end*/
    t = this.sortSpecial(t);

    console.log("Cubic roots: " + t[0] + " " + t[1] + " " + t[2]);
    return t;
  }

  sortSpecial(a) {
    var flip;
    var temp;

    do {
      flip = false;
      for (var i = 0; i < a.length - 1; i++) {
        if ((a[i + 1] >= 0 && a[i] > a[i + 1]) ||
          (a[i] < 0 && a[i + 1] >= 0)) {
          flip = true;
          temp = a[i];
          a[i] = a[i + 1];
          a[i + 1] = temp;
        }
      }
    } while (flip);
    return a;
  }

  // sign of number
  sgn(x) {
    return x < 0 ? -1 : +1;
  }

}


export default BezierCubic;
