import { useRef, useEffect } from "react";
import * as THREE from "three";
import { COLORS } from "../constants.js";

// TR llega como prop `trailer`; lo aliaseamos a TR para mantener idéntico el
// código de la implementación interna (rebautizo viene en paso posterior).
function Viewer3D({placed,selId,stRef,onZoomIn,onZoomOut,simMode,simStep,trailer:TR}){
  const mRef=useRef(null);const st=stRef;
  const R=useRef({s:null,c:null,r:null,f:null});
  useEffect(()=>{
    const el=mRef.current;if(!el)return;const W=el.clientWidth,H=Math.round(W*0.65);
    const s=new THREE.Scene();s.background=new THREE.Color("#080E1A");
    const c=new THREE.PerspectiveCamera(45,W/H,1,10000);
    const r=new THREE.WebGLRenderer({antialias:true});r.setSize(W,H);r.setPixelRatio(Math.min(window.devicePixelRatio,2));
    el.appendChild(r.domElement);R.current={s,c,r,f:null};
    s.add(new THREE.AmbientLight(0xffffff,0.5));const dl=new THREE.DirectionalLight(0xffffff,0.8);dl.position.set(1500,2000,1000);s.add(dl);
    const tl=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TR.largo,TR.alto,TR.ancho)),new THREE.LineBasicMaterial({color:0x334155}));
    tl.position.set(TR.largo/2,TR.alto/2,TR.ancho/2);s.add(tl);
    const fp=new THREE.Mesh(new THREE.PlaneGeometry(TR.largo,TR.ancho),new THREE.MeshBasicMaterial({color:0x0F172A,side:THREE.DoubleSide,transparent:true,opacity:0.5}));
    fp.rotation.x=-Math.PI/2;fp.position.set(TR.largo/2,0.5,TR.ancho/2);s.add(fp);
    const cx=TR.largo/2,cy=TR.alto/2,cz=TR.ancho/2;
    const upd=()=>{const v=st.current;c.position.set(cx+v.r*Math.sin(v.ph)*Math.cos(v.th),cy+v.r*Math.cos(v.ph),cz+v.r*Math.sin(v.ph)*Math.sin(v.th));c.lookAt(cx,cy,cz);};upd();
    const an=()=>{R.current.f=requestAnimationFrame(an);upd();r.render(s,c);};an();
    const cv=r.domElement;
    const oD=(x,y)=>{st.current.dr=true;st.current.lx=x;st.current.ly=y;};
    const oM=(x,y)=>{if(!st.current.dr)return;st.current.th-=(x-st.current.lx)*0.008;st.current.ph=Math.max(0.2,Math.min(Math.PI-0.2,st.current.ph-(y-st.current.ly)*0.008));st.current.lx=x;st.current.ly=y;};
    const oU=()=>{st.current.dr=false;};
    cv.addEventListener("mousedown",e=>oD(e.clientX,e.clientY));cv.addEventListener("mousemove",e=>oM(e.clientX,e.clientY));
    cv.addEventListener("mouseup",oU);cv.addEventListener("mouseleave",oU);
    cv.addEventListener("touchstart",e=>{if(e.touches.length===1){e.preventDefault();oD(e.touches[0].clientX,e.touches[0].clientY);}},{passive:false});
    cv.addEventListener("touchmove",e=>{if(e.touches.length===1){e.preventDefault();oM(e.touches[0].clientX,e.touches[0].clientY);}},{passive:false});
    cv.addEventListener("touchend",oU);
    cv.addEventListener("wheel",e=>{st.current.r=Math.max(400,Math.min(4000,st.current.r+e.deltaY*2));},{passive:true});
    return()=>{cancelAnimationFrame(R.current.f);r.dispose();if(el.contains(r.domElement))el.removeChild(r.domElement);};
  },[]);
  useEffect(()=>{
    const{s}=R.current;if(!s)return;const rm=[];s.traverse(c=>{if(c.userData.bx)rm.push(c);});rm.forEach(c=>{c.geometry.dispose();c.material.dispose();s.remove(c);});
    const visible=simMode?placed.slice(0,simStep):placed;
    visible.forEach((p,idx)=>{
      const isCurrent=simMode&&idx===simStep-1;
      const isSelected=!simMode&&selId===p.id;
      const g=new THREE.BoxGeometry(p.l-1,p.h-1,p.w-1);const co=new THREE.Color(p.color);
      const m=new THREE.Mesh(g,new THREE.MeshPhongMaterial({color:co,transparent:true,opacity:isCurrent||isSelected?1:simMode?0.65:0.82,emissive:isCurrent?co:isSelected?co:new THREE.Color(0),emissiveIntensity:isCurrent?0.5:isSelected?0.3:0}));
      m.position.set(p.x+p.l/2,p.z+p.h/2,p.y+p.w/2);m.userData={bx:true};
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:isCurrent?"#ffffff":p.color})));s.add(m);
    });
  },[placed,selId,simMode,simStep]);
  const BZ={width:32,height:32,borderRadius:"50%",background:COLORS.card,border:`1px solid ${COLORS.border}`,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1};
  return(
    <div style={{position:"relative",width:"100%",borderRadius:6,overflow:"hidden"}}>
      <div ref={mRef} style={{width:"100%"}}/>
      <div style={{position:"absolute",bottom:8,right:8,display:"flex",gap:6}}>
        <button onClick={onZoomIn} style={BZ}>+</button>
        <button onClick={onZoomOut} style={BZ}>−</button>
      </div>
    </div>
  );
}

export default Viewer3D;
