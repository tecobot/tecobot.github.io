/* TeCoBot — geometry, renderer and Play UI.
   Shared by the landing hero (index.html) and Play with TeCoBots (play/).
   Every dimension lives in the MM block below. */
(function(){
  "use strict";

  /* One script, two pages. data-tecobot="hero" on <body> runs the landing
     animation only; anything else opens straight into the Play tool. */
  var MODE = document.body.getAttribute("data-tecobot") === "hero" ? "hero" : "play";

  /* ------------------------------------------------------------------
     MM — every published dimension, in millimetres.
     Source: Saikot et al., Methods (Robot Design and Fabrication;
     Claw and Roller Wheel Design). Values marked (est.) are scaled from
     photographs because the paper does not state them; correct them here
     and the entire model, the readout, and the export update together.
     ------------------------------------------------------------------ */
  var MM = {
    rod:        58,   // carbon-fibre rod length
    rodDia:      2,   // carbon-fibre rod diameter
    moduleDia: 104,   // ONE diameter for the base module, the claw module and
                      // every spacer disk, so none of them stands proud of the
                      // others. The paper states 110 mm for the disks and the
                      // robot; this is set flush with the claw module instead.
    diskT:       2,   // spacer disk thickness
    modules:     4,   // stacked icosahedral tensegrity modules
    junction:    2,   // (est.) clearance between a module and its disk — set to
                      // the disk thickness so the connector stubs vanish
    cableCircle:94,   // (est.) pitch circle of the three actuation cables
    baseH:    78.75,  // (est.) base module height — 75% of the earlier estimate
    topH:       37,   // (est.) top (claw) module height
    knuckleR:   14,   // claw finger pivot radius from the body axis (measured)
    clawFinger: 88,   // (est.) claw finger, straight from pivot to tip
    lobeReach:   7,   // Y-section lobe reach from the finger axis (measured).
                      // Exactly half the pivot radius, and that ratio is what
                      // closes both docking modes: six closed fingers at 60°
                      // close-pack on the pivot circle, and a closed finger's
                      // inner face stands at reach from its own axis, so a
                      // single finger run down that axis meets all three.
    gripOpen:   45,   // hinge range: 0° closed (fingers along the axis) to 45°
    clawSleeve:18.2,  // (est.) rubber tubular sleeve at the finger end — 70%
                      // of the earlier estimate
    wheelDia:   20,   // (est.) passive roller wheel, between claw fingers
    stubLen:    70,   // (est.) docking stub on the frame — a single finger,
                      // mounted perpendicular to its bar, that a closed claw
                      // grips 3-to-1 exactly as it would grip another claw
    barDia:     30,   // (est.) aluminium extrusion of the frame
    ballDia:   200,   // cooperatively lifted ball (Results, M1)
    pipeDia:   185    // (est.) cylindrical pipe for the closed-loop roll (L4)
  };

  var PHI = (1 + Math.sqrt(5)) / 2;
  var UNIT = MM.rod / (2 * PHI);          // mm per drawing unit, set by the rod
  function u(mm){ return mm / UNIT; }     // mm -> units

  /* ---------------- icosahedral tensegrity module ---------------- */
  var V = [];
  [1,-1].forEach(function(a){ [1,-1].forEach(function(b){
    V.push({p:[0, a, b*PHI], t:0});
    V.push({p:[a, b*PHI, 0], t:1});
    V.push({p:[b*PHI, 0, a], t:2});
  });});
  function d2(a,b){ var x=a[0]-b[0], y=a[1]-b[1], z=a[2]-b[2]; return x*x+y*y+z*z; }
  var struts=[], tendons=[];
  for(var i=0;i<12;i++) for(var j=i+1;j<12;j++){
    var dd = d2(V[i].p, V[j].p);
    if(Math.abs(dd - 4*PHI*PHI) < 1e-6 && V[i].t === V[j].t) struts.push([i,j]);
    else if(Math.abs(dd - 4) < 1e-6 && V[i].t !== V[j].t) tendons.push([i,j]);
  }
  // re-orient so the module axis passes through two opposite all-tendon faces
  var r3=1/Math.sqrt(3), r2=1/Math.sqrt(2), r6=1/Math.sqrt(6);
  var e1=[r2,-r2,0], e2=[r6,r6,-2*r6], e3=[r3,r3,r3];
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  var LOC = V.map(function(v){ return [dot(v.p,e1), dot(v.p,e2), dot(v.p,e3)]; });
  var ZMAX = Math.max.apply(null, LOC.map(function(q){ return q[2]; }));
  // widest the tendon lattice reaches from the body axis — what a gripping
  // claw has to stay outside of
  var LAT_R = Math.max.apply(null, LOC.map(function(q){ return Math.hypot(q[0], q[1]); }));
  var endNode = LOC.map(function(q){ return Math.abs(Math.abs(q[2]) - ZMAX) < 1e-6; });

  // The icosahedron edge is 2 units and the strut 2*PHI units, so one unit is
  // MM.rod/(2*PHI) mm and the module height follows from the geometry alone.
  var MOD_H  = 2 * ZMAX;                       // module height, units
  var GAP    = u(MM.junction);
  var N      = MM.modules;
  var MOD_R  = u(MM.moduleDia/2);          // base, claw module and disks share it
  var DISK_R = MOD_R;
  var CAB_R  = u(MM.cableCircle/2);
  var BASE_H = u(MM.baseH),  BASE_R = MOD_R;
  var TOP_H  = u(MM.topH),   TOP_R  = MOD_R;
  var KN_R   = u(MM.knuckleR), C_FING = u(MM.clawFinger), C_SLV = u(MM.clawSleeve);
  var WHEEL  = u(MM.wheelDia/2);
  var BALL_R = u(MM.ballDia/2), PIPE_R = u(MM.pipeDia/2);

  // Disks sit at s = 0 and s = SB, flush against the base and claw modules.
  var SB     = N*(MOD_H + GAP);                // nominal bending arc length
  // A stack of any height is the same module repeated, so its bending length is
  // just the count times the pitch. SB stays the four-module default, which is
  // what the multi-robot layouts are measured in.
  function sbFor(n){ return n*(MOD_H + GAP); }
  var CLAW_L = C_FING;                         // claw reach past the end plate
  var LEN_MM = (BASE_H + SB + TOP_H + CLAW_L + CLAW_L) * UNIT;  // overall, claw tip to claw tip

  /* Docked spacing. Two closed claws interlock by running their fingers past
     each other, so what sets the spacing is the clear distance between the two
     end plates, not the distance between the bodies:

        DOCK_GAP = reach x (2 - overlap)

     At 82% overlap each set of fingers stops a short way clear of the opposite
     plate. A chained robot is placed from the same figure: its base-claw plate
     must land DOCK_GAP beyond the previous robot's distal plate, and because
     its origin sits BASE_H in front of that plate, the origin offset is
     DOCK_GAP + BASE_H. Spacing the origin any closer drives the trailing
     robot's base claw straight through the other robot's claw module. */
  var DOCK_OVERLAP = 0.82;
  var DOCK_GAP = C_FING * (2 - DOCK_OVERLAP);  // plate to plate, docked
  var JOINT    = DOCK_GAP + BASE_H;            // origin offset along the chain

  /* ---------------- pose maths ---------------- */
  // Local body frame: +z is the body axis at the base, bending toward psi.
  function lframe(psi, kappa, s, sb){
    sb = (sb === undefined) ? SB : sb;
    var cd = Math.cos(psi), sd = Math.sin(psi), B = [-sd, cd, 0];
    if(s <= 0 || kappa < 1e-7){
      return { p:[0,0,s], T:[0,0,1], N:[cd,sd,0], B:B };
    }
    var se = Math.min(s, sb), a = kappa*se, r = (1-Math.cos(a))/kappa, h = Math.sin(a)/kappa;
    var p = [cd*r, sd*r, h];
    var T = [cd*Math.sin(a), sd*Math.sin(a), Math.cos(a)];
    var Nn = [cd*Math.cos(a), sd*Math.cos(a), -Math.sin(a)];
    if(s > sb){ var ex = s - sb; p = [p[0]+T[0]*ex, p[1]+T[1]*ex, p[2]+T[2]*ex]; }
    return { p:p, T:T, N:Nn, B:B };
  }
  function mul(M, v){
    return [ M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
             M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
             M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2] ];
  }
  function xf(R, lp){ var w = mul(R.M, lp); return [w[0]+R.o[0], w[1]+R.o[1], w[2]+R.o[2]]; }
  function cols(a,b,c){ return [[a[0],b[0],c[0]],[a[1],b[1],c[1]],[a[2],b[2],c[2]]]; }
  var I3 = cols([1,0,0],[0,1,0],[0,0,1]);
  function matT(M){ return [[M[0][0],M[1][0],M[2][0]],
                            [M[0][1],M[1][1],M[2][1]],
                            [M[0][2],M[1][2],M[2][2]]]; }
  function matMul(A,B){
    var C=[[0,0,0],[0,0,0],[0,0,0]];
    for(var i=0;i<3;i++) for(var j=0;j<3;j++){
      var t=0; for(var k=0;k<3;k++) t+=A[i][k]*B[k][j]; C[i][j]=t;
    }
    return C;
  }
  // rotation of ang about world z
  /* The shortest rotation taking one unit vector onto another. Composing two
     `aim` frames instead injects a twist of its own, because `aim` picks its
     side vector by convention — which is what rolled the H's strokes 90° when
     the grip started following the body's tangent. */
  function alignRot(a, b){
    var v = cross(a, b), c = dot(a, b);
    if(c > 0.999999) return I3;
    if(c < -0.999999){
      var p = Math.abs(a[0]) < 0.9 ? [1,0,0] : [0,1,0], x = norm(cross(a, p));
      return [[2*x[0]*x[0]-1, 2*x[0]*x[1],   2*x[0]*x[2]],
              [2*x[0]*x[1],   2*x[1]*x[1]-1, 2*x[1]*x[2]],
              [2*x[0]*x[2],   2*x[1]*x[2],   2*x[2]*x[2]-1]];
    }
    var K = [[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]];
    var KK = matMul(K, K), k = 1/(1 + c), R = [[0,0,0],[0,0,0],[0,0,0]];
    for(var i=0;i<3;i++) for(var j=0;j<3;j++)
      R[i][j] = (i === j ? 1 : 0) + K[i][j] + KK[i][j]*k;
    return R;
  }
  function rotZ(ang){ var c=Math.cos(ang), s=Math.sin(ang); return cols([c,s,0],[-s,c,0],[0,0,1]); }
  // local +z mapped onto a unit direction d (picking a stable side vector)
  function aim(d, roll){
    var up = Math.abs(d[2]) > 0.95 ? [1,0,0] : [0,0,1];
    var x = cross(up, d); x = norm(x);
    var y = cross(d, x);
    if(roll){ var c=Math.cos(roll), s=Math.sin(roll);
      var x2=[x[0]*c+y[0]*s, x[1]*c+y[1]*s, x[2]*c+y[2]*s];
      var y2=[y[0]*c-x[0]*s, y[1]*c-x[1]*s, y[2]*c-x[2]*s];
      x=x2; y=y2; }
    return cols(x,y,d);
  }
  function mixHex(a, b, t){              // blend two #rrggbb colours
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), o = '#';
    [16, 8, 0].forEach(function(sh){
      var x = Math.round(((pa >> sh) & 255)*(1 - t) + ((pb >> sh) & 255)*t);
      o += (x < 16 ? '0' : '') + x.toString(16);
    });
    return o;
  }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a){ var m=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/m,a[1]/m,a[2]/m]; }
  function add(a,b,k){ k=(k===undefined)?1:k; return [a[0]+b[0]*k, a[1]+b[1]*k, a[2]+b[2]*k]; }

  function place(R, s, x, y){
    var f = lframe(R.psi, R.kappa, s, R.sb);
    var cp = Math.cos(R.psi), sp = Math.sin(R.psi);
    var a = x*cp + y*sp, b = -x*sp + y*cp;
    return xf(R, [ f.p[0] + a*f.N[0] + b*f.B[0],
                   f.p[1] + a*f.N[1] + b*f.B[1],
                   f.p[2] + a*f.N[2] + b*f.B[2] ]);
  }
  /* World pose at either end plate: the claw a dock is made at, and the frame
     it is made in. +1 is the top claw, -1 the base claw, whose axis points the
     other way. */
  function endPose(R, end){
    var f = lframe(R.psi, R.kappa, end > 0 ? R.sb + TOP_H : -BASE_H, R.sb);
    var T = norm(mul(R.M, f.T));
    return { p: xf(R, f.p), T: end > 0 ? T : [-T[0],-T[1],-T[2]],
             N: norm(mul(R.M, f.N)), B: norm(mul(R.M, f.B)) };
  }
  // where the next robot in a chain attaches
  function distal(R){ return endPose(R, +1); }

  /* The world frame of an end claw, carried by the shape instead of rebuilt
     from a convention. alignRot(T, z) is the inverse of the body's own twist —
     a rotation of the bend angle about the bending binormal — so its transpose
     carries the claw's material axes, and the frame stays continuous through
     every shape, zero bend included. `aim` cannot: it swaps its reference axis
     as the claw passes vertical, and anything docked to that claw snaps with
     it. Columns are (x, y, claw axis). */
  var FLIP_X = [[1,0,0],[0,-1,0],[0,0,-1]];      // 180 degrees about x: axis reversed
  var YAW90 = cols([0,0,-1],[0,1,0],[1,0,0]);    // local z onto the frame's own x
  function stationFrame(R, s){
    var lf = lframe(R.psi, R.kappa, s, R.sb);
    return matMul(R.M, matT(alignRot(norm(lf.T), [0,0,1])));
  }
  function endFrame(R, end){
    var F = stationFrame(R, end > 0 ? R.sb + TOP_H : -BASE_H);
    return end > 0 ? F : matMul(F, FLIP_X);
  }
  /* A direction perpendicular to a station's axis, at azimuth `azi` about it,
     measured in that station's material frame. The Frenet N and B are the
     obvious reference and the wrong one: they turn with the bending direction,
     and at zero bend that direction is not defined at all, so the first nudge
     of a cable swung everything docked at an azimuth round the host. */
  function frameRadial(F, azi){
    var c = Math.cos(azi), s = Math.sin(azi);
    return norm([ F[0][0]*c + F[0][1]*s, F[1][0]*c + F[1][1]*s, F[2][0]*c + F[2][1]*s ]);
  }
  // the frame of a claw closing on the far rim of the same plate, facing back
  function opposed(F){ return matMul(F, FLIP_X); }

  /* ---- cable displacement -> shape ----

     Three cables on a circle of radius CAB_R, 120° apart, is exactly three
     degrees of freedom, and the constant-curvature map splits them cleanly.
     Cable i of an arc of backbone length L runs L(1 - kappa*r*cos(phi_i - psi)),
     and the mean of three such lengths 120° apart is exactly L. So the mean
     pull-in is the shortening and nothing else, the three deviations from it
     are the bend and nothing else, and the two do not cross-talk: pull all
     three together and the robot collapses dead straight.

     Phase follows the cables as they are drawn, starting at local azimuth 90°,
     so cable 1 on the slider is cable 1 on the screen. */
  var CAB_PHASE = Math.PI/2;
  var CAB_FLOOR = 0.45;               // the modules cannot be squashed past this

  function cableShape(d, sb0){        // three pull-ins -> bend, direction, length
    sb0 = sb0 || SB;
    var m = (d[0] + d[1] + d[2])/3, cu = 0, cv = 0;
    for(var i=0;i<3;i++){
      var phi = CAB_PHASE + i*2*Math.PI/3;
      cu += (2/3)*(d[i] - m)*Math.cos(phi);
      cv += (2/3)*(d[i] - m)*Math.sin(phi);
    }
    return { sb: Math.max(sb0*CAB_FLOOR, sb0 - m),
             bendDeg: Math.hypot(cu, cv)/CAB_R*180/Math.PI,
             psi: Math.atan2(cv, cu) };
  }
  function shapeCables(bendDeg, psi, sb, sb0){   // and back, for the slider defaults
    sb0 = sb0 || SB;
    var m = sb0 - (sb === undefined ? sb0 : sb), th = bendDeg*Math.PI/180, d = [];
    for(var i=0;i<3;i++) d.push(m + th*CAB_R*Math.cos(CAB_PHASE + i*2*Math.PI/3 - psi));
    return d;
  }

  /* Robots are numbered in the order a config creates them, which is stable
     because a build does not branch on shape. A robot whose cables the user has
     taken over reads its shape from them instead of from the config; the rest
     report the cable lengths their config's pose implies, so the sliders always
     open where the configuration actually is. */
  var CAB_N = 0, CAB_CUR = null;

  function robot(o, M, bendDeg, psi, opts){
    opts = opts || {};
    var id = (opts.cabId === undefined) ? CAB_N++ : opts.cabId;
    var nm = opts.nmod || N, sb0 = sbFor(nm), sb = sb0, ov = CAB_CUR && CAB_CUR[id];
    if(ov){ var sh = cableShape(ov, sb0); bendDeg = sh.bendDeg; psi = sh.psi; sb = sh.sb; }
    var r = { o:o, M:M, psi:psi||0, sb:sb, sb0:sb0, n:nm, kappa:(bendDeg*Math.PI/180)/sb,
              openTop: (opts.openTop===undefined)?0.15:opts.openTop,
              openBase:(opts.openBase===undefined)?0.85:opts.openBase,
              clawOff:(opts.clawOff===undefined)?Math.PI/6:opts.clawOff,
              baseClaw:(opts.baseClaw===undefined)?true:opts.baseClaw,
              bendDeg:bendDeg, cabId:id, name:opts.name, baseOff:opts.baseOff,
              cab: ov ? ov.slice() : shapeCables(bendDeg, psi||0, sb, sb0) };
    return r;
  }
  /* The base claw sits a sixth of a turn round from the top claw, so docked
     robots interleave. A conceptual build may mount it at another angle. */
  function baseOffOf(R){ return R.clawOff + (R.baseOff === undefined ? Math.PI/3 : R.baseOff); }
  // chain: next robot docks its base claw to this robot's top claw
  function chain(R, bendDeg, psiLocal, opts){
    var d = distal(R);
    var o = add(d.p, d.T, JOINT);
    /* Two claws bolted face to face share one rigid interface, so the arriving
       robot's frame is the parent's claw MATERIAL frame — stationFrame, which
       transports the body's own axes along the arc. The Frenet frame (N, B, T)
       is the obvious choice and the wrong one: it carries an extra turn of psi,
       which the interleave then had to cancel by hand, and at zero bend psi is
       not defined at all, so the first touch of a cable spun every robot
       downstream about the joint. In the material frame the parent's top claw
       still reads at clawOff and the arriving base claw at clawOff + 60°, so
       matching the two holds the interleave with nothing to subtract. */
    var M = stationFrame(R, R.sb + TOP_H);
    var nx = robot(o, M, bendDeg, psiLocal||0, opts);
    nx.clawOff = (R.clawOff||0);
    // Both halves of this joint are gripping, so both are fully closed with
    // their fingers along the axis. Forced here rather than left to each
    // morphology, so a docked claw can never be drawn part-open.
    R.openTop  = 0;
    nx.openBase = 0;
    JOINTS.push({ R:R, nx:nx });
    dockPair({R:R, s:R.sb + TOP_H}, {R:nx, s:-BASE_H});
    return nx;
  }

  /* Every chained joint is a claw-to-claw dock, so the two mating sets of three
     fingers must sit 60° apart about the joint axis. This measures that from
     the same place() the renderer draws with, rather than leaving it to the
     eye: 60 is interleaved, 0 is coincident and reads hollow. */
  var JOINTS = [];
  /* Every dock a build makes, recorded as the two stations it joins: a robot and
     an arclength along it, or a fixed world point for a station stub. Whether a
     dock survives the cable sliders is then a measurement rather than a
     judgement — the separation between those two stations must not change. */
  var DOCKS = [];
  function dockPair(a, b){ DOCKS.push({ a:a, b:b }); }
  function dockStation(R, s, p){ DOCKS.push({ a:{R:R, s:s}, b:{p:p} }); }
  function dockFinger(R, held, end, k){
    DOCKS.push({ claw:{R:R, s:R.sb + TOP_H}, finger:{R:held, end:end, k:k} });
  }
  function jointCheck(){
    return JOINTS.map(function(J, n){
      var R = J.R, nx = J.nx, d = distal(R);
      function az(p){
        var v = [p[0]-d.p[0], p[1]-d.p[1], p[2]-d.p[2]];
        var t = dot(v, d.T);
        v = [v[0]-d.T[0]*t, v[1]-d.T[1]*t, v[2]-d.T[2]*t];
        return Math.atan2(dot(v, d.B), dot(v, d.N)) * 180/Math.PI;
      }
      var top = [], base = [], i;
      for(i=0;i<3;i++){
        var a1 = R.clawOff + i*2*Math.PI/3;
        top.push(az(place(R, R.sb + TOP_H, KN_R*Math.cos(a1), KN_R*Math.sin(a1))));
        var a2 = baseOffOf(nx) + i*2*Math.PI/3;
        base.push(az(place(nx, -BASE_H, KN_R*Math.cos(a2), KN_R*Math.sin(a2))));
      }
      var best = 1e9;
      top.forEach(function(t){ base.forEach(function(b){
        best = Math.min(best, Math.abs(((t-b)%360+540)%360-180));
      }); });
      return { joint:n, top:top.map(Math.round), base:base.map(Math.round), minSep:Math.round(best) };
    });
  }
  window.__tecobotJoints = jointCheck;

  /* The separation at each declared dock, in millimetres. */
  window.__tecobotScene = function(){ return scene; };
  window.__docks = function(){
    function at(e){ return e.p ? e.p : place(e.R, e.s, 0, 0); }
    return DOCKS.map(function(d, i){
      var mm;
      if(d.finger){
        /* A claw closed on a finger sits on that finger's own line, so the
           measurement is how far its plate has strayed off it. */
        var H = d.finger.R, e = d.finger.end;
        var f = fingerLine(H, e > 0 ? H.sb + TOP_H : -BASE_H, e,
                           e > 0 ? H.openTop : H.openBase,
                           (e > 0 ? H.clawOff : baseOffOf(H)), d.finger.k);
        var P = at(d.claw), v = add(f.tip, f.root, -1), w = add(P, f.root, -1);
        // against the finger's line, not its drawn segment: a closed claw sits
        // beyond the fingertip, so clamping to the segment measures the overhang
        var L2 = dot(v, v) || 1, q = add(f.root, v, dot(w, v)/L2);
        mm = Math.hypot(P[0]-q[0], P[1]-q[1], P[2]-q[2])*UNIT;
      } else {
        var A = at(d.a), B = at(d.b);
        mm = Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])*UNIT;
      }
      return { i:i, mm: Math.round(mm*1000)/1000 };
    });
  };

  /* The azimuth about a host's own axis that puts a claw-to-body dock in a
     given world direction, at the configuration's default pose. The configs
     carry the resulting constants rather than calling this, because the
     azimuth has to be a constant of the assembly — solving it against a fixed
     world direction every frame would make a dock hold its world heading
     instead of turning with the body it is clamped to. This is how those
     constants were measured, and re-measures them if a default ever moves. */
  window.__dockAzi = function(R, f, want){
    var fr = lframe(R.psi, R.kappa, f*R.sb, R.sb);
    return Math.round(Math.atan2(dot(want, norm(mul(R.M, fr.B))),
                                 dot(want, norm(mul(R.M, fr.N))))*180/Math.PI);
  };
  window.__scene = function(){ return scene; };
  /* Re-read the colour tokens after the page switches between day and night,
     since the paper palette draws with them. */
  window.__tecobotRecolor = function(){ readColors(); if(scene) draw(); };
  /* For every claw in the scene, how close it comes to every other robot's
     backbone. A dock of any kind — claw to claw, or claw to a plate partway
     along another body — holds exactly this clearance, so it is the one number
     that says whether driving a robot has parted anything. */
  window.__clearances = function(){
    var rs = scene.robots, out = [];
    rs.forEach(function(R, i){
      [['b', -BASE_H], ['t', R.sb + TOP_H]].forEach(function(e){
        var p = place(R, e[1], 0, 0);
        rs.forEach(function(Q, j){
          if(i === j) return;
          var best = 1e9;
          for(var t=0; t<=60; t++){
            var q = place(Q, -BASE_H + (Q.sb + TOP_H + BASE_H)*t/60, 0, 0);
            best = Math.min(best, Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]));
          }
          out.push({ id: i + e[0] + '>' + j, d: best });
        });
      });
    });
    return out;
  };

  /* The two end plates of every robot, in world space — what a dock is measured
     between when checking that driving one robot has not parted it. */
  window.__plates = function(){
    return scene.robots.map(function(R){
      return { base: place(R, -BASE_H, 0, 0), top: place(R, R.sb + TOP_H, 0, 0) };
    });
  };
  window.__setView = function(az, el){ cam.az = az; cam.el = el; draw(); };   // used by eleph.py renders
  window.__view = function(){
    return { el: Math.round(cam.el*1000)/1000, az: Math.round(cam.az*1000)/1000,
             focus: FOCUS.map(function(v){ return Math.round(v*100)/100; }),
             freeRot: freeRot, panMode: panMode };
  };

  /* Derived dimensions, in millimetres — the numbers a geometry claim has to be
     checked against, rather than read off a picture. */
  window.__tecobotDims = function(){
    var F = station(), out = { station:{}, grip:[] };
    out.station = { halfWidth: Math.round(F.hx*UNIT), halfDepth: Math.round(F.hy*UNIT),
                    barZ: Math.round(F.barZ*UNIT) };
    for(var th = 20; th <= 70; th += 5){
      var lf = lframe(Math.PI, (th*Math.PI/180)/SB, SB + TOP_H);
      var Rr = KN_R + (-lf.p[0]) + (2 - 0.55)*C_FING*Math.sin(th*Math.PI/180);
      out.grip.push({ spread:th, Rr:Math.round(Rr*UNIT),
                      halfWidth:Math.round(Rr*Math.cos(Math.PI/6)*UNIT) });
    }
    return out;
  };

  /* ---------------- morphologies ---------------- */
  // Each returns {robots:[], props:[], tag:'', conn:''}

  // How far past the end plate the closing fingers reach, along the body axis.
  function gripAngle(open){ return open * MM.gripOpen * Math.PI/180; }
  function fingerAxialReach(open){ return C_FING * Math.cos(gripAngle(open)); }

  /* Place a robot by its far claw rather than by its base: put the distal claw
     plate at Q with the claw's fingers pointing along dir. Solved by rotating
     the robot's own distal pose onto the required one, so the robot may be
     bent — a bent robot's claw does not sit on its base axis, which is why
     this cannot be done by positioning the base. */
  function poseDistal(Q, dir, bendDeg, psi, opts){
    // built at the origin first: cables may override the shape, and the offset
    // from base to claw can only be measured once the shape has settled
    opts = opts || {};
    var r = robot([0,0,0], I3, bendDeg, psi, opts);
    var lf = lframe(r.psi, r.kappa, r.sb + TOP_H, r.sb);
    /* A clamped claw is clamped in all three rotational freedoms, so the
       rotation carrying the claw's own material frame onto the dock's must be
       the shape's actual twist and nothing else. alignRot(T, z) is exactly the
       inverse of that twist — a rotation of the bend angle about the bending
       binormal — whereas composing two `aim` frames adds a convention of its
       own and, worse, swaps its reference axis the moment |T.z| crosses 0.95.
       That swap is a ~90 degrees snap at about 18 degrees of bend: the tail of
       the O- read as spinning in place rather than bending about a fixed claw.
       The extra quarter turn keeps the finger phase every existing config was
       built around.

       `opts.frame` supplies that world claw frame outright, for a dock whose
       roll is set by the plate it closes on rather than by a convention. */
    r.M = matMul(opts.frame || aim(norm(dir), Math.PI/2),
                 alignRot(norm(lf.T), [0,0,1]));
    r.o = add(Q, mul(r.M, lf.p), -1);
    return r;
  }

  /* Hold another robot by its body: this robot's claw at `end`, closed on a
     spacer plate a fraction `f` along the other's length, holding it
     perpendicular to the claw's own axis at azimuth `azi` about it.

     Positioning the held robot from the holder — rather than writing both down
     in world coordinates — is what makes a claw-to-body group articulate as one
     body. Bend the holder and everything it holds swings with it, instead of
     the holder bending out of its own grips. */
  function radial(e, azi){
    return norm([ e.N[0]*Math.cos(azi) + e.B[0]*Math.sin(azi),
                  e.N[1]*Math.cos(azi) + e.B[1]*Math.sin(azi),
                  e.N[2]*Math.cos(azi) + e.B[2]*Math.sin(azi) ]);
  }
  function bodyHeld(A, end, f, azi, roll, bendDeg, psi, opts){
    var e = endPose(A, end);
    var P = add(e.p, e.T, bodyStandoff());            // the gripped plate's centre
    /* Oriented from the gripped station's own tangent, not from the base axis.
       Aiming the base axis keeps the gripped plate square to the claw only while
       the body is straight; bend it and the plate tilts out of the claw, which
       is a dock coming apart even though the gripped point stays put. */
    var r = robot([0,0,0], I3, bendDeg, psi, opts);
    var lf = lframe(r.psi, r.kappa, f*r.sb, r.sb);
    var G = matMul(matMul(endFrame(A, end), rotZ(azi)), YAW90);
    r.M = matMul(matMul(G, rotZ(roll || 0)), alignRot(norm(lf.T), [0,0,1]));
    r.o = add(P, mul(r.M, lf.p), -1);
    dockPair({R:A, s:(end > 0 ? A.sb + TOP_H : -BASE_H)}, {R:r, s:f*r.sb});
    return r;
  }

  /* The mirror of it: place a robot whose own top claw closes on host B's
     spacer plate a fraction f along, approaching along azimuth azi about B's
     axis there. For a dock where the host is already placed and the gripper is
     the one that has to follow it — a tail on a stroke of the H, say.

     `opts.frame` overrides the azimuth with the claw frame this gripper has to
     take, and the direction out of the host follows from it. A fixed azimuth is
     measured in the host's own N/B frame, which turns with the host: fine while
     the host is the only thing that moves, but in the H- the stroke is itself
     held by the cross-member, so bending the cross-member swung the tail off
     the bar. Handing the tail the far rim of the cross-member's own claw plate
     keeps the two claws on one line through that plate whatever the
     cross-member does. */
  function bodyHolder(B, f, azi, bendDeg, psi, opts){
    opts = opts || {};
    var sv = f*B.sb;
    // out of the host, toward us — opposite the gripper's own claw axis
    var dir = opts.frame ? [-opts.frame[0][2], -opts.frame[1][2], -opts.frame[2][2]]
                         : frameRadial(stationFrame(B, sv), azi);
    var Q = add(place(B, sv, 0, 0), dir, bodyStandoff());
    var r = poseDistal(Q, [-dir[0],-dir[1],-dir[2]], bendDeg, psi, opts);
    dockPair({R:r, s:r.sb + TOP_H}, {R:B, s:sv});
    return r;
  }

  /* A copy of a robot spun about the world z axis — the way to build a
     three-fold symmetric group without re-solving each member, so the three
     are exactly 120° apart rather than nearly. */
  function spunCopy(R, ang, c){
    var Rz = rotZ(ang), o = R.o;
    if(c){                                   // spin about a vertical through c
      var q = mul(Rz, [o[0]-c[0], o[1]-c[1], o[2]]);
      o = [q[0]+c[0], q[1]+c[1], q[2]];
    } else o = mul(Rz, o);
    return robot(o, matMul(Rz, R.M), R.bendDeg, R.psi,
                 {openTop:R.openTop, openBase:R.openBase, cabId:R.cabId, nmod:R.n,
                  clawOff:R.clawOff, baseClaw:R.baseClaw, baseOff:R.baseOff});
  }

  /* The lowest claw tip in a group — the floor a scene actually stands on. */
  function lowestTip(rs){
    var lo = Infinity;
    rs.forEach(function(R){
      [[R.sb+TOP_H, +1, R.openTop, R.clawOff],
       [-BASE_H,  -1, R.openBase, baseOffOf(R)]].forEach(function(c){
        for(var k=0;k<3;k++) lo = Math.min(lo, fingerLine(R, c[0], c[1], c[2], c[3], k).tip[2]);
      });
    });
    return lo;
  }

  /* A floor rectangle sized from the feet that actually stand on it, rather
     than from the ring the robots were placed on — an open base claw throws its
     fingertips a good way outside that ring, and the far one lands outside a
     plane measured any other way. */
  function floorFor(rs, margin){
    var mx = 0, my = 0;
    rs.forEach(function(R){
      [[R.sb+TOP_H, +1, R.openTop, R.clawOff],
       [-BASE_H,  -1, R.openBase, baseOffOf(R)]].forEach(function(c){
        for(var k=0;k<3;k++){
          var t = fingerLine(R, c[0], c[1], c[2], c[3], k).tip;
          mx = Math.max(mx, Math.abs(t[0])); my = Math.max(my, Math.abs(t[1]));
        }
      });
    });
    return { hx: mx + margin, hy: my + margin };
  }

  /* Lift a whole scene so its lowest claw tip rests on z = 0. */
  function restOnGround(rs, props){
    var lo = lowestTip(rs);
    rs.forEach(function(R){ R.o = [R.o[0], R.o[1], R.o[2] - lo]; });
    props.forEach(function(pr){
      if(pr.c) pr.c = [pr.c[0], pr.c[1], pr.c[2] - lo];
      if(pr.p) pr.p = [pr.p[0], pr.p[1], pr.p[2] - lo];
      if(pr.a) pr.a = [pr.a[0], pr.a[1], pr.a[2] - lo];
      if(pr.b) pr.b = [pr.b[0], pr.b[1], pr.b[2] - lo];
      if(pr.k === 'frame'){ pr.z0 -= lo; pr.z1 -= lo; }
      // the floor is the reference the scene is being dropped onto, so it is
      // the one thing that must not move with it
    });
    return -lo;
  }

  /* Dock a robot's closed base claw onto a station stub.
     The stub runs from p (on the bar) along dir for len; the claw's axis is the
     stub's own line, so the robot hangs off along dir, perpendicular to the bar
     the stub is mounted on. Same 3-to-1 grip as claw-on-claw: the stub sits on
     the claw axis and the three closed fingers surround it. */
  function dockToStub(pr, bendDeg, psi, opts){
    var cover = 0.80;                                  // of the stub, gripped
    var g = Math.max(0, C_FING - cover*pr.len);
    var plate = add(pr.p, pr.dir, pr.len + g);         // base-claw plate
    var R = robot(add(plate, pr.dir, BASE_H), aim(pr.dir, 0), bendDeg, psi, opts);
    R.openBase = 0;                                    // closed on the stub
    dockStation(R, -BASE_H, plate);
    return R;
  }
  // how far a stub-docked robot reaches from the bar, claw tip included
  function stubReach(len){
    return len + Math.max(0, C_FING - 0.80*len) + BASE_H + SB + TOP_H + CLAW_L;
  }

  /* Claw-to-body grip: a claw closed on another robot's spacer plate.
     A gripper grips closed, so the claw is at 0° and its three fingers form a
     28 mm cage lying along its own axis. The plate is only 2 mm thick, so its
     edge slots into that cage between the fingers — one finger on one face,
     two on the other. The claw therefore takes the plate by the rim rather
     than swallowing the whole 104 mm disc.

     How deep it can bite is set by the tensegrity, not by the plate: the
     lattice reaches LAT_R from the body axis, so the fingertips must stop
     outside that or they foul the struts rather than closing on the rim. The
     stand-off is therefore a full finger length plus the lattice envelope plus
     a clearance, which leaves a bite of (plate radius - LAT_R - clearance) on
     the rim. */
  var BODY_CLEAR = 6;                        // mm, fingertip past the lattice
  var BODY_PINCH = 4;                        // mm, fingertip off the claw axis

  /* Closing to 0° only brings the fingers parallel, still standing a pivot
     radius (14 mm) clear of a 2 mm plate — touching nothing. A gripper has to
     close past parallel, so the body grip runs at a small negative angle,
     enough to bring the fingertips in to a few mm of the claw axis and pinch
     the plate between them. Expressed as a fraction of the 45° range, so it
     stays correct if that range is corrected. */
  function bodyGripOpen(){
    return -Math.asin(Math.max(0, Math.min(1, (KN_R - u(BODY_PINCH))/C_FING))) / gripAngle(1);
  }
  function bodyStandoff(){
    return C_FING*Math.cos(gripAngle(bodyGripOpen())) + LAT_R + u(BODY_CLEAR);
  }

  /* One frame for every manipulation configuration, sized off how far a
     stub-docked robot reaches. Its width is what sets the clear space between
     two robots working toward each other, so that is the governing number and
     the depth and height follow it. */
  /* ---------------- adjustable frames and stations ----------------

     A framed config declares its box and the stations on it instead of writing
     coordinates down, so both can be driven from sliders. A station lives on
     one named cuboid edge and is placed by a fraction along it — which is why
     shrinking an edge can never push a station off the end. It can only crowd a
     station against its neighbour, and that is what the minimum gap guards.

     Each edge also knows which way a stub bolted to it points: perpendicular to
     the edge, into the box. Nothing here invents an edge the cuboid does not
     already have. */
  var EDGE = {
    topFront: { name:'front top edge', short:'Front',
                len:function(F){ return 2*F.hx; },
                pt:function(F,t){ return [(2*t-1)*F.hx, -F.hy, F.h]; },
                dir:function(){ return [0,0,-1]; } },
    topBack:  { name:'back top edge', short:'Back',
                len:function(F){ return 2*F.hx; },
                pt:function(F,t){ return [(2*t-1)*F.hx,  F.hy, F.h]; },
                dir:function(){ return [0,0,-1]; } },
    postL:    { name:'left front post', short:'Left post',
                len:function(F){ return F.h; },
                pt:function(F,t){ return [-F.hx, -F.hy, t*F.h]; },
                dir:function(){ return [ 1,0,0]; } },
    postR:    { name:'right front post', short:'Right post',
                len:function(F){ return F.h; },
                pt:function(F,t){ return [ F.hx, -F.hy, t*F.h]; },
                dir:function(){ return [-1,0,0]; } }
  };

  /* Two robots on one edge must not reach into each other, and a station on top
     of a corner has no bar to clamp round, so every edge owes its stations a
     module's width between them and half of one at each end. */
  var ST_GAP = MOD_R*2.4;
  var ST_END = MOD_R*1.3;

  /* The four-robot triad: its radius is forced by the grip chain (see hang4),
     and the frame depth with it, because the three stations have to land on the
     top edges. Computed here so the rig can pin the depth slider to it. */
  function hangTriad(){
    var th = MM.gripOpen, sigma = th*Math.PI/180, cover = 0.55;
    var lf = lframe(Math.PI, sigma/SB, SB + TOP_H);
    var Rr = KN_R + (-lf.p[0]) + (2 - cover)*C_FING*Math.sin(sigma);
    return { th:th, sigma:sigma, cover:cover, Rr:Rr, yc:-Rr/4, hy:0.75*Rr };
  }

  /* The bend that carries a hanging robot's claw a given distance in from its
     own base axis. The forward direction is SB·(1-cos θ)/θ for the arc plus
     TOP_H·sin θ for the straight run past it, which is monotonic but does not
     invert in closed form, so this bisects. Lets a config set where a claw has
     to arrive and let the bend follow, instead of fixing the bend and living
     with wherever the claw lands. */
  function bendForReach(r){
    var lo = 0, hi = 170;
    for(var i=0;i<40;i++){
      var m = (lo + hi)/2;
      if(-lframe(Math.PI, (m*Math.PI/180)/SB, SB + TOP_H).p[0] < r) lo = m; else hi = m;
    }
    return (lo + hi)/2;
  }

  var RIG = {};                               // frame slider state, per morphology
  var CAB = {};                               // cable overrides, per morphology
  function rigState(key){
    var spec = MORPHS[key].frame;
    if(!spec) return null;
    if(!RIG[key]){
      var d0 = spec.rig0 || {};
      RIG[key] = { w: d0.w || 1, d: d0.d || 1, h: d0.h || 1,
                   t: spec.stations.map(function(s){ return s.t; }) };
    }
    return RIG[key];
  }

  /* Turn the slider state into a box and three-dimensional station points,
     refusing anything the geometry will not take and saying what it moved.

     Two different protections are needed, because there are two kinds of
     station. Ones the user drives are pushed apart to the minimum gap, nearest
     neighbour first, and if the edge is too short for all of them they are
     spread evenly across what there is. Ones the config computes — the
     four-robot triad, whose spacing is not a preference — cannot be moved at
     all, so there it is the frame that gives way: the width is clamped up until
     they fit. */
  function resolveRig(key){
    var spec = MORPHS[key].frame, R = rigState(key), base = station();
    var F = { hx: base.hx*R.w, hy: base.hy*R.d, h: base.barZ*R.h, L: base.L };
    var notes = [];
    if(spec.depth){ F.hy = spec.depth(); }
    if(spec.minHalfWidth){
      var need = spec.minHalfWidth();
      if(F.hx < need){ F.hx = need; notes.push('width held at its minimum — the triad spacing is fixed'); }
    }
    var ts = R.t.slice();
    if(spec.link) ts = spec.link(F, ts);

    var byEdge = {};
    spec.stations.forEach(function(s,i){ (byEdge[s.edge] = byEdge[s.edge] || []).push(i); });
    Object.keys(byEdge).forEach(function(e){
      var idx = byEdge[e], len = EDGE[e].len(F), n = idx.length;
      if(n < 2 || spec.stations[idx[0]].fixed) return;
      idx.sort(function(a,b){ return ts[a] - ts[b]; });
      var pos = idx.map(function(i){ return ts[i]*len; });
      if(len < 2*ST_END + (n-1)*ST_GAP){
        // the edge cannot hold them all: share out what there is, evenly
        var lo = Math.min(ST_END, len/2), span = Math.max(0, len - 2*lo);
        for(var k=0;k<n;k++) pos[k] = lo + span*(n===1?0.5:k/(n-1));
        notes.push(EDGE[e].name + ' is too short for ' + n + ' stations — spaced as far apart as it allows');
      } else {
        for(var k=0;k<n;k++) pos[k] = Math.max(pos[k], (k===0 ? ST_END : pos[k-1] + ST_GAP));
        for(var k=n-1;k>=0;k--) pos[k] = Math.min(pos[k], (k===n-1 ? len - ST_END : pos[k+1] - ST_GAP));
      }
      idx.forEach(function(i,k){ ts[i] = pos[k]/len; });
    });

    return { F:F, notes:notes, t:ts,
             st: spec.stations.map(function(s,i){
               return { k:'stub', p: EDGE[s.edge].pt(F, ts[i]),
                        dir: EDGE[s.edge].dir(F), len: F.L, edge:s.edge };
             }) };
  }

  function station(){
    var L = u(MM.stubLen), reach = stubReach(L), clear = reach*0.46;
    return { L:L, reach:reach, clear:clear,
             hx: reach + clear/2, hy: reach*0.42, barZ: reach*1.08 };
  }

  /* One finger of a claw, as a line in world space. drawClaw draws from this
     and the morphologies aim from it, so a pose built against a finger can
     never drift from the finger that gets drawn. */
  function fingerLine(R, s, dir, open, off, k){
    var al = gripAngle(open);
    var ang = off + k*2*Math.PI/3, ca = Math.cos(ang), sa = Math.sin(ang);
    var root = place(R, s, KN_R*ca, KN_R*sa);
    var rt = KN_R + C_FING*Math.sin(al), zt = C_FING*Math.cos(al);
    var tip = place(R, s + dir*zt, rt*ca, rt*sa);
    return { root:root, tip:tip,
             dir: norm([tip[0]-root[0], tip[1]-root[1], tip[2]-root[2]]) };
  }
  // Stand-off that lands three inward-bending claws on a sphere of radius r.
  // Returns the base ring radius and the sphere centre height.
  function graspRing(bendDeg, open, r){
    var f = lframe(Math.PI, (bendDeg*Math.PI/180)/SB, SB + TOP_H + fingerAxialReach(open));
    return { Rr: -f.p[0] + r*0.90, z: f.p[2] };
  }

  /* A spine with both claws spread, two legs clamped by 3-to-1 docks on the
     two lowest fingers of each claw, and optionally a trunk on the front
     claw's remaining finger. Legs and trunk are placed by their clamped claw
     and bent so the feet share one floor and the trunk curls forward. */
  /* Standing feet: the base claw splayed nearly flat, as the robots stand in
     the studio photographs (about 85 degrees from the body axis). */
  var FOOT_OPEN = 85/MM.gripOpen;
  function walker(trunk){
    var spread = 1, cover = 0.55, best = null;
    function fingers(R, end){
      return [0,1,2].map(function(k){
        return { k:k, f: end > 0 ? fingerLine(R, R.sb + TOP_H, +1, R.openTop, R.clawOff, k)
                                 : fingerLine(R, -BASE_H, -1, R.openBase, baseOffOf(R), k) };
      }).sort(function(a, b){ return a.f.dir[2] - b.f.dir[2]; });
    }
    for(var ci=0; ci<24; ci++) for(var bi=0; bi<6; bi++){
      var co = ci*Math.PI/12, bo = bi*Math.PI/3;
      var a0 = robot([0,0,0], aim(norm([1,0,0]),0), 0, 0, {openTop:spread, openBase:spread, clawOff:co, baseOff:bo, cabId:0});
      var t = fingers(a0, +1), b = fingers(a0, -1);
      // two fingers low and level with each other at each end; prefer the
      // standard claw mounting when it works
      var sc = -(t[0].f.dir[2] + t[1].f.dir[2] + b[0].f.dir[2] + b[1].f.dir[2])
               - 3*(Math.abs(t[0].f.dir[2]-t[1].f.dir[2]) + Math.abs(b[0].f.dir[2]-b[1].f.dir[2]))
               - (bi === 1 ? 0 : 0.01);
      if(!best || sc > best.sc) best = {sc:sc, co:co, bo:bo};
    }
    var a = robot([0,0,0], aim(norm([1,0,0]),0), 0, 0, {openTop:spread, openBase:spread, clawOff:best.co, baseOff:best.bo, cabId:0, name:'spine'});
    var Zg = -1.2*a.sb, rs = [a], id = 1;
    function clampOn(end, fk, score){
      var f = fk.f, plate = add(f.tip, f.dir, C_FING*(1 - cover)), back = [-f.dir[0],-f.dir[1],-f.dir[2]], bb = null;
      for(var bd=0; bd<=160; bd+=10) for(var j=0;j<24;j++){
        var psi = j*Math.PI/12;
        var r = poseDistal(plate, back, bd, psi, {openTop:0, openBase:FOOT_OPEN, clawOff:0, cabId:id});
        var sc = score(r, bd);
        if(!bb || sc > bb.sc) bb = {sc:sc, bd:bd, psi:psi};
      }
      var g = poseDistal(plate, back, bb.bd, bb.psi, {openTop:0, openBase:FOOT_OPEN, clawOff:0, cabId:id, name: score.nm});
      dockFinger(g, a, end, fk.k); id++;
      return g;
    }
    function legScore(r, bd){
      var ft = place(r, -BASE_H, 0, 0), e = endPose(r, -1);
      // feet planted: the leg's last stretch vertical so the splayed claw lies flat
      return -Math.abs(ft[2] - Zg)*4 + (-e.T[2])*14 + 0.05*Math.abs(ft[1]) - bd*0.002;
    }
    legScore.nm = 'leg';
    [+1, -1].forEach(function(end){
      var fs = fingers(a, end);
      rs.push(clampOn(end, fs[0], legScore));
      rs.push(clampOn(end, fs[1], legScore));
    });
    if(trunk){
      /* The trunk is clamped by its own base claw, so it is placed from that
         end: the base plate sits where the finger is gripped, the body runs on
         out along the finger, and its free top claw is the tip of the trunk. */
      var up = fingers(a, +1)[2], f = up.f, d = f.dir, tb = null;
      var plate = add(f.tip, d, C_FING*(1 - cover));
      function trunkAt(bd, psi, roll, nm){
        return robot(add(plate, d, BASE_H), aim(d, roll), bd, psi,
                     {openTop:0.45, openBase:0, clawOff:0, cabId:id, name:nm});
      }
      for(var bd=0; bd<=180; bd+=10) for(var j=0;j<24;j++){
        var r = trunkAt(bd, j*Math.PI/12, 0);
        var tip = place(r, r.sb + TOP_H, 0, 0), mid = place(r, r.sb*0.5, 0, 0);
        var sc = tip[0]*0.6 + mid[2]*0.8 - Math.abs(tip[1])*2 - Math.abs(tip[2] - Zg*0.7)*1.2 - bd*0.002;
        if(!tb || sc > tb.sc) tb = {sc:sc, bd:bd, psi:j*Math.PI/12};
      }
      var tr = trunkAt(tb.bd, tb.psi, 0, 'trunk');
      DOCKS.push({ claw:{R:tr, s:-BASE_H}, finger:{R:a, end:+1, k:up.k} });
      rs.push(tr); id++;
    }
    CAB_N = rs.length;
    var c = place(a, a.sb/2, 0, 0);
    rs.forEach(function(R){ R.o = [R.o[0]-c[0], R.o[1]-c[1], R.o[2]]; });
    var fl = floorFor(rs, MOD_R*2);
    restOnGround(rs, []);
    return { robots:rs, props:[{k:'ground', z:0, hx:fl.hx, hy:fl.hy}],
             tag: trunk ? 'Conceptual — an elephant: spine, four legs and a trunk on 3-to-1 docks'
                        : 'Conceptual — two Ys on one spine, standing on four legs' };
  }

  var MORPHS = {
    s1: {
      desc:'A single tensegrity module between two claw-bearing ends — the shortest TeCoBot that can still grip at both ends. One module bends the least for a given cable pull but carries the most load, so it stands in where stiffness matters more than reach.',
      label:'One module',
      cam:{az:0, el:0.13},
      conn:'\u2014',
      build:function(){
        var r = robot([0,0,0], I3, 6, 0,
                      {openTop:0.60, openBase:0.92, clawOff:Math.PI/6, nmod:1});
        return { robots:[r], props:[],
                 tag:'Single TeCoBot \u2014 one tensegrity module, a claw at each end' };
      }
    },
    s2: {
      desc:'Two modules. Doubling the stack doubles the arc length a given curvature acts over, so the same cable pull turns the tip through twice the angle. This is the first height at which the body reads as a continuum rather than as a joint.',
      label:'Two modules',
      cam:{az:0, el:0.13},
      conn:'\u2014',
      build:function(){
        var r = robot([0,0,0], I3, 12, 0,
                      {openTop:0.60, openBase:0.92, clawOff:Math.PI/6, nmod:2});
        return { robots:[r], props:[],
                 tag:'Single TeCoBot \u2014 two tensegrity modules, a claw at each end' };
      }
    },
    s3: {
      desc:'Three modules — enough length for the tip to curl back past the body\'s own base, which is what a grasp from an awkward approach, or a dock onto a robot alongside it, needs.',
      label:'Three modules',
      cam:{az:0, el:0.13},
      conn:'\u2014',
      build:function(){
        var r = robot([0,0,0], I3, 18, 0,
                      {openTop:0.60, openBase:0.92, clawOff:Math.PI/6, nmod:3});
        return { robots:[r], props:[],
                 tag:'Single TeCoBot \u2014 three tensegrity modules, a claw at each end' };
      }
    },
    s4: {
      desc:'Four modules: the build the paper characterises. Four is where reach, curvature and load balance — long enough to wrap a payload or cross a frame, stiff enough to hold a second robot off one claw.',
      label:'Four modules',
      cam:{az:0, el:0.13},
      conn:'\u2014',
      build:function(){
        var r = robot([0,0,0], I3, 24, 0,
                      {openTop:0.60, openBase:0.92, clawOff:Math.PI/6, nmod:4});
        return { robots:[r], props:[],
                 tag:'Single TeCoBot \u2014 four tensegrity modules, a claw at each end' };
      }
    },
    s5: {
      desc:'Five modules, the tallest stack still worth driving from one set of cables. Past this the tip droops under its own weight faster than the extra arc length buys reach.',
      label:'Five modules',
      cam:{az:0, el:0.13},
      conn:'\u2014',
      build:function(){
        var r = robot([0,0,0], I3, 26, 0,
                      {openTop:0.60, openBase:0.92, clawOff:Math.PI/6, nmod:5});
        return { robots:[r], props:[],
                 tag:'Single TeCoBot \u2014 five tensegrity modules, a claw at each end' };
      }
    },
    body: {
      cabAll:false, cabOnly:[1],
      desc:'A closed claw clamped on the rim of another robot\'s spacer plate. This is the dock that attaches a robot anywhere along another\'s length instead of only at its ends, and it is what makes the planar morphologies — H, O-, H- — possible at all.',
      label:'Claw-to-body — gripping another robot’s plate',
      cam:{az:-0.40, el:0.20},
      conn:'claw–body ×1',
      build:function(){
        /* The gripped robot is rolled 60° about its own long axis. Left
           upright, one of its three actuation cables runs along the very top
           of the body at a 47 mm radius and passes straight through where a
           closed finger sits; a 60° roll puts every cable clear. */
        var D = bodyStandoff(), zh = MOD_R;
        var a = robot([-SB/2, 0, zh], aim(norm([1,0,0]), Math.PI/3), 0, Math.PI/2,
                      {openTop:0.40, openBase:0.40, clawOff:Math.PI/6});
        var P = place(a, a.sb/2, 0, 0);               // its middle spacer plate
        var b = robot([P[0], P[1], P[2] + D + BASE_H], I3, 30, Math.PI/2,
                      {openTop:0.55, openBase:bodyGripOpen(), clawOff:0});
        dockPair({R:b, s:-BASE_H}, {R:a, s:a.sb/2});
        return { robots:[a,b], props:[],
                 tag:'Claw-to-body — a closed claw clamped on another robot’s middle plate or tensegrity modules' };
      }
    },
    dock33: {
      cabAll:false,
      desc:'Two claws closed into each other, every finger landing in the valley between two of the other\'s. Six fingers interleaved at 60° carry moment in any direction, which is what lets a chain of docked robots cantilever instead of hinging.',
      label:'Docking 3-to-3 — three fingers into three',
      cam:{az:0, el:0.10},
      zoom:2.6,
      conn:'claw–claw, symmetric',
      build:function(){
        /* Built as a chain rather than as two robots written down facing each
           other. Placed by absolute coordinates the dock came apart the moment
           either body changed shape, because both claw plates were put where a
           nominal four-module body would have left them. Chained, the second
           robot hangs off the first's actual claw, and its own shape only
           pivots it about the plate it is docked to. */
        var a = robot([-(SB + TOP_H + DOCK_GAP/2), 0, BASE_R], aim(norm([1,0,0]), 0), 0, 0,
                      {openTop:0, openBase:0.9, clawOff:Math.PI/6});
        var b = chain(a, 0, 0, {openTop:0, openBase:0, clawOff:Math.PI/6});
        b.openBase = 0; b.openTop = 0;
        return { robots:[a,b], props:[],
                 tag:'3-to-3 — six fingers interlocked' };
      }
    },
    dock31: {
      cabAll:false,
      desc:'One claw spread open, the other closed around a single one of its fingers. The two bodies meet at an angle rather than end to end, and that is how a branch is built — three robots gripping three fingers of a fourth.',
      label:'Docking 3-to-1 — one claw spread, one closed',
      cam:{az:0, el:0.12},
      zoom:1.45,
      conn:'claw–claw, asymmetric',
      build:function(){
        /* Asymmetric dock, as the hardware does it: one claw spreads its three
           fingers, the other stays closed and clamps a single one of them.
           The closed claw's axis is the gripped finger's own line, not the open
           robot's body axis, which is why the two bodies finish at an angle to
           each other. That angle is not posed — it follows from how far the
           open claw is spread. */
        var spread = 0.80, cover = 0.55;

        // the spread claw, body along +x
        var a = robot([0,0,0], aim(norm([1,0,0]), 0), 0, 0,
                      {openTop:spread, openBase:0.9, clawOff:Math.PI/2});

        // take the finger that gets gripped and aim the closed claw along it
        var f = fingerLine(a, a.sb + TOP_H, +1, spread, a.clawOff, 0);
        var back  = [-f.dir[0], -f.dir[1], -f.dir[2]];        // closed claw's +z
        var plate = add(f.tip, f.dir, C_FING*(1 - cover));    // sits clear of the tip
        /* Placed by its claw rather than by its base: the claw is the end that
           has to stay on the finger, and positioning from the base put the
           plate wherever a nominal four-module body happened to end, so the
           dock parted as soon as this robot's own shape changed. */
        var b = poseDistal(plate, back, 0, 0, {openTop:0, openBase:0.9, clawOff:0});
        dockPair({R:b, s:b.sb + TOP_H}, {R:a, s:a.sb + TOP_H});

        return { robots:[a,b], props:[],
                 tag:'3-to-1 — one claw spread, the other closed on a single finger' };
      }
    },
    lift: {
      cab:false,
      desc:'Three robots standing on their base claws, bending inward to carry a 200 mm sphere between their top claws. No single claw spans the payload: the grasp exists only as a property of the group, and is lost the moment one member lets go.',
      label:'Three standing, lifting a ball',
      cam:{az:0, el:0.30},
      conn:'claw–object ×3',
      build:function(){
        var bend = 62, open = 0.5, rs = [];
        var g = graspRing(bend, open, BALL_R);
        for(var k=0;k<3;k++){
          var a = k*2*Math.PI/3 + Math.PI/2;
          var o = [g.Rr*Math.cos(a), g.Rr*Math.sin(a), 0];
          // local axes follow the ring, so psi = pi always bends toward the centre
          rs.push(robot(o, rotZ(a), bend, Math.PI, {openTop:open, openBase:1, clawOff:Math.PI/6}));
        }
        /* The ball goes where the claws actually are rather than where the
           nominal bend said they would be, so it stays in their grip when the
           cables move them. The three claws are symmetric about the group's
           axis, so the centroid of the nine fingertips sits on that axis and in
           the middle of the grasp, which is where the ball's centre belongs. */
        var bx=0, by=0, bz=0;
        rs.forEach(function(R){ for(var k=0;k<3;k++){
          var t = fingerLine(R, R.sb+TOP_H, +1, R.openTop, R.clawOff, k).tip;
          bx += t[0]/9; by += t[1]/9; bz += t[2]/9;
        } });
        var fl = floorFor(rs, MOD_R*1.9);       // the three feet, plus a margin
        var props = [{k:'ball', c:[bx,by,bz], r:BALL_R},
                     {k:'ground', z:0, hx:fl.hx, hy:fl.hy}];
        // drop the group so the base-claw tips land exactly on the floor
        restOnGround(rs, props);
        return { robots:rs, props:props,
                 tag:'Cooperative lift — three robots standing on the floor, holding one 200 mm ball' };
      }
    },
    M1: {
      desc:'Three robots hung from docking stations on the frame\'s top edges, each bending in toward the others. The anchors are fixed and all of the reaching is done by the bodies, so a shared workspace forms under the frame wherever the three choose to meet.',
      label:'M1 — three docked vertically on the frame',
      cam:{az:0, el:0.21},
      conn:'claw–station ×3',
      // the frame and pose this configuration is set up with
      frame:{ rig0:{ d:1.16 },
              stations:[ {edge:'topFront', t:0.34}, {edge:'topFront', t:0.66},
                         {edge:'topBack',  t:0.50} ] },
      cab0:[ [109, 23, 80], [-1, 17, 92], [27, 78, -19] ],
      build:function(rig){
        /* Three robots hang from stubs on the frame's own top edges — two on
           the front, one on the back — each closed on a stub pointing straight
           down, so each body runs perpendicular to the edge it hangs from.

           Each robot keeps its own pose wherever its station is put and
           whatever size the frame is. An earlier version re-solved the bend from
           the distance to the other two, so that sliding a station re-posed its
           robot; holding the pose is what makes the stations and the cables
           independent controls. Nothing checks for collision, so a robot can be
           driven into its neighbour — that is the user's business, not the
           renderer's. */
        var F = rig.F, st = rig.st, open = 0.5;
        var rs = [], props = [{k:'frame', hx:F.hx, hy:F.hy, z0:0, z1:F.h}];
        st.forEach(function(q){
          props.push(q);
          rs.push(dockToStub(q, 40, 0, {openTop:open, clawOff:Math.PI/6}));
        });
        return { robots:rs, props:props,
                 tag:'M1 — three robots hanging from docking stations on the frame\u2019s top edges' };
      }
    },
    M2: {
      desc:'Two robots hanging vertically from opposite top edges and one reaching horizontally off a front post. Approaching one volume from three directions at once lets the group hold and reorient an object that no single arm could turn.',
      label:'M2 — two vertical, one horizontal',
      cam:{az:0, el:0.17},
      conn:'claw–station ×3',
      frame:{ stations:[ {edge:'topBack',  t:0.50},
                         {edge:'topFront', t:0.28},
                         {edge:'postR',    t:0.09} ] },
      build:function(rig){
        /* M3's frame and M3's anchors, with the left-hand ground robot lifted
           onto the front top edge so that it hangs vertically instead: two
           vertical robots working the same volume from opposite faces, one
           horizontal robot anchored low on the far post. */
        var F = rig.F, st = rig.st;
        var props = [{k:'frame', hx:F.hx, hy:F.hy, z0:0, z1:F.h}].concat(st);
        var rs = [ dockToStub(st[0], 12, 0,           {openTop:0.5, clawOff:0}),
                   dockToStub(st[1], 26, Math.PI/2,   {openTop:0.5, clawOff:0}),
                   dockToStub(st[2], 14, Math.PI/2,   {openTop:0.6, clawOff:Math.PI/6}) ];
        return { robots:rs, props:props,
                 tag:'M2 — two vertical robots and one horizontal on the same frame' };
      }
    },
    hang4: {
      cabOnly:[3], cabAll:false,
      desc:'Three robots hanging from the frame, each closing on one finger of a fourth robot\'s spread claw. The fourth is carried entirely by those 3-to-1 docks — a branching joint whose payload is a whole robot.',
      label:'Four robots — three holding one by its claw',
      cam:{az:0, el:0.17},
      conn:'claw–station ×3, claw–claw 3-to-1 ×3',
      frame:{
        /* The three stations are the triad, so none of them is a preference:
           one slider slides the whole group along the edges, the other two
           follow it, and the depth is not offered at all. */
        stations:[ {edge:'topBack',  t:0.50, slider:'group'},
                   {edge:'topFront', t:0.50, fixed:true},
                   {edge:'topFront', t:0.50, fixed:true} ],
        depth:function(){ return hangTriad().hy; },
        minHalfWidth:function(){ return hangTriad().Rr*Math.cos(Math.PI/6) + ST_END; },
        link:function(F, ts){
          var T = hangTriad(), dx = T.Rr*Math.cos(Math.PI/6)/(2*F.hx);
          var c = Math.min(1 - dx, Math.max(dx, ts[0]));
          return [c, c - dx, c + dx];
        }
      },
      build:function(rig){
        /* Three robots hang from stubs on the frame's top edges and close on
           the three fingers of a fourth robot's spread claw — the asymmetric
           dock repeated about a common axis. Same hardware as M1: the stubs
           point straight down, perpendicular to the edges they are bolted to,
           and all the reaching is done by bending the three robots inward.

           That makes the spread angle equal to the bend. A robot hanging from
           a vertical stub has a vertical base axis, so its claw axis is tilted
           from vertical by exactly its bend, and the finger it grips has to
           leave the held claw at that same angle or the two are not collinear.
           Both are therefore set to the hinge limit, which is what makes the
           triad as wide as it can be; its radius follows from the grip chain,
           a finger root at KN_R plus the robot's own inward travel plus the
           finger run.

           The frame then only has to touch those three stubs. With one finger
           at azimuth 90° landing on the back top edge and the other two on the
           front top edge, the box runs from +Rr to −Rr/2 in y, so its depth is
           forced at 1.5·Rr — but its width is free. The triad sits a quarter of
           Rr forward of the box centre, which is what brings those two front
           stubs onto the front edge instead of inside the face. */
        var F = rig.F, st = rig.st, T = hangTriad();
        var cx = st[0].p[0];                     // the triad centre follows the slider
        var props = [st[0], st[1], st[2]];
        /* One robot, and two exact copies of it spun about the group's own
           axis. Built independently the three could be driven apart — moving
           one would take its claw off the fourth robot's finger while the other
           two stayed put — and a symmetric grasp is not three poses anyway. As
           copies they share a single set of cables, so the grasp survives
           anything the sliders do to it. */
        var r0 = dockToStub(st[0], T.th, -Math.PI/2 - Math.PI/2, {openTop:0, clawOff:Math.PI/6});
        var ctr = [cx, T.yc];
        var rs = [r0, spunCopy(r0, 2*Math.PI/3, ctr), spunCopy(r0, 4*Math.PI/3, ctr)];
        /* The held claw is solved from where the gripping claws have actually
           ended up, rather than read off the first one's height and left there.

           A gripping claw's plate has to lie on the finger it is closed on. The
           finger leaves the held claw's knuckle circle at KN_R and runs
           (2 - cover)·C_FING to that plate, so the plate's radius about the
           triad's axis fixes the spread outright, and the spread then fixes how
           far below the plate the held claw sits. Two unknowns, two
           measurements, no search. Before this the held robot kept its nominal
           spread and only followed the claws' height, so any cable on the triad
           walked the other two grips off their fingers. */
        var d0 = distal(rs[0]), axis = [cx, T.yc];
        var reach = (2 - T.cover)*C_FING;
        var rho = Math.hypot(d0.p[0] - axis[0], d0.p[1] - axis[1]);
        var sig = Math.asin(Math.max(0, Math.min(1, (rho - KN_R)/reach)));
        var root = [axis[0], axis[1], d0.p[2] - reach*Math.cos(sig)];
        // psi quoted in the claw's material frame, which is where the twist of
        // a distally placed robot is now measured from
        var held = poseDistal(root, [0,0,1], 26, 285*Math.PI/180,
                              {openTop: Math.max(0, Math.min(1, sig/(MM.gripOpen*Math.PI/180))),
                               openBase:0.85, clawOff:Math.PI/6});
        /* Spin it about its own claw so that one finger meets the back stub,
           then carry it out to the triad centre. The spin has to happen first:
           spunCopy turns about the world axis, which is only the claw's own
           axis while the robot is still sitting on it. */
        /* Spun so that finger 0 points at gripping claw 0; the other two follow
           from the triad's own symmetry. */
        var f0 = fingerLine(held, held.sb + TOP_H, +1, held.openTop, held.clawOff, 0).root;
        held = spunCopy(held,
          Math.atan2(d0.p[1] - axis[1], d0.p[0] - axis[0]) -
          Math.atan2(f0[1] - axis[1], f0[0] - axis[0]), axis);
        rs.push(held);
        for(var q=0; q<3; q++) dockFinger(rs[q], held, +1, q);
        window.__hang4 = { halfWidth:Math.round(F.hx*UNIT), halfDepth:Math.round(F.hy*UNIT),
                           triadRadius:Math.round(T.Rr*UNIT), stub:Math.round(F.L*UNIT),
                           bend:T.th, spread:T.th };
        /* Only the height is this config's own, and it clears the hanging group
           by a module width. */
        props.push({k:'frame', hx:F.hx, hy:F.hy, z0:lowestTip(rs) - MOD_R*1.6, z1:F.h});
        return { robots:rs, props:props,
                 tag:'Four robots — three hanging from the frame hold a fourth by its spread claw' };
      }
    },
    stand4: {
      cabOnly:[3], cabAll:false,
      desc:'The same branch inverted: three robots standing on the floor, arching inward to hold a fourth upright between them. A group assembling a structure taller than any of its members, out of nothing but its members.',
      label:'Four robots — three standing, balancing one upright',
      cam:{az:0, el:0.26},
      conn:'claw–claw 3-to-1 ×3',
      build:function(){
        /* The inverse: three robots stand on their own base claws, arch
           inward and close on the three fingers of a fourth robot's spread
           base claw, holding it upright. Same forced relation — spread angle
           equals bend — because a standing robot's base axis is vertical too. */
        var th = 40, open4 = th/MM.gripOpen, cover = 0.55;
        var lf = lframe(Math.PI, (th*Math.PI/180)/SB, SB + TOP_H);
        var Rr = KN_R + (-lf.p[0]) + (2 - cover)*C_FING*Math.sin(th*Math.PI/180);
        /* One robot and two copies spun about the group's axis, for the same
           reason as the hanging version: a symmetric grasp is one pose, and
           three independent ones can be driven apart. */
        var a0 = Math.PI/2;
        var r0 = robot([Rr*Math.cos(a0), Rr*Math.sin(a0), 0], rotZ(a0), th, Math.PI,
                       {openTop:0, openBase:1, clawOff:Math.PI/6});
        var rs = [r0, spunCopy(r0, 2*Math.PI/3), spunCopy(r0, 4*Math.PI/3)];
        /* The held robot's spread claw is solved from where the gripping claws
           have actually ended up, exactly as in the hanging version: the plate's
           radius about the group's axis fixes the spread, and the spread fixes
           how far above it the held claw sits. */
        var d0 = distal(rs[0]);
        var reach = (2 - cover)*C_FING;
        var rho = Math.hypot(d0.p[0], d0.p[1]);
        var sig = Math.asin(Math.max(0, Math.min(1, (rho - KN_R)/reach)));
        var zb = d0.p[2] + reach*Math.cos(sig);
        var up0 = robot([0, 0, zb + BASE_H], I3, 22, Math.PI/2,
                        {openTop:0.5, clawOff:Math.PI/6,
                         openBase: Math.max(0, Math.min(1, sig/(MM.gripOpen*Math.PI/180)))});
        var g0 = fingerLine(up0, -BASE_H, -1, up0.openBase, baseOffOf(up0), 0).root;
        var up = spunCopy(up0, Math.atan2(d0.p[1], d0.p[0]) - Math.atan2(g0[1], g0[0]));
        rs.push(up);
        for(var q=0; q<3; q++) dockFinger(rs[q], up, -1, q);
        var fl = floorFor(rs, MOD_R*1.9);       // the three feet, plus a margin
        var props = [{k:'ground', z:0, hx:fl.hx, hy:fl.hy}];
        restOnGround(rs, props);
        return { robots:rs, props:props,
                 tag:'Three robots standing on the floor, holding a fourth upright 3-to-1' };
      }
    },
    H1: {
      desc:'The H with a fourth robot docked claw-to-body on one stroke, reaching out along the bar — H-, or a lizard: four legs and a tail. The H gives the stance and the tail gives the steering, by moving the group\'s centre of mass off the rolling axis.',
      label:'Lizard — H plus a trailing robot (H-)',
      cam:{az:0, el:1.05},
      conn:'claw–body ×3',
      build:function(){
        /* The H of L3 turned so its two strokes run up the page, with a fourth
           robot docked claw-to-body on the right-hand stroke and reaching out
           along the bar's direction — literally H-.

           The chain of dependence runs cross-member, then the two strokes it
           holds, then the tail on the right-hand one, each perpendicular to
           whatever it is docked to. Bend any of them and everything downstream
           of it follows. The tail takes the same plate as the cross-member, so
           the bar of the H and the hyphen stay one straight line; the two claws
           sit on opposite rims of that one disc. */
        var cross = robot([0, 0, MOD_R], aim(norm([1,0,0]), 0), 0, 0,
                          {openTop:bodyGripOpen(), openBase:bodyGripOpen(),
                           clawOff:0, name:'cross-member'});
        var left  = bodyHeld(cross, -1, 0.5, 0, Math.PI/3, 0, Math.PI/2,
                             {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, name:'left stroke'});
        var right = bodyHeld(cross, +1, 0.5, 0, Math.PI/3, 0, Math.PI/2,
                             {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, name:'right stroke'});
        /* The tail closes on the far rim of the very plate the cross-member
           holds, so its claw frame is the cross-member's claw frame turned to
           face back. That keeps the two claws on one line through the shared
           plate — the bar and the hyphen of the H- — however the cross-member
           is driven, instead of at a fixed azimuth about the stroke, which the
           stroke carried away with it. */
        var tail  = bodyHolder(right, 0.5, 0, 0, 0,
                               {frame:opposed(endFrame(cross, +1)),
                                openTop:bodyGripOpen(), openBase:0.35, clawOff:0, name:'tail'});
        return { robots:[cross, left, right, tail], props:[],
                 tag:'Lizard (H-) — the H with a fourth robot trailing on a claw-to-body grip' };
      }
    },
    M3: {
      desc:'One robot hangs from the back top edge while two more, anchored low on the front posts, lie along the ground. The two ground robots brace and position the workpiece; the vertical one works on it.',
      label:'M3 — one vertical, two horizontal',
      cam:{az:0, el:0.17},
      conn:'claw–station ×3',
      frame:{ stations:[ {edge:'topBack', t:0.50},
                         {edge:'postL',   t:0.09},
                         {edge:'postR',   t:0.09} ] },
      build:function(rig){
        /* One robot hangs from a stub on the back top edge; two more are docked
           to stubs on the front posts and lie along the ground. The frame's
           width is what sets the clear space between those two. All three dock
           to the cuboid's own edges — nothing is added to it. */
        var F = rig.F, st = rig.st;
        var props = [{k:'frame', hx:F.hx, hy:F.hy, z0:0, z1:F.h}].concat(st);
        var rs = [ dockToStub(st[0], 10, 0, {openTop:0.5, clawOff:0}),
                   dockToStub(st[1], 14, -Math.PI/2, {openTop:0.6, clawOff:Math.PI/6}),
                   dockToStub(st[2], 14,  Math.PI/2, {openTop:0.6, clawOff:Math.PI/6}) ];
        return { robots:rs, props:props,
                 tag:'M3 — two ground robots anchor from the posts while the vertical robot works' };
      }
    },
    M4: {
      desc:'Three robots docked claw to claw into a serial chain, the root clamped to the frame. Every dock adds its own curvature, so the chain reaches well past the frame and around obstacles a single robot cannot clear.',
      label:'M4 — three in series, extended reach',
      cam:{az:-0.34, el:0.20},
      conn:'claw–station ×1, claw–claw ×2',
      frame:{ stations:[ {edge:'topBack', t:0.50} ] },
      build:function(rig){
        /* The chain is anchored: the root robot's closed base claw grips a stub
           on the back top edge, so the arm cantilevers down and forward out of
           the open front face rather than sideways through the posts. */
        var F = rig.F, st = rig.st[0];
        var a = dockToStub(st, 52, Math.PI, {openTop:0, clawOff:Math.PI/6});
        var b = chain(a, 44, Math.PI, {openTop:0, openBase:0});
        var c = chain(b, 34, Math.PI, {openTop:0.62, openBase:0.15});
        return { robots:[a,b,c],
                 props:[{k:'frame', hx:F.hx, hy:F.hy, z0:0, z1:F.h}, st],
                 tag:'M4 — serial chain anchored to the frame, reaching past a single robot' };
      }
    },
    L1: {
      desc:'Three robots docked in a line along the ground. Extending and contracting the stacks in sequence, with the end claws anchoring in turn, inches the whole chain forward — peristaltic crawling, with no wheels and no feet.',
      label:'L1 — Snake: serial chain on the ground (---)',
      cam:{az:-0.38, el:0.26},
      conn:'claw–claw ×2',
      build:function(){
        var d = norm([1,0,0]);
        var a = robot([-(SB+TOP_H+CLAW_L)*1.15, 0, BASE_R], aim(d,0), 14, Math.PI/2, {openTop:0.15, openBase:0.55, clawOff:Math.PI/6});
        /* Bending directions are quoted in the parent's claw frame, which no
           longer carries the parent's own psi, so each link down the chain
           states the full angle rather than inheriting part of it. */
        var b = chain(a, -10, Math.PI, {openTop:0, openBase:0});
        var c = chain(b, 14, 3*Math.PI/2, {openTop:0.55, openBase:0.15});
        return { robots:[a,b,c], props:[], tag:'L1 (snake) — anchored extension–contraction along a straight chain' };
      }
    },
    L3: {
      desc:'Two parallel robots joined by a cross-member gripping a middle spacer plate on each — an H. The spacing between the strokes is not a choice: it is the cross-member\'s own length plus the two grip stand-offs.',
      label:'L3 — H-shape, two parallel plus a central robot',
      cam:{az:0, el:0.92},
      conn:'claw–body ×2',
      build:function(){
        /* The cross-member grips a middle spacer plate at each end, so the
           spacing between the two parallel robots is not a free choice: it is
           the cross-member's own length plus the two grip stand-offs.

           The two strokes are placed from the cross-member's claws rather than
           written down beside it, and each is held perpendicular to the claw
           that holds it. That is what makes the H one body: bend the
           cross-member and both strokes swing with it, instead of the
           cross-member bending out of its own grips. */
        var cross = robot([0, 0, MOD_R], aim(norm([0,1,0]), 0), 0, 0,
                          {openTop:bodyGripOpen(), openBase:bodyGripOpen(),
                           clawOff:0, name:'cross-member'});
        // rolled 60° so no actuation cable lies where a closed finger closes
        var hold = {openTop:0.35, openBase:0.35, clawOff:Math.PI/6};
        var near = bodyHeld(cross, -1, 0.5, Math.PI, Math.PI/3, 0, Math.PI/2,
                            {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, name:'near stroke'});
        var far  = bodyHeld(cross, +1, 0.5, Math.PI, Math.PI/3, 0, Math.PI/2,
                            {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, name:'far stroke'});
        return { robots:[cross, near, far], props:[],
                 tag:'L3 — H morphology: the cross-member grips a middle plate on each parallel robot' };
      }
    },
    L4: {
      cab:false,
      desc:'Three robots docked claw to claw into a closed ring. Driving curvature around the ring rolls it along the ground, and with nothing anchored the whole body is the wheel.',
      label:'L4 — closed loop (O)',
      cam:{az:-0.48, el:0.18},
      conn:'claw–claw ×3',
      build:function(){
        // three equal arcs, each turning 120°, close into a ring
        var a = robot([0,0,0], aim(norm([0,0,1]),0), 120, 0, {openTop:0, openBase:0, clawOff:Math.PI/6});
        var b = chain(a, 120, 0, {openTop:0, openBase:0});
        var c = chain(b, 120, 0, {openTop:0, openBase:0});
        var rs = [a,b,c];
        // Centre on the centroid of the ring itself, not of the three base
        // points, so the pipe sits on the loop's true axis.
        var sx=0, sy=0, sz=0, n=0;
        rs.forEach(function(R){
          for(var s=0; s<=R.sb; s+=R.sb/12){ var p=place(R,s,0,0); sx+=p[0]; sy+=p[1]; sz+=p[2]; n++; }
        });
        var c0=[sx/n, sy/n, sz/n];
        rs.forEach(function(R){ R.o = [R.o[0]-c0[0], R.o[1]-c0[1], R.o[2]-c0[2]]; });
        JOINTS.push({ R:c, nx:a });   // the loop closing back on itself
        return { robots:rs, props:[],
                 tag:'L4 — three robots closed into a single rolling loop' };
      }
    },
    /* ---- Conceptual configurations: shapes the docking rules allow but the
       paper does not demonstrate. Where a grip could close at more than one
       azimuth, the build tries each and keeps the one that lies the way the
       sketch does, so the shape follows from the docks rather than from
       hand-tuned angles. Discarded trials are taken back out of DOCKS. ---- */
    C1: {
      desc:'Three robots docked claw to claw in a row, with two more gripping the first and last by a middle spacer plate and standing off to one side. A conceptual shape: a long spine with two legs, like a table seen from above.',
      label:'C1 — row of three with two legs (⊓)',
      cam:{az:0, el:1.25},
      zoom:1.15,
      conn:'claw–claw ×2, claw–body ×2',
      build:function(){
        var a = robot([0, 0, MOD_R], aim(norm([1,0,0]), 0), 0, 0, {openTop:0, openBase:0.45, clawOff:Math.PI/6});
        var b = chain(a, 0, 0, {openTop:0, openBase:0});
        var c = chain(b, 0, 0, {openTop:0.45, openBase:0});
        function leg(host, id){
          var best = null, n0 = DOCKS.length;
          [0, Math.PI/2, Math.PI, 3*Math.PI/2].forEach(function(azi){
            var r = bodyHolder(host, 0.5, azi, 0, 0, {openTop:bodyGripOpen(), openBase:0.35, clawOff:0, cabId:id});
            var t = place(r, r.sb, 0, 0), f = place(r, 0, 0, 0);
            var sc = -(f[1]-t[1]) - 3*Math.abs(f[2]-t[2]);    // off to -y, lying flat
            if(!best || sc > best.sc) best = {sc:sc, azi:azi};
            DOCKS.length = n0;
          });
          return bodyHolder(host, 0.5, best.azi, 0, 0, {openTop:bodyGripOpen(), openBase:0.35, clawOff:0, cabId:id, name:'leg'});
        }
        var l1 = leg(a, 3), l2 = leg(c, 4); CAB_N = 5;
        var rs = [a,b,c,l1,l2], sx=0, sy=0, n=0;
        rs.forEach(function(R){ for(var q=0;q<=R.sb;q+=R.sb/8){ var p=place(R,q,0,0); sx+=p[0]; sy+=p[1]; n++; } });
        rs.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]]; });
        return { robots:rs, props:[], tag:'Conceptual — a row of three with two legs on claw-to-body grips' };
      }
    },
    C2: {
      cabOnly:[4,5], cabAll:false,
      desc:'Four robots closed into a flat ring, a fifth gripping the ring by a spacer plate and reaching straight out, and a sixth held crosswise at the end of that arm. A conceptual shape: the ring rolls, the arm steers, and the crossbar can brace or carry.',
      label:'C2 — ring with an arm and a crossbar (⊢O)',
      cam:{az:0, el:1.05},
      zoom:0.7,
      conn:'claw–claw ×4, claw–body ×2',
      build:function(){
        var zh = MOD_R;
        var a = robot([0, 0, zh], aim(norm([1,0,0]), 0), 90, 0, {openTop:0, openBase:0, clawOff:Math.PI/6});
        var b = chain(a, 90, 0, {openTop:0, openBase:0});
        var c = chain(b, 90, 0, {openTop:0, openBase:0});
        var d4 = chain(c, 90, 0, {openTop:0, openBase:0});
        var ring = [a,b,c,d4], sx=0, sy=0, n=0;
        ring.forEach(function(R){ for(var q=0;q<=R.sb;q+=R.sb/12){ var p=place(R,q,0,0); sx+=p[0]; sy+=p[1]; n++; } });
        ring.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]]; });
        JOINTS.push({ R:d4, nx:a });
        var n0 = DOCKS.length, best = null;
        [0, Math.PI/2, Math.PI, 3*Math.PI/2].forEach(function(azi){
          var r = bodyHolder(a, 0.5, azi, 0, 0, {openTop:bodyGripOpen(), openBase:bodyGripOpen(), clawOff:0, cabId:4});
          var f = place(r, 0, 0, 0), t = place(r, r.sb, 0, 0);
          var sc = Math.hypot(f[0], f[1]) - Math.hypot(t[0], t[1]) - 3*Math.abs(f[2]-t[2]);   // outward, flat
          if(!best || sc > best.sc) best = {sc:sc, azi:azi};
          DOCKS.length = n0;
        });
        var arm = bodyHolder(a, 0.5, best.azi, 0, 0, {openTop:bodyGripOpen(), openBase:bodyGripOpen(), clawOff:0, cabId:4, name:'arm'});
        n0 = DOCKS.length; best = null;
        for(var ai=0; ai<8; ai++) for(var ri=0; ri<6; ri++){
          var azi = ai*Math.PI/4, roll = ri*Math.PI/6;
          var r = bodyHeld(arm, -1, 0.5, azi, roll, 0, Math.PI/2, {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, cabId:5});
          var p0 = place(r, 0, 0, 0), p1 = place(r, r.sb, 0, 0);
          var sc = -Math.abs(p1[2]-p0[2]) - (ri === 2 ? 0 : 1e-3);
          if(!best || sc > best.sc) best = {sc:sc, azi:azi, roll:roll};
          DOCKS.length = n0;
        }
        var bar = bodyHeld(arm, -1, 0.5, best.azi, best.roll, 0, Math.PI/2, {openTop:0.35, openBase:0.35, clawOff:Math.PI/6, cabId:5, name:'crossbar'});
        CAB_N = 6;
        var rs = ring.concat([arm, bar]); sx=0; sy=0; n=0;
        rs.forEach(function(R){ for(var q=0;q<=R.sb;q+=R.sb/8){ var p=place(R,q,0,0); sx+=p[0]; sy+=p[1]; n++; } });
        rs.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]]; });
        return { robots:rs, props:[], tag:'Conceptual — a rolling ring with an arm and a crossbar' };
      }
    },
    C3: {
      cab:false,
      desc:'Five robots docked claw to claw into a closed ring, each bent through 72° so the five close exactly. A conceptual shape: a larger, rounder loop than three robots make, enclosing more room for an object.',
      label:'C3 — five-robot ring (pentagon)',
      cam:{az:0, el:1.05},
      zoom:0.58,
      conn:'claw–claw ×5',
      build:function(){
        var a = robot([0, 0, MOD_R], aim(norm([1,0,0]), 0), 72, 0, {openTop:0, openBase:0, clawOff:Math.PI/6});
        var rs = [a];
        for(var i=0;i<4;i++) rs.push(chain(rs[rs.length-1], 72, 0, {openTop:0, openBase:0}));
        var sx=0, sy=0, n=0;
        rs.forEach(function(R){ for(var q=0;q<=R.sb;q+=R.sb/12){ var p=place(R,q,0,0); sx+=p[0]; sy+=p[1]; n++; } });
        rs.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]]; });
        JOINTS.push({ R:rs[4], nx:a });
        return { robots:rs, props:[], tag:'Conceptual — five robots closed into one ring' };
      }
    },
    /* ---- 3-to-1 polygons and walkers. A spread claw holds a finger out at up
       to the hinge's full 45°, and a closed claw clamped on that finger sits on
       the finger's own line, so each such dock turns the chain by the spread
       angle. The helpers below pick the finger, roll and bending plane that keep
       a shape planar (or symmetric) by measurement rather than by hand. ---- */
    C4: {
      cab:false,
      desc:'Five robots joined end to end by 3-to-1 docks: each spread base claw holds one finger out, and the next robot’s closed claw clamps it. The claw hinge opens to 45° and a pentagon turns 72° at each corner, so each robot bends the remaining 27°, keeping the sides nearly straight. A conceptual shape.',
      label:'C4 — pentagon from 3-to-1 docks',
      cam:{az:0, el:1.2},
      zoom:0.62,
      conn:'claw–claw 3-to-1 ×5',
      build:function(){
        var spread = 1, cover = 0.55;
        function crossZ(u, v){ return u[0]*v[1] - u[1]*v[0]; }
        function travel(R){ return endPose(R, -1).T; }           // out of the base end
        function leftFinger(R){   // flattest base finger that turns left
          var T = travel(R), best = null;
          for(var k=0;k<3;k++){
            var f = fingerLine(R, -BASE_H, -1, R.openBase, baseOffOf(R), k);
            var sc = -Math.abs(f.dir[2])*10 + (crossZ(T, f.dir) > 0 ? 3 : 0);
            if(!best || sc > best.sc) best = {sc:sc, k:k, f:f};
          }
          return best;
        }
        function quality(R, startDir){
          var T = travel(R), lf = leftFinger(R);
          return -Math.abs(T[2])*10 + lf.sc + (crossZ(startDir, T) > 0 ? 3 : 0);
        }
        function ring(bend, record){
          var rs = [];
          var first = null;
          for(var pi=0; pi<72; pi++) for(var ci=0; ci<12; ci++){
            var psi = pi*Math.PI/36, co = ci*Math.PI/18;
            var r = robot([0,0,0], aim(norm([1,0,0]),0), bend, psi, {openTop:0, openBase:spread, clawOff:co, cabId:0});
            var top = endPose(r, +1).T, sc = quality(r, [-top[0],-top[1],-top[2]]) - Math.abs(top[2])*10 - Math.abs(place(r, r.sb/2, 0, 0)[2])*2;
            if(!first || sc > first.sc) first = {sc:sc, psi:psi, co:co};
          }
          rs.push(robot([0,0,0], aim(norm([1,0,0]),0), bend, first.psi, {openTop:0, openBase:spread, clawOff:first.co, cabId:0}));
          for(var i=1;i<5;i++){
            var H = rs[i-1], fk = leftFinger(H), f = fk.f;
            var plate = add(f.tip, f.dir, C_FING*(1 - cover)), back = [-f.dir[0],-f.dir[1],-f.dir[2]];
            var best = null;
            for(var pj=0; pj<72; pj++) for(var cj=0; cj<12; cj++){
              var psi2 = pj*Math.PI/36, co2 = cj*Math.PI/18;
              var r2 = poseDistal(plate, back, bend, psi2, {openTop:0, openBase:spread, clawOff:co2, cabId:i});
              var sc = quality(r2, f.dir);
              if(!best || sc > best.sc) best = {sc:sc, psi:psi2, co:co2};
            }
            var G = poseDistal(plate, back, bend, best.psi, {openTop:0, openBase:spread, clawOff:best.co, cabId:i});
            if(record) dockFinger(G, H, -1, fk.k);
            rs.push(G);
          }
          var lf = leftFinger(rs[4]), f = lf.f;
          var want = add(f.tip, f.dir, C_FING*(1 - cover));
          var have = place(rs[0], rs[0].sb + TOP_H, 0, 0);
          return { rs:rs, k:lf.k, gap:Math.hypot(want[0]-have[0], want[1]-have[1], want[2]-have[2]) };
        }
        /* The corner turn is the 45° spread plus each robot's own bend, but
           the clamp sits off the finger's root, so the bend that closes the
           ring is found by measuring the gap rather than set to 72 - 45. */
        var bestB = null;
        for(var bb = 18; bb <= 36; bb += 1){ var t = ring(bb, false); if(!bestB || t.gap < bestB.gap) bestB = {bend:bb, gap:t.gap}; }
        var R5 = ring(bestB.bend, true), rs = R5.rs;
        dockFinger(rs[0], rs[4], -1, R5.k);   // the ring closing on the first robot
        var sx=0, sy=0, sz=0, n=0;
        rs.forEach(function(R){ for(var q=0;q<=R.sb;q+=R.sb/10){ var p=place(R,q,0,0); sx+=p[0]; sy+=p[1]; sz+=p[2]; n++; } });
        rs.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]-sz/n + MOD_R]; });
        return { robots:rs, props:[], tag:'Conceptual — a pentagon of five robots on 3-to-1 docks' };
      }
    },
    C5: {
      cabOnly:[1,2,3,4],
      cab0:[ null, [29, 78, -20], [29, 78, -20], [29, 78, -20], [29, 78, -20] ],
      desc:'One robot as a spine with both claws spread, and two robots clamped by 3-to-1 docks on two fingers of each claw, bending down to the ground as legs. Two Ys sharing one spine: from above it reads as an X. A conceptual walker.',
      label:'C5 — two Ys on one spine (four legs)',
      cam:{az:-0.75, el:0.42},
      zoom:0.8,
      conn:'claw–claw 3-to-1 ×4',
      build:function(){ return walker(false); }
    },
    C6: {
      cabOnly:[1,2,3,4,5],
      cab0:[ null, [29, 78, -20], [29, 78, -20], [29, 78, -20], [29, 78, -20], [-20, 53, 53] ],
      desc:'The four-legged walker of C5 with a sixth robot clamped on the front claw’s free finger, curling forward and down as a trunk. Six robots, one spine, four legs and a trunk: an elephant. A conceptual shape.',
      label:'C6 — elephant (six robots)',
      cam:{az:-3.855, el:0.147},
      focus:[-1.04, 1.21, 7.57],   // the opening view, set by hand in Play (__view())
      zoom:1.0,
      conn:'claw–claw 3-to-1 ×5',
      build:function(){ return walker(true); }
    },
    L2: {
      cabOnly:[2], cabAll:false,
      desc:'Two robots closed into a flat loop with a third trailing on a claw-to-body grip. The loop rolls; the tail shifts the group\'s centre of mass and steers it, which turns a rolling gait into a directed one.',
      label:'L2 — loop with a trailing robot (O-)',
      cam:{az:0, el:1.05},
      conn:'claw–claw ×2, claw–body ×1',
      build:function(){
        /* Flat O-, read from above. Both the body axis and the bending
           direction are horizontal, so the ring closes in the ground plane
           rather than standing up. Two robots turning 180° each make a
           stadium: half-circles at the two ends, joined by the straight base,
           top and claw sections.

           The tail is a claw-to-body grip. At its arc midpoint a robot has
           turned 90° from its start, so its tangent there runs across the
           loop's long axis — which is exactly where a perpendicular claw gives
           a tail lying along that axis. The trailing robot therefore takes the
           plate at the loop's far end and extends straight back from it. */
        var zh = MOD_R;
        var a = robot([0, 0, zh], aim(norm([1,0,0]), 0), 180, 0,
                      {openTop:0, openBase:0, clawOff:Math.PI/6});
        var b = chain(a, 180, 0, {openTop:0, openBase:0});
        var loop = [a,b], sx=0, sy=0, n=0;
        loop.forEach(function(R){
          for(var s=0; s<=R.sb; s+=R.sb/14){ var p=place(R,s,0,0); sx+=p[0]; sy+=p[1]; n++; }
        });
        loop.forEach(function(R){ R.o=[R.o[0]-sx/n, R.o[1]-sy/n, R.o[2]]; });
        JOINTS.push({ R:b, nx:a });   // the loop closing back on itself

        // the tail grips the plate at the loop's far end and follows it
        var t = bodyHolder(b, 0.5, Math.PI, 0, 0,
                           {openTop:bodyGripOpen(), openBase:0.35, clawOff:0, name:'tail'});
        return { robots:[a,b,t], props:[],
                 tag:'L2 — two robots closed into a flat loop, the third trailing on a claw-to-body grip' };
      }
    }
  };

  /* ---------------- canvas, camera ---------------- */
  var canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  var W=0, H=0, K=1, DPR=1, cam={az:0, el:0.17}, showLabels=false, freeRot=false, panMode=false, zoomF=1;
  var splashing = (MODE === "hero");

  /* The stage takes the width it is given and whatever height is left beneath
     it, with nothing pinning its shape — which is the whole of the fix. It used
     to be locked to the cover's 215 x 285 portrait so that the screen matched
     the exported file, which made its height a consequence of its width; capping
     that height to fit a laptop then dragged the width down with it and left a
     narrow column. Unpinned, a wide screen gets a wide stage. */
  function resize(){
    DPR = Math.min(window.devicePixelRatio||1, 2);
    var view = canvas.parentNode;
    /* Measured at full width first: the stage is narrowed to the export's
       aspect afterwards, and measuring it after that would ratchet it smaller
       on every resize. */
    view.style.width = '100%';
    var full = view.getBoundingClientRect().width;
    if(splashing){
      /* The hero fills the screen below the site's top bar, never under it,
         and grows if the title block needs more room than a short window has:
         on a wide screen it only has to clear the type, on a narrow one the
         robot stacks above the type and needs its own band as well. */
      var bar = document.querySelector('.topbar'), inner = document.querySelector('.splashInner');
      var barH = bar ? bar.getBoundingClientRect().height : 0;
      /* Sized to the title block rather than the window, so the gap under the
         top bar stays small: 48 px above and below the type on a wide screen,
         never taller than the window unless the type itself needs it. A narrow
         screen adds a 330 px band above the type for the robot. */
      var ih = inner ? inner.offsetHeight : 480;
      // fills the window under the top bar; grows only if the type needs more
      if(heroWide()) H = Math.max(ih + 56, window.innerHeight - barH);
      else H = Math.max(ih + 330, window.innerHeight - barH);
      W = full;
    } else {
      var top = view.getBoundingClientRect().top + window.scrollY;
      var below = document.getElementById('below').offsetHeight;
      // narrow enough and the spec panel wraps under the stage, which is height
      // the stage has to give up too
      var sideEl = document.getElementById('side');
      var stacked = !sideEl.hidden &&
        getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length < 2;
      var budget = window.innerHeight - top - below - (stacked ? sideEl.offsetHeight + 16 : 0) - 26;
      W = full;
      H = Math.max(300, Math.min(budget, Math.round(W*0.8)));
    }
    view.style.width = W + 'px';
    view.style.height = H + 'px';
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
  }
  var FOCUS = [0,0,0], SPAN = 20, LWS = 1, LW_REF_K = 14;   // pixels per model unit at which line widths were tuned (one robot, laptop)
  /* Where the scene's centre sits in the stage. The tool keeps it central; the
     hero moves it off to one side so that the robot and the type each get their
     own half of a wide screen instead of sharing one, which is the only way two
     white things on black stop competing. On a narrow screen there is no second
     half, so it stacks and the robot sits high instead. */
  var VCEN = 0.56, HCEN = 0.5;
  function heroWide(){ return window.innerWidth >= 900; }
  function heroFrame(){
    if(heroWide()){ HCEN = 0.71; VCEN = 0.50; } else { HCEN = 0.5; VCEN = 0.235; }
  }
  /* On a wide screen the robot gets the space to the right of the title block
     and is scaled to fit inside it with a margin all round, so it can never
     run under the type or off the top or bottom of the stage. Its extent over
     the whole animation, measured, is 0.742 x min(W,H) x 0.92 x zoom tall and
     0.856 x the same wide; dividing the free space by those gives the zoom.
     A narrow screen stacks the robot above the type instead. */
  var HERO_Z = 1.45, DROP_CV = null;
  var END_PLATE_BACK = 0.6;          // depth push for the end plates, in model units
  function heroFit(){
    heroFrame();
    if(!heroWide()){
      // the robot gets the band above the type, centred in it and scaled to it
      var tb = document.querySelector('.splashInner'), band = H - (tb ? tb.offsetHeight : 480) - H*0.03;
      HERO_Z = Math.max(0.8, Math.min(1.15, 0.88*band/330, 0.88*W/390));
      HCEN = 0.5; VCEN = Math.max(165, band/2)/H; return;
    }
    var inner = document.querySelector('.splashInner'), vb = canvas.getBoundingClientRect();
    var textR = inner ? inner.getBoundingClientRect().right - vb.left : W*0.4;
    var gap = Math.max(32, W*0.03), my = Math.max(28, H*0.045);
    var availW = W - textR - 2*gap, availH = H - 2*my, base = Math.min(W, H)*0.92;
    HERO_Z = Math.max(0.5, Math.min(1.45, availH/(0.742*base), availW/(0.856*base)));
    HCEN = (textR + gap + availW/2)/W;
    VCEN = 0.485;          // the robot's extent runs slightly low of its centre
  }
  function proj(P){
    var ca=Math.cos(cam.az), sa=Math.sin(cam.az), ce=Math.cos(cam.el), se=Math.sin(cam.el);
    var dx=P[0]-FOCUS[0], dy=P[1]-FOCUS[1], dz=P[2]-FOCUS[2];
    var x1 = dx*ca - dy*sa, y1 = dx*sa + dy*ca;
    var up = dz*ce + y1*se, depth = y1*ce - dz*se;
    var f = 150/(150+depth);
    return { x: W*HCEN + x1*K*f, y: H*VCEN - up*K*f, d: depth };
  }
  var colors = {};
  function readColors(){
    var cs = getComputedStyle(document.documentElement);
    ['paper','panel','ink','muted','rule','shell','strut','tendon','cable','accent','stage'].forEach(function(n){
      colors[n] = cs.getPropertyValue('--'+n).trim();
    });
  }
  // for stills: the same palette drawn with no backdrop, so the image sits on any page colour
  /* The two small notes on the stage take the palette's own label colour, so
     they read on any backdrop; on any palette but Studio a hint points back to
     it, since black is where the robots read best. */
  var HINT = null;
  function stageNotes(P){
    if(MODE === 'hero') return;
    var view = document.getElementById('view'); if(!view) return;
    var cav = view.querySelector('.caveat');
    if(!HINT){
      HINT = document.createElement('p'); HINT.className = 'palHint';
      HINT.textContent = 'Try the black (Studio) palette for best contrast';
      view.appendChild(HINT);
    }
    var col = P.label || '#EDF1EE';
    if(cav) cav.style.color = col;
    var tag = document.getElementById('tag'); if(tag) tag.style.color = col;
    HINT.style.color = col;
    HINT.hidden = (document.getElementById('pal').value === 'studio');
  }
  function palette(){
    var P = palette0();
    if(window.__tecobotNoBg){ var Q = {}; for(var k in P) Q[k] = P[k]; Q.bg = null; Q.card = null; Q.drop = null; if(window.__tecobotGround) Q.ground = window.__tecobotGround; return Q; }
    return P;
  }
  function palette0(){
    var p = document.getElementById('pal').value;
    // extra palettes can be registered from outside, for previews
    if(window.__tecobotPalettes && window.__tecobotPalettes[p]) return window.__tecobotPalettes[p];
    // On black the real black carbon rods would disappear, so they carry a
    // lighter rim the way they catch a side light in the studio photographs.
    if(p === 'studio') return { bg:'#0A0B0B', shell:'#F4F6F4', strut:'#14181C', rim:'#737F79',
                                tendon:'#9EA9A4', cable:'#C9A94A', accent:'#CE3127', sleeve:'#C4A478',
                                fill:'rgba(226,231,228,0.16)', edge:'#8E9893', prop:'#434A4B', ground:'#191D1F',
                                label:'#EDF1EE', labelBg:'rgba(10,11,11,0.72)' };
    /* Day: the night robot's own colours on a flat mid-grey hero (#B9BCBF).
       White shells shaded as if lit from the upper left, a hairline grey
       outline, and a soft contact shadow under the base. */
    if(p === 'day') return { bg:'#B9BCBF',
                             shell:'#F4F6F4', strut:'#14181C', rim:null, tendon:'#9EA9A4', cable:'#C9A94A',
                             accent:'#CE3127', sleeve:'#C4A478', fill:'rgba(255,255,255,0.55)',
                             edge:'#AEB7B2', outline:'#AEB7B2', outlineW:1.6,
                             shade:'#8F9893', shadeAmt:0.38, shadow:'rgba(20,24,26,0.22)',
                             prop:'#C9D0CB', frame:'#6A7074', keyLine:'#1C2023', ground:'#C4C8C6', label:'#14181A', labelBg:'rgba(233,236,232,0.82)' };
    // Paper is always light, whichever page theme is on.
    if(p === 'paper')  return { bg:'#E9ECE8', shell:'#FFFFFF', strut:'#14181A', rim:null,
                                tendon:'#8A9490', cable:'#B89B3E', accent:'#C8322B', sleeve:'#B8945F',
                                fill:'rgba(255,255,255,0.55)', edge:'#9AA49F', prop:'#D4DAD5', frame:'#A3AAA6', keyLine:'#1C2023', ground:'#DDE2DE',
                                label:'#14181A', labelBg:'rgba(242,244,241,0.78)' };
    return { bg:null, shell:'#FFFFFF', strut:colors.strut, rim:null,
             tendon:colors.tendon, cable:colors.cable, accent:colors.accent, sleeve:'#B8945F',
             fill:'rgba(255,255,255,0.5)', edge:'#9AA49F', prop:'#D4DAD5', ground:'#DDE2DE',
             label:colors.ink, labelBg:'rgba(242,244,241,0.78)' };
  }

  function ring(R, s, r, n, off){
    var o=[]; for(var i=0;i<n;i++){ var a=i/n*2*Math.PI+(off||0); o.push(place(R, s, r*Math.cos(a), r*Math.sin(a))); } return o;
  }
  function discAt(c, axis, r, n, roll){
    var M = aim(norm(axis), roll||0), o=[];
    for(var i=0;i<n;i++){ var a=i/n*2*Math.PI; o.push(add(c, mul(M,[r*Math.cos(a), r*Math.sin(a), 0]))); }
    return o;
  }

  /* ---------------- robot drawing ---------------- */
  function buildRobot(R, items, P){
    function line(A,B,col,w,dash,al){ var a=proj(A), b=proj(B);
      items.push({k:'l', a:a, b:b, d:(a.d+b.d)/2, col:col, w:w, dash:dash, al:al===undefined?1:al}); }
    function poly(pts, fill, stroke, w, al){ var q=pts.map(proj), d=0;
      q.forEach(function(t){ d+=t.d; }); items.push({k:'p', q:q, d:d/q.length, fill:fill, stroke:stroke, w:w, al:al===undefined?1:al}); }
    function dotAt(A,r,col){ var a=proj(A); items.push({k:'c', a:a, d:a.d-0.02, r:r, col:col}); }

    // Disk 0 sits at s = 0 and disk N at s = SB, so the end plates are flush
    // against the base module and the claw module with no gap.
    // Pulling all three cables shortens the backbone, and the modules are what
    // take up the difference, so disk pitch and module height share one ratio.
    var comp = R.sb/R.sb0, diskS=[];
    for(var jd=0; jd<=R.n; jd++) diskS.push(jd*(MOD_H+GAP)*comp);

    // One ring per disk, with a heavier rim so a single 2 mm plate still reads
    // as solid. Drawing both faces made each disk look like two plates.
    diskS.forEach(function(s, jj){
      var first = items.length;
      if(P.outline) poly(ring(R, s, DISK_R, 44), 'rgba(0,0,0,0)', P.outline, ((jj===0||jj===R.n)?4.4:3.6) + (P.outlineW || 2), 1);
      poly(ring(R, s, DISK_R, 44), P.fill, P.disk || P.shell, (jj===0||jj===R.n)?4.4:3.6, 1);
      /* The two end plates are the same size as, and flush with, the base and
         claw modules, so where the plate's rim crosses the module's wall the
         two sit at almost the same depth and the sort swaps them as the robot
         moves, which flickers. Pushed back behind the module, the plate is
         always drawn first and only its rim shows around the module's edge. */
      if(jj === 0 || jj === R.n) for(var q = first; q < items.length; q++) items[q].d += END_PLATE_BACK;
    });

    // tensegrity modules, each centred between its two disks
    for(var m=0; m<R.n; m++){
      var s0 = diskS[m] + GAP*comp/2, rot = m*Math.PI/3, cr = Math.cos(rot), sr = Math.sin(rot);
      var pts = LOC.map(function(q){
        return place(R, s0 + (q[2] + ZMAX)*comp, q[0]*cr - q[1]*sr, q[0]*sr + q[1]*cr);
      });
      tendons.forEach(function(e){ line(pts[e[0]], pts[e[1]], P.tendon, 1.5, null, 0.95); });
      struts.forEach(function(e){
        var rw = 1;
        if(P.rim) line(pts[e[0]], pts[e[1]], P.rim, 2.9*rw, null, 0.85);
        line(pts[e[0]], pts[e[1]], P.strut, (P.rim ? 1.7 : 2.0)*rw);
      });
      LOC.forEach(function(q, idx){
        dotAt(pts[idx], 1.2, P.strut);
        if(endNode[idx]){
          var x = q[0]*cr - q[1]*sr, y = q[0]*sr + q[1]*cr;
          // connector from the triangle node to its disk: purely axial and only
          // the clearance long, so it does not read as a stand-off
          var sd = q[2] > 0 ? diskS[m+1] : diskS[m];
          line(pts[idx], place(R, sd, x, y), P.shell, 2.2, null, 0.9);
        }
      });
    }

    // three actuation cables at 120°, routed through the disks
    [0,1,2].forEach(function(k){
      var a = Math.PI/2 + k*2*Math.PI/3;
      for(var jc=0; jc<R.n; jc++){
        line(place(R, diskS[jc],   CAB_R*Math.cos(a), CAB_R*Math.sin(a)),
             place(R, diskS[jc+1], CAB_R*Math.cos(a), CAB_R*Math.sin(a)),
             P.cable, 1.7, [5,4], 0.95);
      }
    });

    // base module (a cylinder below s = 0)
    cylinder(R, -BASE_H, 0, BASE_R, P, items, true, P.base);
    // top module
    cylinder(R, R.sb, R.sb + TOP_H, TOP_R, P, items, true, P.top);

    // claws
    drawClaw(R, R.sb + TOP_H, +1, R.openTop,  R.clawOff, items, P);
    if(R.baseClaw) drawClaw(R, -BASE_H, -1, R.openBase, baseOffOf(R), items, P);
  }

  /* The base and claw modules, each quad sorted on its own mean depth like
     everything else in the scene.

     Biasing the near wall forward does make the shell read as fully solid — the
     cables and the first lattice nodes stop showing through, since those end on
     the plate and tie with it on depth. But the claws sit directly on these two
     modules, and a wall biased far enough to beat the lattice also beats the
     fingers in front of it, which swallows the claws. The faint lattice behind
     the plate is the lesser of the two, so the depth is left honest. */
  function cylinder(R, s0, s1, r, P, items, capped, col){
    col = col || P.shell;   // a palette may colour the base and claw modules apart
    function poly(pts, fill, stroke, w, al){ var q=pts.map(proj), d=0;
      q.forEach(function(t){ d+=t.d; }); items.push({k:'p', q:q, d:d/q.length, fill:fill, stroke:stroke, w:w, al:al===undefined?1:al}); }
    var n = 30, b = ring(R, s0, r, n), t = ring(R, s1, r, n);
    /* With P.shade, each face of the shell is darkened by how far it turns
       away from a light at the upper left, in front of the screen, so a white
       module reads as a solid cylinder on a light page. A face's sideways
       position across the silhouette, -1 to 1, gives its normal: that much
       sideways and the rest toward the viewer. */
    var cb0 = proj(place(R, s0, 0, 0)), ct0 = proj(place(R, s1, 0, 0));
    var axx = ct0.x - cb0.x, axy = ct0.y - cb0.y, axl = Math.hypot(axx, axy) || 1;
    axx /= axl; axy /= axl;
    var pxx = -axy, pxy = axx;
    if(pxx < 0){ pxx = -pxx; pxy = -pxy; }              // across, toward screen right
    var offs = [], omax = 1e-6;
    if(P.shade){
      for(var i0=0;i0<n;i0++){
        var qa0 = proj(b[i0]), qb0 = proj(b[(i0+1)%n]);
        var o = ((qa0.x + qb0.x)/2 - cb0.x)*pxx + ((qa0.y + qb0.y)/2 - cb0.y)*pxy;
        offs.push(o); omax = Math.max(omax, Math.abs(o));
      }
    }
    for(var i=0;i<n;i++){
      var fc = col;
      if(P.shade){
        var tx = Math.max(-1, Math.min(1, offs[i]/omax)), tz = Math.sqrt(1 - tx*tx);
        var lit = Math.max(0, tx*-0.55 + tz*0.835);       // light from the left, in front
        fc = mixHex(col, P.shade, (1 - lit)*(P.shadeAmt || 0.22));
      }
      poly([b[i], b[(i+1)%n], t[(i+1)%n], t[i]], fc, fc, 0.5, 1);
    }
    if(capped){ poly(t, col, P.outline || P.edge, 1.1, 1); poly(b, col, P.outline || P.edge, 1.1, 1); }
    /* On a light page a white shell needs its outline. The two silhouette
       edges are the ring points farthest either side of the projected axis. */
    if(P.outline){
      var cb = proj(place(R, s0, 0, 0)), ct = proj(place(R, s1, 0, 0));
      var ax = ct.x - cb.x, ay = ct.y - cb.y, al = Math.hypot(ax, ay) || 1;
      var lo = 0, hi = 0, vlo = 1e9, vhi = -1e9;
      for(var k=0;k<n;k++){
        var q = proj(b[k]), v = ((q.x - cb.x)*ay - (q.y - cb.y)*ax)/al;
        if(v < vlo){ vlo = v; lo = k; } if(v > vhi){ vhi = v; hi = k; }
      }
      [lo, hi].forEach(function(k){
        var qa = proj(b[k]), qb = proj(t[k]);
        items.push({k:'l', a:qa, b:qb, d:Math.min(qa.d, qb.d) - 0.04, col:P.outline, w:1.3, dash:null, al:1});
      });
    }
  }

  // dir = +1 distal claw, -1 base claw (fingers point back past the base)
  function drawClaw(R, s, dir, open, off, items, P){
    function line(A,B,col,w,dash,al){ var a=proj(A), b=proj(B);
      items.push({k:'l', a:a, b:b, d:(a.d+b.d)/2, col:col, w:w, dash:dash, al:al===undefined?1:al}); }
    function poly(pts, fill, stroke, w, al){ var q=pts.map(proj), d=0;
      q.forEach(function(t){ d+=t.d; }); items.push({k:'p', q:q, d:d/q.length, fill:fill, stroke:stroke, w:w, al:al===undefined?1:al}); }

    // One straight finger per claw, pivoting on the plate. All three swing
    // together — a single motor through a self-locking worm — over the real
    // hinge range: 0° closed, with the fingers along the body axis, to 45°.
    var al = gripAngle(open);
    // The finger carries its real width, 2 x the Y-section lobe reach, because
    // that width is what closes the two docking modes. Converted from model
    // units at the current scale so it tracks zoom rather than staying a
    // fixed stroke.
    var pf = 150 / (150 + proj(place(R, s, 0, 0)).d);
    var fw = Math.max(2.2, u(MM.lobeReach) * 2 * K * pf);

    /* A finger is one straight part, but it is drawn in pieces.

       A thick line carries a single depth, and one depth cannot be right for
       something that runs toward or away from the camera — which is what let
       the claw module's own rim sort in front of the fingers standing on it.
       Each piece sorts on its own, so the rim is covered where it should be.

       The sleeve is taken as a share of the drawn length rather than of the
       three-dimensional length. Foreshortening is honest either way, but a
       fixed share of the 3D finger makes the sleeve stretch and shrink as the
       claw turns, and a part that changes length reads as a modelling error
       rather than as perspective. */
    function seg(a, b, col, w, al){
      items.push({k:'l', a:a, b:b, d:(a.d+b.d)/2, col:col, w:w, dash:null, abs:true,
                  al:al===undefined?1:al});
    }
    function along(a, b, t){
      return { x:a.x + (b.x-a.x)*t, y:a.y + (b.y-a.y)*t, d:a.d + (b.d-a.d)*t };
    }
    /* The sleeve takes a fixed share of the finger's own length, so it
       foreshortens with it. Drawing it at a fixed size on screen instead does
       make it a part that never changes, but it costs the look, and the look
       is what this is for.

       The fills are still laid down in pieces, each sorting on its own depth:
       a thick line carries one depth, and one depth cannot be right for
       something running toward or away from the camera, which is what let the
       claw module's rim sort in front of the fingers standing on it. The pieces
       are the same colour and width, so along a straight finger they render as
       one unbroken stroke. The shading line down the finger is drawn once for
       the whole length, a hair in front of its own fill — drawn per piece, the
       pieces' round caps chop it into a dashed seam. */
    var slv = C_SLV/C_FING, cut = 1 - slv, NS = 4;
    for(var k=0;k<3;k++){
      var f = fingerLine(R, s, dir, open, off, k);
      var a = proj(f.root), b = proj(f.tip);
      if(P.outline) items.push({k:'l', a:a, b:b, d:Math.max(a.d, b.d) + 0.05, col:P.outline, w:fw + (P.outlineW || 2.4)*LWS, dash:null, abs:true, al:1});
      for(var i=0;i<NS;i++) seg(along(a, b, cut*i/NS), along(a, b, cut*(i+1)/NS), P.finger || P.shell, fw);
      var e0 = along(a, b, 0), e1 = along(a, b, cut);
      items.push({k:'l', a:e0, b:e1, d:Math.min(e0.d, e1.d) - 0.05, col:P.edge,
                  w:1.0, dash:null, al:0.35});
      for(var j=0;j<2;j++) seg(along(a, b, cut + slv*j/2), along(a, b, cut + slv*(j+1)/2),
                               P.sleeve, fw*0.97);
    }
    // The passive roller wheels that sit between the fingers are deliberately
    // not drawn — they read as stray circles at this scale.
  }

  /* ---------------- props ---------------- */
  function buildProp(pr, items, P){
    if(pr.k === 'ball'){
      var a = proj(pr.c);
      var f = 150/(150+a.d);
      items.push({k:'ball', a:a, d:a.d, r:pr.r*K*f, col:P.accent});
    } else if(pr.k === 'pipe' || pr.k === 'roll'){
      // One opaque pass, so overlapping quads cannot stack into visible banding.
      var n = 40, ax = norm(pr.axis || [1,0,0]);
      var c1 = add(pr.c, ax, -pr.h), c2 = add(pr.c, ax, pr.h);
      var r1 = discAt(c1, ax, pr.r, n), r2 = discAt(c2, ax, pr.r, n);
      for(var i=0;i<n;i++){
        var q = [r1[i], r1[(i+1)%n], r2[(i+1)%n], r2[i]].map(proj), dd=0;
        q.forEach(function(t){ dd+=t.d; });
        items.push({k:'p', q:q, d:dd/4 + 0.6, fill:P.prop, stroke:P.prop, w:0.6, al:1});
      }
      items.push({k:'p', q:r1.map(proj), d:proj(c1).d + 0.6, fill:P.prop, stroke:P.prop, w:0.6, al:1});
      items.push({k:'p', q:r2.map(proj), d:proj(c2).d + 0.6, fill:P.prop, stroke:P.edge, w:1.3, al:1});
    } else if(pr.k === 'ground'){
      // The floor the robots rest their base claws on, always furthest back.
      // Drawn with its own edge so the plane reads as a finite surface the feet
      // stand on rather than a wash across the whole stage.
      var gx = (pr.hx === undefined) ? pr.r : pr.hx, gy = (pr.hy === undefined) ? pr.r : pr.hy;
      var gq = [[-gx,-gy,pr.z],[gx,-gy,pr.z],[gx,gy,pr.z],[-gx,gy,pr.z]].map(proj);
      items.push({k:'p', q:gq, d:1e6, fill:P.ground, stroke:P.edge, w:1.1, al:1});
    } else if(pr.k === 'frame' || pr.k === 'bar' || pr.k === 'stub'){
      function thick(A, B, col, mm, al){
        var a = proj(A), b = proj(B), dm = (a.d+b.d)/2;
        items.push({k:'l', a:a, b:b, d:dm, col:col,
                    w:Math.max(1.8, u(mm)*K*(150/(150+dm))), dash:null, abs:true,
                    al:(al===undefined)?1:al});
      }
      if(pr.k === 'bar'){
        thick(pr.a, pr.b, P.frame || P.prop, MM.barDia);
      } else if(pr.k === 'frame'){
        // cuboidal extrusion frame: four posts and two rectangles
        var X = [-pr.hx, pr.hx], Y = [-pr.hy, pr.hy], Z = [pr.z0, pr.z1];
        X.forEach(function(x){ Y.forEach(function(y){ thick([x,y,Z[0]],[x,y,Z[1]], P.frame || P.prop, MM.barDia); }); });
        // complete rectangle on top; at the bottom only the two side rails,
        // leaving the front and back open
        Y.forEach(function(y){ thick([X[0],y,Z[1]],[X[1],y,Z[1]], P.frame || P.prop, MM.barDia); });
        X.forEach(function(x){ thick([x,Y[0],Z[1]],[x,Y[1],Z[1]], P.frame || P.prop, MM.barDia); });
        X.forEach(function(x){ thick([x,Y[0],Z[0]],[x,Y[1],Z[0]], P.frame || P.prop, MM.barDia); });
      } else {
        // a station stub: one finger, sleeved at its free end
        var sl = Math.min(C_SLV, pr.len*0.42);
        thick(pr.p, add(pr.p, pr.dir, pr.len - sl), P.shell,  MM.lobeReach*2);
        thick(add(pr.p, pr.dir, pr.len - sl), add(pr.p, pr.dir, pr.len),
              P.sleeve, MM.lobeReach*2);
      }
    }
  }

  /* ---------------- scene ---------------- */
  var scene = null;
  function rebuild(keepCam){
    var key = document.getElementById('morph').value;
    JOINTS = []; DOCKS = [];
    /* A configuration may ship a pose of its own, as the cable displacements
       that produce it. Seeded here rather than written as bend angles, so the
       sliders open on the numbers that made the picture, and Reset cables comes
       back to them. */
    if(!CAB[key] && MORPHS[key].cab0){
      CAB[key] = MORPHS[key].cab0.map(function(c){
        return c ? c.map(function(mm){ return u(mm); }) : null;   // null: the config's own pose
      });
    }
    CAB_N = 0; CAB_CUR = CAB[key] || null;
    var rig = MORPHS[key].frame ? resolveRig(key) : null;
    scene = MORPHS[key].build(rig);
    scene.conn = MORPHS[key].conn;
    if(rig){
      scene.rigNotes = rig.notes; scene.rigF = rig.F;
      // the resolved positions are the real ones — write them back so a slider
      // cannot be dragged past a neighbour it has already come to rest against
      RIG[key].t = rig.t.slice();
    }
    if(MORPHS[key].cam && !keepCam){ cam.az = MORPHS[key].cam.az; cam.el = MORPHS[key].cam.el; }
    if(!keepCam) zoomF = MORPHS[key].zoom || 1;
    /* Framing is settled once per morphology and then left alone. Refitting on
       every rebuild is what made the width slider look like a zoom: a wider box
       is a wider extent, so the fit answered by drawing everything smaller, and
       a slider that should have moved two posts appeared to shrink the robots.
       Hold the fit and a slider moves only what it names; the wheel is there if
       the box grows past the edges. */
    if(keepCam){ caption(key); readout(); return; }
    var xs=[], ys=[], zs=[];
    scene.robots.forEach(function(R){
      for(var s=-BASE_H; s<=R.sb+TOP_H; s+=R.sb/6){
        var p = place(R, Math.min(s, R.sb+TOP_H), 0, 0);
        xs.push(p[0]); ys.push(p[1]); zs.push(p[2]);
      }
      [[R.sb+TOP_H, +1, R.openTop, R.clawOff],
       [-BASE_H,  -1, R.openBase, baseOffOf(R)]].forEach(function(c){
        for(var k=0;k<3;k++){
          var t = fingerLine(R, c[0], c[1], c[2], c[3], k).tip;
          xs.push(t[0]); ys.push(t[1]); zs.push(t[2]);
        }
      });
    });
    scene.props.forEach(function(pr){
      function note(q){ xs.push(q[0]); ys.push(q[1]); zs.push(q[2]); }
      if(pr.c) note(pr.c);
      if(pr.k === 'frame'){
        [-pr.hx, pr.hx].forEach(function(x){ [-pr.hy, pr.hy].forEach(function(y){
          note([x,y,pr.z0]); note([x,y,pr.z1]); }); });
      } else if(pr.k === 'bar'){ note(pr.a); note(pr.b); }
      else if(pr.k === 'stub'){ note(pr.p); note(add(pr.p, pr.dir, pr.len)); }
    });
    var mnx=Math.min.apply(null,xs), mxx=Math.max.apply(null,xs);
    var mny=Math.min.apply(null,ys), mxy=Math.max.apply(null,ys);
    var mnz=Math.min.apply(null,zs), mxz=Math.max.apply(null,zs);
    FOCUS = [(mnx+mxx)/2, (mny+mxy)/2, (mnz+mxz)/2];
    if(MORPHS[key].focus) FOCUS = MORPHS[key].focus.slice();   // a hand-set view keeps its own centre
    SPAN = Math.max(mxx-mnx, mxy-mny, mxz-mnz) + CLAW_L*1.25 + DISK_R*1.6;
    caption(key);
    readout();
  }

  /* The tag names the shape on the stage; the paragraph under it says what the
     configuration is and what it is for. Both come from the config itself. */
  function caption(key){
    document.getElementById('tag').textContent = scene.tag;
    document.getElementById('desc').textContent = MORPHS[key].desc || '';
  }

  function readout(){
    function set(id, v){ document.getElementById(id).textContent = v; }
    set('f-rod',  MM.rod + ' mm');
    set('f-disk', MM.moduleDia + ' mm');
    var R0 = scene.robots[0];
    set('f-mod',  String(R0.n));
    set('f-body', Math.round(R0.sb*UNIT) + ' mm');
    set('f-total',Math.round((BASE_H + R0.sb + TOP_H + 2*CLAW_L)*UNIT) + ' mm');
  }

  function draw(target, tw, th){
    var c = target || ctx;
    var ow=W, oh=H, od=DPR;
    if(tw){ W=tw/2; H=th/2; DPR=2; }
    c.setTransform(DPR,0,0,DPR,0,0);
    c.clearRect(0,0,W,H);
    var P = palette();
    stageNotes(P);
    if(P.bg){ c.fillStyle = P.bg; c.fillRect(0,0,W,H); }
    /* A studio sweep: lighter behind the robot, falling off toward the edges. */
    if(P.sweep){
      var sg = c.createRadialGradient(W*HCEN, H*VCEN, 0, W*HCEN, H*VCEN, Math.max(W, H)*0.62);
      sg.addColorStop(0, P.sweep[0]); sg.addColorStop(1, P.sweep[1]);
      c.fillStyle = sg; c.fillRect(0,0,W,H);
    }
    /* A soft contact shadow under a single standing robot's base claw. */
    if(P.shadow && scene && scene.robots.length === 1){
      var R0 = scene.robots[0], fy = -1e9, fx = 0, fxs = [];
      for(var k=0;k<3;k++){
        var tp = proj(fingerLine(R0, -BASE_H, -1, R0.openBase, baseOffOf(R0), k).tip);
        fxs.push(tp.x); if(tp.y > fy) fy = tp.y;
      }
      fx = (Math.min.apply(null, fxs) + Math.max.apply(null, fxs))/2;
      var rx = Math.max(40, (Math.max.apply(null, fxs) - Math.min.apply(null, fxs))*0.75), ry = rx*0.16;
      c.save(); c.translate(fx, fy - ry*0.2); c.scale(1, ry/rx);
      var shg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      shg.addColorStop(0, P.shadow); shg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = shg; c.beginPath(); c.arc(0, 0, rx, 0, 2*Math.PI); c.fill(); c.restore();
    }
    /* A palette may set the robot on a card of its own: a rounded panel sized
       to the robot's extent over the whole animation (see heroFit). */
    if(P.card){
      var base = Math.min(W, H)*0.92*zoomF, cw = 0.856*base + 64, ch = 0.742*base + 56;
      ch = Math.min(ch, H - 24); cw = Math.min(cw, W - 24);
      var cx = W*HCEN - cw/2, cy = Math.max(12, Math.min(H - 12 - ch, H*VCEN - ch/2 + base*0.012)), rr = 18;
      c.fillStyle = P.card; c.beginPath();
      c.moveTo(cx+rr, cy); c.arcTo(cx+cw, cy, cx+cw, cy+ch, rr); c.arcTo(cx+cw, cy+ch, cx, cy+ch, rr);
      c.arcTo(cx, cy+ch, cx, cy, rr); c.arcTo(cx, cy, cx+cw, cy, rr); c.closePath(); c.fill();
    }
    K = Math.min(H, W) / SPAN * 0.92 * zoomF;
    /* Line widths and dot sizes were tuned for one robot filling a laptop
       stage, and scale with the drawing from there: zoom in and a rod thickens
       with the disks around it, zoom out and it thins, so the proportions hold
       at any size (with a floor so nothing vanishes). */
    LWS = Math.max(0.22, Math.min(5, K / LW_REF_K));
    // the hero draws the robot largest, so its lines grow more gently above the
    // reference: a third as fast, and no more than 1.4 times as thick
    if(MODE === 'hero' && LWS > 1) LWS = Math.min(1.4, 1 + (LWS - 1)*0.35);

    var items = [];
    scene.props.forEach(function(pr){ buildProp(pr, items, P); });
    scene.robots.forEach(function(R){ buildRobot(R, items, P); });
    items.sort(function(a,b){ return b.d - a.d; });

    /* A soft drop shadow the robot casts on the backdrop: its silhouette drawn
       once in a single colour off screen, then laid down blurred and offset
       before the robot itself is drawn. */
    if(P.drop){
      if(!DROP_CV) DROP_CV = document.createElement('canvas');
      DROP_CV.width = c.canvas.width; DROP_CV.height = c.canvas.height;
      var dc = DROP_CV.getContext('2d');
      dc.setTransform(DPR,0,0,DPR,0,0); dc.lineCap='round'; dc.lineJoin='round';
      dc.strokeStyle = dc.fillStyle = '#000';
      items.forEach(function(it){
        if(it.k === 'l'){ dc.lineWidth = it.abs ? it.w : it.w*LWS; dc.beginPath(); dc.moveTo(it.a.x, it.a.y); dc.lineTo(it.b.x, it.b.y); dc.stroke(); }
        else if(it.k === 'p'){ dc.beginPath(); it.q.forEach(function(q,i){ i ? dc.lineTo(q.x,q.y) : dc.moveTo(q.x,q.y); }); dc.closePath(); dc.fill(); }
      });
      c.save(); c.setTransform(1,0,0,1,0,0);
      c.globalAlpha = P.drop.alpha; c.filter = 'blur(' + (P.drop.blur*DPR) + 'px)';
      c.drawImage(DROP_CV, P.drop.dx*DPR, P.drop.dy*DPR);
      c.restore();
    }

    c.lineCap='round'; c.lineJoin='round';
    items.forEach(function(it){
      if(it.k === 'l'){
        c.globalAlpha = it.al; c.strokeStyle = it.col; c.lineWidth = it.abs ? it.w : it.w*LWS;
        c.setLineDash(it.dash ? it.dash.map(function(v){ return v*LWS; }) : []);
        c.beginPath(); c.moveTo(it.a.x, it.a.y); c.lineTo(it.b.x, it.b.y); c.stroke();
      } else if(it.k === 'p'){
        c.setLineDash([]); c.beginPath();
        it.q.forEach(function(p,i){ i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y); });
        c.closePath();
        c.globalAlpha = it.al; c.fillStyle = it.fill; c.fill();
        c.globalAlpha = 1; c.strokeStyle = it.stroke; c.lineWidth = it.w*LWS; c.stroke();
      } else if(it.k === 'ball'){
        c.setLineDash([]); c.globalAlpha = 1;
        var g = c.createRadialGradient(it.a.x - it.r*0.35, it.a.y - it.r*0.4, it.r*0.1, it.a.x, it.a.y, it.r*1.05);
        g.addColorStop(0, '#E8574C'); g.addColorStop(0.55, it.col); g.addColorStop(1, '#7E1B16');
        c.fillStyle = g; c.beginPath(); c.arc(it.a.x, it.a.y, it.r, 0, 2*Math.PI); c.fill();
      } else {
        c.globalAlpha = 1; c.setLineDash([]); c.fillStyle = it.col;
        c.beginPath(); c.arc(it.a.x, it.a.y, it.r*LWS, 0, 2*Math.PI); c.fill();
      }
    });
    c.globalAlpha = 1; c.setLineDash([]);

    if(showLabels) drawLabels(c, P);
    if(tw){ W=ow; H=oh; DPR=od; }
  }

  // Screen-only: 3 mm bleed on top, bottom and right, plus the masthead keep-out.
  /* The key, drawn on the robot instead of printed beside it: each part names
     itself where it actually is. The anchors come off the first robot in the
     scene and are computed the same way the drawing computes them, so they
     follow whatever shape the cables have put it in rather than pointing at
     remembered coordinates. Labels are stacked on whichever side of the body
     their anchor falls, far enough apart not to collide. */
  function partAnchors(R){
    var comp = R.sb/R.sb0, pitch = (MOD_H + GAP)*comp;
    var mid = Math.floor(R.n/2), rot = mid*Math.PI/3;
    var cr = Math.cos(rot), sr = Math.sin(rot), s0 = mid*pitch + GAP*comp/2;
    function node(i){
      var q = LOC[i];
      return place(R, s0 + (q[2] + ZMAX)*comp, q[0]*cr - q[1]*sr, q[0]*sr + q[1]*cr);
    }
    function mids(e){ var a = node(e[0]), b = node(e[1]);
      return [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]; }
    var ca = Math.cos(CAB_PHASE), sa = Math.sin(CAB_PHASE);
    return [
      ['Claw',                  fingerLine(R, R.sb + TOP_H, +1, R.openTop, R.clawOff, 0).tip],
      ['Claw module',           place(R, R.sb + TOP_H*0.5, TOP_R, 0)],
      ['Spacer disk',           place(R, mid*pitch, DISK_R, 0)],
      ['Tensegrity module',     place(R, s0 + ZMAX*comp, 0, LAT_R)],
      ['Carbon-fibre strut',    mids(struts[0])],
      ['TPU tendon lattice',    mids(tendons[0])],
      ['Actuation cable',       place(R, mid*pitch, CAB_R*ca, CAB_R*sa)],
      ['Base module',           place(R, -BASE_H*0.5, -BASE_R, 0)]
    ];
  }

  function drawLabels(c, P){
    if(!scene || !scene.robots.length) return;
    var R = scene.robots[0], pts = partAnchors(R);
    var rows = pts.map(function(a){ var q = proj(a[1]); return { t:a[0], x:q.x, y:q.y }; });
    var cx = 0;
    rows.forEach(function(r){ cx += r.x/rows.length; });
    var pad = Math.max(18, H*0.028), fs = Math.max(10, Math.min(14, H*0.019));
    [-1, 1].forEach(function(side){
      var col = rows.filter(function(r){ return (r.x < cx ? -1 : 1) === side; })
                    .sort(function(a,b){ return a.y - b.y; });
      // spread them so no two labels sit on top of each other
      var span = (col.length-1)*pad, y0 = Math.min(Math.max(H/2 - span/2, pad), H - pad - span);
      col.forEach(function(r, i){ r.ly = y0 + i*pad; r.lx = side < 0 ? pad*0.9 : W - pad*0.9; });
    });
    c.save();
    c.font = '600 ' + fs.toFixed(1) + 'px Archivo, system-ui, sans-serif';
    c.textBaseline = 'middle';
    rows.forEach(function(r){
      var right = r.lx > W/2;
      c.strokeStyle = P.keyLine || P.edge; c.lineWidth = 1; c.globalAlpha = P.keyLine ? 0.9 : 0.75;
      c.beginPath();
      c.moveTo(r.x, r.y);
      c.lineTo(r.lx + (right ? -6 : 6), r.ly);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = P.keyLine || P.edge;
      c.beginPath(); c.arc(r.x, r.y, 2.4, 0, 2*Math.PI); c.fill();
      c.textAlign = right ? 'right' : 'left';
      var w = c.measureText(r.t).width;
      c.fillStyle = P.labelBg;
      c.fillRect(right ? r.lx - w - 7 : r.lx - 3, r.ly - fs*0.82, w + 10, fs*1.64);
      c.fillStyle = P.label;
      c.fillText(r.t, r.lx, r.ly);
    });
    c.restore();
  }



  /* ---------------- UI ---------------- */
  /* Two dropdowns: the category chooses what kind of thing is being shown, the
     second lists the configurations inside it. A category with one entry still
     fills the second list, so the two always read together. */
  var CATS = [
    { label:'Single robot',
      keys:['s1','s2','s3','s4','s5'] },
    { label:'Docking',
      keys:['dock33','dock31','body'] },
    { label:'Cooperative manipulation',
      keys:['M1','M2','M3','M4','lift','hang4','stand4'] },
    { label:'Cooperative locomotion',
      keys:['L1','L2','L3','L4','H1'] },
    { label:'Conceptual configurations',
      keys:['C1','C2','C3','C4','C5','C6'] }
  ];
  var sel = document.getElementById('morph'), catEl = document.getElementById('cat');
  CATS.forEach(function(c, i){
    var o = document.createElement('option'); o.value = String(i); o.textContent = c.label;
    catEl.appendChild(o);
  });
  function fillMorphs(i, want){
    sel.innerHTML = '';
    CATS[i].keys.forEach(function(k){
      var o = document.createElement('option'); o.value = k; o.textContent = MORPHS[k].label;
      sel.appendChild(o);
    });
    sel.value = (want && CATS[i].keys.indexOf(want) >= 0) ? want : CATS[i].keys[0];
  }
  window.__tecobotCats = CATS;
  catEl.value = '0';
  fillMorphs(0, 's4');
  catEl.addEventListener('change', function(){
    fillMorphs(+catEl.value); rebuild(); rigPanel(); cabPanel(); sidePanel(); syncSliders(); draw();
  });

  /* ---- frame rig panel ----
     Rebuilt whenever the morphology changes, because the stations and which of
     them can move are the config's own, not the panel's. A dimension the config
     derives is shown disabled rather than hidden, so it is clear it exists and
     is not a choice. */
  var rigEl = document.getElementById('rig'), rigStEl = document.getElementById('rig-st'),
      rigNoteEl = document.getElementById('rig-note');
  var RIGDIM = [['w','rig-w'], ['d','rig-d'], ['h','rig-h']];
  var rigInputs = [];

  function rigPanel(){
    var key = sel.value, spec = MORPHS[key].frame;
    rigEl.hidden = !spec;
    rigNoteEl.hidden = true;
    if(!spec) return;
    var R = rigState(key);
    RIGDIM.forEach(function(p){
      var el = document.getElementById(p[1]);
      el.value = Math.round(R[p[0]]*100);
      el.disabled = (p[0] === 'd' && !!spec.depth);
    });
    rigStEl.innerHTML = '';
    rigInputs = [];
    spec.stations.forEach(function(s, i){
      if(s.fixed) return;
      var lab = document.createElement('label');
      var n = spec.stations.filter(function(q){ return !q.fixed; }).length;
      var same = spec.stations.filter(function(q){ return q.edge === s.edge && !q.fixed; });
      lab.textContent = s.slider === 'group' ? 'All three'
        : n === 1 ? 'Position'
        : EDGE[s.edge].short + (same.length > 1 ? ' ' + (same.indexOf(s) + 1) : '');
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = 0; inp.max = 1000; inp.step = 1;
      inp.value = Math.round(R.t[i]*1000);
      inp.addEventListener('input', function(){
        R.t[i] = +inp.value/1000; rebuild(true); draw(); rigReadout();
      });
      lab.appendChild(inp); rigStEl.appendChild(lab);
      rigInputs.push({ i:i, el:inp });
    });
    rigReadout();
  }

  /* The specs describe one robot, so they are shown where there is one robot to
     describe and the stage takes the whole width otherwise. */
  function sidePanel(){
    var one = CATS[+catEl.value] && CATS[+catEl.value].label === 'Single robot';
    var kb = document.getElementById('labels');
    kb.hidden = !one;
    if(!one && showLabels){ showLabels = false; toggleBtn(kb, false); }
    document.getElementById('side').hidden = !one;
    document.querySelector('.layout').style.gridTemplateColumns =
      one ? '' : 'minmax(0,1fr)';
  }

  function rigReadout(){
    var key = sel.value, spec = MORPHS[key].frame;
    if(!spec) return;
    var R = rigState(key), F = (scene && scene.rigF) || resolveRig(key).F;
    function set(id, mm){ document.getElementById(id).textContent = Math.round(mm) + ' mm'; }
    set('rig-w-o', 2*F.hx*UNIT); set('rig-d-o', 2*F.hy*UNIT); set('rig-h-o', F.h*UNIT);
    // a dimension the rig had to clamp shows its clamped value, not the slider's
    document.getElementById('rig-w').value = Math.round(F.hx/station().hx*100);
    rigInputs.forEach(function(r){ r.el.value = Math.round(R.t[r.i]*1000); });
    var notes = (scene && scene.rigNotes) || [];
    rigNoteEl.hidden = !notes.length;
    rigNoteEl.textContent = notes.join(' · ');
  }

  RIGDIM.forEach(function(p){
    document.getElementById(p[1]).addEventListener('input', function(){
      var R = rigState(sel.value);
      if(!R) return;
      R[p[0]] = this.value/100;
      rebuild(true); draw(); rigReadout();
    });
  });
  document.getElementById('rig-reset').addEventListener('click', function(){
    delete RIG[sel.value]; rebuild(true); rigPanel(); draw();
  });

  /* ---- cable panel ----
     One robot, or all of them, and the three cables that shape it. The sliders
     always open on what the configuration already is: a robot nobody has taken
     over reports the cable lengths its own pose implies, so moving a slider
     picks the shape up from where it was rather than snapping it straight. */
  var cabSel = document.getElementById('cab-r'), cabPick = {};
  /* Slider bounds for the four-module build. Cable travel is a length along the
     body, so a stack of a different height gets its share of them — a single
     module can only take a quarter of what four can. */
  var CAB_LO = -20, CAB_HI = 140;
  function cabRange(R){
    var k = (R ? R.n : N)/N;
    return { lo: Math.round(CAB_LO*k), hi: Math.round(CAB_HI*k) };
  }

  function cabRobots(){ return (scene && scene.robots) || []; }
  function cabTarget(){
    var rs = cabRobots(), pk = cabSel.value;
    if(pk === 'all') return rs[(MORPHS[sel.value].cabOnly || [0])[0]] || rs[0];
    return rs[Math.min(+pk, rs.length-1)];
  }
  /* A configuration says which of its robots the cables may drive, and the
     robots come before All robots because a single robot is the common case.
     Some docks are only one-way: the robot positioned from another can be moved
     freely, but moving the one it hangs off would need the dock re-derived, and
     where that is not done the option is not offered rather than left to come
     apart under the slider. */
  function cabPanel(){
    var key = sel.value, spec = MORPHS[key], rs = cabRobots();
    document.getElementById('cab').hidden = (spec.cab === false);
    if(spec.cab === false) return;
    var allow = (spec.cabOnly || rs.map(function(_, i){ return i; }))
                  .filter(function(i){ return i < rs.length; });
    cabSel.innerHTML = '';
    var opts = allow.map(function(i){
      return [String(i), 'Robot ' + (i+1) + (rs[i].name ? ' \u2014 ' + rs[i].name : '')];
    });
    opts.forEach(function(o){
      var e = document.createElement('option'); e.value = o[0]; e.textContent = o[1];
      cabSel.appendChild(e);
    });
    var want = cabPick[key], ok = opts.some(function(o){ return o[0] === want; });
    cabSel.value = ok ? want : opts[0][0];
    cabSync();
  }
  function cabSync(){
    var R = cabTarget();
    if(!R) return;
    var rg = cabRange(R);
    for(var i=0;i<3;i++){
      var el = document.getElementById('cab-'+(i+1));
      el.min = rg.lo; el.max = rg.hi;
      var mm = Math.max(rg.lo, Math.min(rg.hi, Math.round(R.cab[i]*UNIT)));
      el.value = mm;
      document.getElementById('cab-'+(i+1)+'-o').textContent = (mm > 0 ? '+' : '') + mm;
    }
  }
  [1,2,3].forEach(function(nn){
    document.getElementById('cab-'+nn).addEventListener('input', function(){
      var key = sel.value, rs = cabRobots(), pk = cabSel.value, v = u(+this.value);
      if(!rs.length) return;
      if(!CAB[key]) CAB[key] = [];
      var targets = pk === 'all'
        ? (MORPHS[key].cabOnly || rs.map(function(_, i){ return i; })).map(function(i){ return rs[i]; })
        : [rs[Math.min(+pk, rs.length-1)]];
      targets.forEach(function(R){
        if(!R) return;
        var cur = (CAB[key][R.cabId] || R.cab).slice();
        cur[nn-1] = v; CAB[key][R.cabId] = cur;
      });
      rebuild(true); draw(); cabSync();
    });
  });
  cabSel.addEventListener('change', function(){ cabPick[sel.value] = cabSel.value; cabSync(); });
  document.getElementById('cab-reset').addEventListener('click', function(){
    delete CAB[sel.value]; rebuild(true); cabPanel(); draw();
  });

  var zoomEl = document.getElementById('zoom');
  function syncSliders(){ zoomEl.value = Math.round(zoomF*100); }
  zoomEl.addEventListener('input', function(){ zoomF = zoomEl.value/100; draw(); });
  sel.addEventListener('change', function(){ rebuild(); rigPanel(); cabPanel(); syncSliders(); draw(); });
  document.getElementById('pal').addEventListener('change', function(){ draw(); });
  function toggleBtn(el, on){
    el.style.background = on ? 'var(--accent)' : '';
    el.style.color = on ? '#fff' : '';
    el.style.borderColor = on ? 'var(--accent)' : '';
  }
  document.getElementById('labels').addEventListener('click', function(){
    showLabels = !showLabels; toggleBtn(this, showLabels); draw();
  });
  document.getElementById('freerot').addEventListener('click', function(){
    freeRot = !freeRot; toggleBtn(this, freeRot);
    // coming back from free, bring the view inside the normal limits again
    if(!freeRot){ cam.el = Math.max(-0.1, Math.min(1.1, cam.el)); draw(); }
  });
  document.getElementById('panmode').addEventListener('click', function(){
    panMode = !panMode; toggleBtn(this, panMode);
    view.classList.toggle('panning', panMode);
  });

  var view = document.getElementById('view'), dragging=false, px=0, py=0;
  view.addEventListener('pointerdown', function(e){
    /* The hero drives the camera itself, so orbiting is off there: a drag would
       fight the animation, which overwrites the camera on the next frame.
       And anything interactive sitting over the stage keeps its own clicks —
       pointer capture redirects the click that follows to the capture target,
       so grabbing every pointerdown here swallowed the splash button. */
    if(splashing || e.target.closest('.splashInner')) return;
    dragging=true; px=e.clientX; py=e.clientY; view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', function(e){
    if(!dragging) return;
    if(panMode){
      /* Pan by sliding the point the camera looks at, in the plane of the
         screen. The two world directions fall out of the projection itself:
         (cos az, -sin az, 0) moves purely along screen x, and
         (sin el sin az, sin el cos az, cos el) purely up the screen. Moving the
         focus one way slides the scene the other, hence the signs. */
      var ca2 = Math.cos(cam.az), sa2 = Math.sin(cam.az);
      var ce2 = Math.cos(cam.el), se2 = Math.sin(cam.el);
      FOCUS = add(add(FOCUS, [ca2, -sa2, 0], -(e.clientX - px)/K),
                  [se2*sa2, se2*ca2, ce2], (e.clientY - py)/K);
      px = e.clientX; py = e.clientY; draw();
      return;
    }
    cam.az += (e.clientX-px)*0.007;
    /* The view is normally held between level and overhead, which is where
       these configurations read; Free rotate lets it tip right over. */
    var hi = freeRot ? 1.52 : 1.1, lo = freeRot ? -1.52 : -0.1;
    cam.el = Math.max(lo, Math.min(hi, cam.el + (e.clientY-py)*0.005));
    px=e.clientX; py=e.clientY; syncSliders(); draw();
  });
  ['pointerup','pointercancel'].forEach(function(n){ view.addEventListener(n, function(){ dragging=false; }); });

  /* Wheel zoom. Multiplicative, so one notch covers the same proportion of the
     range wherever you are in it, and the page itself is kept from scrolling. */
  view.addEventListener('wheel', function(e){
    /* On the hero the wheel belongs to the page, not to the zoom. Swallowing it
       here both fought the animation, which sets its own zoom every frame, and
       stopped the wheel scrolling down to the writing the hero invites you to
       read. */
    if(splashing) return;
    e.preventDefault();
    var step = Math.pow(1.0016, -e.deltaY * (e.deltaMode === 1 ? 16 : 1));
    zoomF = Math.max(0.6, Math.min(5, zoomF * step));
    syncSliders(); draw();
  }, { passive:false });

  document.getElementById('save').addEventListener('click', function(){
    var dim = [Math.round(W*2), Math.round(H*2)];
    var off = document.createElement('canvas');
    off.width = dim[0]; off.height = dim[1];
    draw(off.getContext('2d'), dim[0], dim[1]);
    var a = document.createElement('a');
    a.download = 'tecobot-' + document.getElementById('morph').value + '-' + dim[0] + 'x' + dim[1] + '.png';
    a.href = off.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  });

  readColors();
  if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener){
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ readColors(); draw(); });
  }
  window.addEventListener('resize', function(){ if(splashing){ heroFrame(); resize(); heroFit(); } else resize(); draw(); });
  /* ---- the way in ----
     The page opens on one four-module robot working through its own range —
     cables pulled round the circle for bending, pulled together for
     compression — with everything else out of the way behind one button. The
     animation drives the same cable override the sliders drive, so what is on
     screen before the click is the thing the controls act on after it. */
  /* The hero works through the robot's repertoire in order rather than running
     two sinusoids over each other, and it opens on the part most continuum
     robots cannot do: pull all three cables together and the body collapses,
     dead straight. Only then does it extend and bend, sweeping the bending
     direction round, which is the other half of what three cables buy — and it
     finishes by doing both at once.

     Each row is a keyframe: time, the collective pull, the bending amplitude,
     and the bending direction in turns. */
  /* The hero runs on two clocks, the bend sweeping its direction round while
     the collective pull breathes — but it opens on a compression, because that
     is the one thing most continuum robots cannot do. The bend fades in over
     the first few seconds so the page's first move is the body shortening dead
     straight; after that the two simply run. */
  function splashPose(t){
    var dir = t*0.55;                                   // bend direction, going round
    var warm = Math.min(1, Math.max(0, (t - 3.2)/3.4)); // bending, once the squeeze has shown
    var squeeze = 116*(0.5 - 0.5*Math.cos(t*0.42));     // the three pulled together
    var amp = 69*warm*(0.52 + 0.48*Math.sin(t*0.29));   // how hard it bends
    return [0,1,2].map(function(k){
      return u(squeeze + amp*Math.cos(CAB_PHASE + k*2*Math.PI/3 - dir));
    });
  }


  function heroCam(t){
    cam.az = 0.5*Math.sin(t*0.17);
    cam.el = 0.16 + 0.06*Math.sin(t*0.11);
  }
  /* Exposed so the hero's extremes can be checked at fixed phases rather than
     by catching the animation mid-sweep. */
  window.__heroAt = function(t){
    CAB.s4 = [splashPose(t)];
    heroCam(t);
    zoomF = HERO_Z;
    rebuild(true); draw();
    var R = scene.robots[0];
    // how far the claw plate swings off the base axis on screen, in pixels:
    // the number that says whether the bend is actually being shown
    var p0 = proj(place(R, -BASE_H, 0, 0)), p1 = proj(place(R, R.sb + TOP_H, 0, 0));
    return { bend: Math.round(R.bendDeg), body: Math.round(R.sb*UNIT),
             swing: Math.round(Math.abs(p1.x - p0.x)) };
  };
  var splashStart = 0, splashRAF = 0, splashLast = 0;
  function splashFrame(ts){
    if(!splashing) return;
    if(!splashStart) splashStart = ts;
    var onScreen = canvas.parentNode.getBoundingClientRect().bottom > 0;
    if(onScreen && ts - splashLast > 32){               // ~30fps is plenty
      splashLast = ts;
      var t = (ts - splashStart)/1000;
      CAB.s4 = [splashPose(t)];
      zoomF = HERO_Z;
      heroCam(t);
      rebuild(true); draw();
    }
    splashRAF = requestAnimationFrame(splashFrame);
  }
  function enterApp(){
    if(!splashing) return;
    splashing = false;
    VCEN = 0.56; HCEN = 0.5;
    cancelAnimationFrame(splashRAF);
    window.scrollTo(0, 0);
    delete CAB.s4;
    document.body.classList.remove('splashing');
    cam.az = MORPHS.s4.cam.az; cam.el = MORPHS.s4.cam.el;
    resize(); rebuild(); rigPanel(); cabPanel(); sidePanel(); syncSliders(); draw();
  }
  ['play','play2'].forEach(function(id){
    var el = document.getElementById(id);
    // on the landing page these are links to the Play page, not buttons
    if(el && el.tagName === 'BUTTON') el.addEventListener('click', enterApp);
  });

  if(MODE === 'hero'){
    document.body.classList.add('splashing');
    heroFrame();
    resize(); heroFit(); rebuild(); rigPanel(); cabPanel(); sidePanel(); syncSliders(); draw();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce){ CAB.s4 = [splashPose(9)]; heroCam(9); zoomF = HERO_Z; rebuild(true); draw(); }
    else splashRAF = requestAnimationFrame(splashFrame);
  } else {
    VCEN = 0.56; HCEN = 0.5;
    /* A link such as play/#M1 opens on that configuration. */
    var want = (location.hash || '').slice(1);
    if(!(want && MORPHS[want])) want = 'C6';   // the elephant greets new visitors
    if(want && MORPHS[want]){
      CATS.forEach(function(c, i){ if(c.keys.indexOf(want) >= 0){ catEl.value = String(i); fillMorphs(i, want); } });
    }
    resize(); rebuild(); rigPanel(); cabPanel(); sidePanel(); syncSliders(); draw();
  }
})();
