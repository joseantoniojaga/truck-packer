import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Plus, Minus } from "lucide-react";

// Lee el color de fondo apropiado para la escena según el tema actual.
// Resuelve la CSS variable (no se puede pasar `var(--x)` directo a THREE).
function getThemeBackground() {
  if (typeof document === "undefined") return "#0A1420";
  const theme = document.documentElement.getAttribute("data-theme");
  const computed = getComputedStyle(document.documentElement);
  if (theme === "dark") {
    return (computed.getPropertyValue("--bg-base").trim() || "#0A1420");
  }
  return (computed.getPropertyValue("--bg-subtle").trim() || "#EEF2F6");
}

// Configuración de la cámara ortográfica para los modos fijos
// (Frente / Lado / Arriba). Una proyección ortográfica elimina la distorsión
// de perspectiva — el tráiler se ve como plano técnico, no como render 3D.
//
// Devuelve { pos, target, up, left, right, top, bottom } o null si el modo
// no es uno de los tres soportados. El frustum se calcula de modo que el
// bbox visible del tráiler en ese modo entre con un 10% de margen y el
// aspect del canvas se respeta (sin estirar la imagen).
function orthoView(mode, TR, aspect) {
  const cx = TR.largo / 2;
  const cy = TR.alto / 2;
  const cz = TR.ancho / 2;

  // bbox visible en pantalla (H = horizontal, V = vertical) por modo.
  let bboxH, bboxV;
  if (mode === "front")      { bboxH = TR.ancho; bboxV = TR.alto;  }
  else if (mode === "side")  { bboxH = TR.largo; bboxV = TR.alto;  }
  else if (mode === "top")   { bboxH = TR.ancho; bboxV = TR.largo; }
  else return null;

  const margin = 1.1;
  const bboxAspect = bboxH / bboxV;

  // Si el canvas es más ancho que el bbox, limita por altura y expande H.
  // Si es más alto/angosto, limita por ancho y expande V. Así no hay
  // distorsión y queda centrado.
  let halfH, halfV;
  if (aspect > bboxAspect) {
    halfV = (bboxV / 2) * margin;
    halfH = halfV * aspect;
  } else {
    halfH = (bboxH / 2) * margin;
    halfV = halfH / aspect;
  }

  // En ortho la distancia no afecta el tamaño en pantalla — solo importa
  // estar fuera del bbox y dentro del `far`. Usamos 3× la dim más grande.
  const dist = Math.max(TR.largo, TR.alto, TR.ancho) * 3;

  if (mode === "front") {
    return { pos: [cx - dist, cy, cz], target: [cx, cy, cz], up: [0, 1, 0],
             left: -halfH, right: halfH, top: halfV, bottom: -halfV };
  }
  if (mode === "side") {
    return { pos: [cx, cy, cz + dist], target: [cx, cy, cz], up: [0, 1, 0],
             left: -halfH, right: halfH, top: halfV, bottom: -halfV };
  }
  if (mode === "top") {
    // Vista cenital: el frente del tráiler (X bajo) debe apuntar HACIA
    // ARRIBA en la pantalla. Eso se logra con up = (0,0,-1).
    return { pos: [cx, cy + dist, cz], target: [cx, cy, cz], up: [0, 0, -1],
             left: -halfH, right: halfH, top: halfV, bottom: -halfV };
  }
  return null;
}

// TR llega como prop `trailer`; lo aliaseamos a TR para mantener consistencia
// con el resto del proyecto (constantes geométricas usan TR.largo/ancho/alto).
function Viewer3D({ placed, selId, stRef, onZoomIn, onZoomOut, simMode, simStep, trailer: TR, cameraMode = 'free' }) {
  const mountRef = useRef(null);
  const orbitState = stRef;
  // Guardamos refs tanto a la perspectiva (modo free / OrbitControls casero)
  // como a la ortográfica (vistas fijas). `activeCamera` apunta a la que
  // se está renderizando ahora.
  const threeRef = useRef({
    scene: null,
    perspectiveCamera: null,
    orthoCamera: null,
    activeCamera: null,
    renderer: null,
    animationFrameId: null,
  });
  // Refs con los valores más recientes — leídos por handlers / animate.
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const trailerRef = useRef(TR);
  trailerRef.current = TR;

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) return;
    const width = mountElement.clientWidth || 800;
    const height = mountElement.clientHeight || Math.round(width * 0.65);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(getThemeBackground());

    const perspectiveCamera = new THREE.PerspectiveCamera(45, width / height, 1, 100000);
    // Ortho: el frustum real se setea en el useEffect que reacciona a
    // cameraMode/trailer; aquí solo placeholder con near/far razonables.
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mountElement.appendChild(renderer.domElement);
    threeRef.current = {
      scene, perspectiveCamera, orthoCamera, activeCamera: perspectiveCamera,
      renderer, animationFrameId: null,
    };

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1500, 2000, 1000);
    scene.add(directionalLight);

    // Edges + floor iniciales — se etiquetan con userData.kind para que el
    // useEffect dedicado a `trailer` pueda recrearlos cuando cambian dims.
    const trailerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TR.largo, TR.alto, TR.ancho)),
      new THREE.LineBasicMaterial({ color: 0x334155 })
    );
    trailerEdges.position.set(TR.largo / 2, TR.alto / 2, TR.ancho / 2);
    trailerEdges.userData.kind = "trailerEdges";
    scene.add(trailerEdges);

    const floorPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(TR.largo, TR.ancho),
      new THREE.MeshBasicMaterial({
        color: 0x0F172A,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
    );
    floorPlane.rotation.x = -Math.PI / 2;
    floorPlane.position.set(TR.largo / 2, 0.5, TR.ancho / 2);
    floorPlane.userData.kind = "floor";
    scene.add(floorPlane);

    // Posición inicial de la perspectiva via orbitState.
    const initOrbit = () => {
      const t = trailerRef.current;
      const orbit = orbitState.current;
      perspectiveCamera.position.set(
        t.largo / 2 + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        t.alto / 2 + orbit.radius * Math.cos(orbit.phi),
        t.ancho / 2 + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta)
      );
      perspectiveCamera.lookAt(t.largo / 2, t.alto / 2, t.ancho / 2);
    };
    initOrbit();

    // updateCamera solo actualiza la PERSPECTIVA (modo free). La ortho la
    // configura el useEffect dependiente de [cameraMode, trailer] y no
    // necesita actualizarse por frame.
    const updateCamera = () => {
      if (cameraModeRef.current !== 'free') return;
      const t = trailerRef.current;
      const orbit = orbitState.current;
      perspectiveCamera.position.set(
        t.largo / 2 + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        t.alto / 2 + orbit.radius * Math.cos(orbit.phi),
        t.ancho / 2 + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta)
      );
      perspectiveCamera.lookAt(t.largo / 2, t.alto / 2, t.ancho / 2);
    };

    const animate = () => {
      threeRef.current.animationFrameId = requestAnimationFrame(animate);
      updateCamera();
      renderer.render(scene, threeRef.current.activeCamera);
    };
    animate();

    const canvas = renderer.domElement;

    const onPointerDown = (x, y) => {
      if (cameraModeRef.current !== 'free') return;
      orbitState.current.dragging = true;
      orbitState.current.lastX = x;
      orbitState.current.lastY = y;
    };
    const onPointerMove = (x, y) => {
      if (cameraModeRef.current !== 'free') return;
      if (!orbitState.current.dragging) return;
      orbitState.current.theta -= (x - orbitState.current.lastX) * 0.008;
      orbitState.current.phi = Math.max(
        0.2,
        Math.min(Math.PI - 0.2, orbitState.current.phi - (y - orbitState.current.lastY) * 0.008)
      );
      orbitState.current.lastX = x;
      orbitState.current.lastY = y;
    };
    const onPointerUp = () => {
      orbitState.current.dragging = false;
    };

    canvas.addEventListener("mousedown", e => onPointerDown(e.clientX, e.clientY));
    canvas.addEventListener("mousemove", e => onPointerMove(e.clientX, e.clientY));
    canvas.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("mouseleave", onPointerUp);
    canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", e => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener("touchend", onPointerUp);
    canvas.addEventListener("wheel", e => {
      if (cameraModeRef.current !== 'free') return;
      orbitState.current.radius = Math.max(
        400,
        Math.min(4000, orbitState.current.radius + e.deltaY * 2)
      );
    }, { passive: true });

    // ResizeObserver: ajusta ambas cámaras al nuevo aspect. La ortho
    // necesita además recomputar el frustum porque su escala depende del
    // aspect (a diferencia de la perspectiva, donde basta updateProjectionMatrix).
    let resizeObs = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0 && h > 0) {
            renderer.setSize(w, h, false);
            const aspect = w / h;
            perspectiveCamera.aspect = aspect;
            perspectiveCamera.updateProjectionMatrix();
            if (cameraModeRef.current !== 'free') {
              const conf = orthoView(cameraModeRef.current, trailerRef.current, aspect);
              if (conf) {
                const cam = threeRef.current.orthoCamera;
                cam.left = conf.left;
                cam.right = conf.right;
                cam.top = conf.top;
                cam.bottom = conf.bottom;
                cam.updateProjectionMatrix();
              }
            }
          }
        }
      });
      resizeObs.observe(mountElement);
    }

    // MutationObserver: el background sigue al toggle de tema (data-theme).
    let themeObs = null;
    if (typeof MutationObserver !== "undefined") {
      themeObs = new MutationObserver(() => {
        scene.background = new THREE.Color(getThemeBackground());
      });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    return () => {
      cancelAnimationFrame(threeRef.current.animationFrameId);
      if (resizeObs) resizeObs.disconnect();
      if (themeObs) themeObs.disconnect();
      renderer.dispose();
      if (mountElement.contains(renderer.domElement)) mountElement.removeChild(renderer.domElement);
    };
  }, []);

  // Recrea los edges del tráiler y el plano del piso cuando cambian las
  // dims. Sin esto, editar el tráiler dejaba la wireframe vieja en escena.
  useEffect(() => {
    const ref = threeRef.current;
    if (!ref || !ref.scene) return;
    const scene = ref.scene;

    const toRemove = scene.children.filter(o =>
      o.userData?.kind === "trailerEdges" || o.userData?.kind === "floor"
    );
    toRemove.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TR.largo, TR.alto, TR.ancho)),
      new THREE.LineBasicMaterial({ color: 0x334155 })
    );
    edges.position.set(TR.largo / 2, TR.alto / 2, TR.ancho / 2);
    edges.userData.kind = "trailerEdges";
    scene.add(edges);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(TR.largo, TR.ancho),
      new THREE.MeshBasicMaterial({
        color: 0x0F172A,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(TR.largo / 2, 0.5, TR.ancho / 2);
    floor.userData.kind = "floor";
    scene.add(floor);
  }, [TR.largo, TR.alto, TR.ancho]);

  // Cambia entre perspectiva (modo free) y ortográfica (vistas fijas), y
  // recalcula el frustum de la ortho según el modo + dims actuales.
  useEffect(() => {
    const ref = threeRef.current;
    if (!ref || !ref.renderer || !ref.orthoCamera) return;

    if (cameraMode === "free") {
      ref.activeCamera = ref.perspectiveCamera;
      return;
    }

    const w = ref.renderer.domElement.clientWidth || 1;
    const h = ref.renderer.domElement.clientHeight || 1;
    const aspect = w / h;
    const conf = orthoView(cameraMode, TR, aspect);
    if (!conf) return;

    const cam = ref.orthoCamera;
    cam.left = conf.left;
    cam.right = conf.right;
    cam.top = conf.top;
    cam.bottom = conf.bottom;
    cam.position.set(conf.pos[0], conf.pos[1], conf.pos[2]);
    cam.up.set(conf.up[0], conf.up[1], conf.up[2]);
    cam.lookAt(conf.target[0], conf.target[1], conf.target[2]);
    cam.updateProjectionMatrix();
    ref.activeCamera = cam;
  }, [cameraMode, TR.largo, TR.alto, TR.ancho]);

  useEffect(() => {
    const { scene } = threeRef.current;
    if (!scene) return;

    const meshesToRemove = [];
    scene.traverse(child => {
      if (child.userData.bx) meshesToRemove.push(child);
    });
    meshesToRemove.forEach(child => {
      child.geometry.dispose();
      child.material.dispose();
      scene.remove(child);
    });

    const visible = simMode ? placed.slice(0, simStep) : placed;
    visible.forEach((placedItem, idx) => {
      const isCurrent = simMode && idx === simStep - 1;
      const isSelected = !simMode && selId === placedItem.id;
      const geometry = new THREE.BoxGeometry(placedItem.l - 1, placedItem.h - 1, placedItem.w - 1);
      const meshColor = new THREE.Color(placedItem.color);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        color: meshColor,
        transparent: true,
        opacity: isCurrent || isSelected ? 1 : simMode ? 0.65 : 0.82,
        emissive: isCurrent ? meshColor : isSelected ? meshColor : new THREE.Color(0),
        emissiveIntensity: isCurrent ? 0.5 : isSelected ? 0.3 : 0,
      }));
      mesh.position.set(
        placedItem.x + placedItem.l / 2,
        placedItem.z + placedItem.h / 2,
        placedItem.y + placedItem.w / 2
      );
      mesh.userData = { bx: true };
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: isCurrent ? "#ffffff" : placedItem.color })
      ));
      scene.add(mesh);
    });
  }, [placed, selId, simMode, simStep]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {/* Mini-ActionBar de zoom en la esquina inferior derecha, mismo
          tratamiento visual que el ActionBar principal. */}
      <div style={{
        position: "absolute",
        bottom: 16, right: 16,
        zIndex: 15,
        display: "inline-flex",
        gap: 4,
        padding: 6,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
      }}>
        <button
          type="button"
          className="action-btn action-btn--secondary"
          onClick={onZoomIn}
          aria-label="Acercar"
          title="Acercar"
          style={{ padding: "10px 14px" }}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="action-btn action-btn--secondary"
          onClick={onZoomOut}
          aria-label="Alejar"
          title="Alejar"
          style={{ padding: "10px 14px" }}
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
}

export default Viewer3D;
