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

// Computa la posición de la cámara para los modos fijos. El tráiler está
// centrado en (largo/2, alto/2, ancho/2). Distancia: 1.5× la dim más grande.
function fixedCameraPose(mode, TR) {
  const cx = TR.largo / 2;
  const cy = TR.alto / 2;
  const cz = TR.ancho / 2;
  const dist = Math.max(TR.largo, TR.alto, TR.ancho) * 1.5;
  if (mode === 'front') {
    // Mirando desde fuera del tráiler hacia la cara delantera (X bajo).
    return { pos: [-dist, cy, cz], target: [cx, cy, cz] };
  }
  if (mode === 'side') {
    // Lateral derecho.
    return { pos: [cx, cy, cz + dist], target: [cx, cy, cz] };
  }
  if (mode === 'top') {
    // Picada cenital.
    return { pos: [cx, cy + dist, cz], target: [cx, cy, cz] };
  }
  return null;
}

// TR llega como prop `trailer`; lo aliaseamos a TR para mantener consistencia
// con el resto del proyecto (constantes geométricas usan TR.largo/ancho/alto).
function Viewer3D({ placed, selId, stRef, onZoomIn, onZoomOut, simMode, simStep, trailer: TR, cameraMode = 'free' }) {
  const mountRef = useRef(null);
  const orbitState = stRef;
  const threeRef = useRef({ scene: null, camera: null, renderer: null, animationFrameId: null });
  // Ref con el modo de cámara más reciente — leído por los handlers (que viven
  // dentro del useEffect inicial y de otra forma capturarían un valor viejo).
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) return;
    const width = mountElement.clientWidth || 800;
    const height = mountElement.clientHeight || Math.round(width * 0.65);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(getThemeBackground());

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mountElement.appendChild(renderer.domElement);
    threeRef.current = { scene, camera, renderer, animationFrameId: null };

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1500, 2000, 1000);
    scene.add(directionalLight);

    const trailerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(TR.largo, TR.alto, TR.ancho)),
      new THREE.LineBasicMaterial({ color: 0x334155 })
    );
    trailerEdges.position.set(TR.largo / 2, TR.alto / 2, TR.ancho / 2);
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
    scene.add(floorPlane);

    const centerX = TR.largo / 2;
    const centerY = TR.alto / 2;
    const centerZ = TR.ancho / 2;

    const updateCamera = () => {
      if (cameraModeRef.current !== 'free') {
        // Modo fijo: la posición se setea via useEffect aparte. Solo aseguramos
        // que la cámara mire al centro en cada frame por si algo la mueve.
        const pose = fixedCameraPose(cameraModeRef.current, TR);
        if (pose) camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
        return;
      }
      const orbit = orbitState.current;
      camera.position.set(
        centerX + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        centerY + orbit.radius * Math.cos(orbit.phi),
        centerZ + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta)
      );
      camera.lookAt(centerX, centerY, centerZ);
    };
    updateCamera();

    const animate = () => {
      threeRef.current.animationFrameId = requestAnimationFrame(animate);
      updateCamera();
      renderer.render(scene, camera);
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

    // ResizeObserver: el canvas sigue al contenedor cuando cambia de tamaño.
    let resizeObs = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0 && h > 0) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
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

  // Cuando cambia cameraMode, recolocar la cámara en su posición fija (o
  // dejarla bajo control de orbitState si vuelve a 'free').
  useEffect(() => {
    const { camera } = threeRef.current;
    if (!camera) return;
    const pose = fixedCameraPose(cameraMode, TR);
    if (pose) {
      camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    }
    // En modo 'free' no tocamos nada — el animate loop lee orbitState.
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
