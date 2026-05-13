import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { findBestPos, fullPack, fmtV, getCounts } from './packing.js';
import { FURNITURE } from './furniture.js';

const TR = { largo:1615.4, ancho:247, alto:280, placas:"49-UT-7V" };
const TV = TR.largo*TR.ancho*TR.alto;
const MIN = 5;


// --- Three.js 3D Viewer ---
function Viewer3D({placed,selId,stRef,onZoomIn,onZoomOut}){
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
    for(const p of placed){
      const g=new THREE.BoxGeometry(p.l-1,p.h-1,p.w-1);const co=new THREE.Color(p.color);
      const m=new THREE.Mesh(g,new THREE.MeshPhongMaterial({color:co,transparent:true,opacity:selId===p.id?1:0.82,emissive:selId===p.id?co:new THREE.Color(0),emissiveIntensity:selId===p.id?0.3:0}));
      m.position.set(p.x+p.l/2,p.z+p.h/2,p.y+p.w/2);m.userData={bx:true};
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:p.color})));s.add(m);
    }
  },[placed,selId]);
  const BZ={width:32,height:32,borderRadius:"50%",background:"#1E293B",border:"1px solid #334155",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1};
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

// --- 2D View ---
function OV({placed,vk,selId,onSel}){
  const gc=(p)=>{const L=TR.largo,W=TR.ancho,H=TR.alto;switch(vk){case"top":return{x:p.x/L*100,y:p.y/W*100,w:p.l/L*100,h:p.w/W*100};case"bottom":return{x:p.x/L*100,y:(W-p.y-p.w)/W*100,w:p.l/L*100,h:p.w/W*100};case"front":return{x:p.y/W*100,y:(H-p.z-p.h)/H*100,w:p.w/W*100,h:p.h/H*100};case"back":return{x:(W-p.y-p.w)/W*100,y:(H-p.z-p.h)/H*100,w:p.w/W*100,h:p.h/H*100};case"right":return{x:p.x/L*100,y:(H-p.z-p.h)/H*100,w:p.l/L*100,h:p.h/H*100};case"left":return{x:(L-p.x-p.l)/L*100,y:(H-p.z-p.h)/H*100,w:p.l/L*100,h:p.h/H*100};default:return{x:0,y:0,w:0,h:0};}};
  const a={top:25,bottom:25,front:80,back:80,right:20,left:20};
  const lb={top:"Superior",bottom:"Inferior",front:"Frontal",back:"Trasera",right:"Derecha",left:"Izquierda"};
  let list=placed;
  if(vk==="front")list=placed.filter(p=>p.x<TR.largo*0.06);if(vk==="back")list=placed.filter(p=>p.x+p.l>TR.largo*0.94);
  if(vk==="right"){const s=new Map();for(const p of placed){const k=`${Math.round(p.x/5)}-${Math.round(p.z/5)}`;if(!s.has(k)||p.y>s.get(k).y)s.set(k,p);}list=Array.from(s.values());}
  if(vk==="left"){const s=new Map();for(const p of placed){const k=`${Math.round(p.x/5)}-${Math.round(p.z/5)}`;if(!s.has(k)||p.y<s.get(k).y)s.set(k,p);}list=Array.from(s.values());}
  return(<div style={{flex:1,minWidth:"48%"}}><div style={{fontSize:9,color:"#64748B",marginBottom:2,fontWeight:600,textAlign:"center"}}>{lb[vk]}</div>
    <div style={{position:"relative",width:"100%",paddingBottom:`${a[vk]}%`,background:"#080E1A",borderRadius:4,border:"1px solid #1E293B",overflow:"hidden"}}>
      {list.map((p,i)=>{const c=gc(p);if(c.w<0.3||c.h<0.3)return null;const is=selId===p.id;
        return(<div key={i} onClick={e=>{e.stopPropagation();onSel(p.id);}} style={{position:"absolute",left:`${c.x}%`,top:`${c.y}%`,width:`${c.w}%`,height:`${c.h}%`,background:is?p.color:p.color+"88",border:`1px solid ${p.color}`,borderRadius:1,cursor:"pointer",opacity:is?1:0.75,zIndex:is?10:1,boxShadow:is?`0 0 0 2px ${p.color}`:"none"}} title={p.name}/>);})}
    </div></div>);
}

const STRATS=[
  {key:"max_pieces",icon:"🔢",label:"Máx piezas",desc:"Mayor número de muebles"},
  {key:"max_volume",icon:"📦",label:"Máx volumen",desc:"Llena al máximo"},
  {key:"big_first",icon:"🛋️",label:"Grandes primero",desc:"Prioriza grandes"},
  {key:"flat_first",icon:"📐",label:"Planos primero",desc:"Apila lo plano"},
  {key:"balanced",icon:"⚖️",label:"Balanceado",desc:"Reparte entre todos"},
];

function applyStrat(key,items){
  const e=items.map(it=>({...it,vol:it.ancho*it.alto*it.fondo,load:0}));
  let sorted;
  if(key==="max_pieces")sorted=[...e].sort((a,b)=>a.vol-b.vol);
  else if(key==="max_volume")sorted=[...e].sort((a,b)=>b.vol-a.vol);
  else if(key==="big_first")sorted=[...e].sort((a,b)=>Math.max(b.ancho,b.alto,b.fondo)-Math.max(a.ancho,a.alto,a.fondo));
  else if(key==="flat_first")sorted=[...e].sort((a,b)=>Math.min(a.ancho,a.alto,a.fondo)-Math.min(b.ancho,b.alto,b.fondo));
  else sorted=[...e].sort((a,b)=>b.vol-a.vol);
  if(key==="balanced"){
    const w=items.map(it=>({...it,load:0}));let ch=true;
    while(ch){ch=false;for(const x of w){if(x.load>=x.inv)continue;x.load++;const{placed:pk}=fullPack(w,TR);const c=getCounts(pk);if((c[x.id]||0)>=x.load)ch=true;else x.load--;}}
    return w;
  }
  const w=items.map(it=>({...it,load:0}));
  for(const s of sorted){const i=w.findIndex(x=>x.id===s.id);if(i<0)continue;
    for(let j=0;j<s.inv;j++){w[i].load++;const{placed:pk}=fullPack(w,TR);const c=getCounts(pk);if((c[s.id]||0)<w[i].load){w[i].load--;break;}}}
  return w;
}

function useRepeatAction(action, delay = 300, interval = 100) {
  const timerRef = useRef(null);
  const start = () => {
    action();
    timerRef.current = setTimeout(() => {
      timerRef.current = setInterval(action, interval);
    }, delay);
  };
  const stop = () => {
    clearTimeout(timerRef.current);
    clearInterval(timerRef.current);
  };
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop };
}

export default function App(){
  const [items,setItems]=useState(FURNITURE.map(it=>({...it,load:0})));
  const [placed,setPlaced]=useState([]);
  const [selId,setSelId]=useState(null);
  const [viewMode,setVM]=useState("3d");
  const [editMode,setEM]=useState(false);
  const [showStrats,setSS]=useState(false);
  const [computing,setComp]=useState(false);
  const [conflict,setConflict]=useState(null);
  const [packMode,setPackMode]=useState("backToFront");
  const [modeSwitchTarget,setModeSwitchTarget]=useState(null);
  const [pendingStrat,setPendingStrat]=useState(null);
  const [pendingAdd,setPendingAdd]=useState(null);
  const [pendingRemove,setPendingRemove]=useState(null);
  const [showReorgConfirm,setShowReorgConfirm]=useState(false);

  useEffect(()=>{
    document.body.style.background="#0B1121";
    document.body.style.margin="0";
    document.body.style.padding="0";
    document.documentElement.style.background="#0B1121";
  },[]);

  const stRef=useRef({th:Math.PI/4,ph:Math.PI/3,r:1400,dr:false,lx:0,ly:0});
  const onZoomIn=()=>{stRef.current.r=Math.max(400,Math.min(3500,stRef.current.r-200));};
  const onZoomOut=()=>{stRef.current.r=Math.max(400,Math.min(3500,stRef.current.r+200));};

  const rpRef=useRef(null);
  const stopRepeat=useCallback(()=>{clearTimeout(rpRef.current);clearInterval(rpRef.current);rpRef.current=null;},[]);
  const startRepeat=useCallback((action)=>{stopRepeat();action();rpRef.current=setTimeout(()=>{rpRef.current=setInterval(action,100);},300);},[stopRepeat]);

  const pkC=useMemo(()=>getCounts(placed),[placed]);
  const volL=placed.reduce((s,p)=>s+p.l*p.w*p.h,0);
  const util=(volL/TV)*100;
  const tLoad=items.reduce((s,i)=>s+i.load,0);
  const tInv=items.reduce((s,i)=>s+i.inv,0);

  // INCREMENTAL ADD: find space for 1 new item without moving existing ones
  const addOne=useCallback((id)=>{
    const it=items.find(x=>x.id===id);
    if(!it||it.load>=it.inv)return;
    const pos=findBestPos([it.ancho,it.alto,it.fondo],placed,TR,packMode,it.id);
    if(!pos){setPendingAdd({id,itemName:it.name});return;}
    const newItem={id:it.id,name:it.name,color:it.color,x:pos.x,y:pos.y,z:pos.z,l:pos.l,w:pos.w,h:pos.h};
    setItems(items.map(x=>x.id===id?{...x,load:x.load+1}:x));
    setPlaced([...placed,newItem]);
  },[items,placed,packMode]);

  // Runs after user confirms the reorganize popup
  const confirmAdd=useCallback(()=>{
    if(!pendingAdd)return;
    const{id}=pendingAdd;
    setPendingAdd(null);
    const it=items.find(x=>x.id===id);
    if(!it||it.load>=it.inv)return;
    const newItems=items.map(x=>x.id===id?{...x,load:x.load+1}:x);
    const{placed:newP}=fullPack(newItems,TR,packMode);
    const newC=getCounts(newP);
    if((newC[id]||0)<=it.load)return;
    const displaced=[];
    for(const x of items){if(x.id===id||x.load===0)continue;const oc=pkC[x.id]||0;const nc=newC[x.id]||0;if(nc<oc)displaced.push({id:x.id,name:x.name,lost:oc-nc,oldC:oc,newC:nc});}
    if(displaced.length>0){setConflict({id,itemName:it.name,displaced,newItems,newP});}
    else{setItems(newItems);setPlaced(newP);}
  },[pendingAdd,items,pkC,packMode]);

  // REMOVE: show popup if other items are placed, otherwise just remove
  const removeOne=useCallback((id)=>{
    const it=items.find(x=>x.id===id);
    if(!it||it.load<=0)return;
    if(placed.length>1){
      setPendingRemove(id);
    } else {
      setItems(items.map(x=>x.id===id?{...x,load:0}:x));
      setPlaced([]);
    }
  },[items,placed]);

  // FULL REPACK (strategies, reset)
  const doRepack=useCallback((newItems)=>{
    const{placed:p}=fullPack(newItems,TR,packMode);
    setItems(newItems);setPlaced(p);
  },[packMode]);

  const setInv=useCallback((id,v)=>{
    const ni=items.map(it=>it.id===id?{...it,inv:Math.max(0,v),load:Math.min(it.load,Math.max(0,v))}:it);
    doRepack(ni);
  },[items,doRepack]);

  const runStrat=(k)=>{setComp(true);setTimeout(()=>{const r=applyStrat(k,items);doRepack(r);setSS(false);setComp(false);},50);};
  const handleStrat=(k)=>{if(placed.length>0){setPendingStrat(k);}else{runStrat(k);}};

  const sel=selId?items.find(a=>a.id===selId):null;
  const selVol=sel?sel.ancho*sel.alto*sel.fondo:0;
  const B={borderRadius:5,border:"1px solid #334155",background:"#0F172A",cursor:"pointer",fontFamily:"DM Sans",fontWeight:600};

  return(
    <div className="tp-root" style={{fontFamily:"'DM Sans',sans-serif",background:"#0B1121",color:"#E8E6DF",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`
        .tp-root{height:100vh;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;}
        .tp-header{flex-shrink:0;margin-bottom:10px;}
        .tp-cols{display:flex;gap:12px;flex:1;min-height:0;overflow:hidden;}
        .tp-left{width:35%;overflow-y:auto;flex-shrink:0;}
        .tp-right{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
        @media(max-width:768px){
          .tp-root{height:auto;min-height:100vh;overflow:visible;}
          .tp-cols{flex-direction:column;flex:none;overflow:visible;}
          .tp-left,.tp-right{width:100%;overflow:visible;}
        }
      `}</style>

      {/* CONFLICT */}
      {conflict&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #F59E0B44"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#F59E0B",marginBottom:10}}>⚠ Conflicto de espacio</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 10px"}}>No hay hueco disponible para <b style={{color:"#06B6D4"}}>{conflict.itemName}</b>. Reorganizar desplazaría:</p>
            {conflict.displaced.map(d=>(
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#0F172A",borderRadius:6,marginBottom:4,fontSize:12}}>
                <span>{d.name}</span><span style={{color:"#EF4444",fontFamily:"JetBrains Mono"}}>{d.oldC}→{d.newC} (−{d.lost})</span>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setItems(conflict.newItems);setPlaced(conflict.newP);setConflict(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#F59E0B",borderColor:"#F59E0B44"}}>Reorganizar</button>
              <button onClick={()=>setConflict(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODE SWITCH CONFIRM */}
      {modeSwitchTarget&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #F59E0B44"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#F59E0B",marginBottom:10}}>⚠ Cambiar modo de acomodo</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Cambiar de modo eliminará todos los muebles colocados. ¿Continuar?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);setPackMode(modeSwitchTarget);setModeSwitchTarget(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#F59E0B",borderColor:"#F59E0B44"}}>Sí, cambiar</button>
              <button onClick={()=>setModeSwitchTarget(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* STRATEGY CONFIRM */}
      {pendingStrat&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #F59E0B44"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#F59E0B",marginBottom:10}}>🧠 Aplicar estrategia</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Esto reorganizará todos los muebles colocados. ¿Continuar?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{const k=pendingStrat;setPendingStrat(null);runStrat(k);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#06B6D4",borderColor:"#06B6D444"}}>Sí, reorganizar</button>
              <button onClick={()=>setPendingStrat(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* REORGANIZE ADD CONFIRM */}
      {pendingAdd&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #F59E0B44"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#F59E0B",marginBottom:10}}>🔄 Reorganizar carga</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>No hay espacio disponible para <b style={{color:"#06B6D4"}}>{pendingAdd.itemName}</b>. ¿Reorganizar todos los muebles para intentar que quepa?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={confirmAdd} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#06B6D4",borderColor:"#06B6D444"}}>Sí, reorganizar</button>
              <button onClick={()=>setPendingAdd(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>No, dejarlo así</button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE CONFIRM */}
      {pendingRemove!==null&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #F59E0B44"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#F59E0B",marginBottom:10}}>🔄 Quitar mueble</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Quitar este mueble reorganizará los demás. ¿Continuar?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{const id=pendingRemove;setPendingRemove(null);const ni=items.map(x=>x.id===id?{...x,load:x.load-1}:x);const{placed:p}=fullPack(ni,TR,packMode);setItems(ni);setPlaced(p);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#F59E0B",borderColor:"#F59E0B44"}}>Sí, quitar y reorganizar</button>
              <button onClick={()=>setPendingRemove(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* REORG CONFIRM */}
      {showReorgConfirm&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:340,width:"100%",border:"1px solid #06B6D444"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#06B6D4",marginBottom:10}}>🔄 Reorganizar carga</div>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Esto reacomodará todos los muebles para optimizar el espacio. ¿Continuar?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowReorgConfirm(false);doRepack(items);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#06B6D4",borderColor:"#06B6D444"}}>Sí, reorganizar</button>
              <button onClick={()=>setShowReorgConfirm(false)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER (ancho completo) ── */}
      <div className="tp-header">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <span style={{fontSize:20}}>🚛</span>
          <h1 style={{margin:0,fontSize:17,fontWeight:700,color:"#F8FAFC"}}>Calculadora de Carga</h1>
        </div>
        <p style={{margin:0,fontSize:10,color:"#64748B"}}>Tráiler 16.15m × 2.47m × 2.80m · {TR.placas} · {fmtV(TV)}</p>
      </div>

      {/* ── DOS COLUMNAS ── */}
      <div className="tp-cols">

        {/* ── IZQUIERDA: controles (35%) ── */}
        <div className="tp-left">

          <div style={{background:"#1E293B",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5}}>
              <span style={{color:"#94A3B8"}}>📦 {placed.length} colocadas / {tLoad} pedidas</span>
              <span style={{fontFamily:"JetBrains Mono",fontWeight:600,color:util>85?"#EF4444":util>60?"#F59E0B":"#34D399"}}>{util.toFixed(1)}%</span>
            </div>
            <div style={{background:"#0F172A",borderRadius:5,height:18,overflow:"hidden"}}>
              <div style={{width:`${Math.min(util,100)}%`,height:"100%",background:util>85?"linear-gradient(90deg,#F59E0B,#EF4444)":"linear-gradient(90deg,#06B6D4,#34D399)",borderRadius:5,transition:"width 0.4s"}}/>
            </div>
            <div style={{fontSize:10,color:"#64748B",marginTop:4,textAlign:"right"}}>{fmtV(volL)} / {fmtV(TV)}</div>
          </div>

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("free");else setPackMode("free");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="free"?"#0B1121":"#94A3B8",background:packMode==="free"?"#06B6D4":"#0F172A",borderColor:packMode==="free"?"#06B6D4":"#334155"}}>📦 Libre</button>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("backToFront");else setPackMode("backToFront");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="backToFront"?"#0B1121":"#94A3B8",background:packMode==="backToFront"?"#06B6D4":"#0F172A",borderColor:packMode==="backToFront"?"#06B6D4":"#334155"}}>🧱 Fondo→Frente</button>
          </div>

          <button onClick={()=>{if(placed.length>0)setShowReorgConfirm(true);}} disabled={computing||placed.length===0} style={{...B,width:"100%",padding:"8px",marginBottom:8,fontSize:12,color:"#06B6D4",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:"#06B6D444",opacity:(computing||placed.length===0)?0.5:1}}>
            🔄 Reorganizar
          </button>

          <button onClick={()=>setSS(!showStrats)} disabled={computing} style={{...B,width:"100%",padding:"8px",marginBottom:8,fontSize:12,color:"#F59E0B",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:showStrats?"#F59E0B44":"#334155",opacity:computing?0.5:1}}>
            {computing?"⏳ Calculando...":"🧠 Estrategias"} {!computing&&(showStrats?"▲":"▼")}
          </button>
          {showStrats&&(
            <div style={{background:"#1E293B",borderRadius:8,padding:10,marginBottom:10,border:"1px solid #F59E0B22"}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {STRATS.map(s=>(<button key={s.key} onClick={()=>handleStrat(s.key)} disabled={computing} style={{...B,padding:"8px 12px",display:"flex",alignItems:"flex-start",gap:10,textAlign:"left",opacity:computing?0.5:1}}>
                  <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span><div><div style={{fontSize:11,color:"#F8FAFC",fontWeight:600}}>{s.label}</div><div style={{fontSize:9,color:"#64748B",fontWeight:400,marginTop:1}}>{s.desc}</div></div>
                </button>))}
              </div>
            </div>
          )}

          {sel&&(<div style={{background:`${sel.color}12`,border:`1px solid ${sel.color}33`,borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:sel.color}}>{sel.name}</span>
              <button onClick={()=>setSelId(null)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:6,fontSize:10,color:"#94A3B8"}}>
              <span>Medidas: <b style={{color:"#E8E6DF"}}>{sel.ancho}×{sel.alto}×{sel.fondo}cm</b></span>
              <span>Vol: <b style={{color:"#E8E6DF"}}>{fmtV(selVol)}</b></span>
              <span>Inventario: <b style={{color:"#E8E6DF"}}>{sel.inv}</b></span>
              <span>A cargar: <b style={{color:"#06B6D4"}}>{sel.load}</b></span>
              <span>Colocadas: <b style={{color:(pkC[sel.id]||0)>=sel.load?"#34D399":"#F59E0B"}}>{pkC[sel.id]||0}</b></span>
            </div>
          </div>)}

          <div style={{background:"#1E293B",borderRadius:8,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:600,color:"#F8FAFC"}}>Muebles</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setEM(!editMode)} style={{...B,padding:"3px 7px",fontSize:10,color:editMode?"#F59E0B":"#94A3B8"}}>{editMode?"✓ Listo":"✏️ Inventario"}</button>
                <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);}} style={{...B,padding:"3px 7px",fontSize:10,color:"#EF4444"}}>Todos a 0</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:6,padding:"4px 8px",background:"#0F172A",borderRadius:5,fontSize:9,color:"#64748B"}}>
              {editMode?<span>Editando <b style={{color:"#F59E0B"}}>inventario</b></span>
              :<><span style={{fontFamily:"JetBrains Mono",color:"#34D399"}}>colocadas</span><span>/</span><span style={{fontFamily:"JetBrains Mono",color:"#E8E6DF"}}>tenemos</span><span>— + agrega sin mover los demás</span></>}
            </div>
            {items.map(a=>{const pk=pkC[a.id]||0;
              return(<div key={a.id} onClick={()=>setSelId(a.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:3,background:selId===a.id?"#0F172A":"#13192A",borderRadius:6,cursor:"pointer",border:selId===a.id?`1px solid ${a.color}44`:"1px solid transparent"}}>
                <div style={{width:4,height:24,borderRadius:3,background:a.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,color:"#F8FAFC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</div>
                  <div style={{fontSize:9,color:"#475569"}}>{a.ancho}×{a.alto}×{a.fondo}cm</div></div>
                {!editMode&&<span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:a.load===0?"#64748B":pk>=a.load?"#34D399":"#F59E0B",minWidth:38,textAlign:"right"}}>{pk}/{a.inv}</span>}
                {editMode?(<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onMouseDown={e=>{e.stopPropagation();startRepeat(()=>setInv(a.id,a.inv-1));}} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={e=>{e.preventDefault();e.stopPropagation();startRepeat(()=>setInv(a.id,a.inv-1));}} onTouchEnd={stopRepeat} onClick={e=>e.stopPropagation()} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <span style={{fontFamily:"JetBrains Mono",fontSize:12,color:"#F59E0B",minWidth:24,textAlign:"center"}}>{a.inv}</span>
                  <button onMouseDown={e=>{e.stopPropagation();startRepeat(()=>setInv(a.id,a.inv+1));}} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={e=>{e.preventDefault();e.stopPropagation();startRepeat(()=>setInv(a.id,a.inv+1));}} onTouchEnd={stopRepeat} onClick={e=>e.stopPropagation()} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                </div>):(<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onMouseDown={e=>{e.stopPropagation();startRepeat(()=>removeOne(a.id));}} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={e=>{e.preventDefault();e.stopPropagation();startRepeat(()=>removeOne(a.id));}} onTouchEnd={stopRepeat} onClick={e=>e.stopPropagation()} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <span style={{fontFamily:"JetBrains Mono",fontSize:12,color:"#06B6D4",minWidth:24,textAlign:"center"}}>{a.load}</span>
                  <button onMouseDown={e=>{e.stopPropagation();startRepeat(()=>addOne(a.id));}} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={e=>{e.preventDefault();e.stopPropagation();startRepeat(()=>addOne(a.id));}} onTouchEnd={stopRepeat} onClick={e=>e.stopPropagation()} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                </div>)}
              </div>);
            })}
          </div>

          <div style={{marginTop:10,background:"#162032",borderRadius:8,padding:10,fontSize:10,color:"#94A3B8",lineHeight:1.5}}>
            <span style={{fontWeight:600,color:"#CBD5E1"}}>💡</span> <b>+ es incremental:</b> busca el mejor hueco sin mover nada. <b>−</b> quita el último y reorganiza. Las estrategias reorganizan todo para optimizar.
          </div>

        </div>{/* end left */}

        {/* ── DERECHA: visual (65%) ── */}
        <div className="tp-right">

          <div style={{display:"flex",gap:3,marginBottom:8,flexShrink:0}}>
            <button onClick={()=>setVM("3d")} style={{...B,flex:1,padding:"6px 0",borderRadius:6,fontSize:11,background:viewMode==="3d"?"#06B6D4":"#1E293B",color:viewMode==="3d"?"#0B1121":"#64748B"}}>🧊 3D</button>
            <button onClick={()=>setVM("grid")} style={{...B,flex:1,padding:"6px 0",borderRadius:6,fontSize:11,background:viewMode==="grid"?"#06B6D4":"#1E293B",color:viewMode==="grid"?"#0B1121":"#64748B"}}>⊞ 6 Vistas</button>
          </div>

          {viewMode==="3d"&&(<div style={{background:"#1E293B",borderRadius:8,padding:10,flex:1,minHeight:0,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {tLoad===0?<div style={{textAlign:"center",color:"#334155",fontSize:11,padding:"40px 0"}}>Usa + o una estrategia</div>:<Viewer3D placed={placed} selId={selId} stRef={stRef} onZoomIn={onZoomIn} onZoomOut={onZoomOut}/>}
            <p style={{margin:"6px 0 0",fontSize:9,color:"#475569",textAlign:"center",flexShrink:0}}>Arrastra para rotar · Scroll para zoom · Muebles se quedan en su lugar al agregar</p>
          </div>)}
          {viewMode==="grid"&&(<div style={{background:"#1E293B",borderRadius:8,padding:10,flex:1,minHeight:0,overflowY:"auto"}}>
            {tLoad===0?<div style={{textAlign:"center",color:"#334155",fontSize:11,padding:"40px 0"}}>Usa + o una estrategia</div>:(
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{["top","bottom","right","left","front","back"].map(vk=>(<OV key={vk} placed={placed} vk={vk} selId={selId} onSel={setSelId}/>))}</div>)}
          </div>)}

        </div>{/* end right */}

      </div>
    </div>
  );
}
