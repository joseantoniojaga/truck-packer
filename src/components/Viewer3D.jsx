import { useRef, useEffect } from "react";
import * as THREE from "three";
import { COLORS } from "../constants.js";

// TR llega como prop `trailer`; lo aliaseamos a TR para mantener consistencia
// con el resto del proyecto (constantes geométricas usan TR.largo/ancho/alto).
function Viewer3D({ placed, selId, stRef, onZoomIn, onZoomOut, simMode, simStep, trailer: TR }) {
  const mountRef = useRef(null);
  const orbitState = stRef;
  const threeRef = useRef({ scene: null, camera: null, renderer: null, animationFrameId: null });

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) return;
    const width = mountElement.clientWidth;
    const height = Math.round(width * 0.65);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080E1A");

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      orbitState.current.dragging = true;
      orbitState.current.lastX = x;
      orbitState.current.lastY = y;
    };
    const onPointerMove = (x, y) => {
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
      orbitState.current.radius = Math.max(
        400,
        Math.min(4000, orbitState.current.radius + e.deltaY * 2)
      );
    }, { passive: true });

    return () => {
      cancelAnimationFrame(threeRef.current.animationFrameId);
      renderer.dispose();
      if (mountElement.contains(renderer.domElement)) mountElement.removeChild(renderer.domElement);
    };
  }, []);

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

  const zoomButtonStyle = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 6, overflow: "hidden" }}>
      <div ref={mountRef} style={{ width: "100%" }} />
      <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 6 }}>
        <button onClick={onZoomIn} style={zoomButtonStyle}>+</button>
        <button onClick={onZoomOut} style={zoomButtonStyle}>−</button>
      </div>
    </div>
  );
}

export default Viewer3D;
