import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { findBestPos, fullPack, fmtV, getCounts } from './packing.js';
import { calculateSwapOptions } from './swapCalculator';
import { FURNITURE } from './furniture.js';
import { computeLoadingOrder } from './loadingSequence.js';

const TR = { largo:1615.4, ancho:247, alto:280, placas:"49-UT-7V" };
const TV = TR.largo*TR.ancho*TR.alto;
const MIN = 5;


// --- Three.js 3D Viewer ---
function Viewer3D({placed,selId,stRef,onZoomIn,onZoomOut,simMode,simStep}){
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

function applyStrat(key,items,trailer=TR,mode="backToFront"){
  const e=items.map(it=>({...it,vol:it.ancho*it.alto*it.fondo,load:0}));
  let sorted;
  if(key==="max_pieces")sorted=[...e].sort((a,b)=>a.vol-b.vol);
  else if(key==="max_volume")sorted=[...e].sort((a,b)=>b.vol-a.vol);
  else if(key==="big_first")sorted=[...e].sort((a,b)=>Math.max(b.ancho,b.alto,b.fondo)-Math.max(a.ancho,a.alto,a.fondo));
  else if(key==="flat_first")sorted=[...e].sort((a,b)=>Math.min(a.ancho,a.alto,a.fondo)-Math.min(b.ancho,b.alto,b.fondo));
  else sorted=[...e].sort((a,b)=>b.vol-a.vol);

  const w=items.map(it=>({...it,load:0}));

  if(key==="balanced"){
    // Versión rápida: calcular capacidad individual de cada tipo primero
    const capacities={};
    for(const item of w){
      const testItems=[{...item,load:item.inv}];
      const{placed}=fullPack(testItems,trailer,mode);
      capacities[item.id]=placed.length;
    }
    // Repartir proporcionalmente entre todos los tipos
    let changed=true;
    while(changed){
      changed=false;
      for(const x of w){
        if(x.load>=x.inv)continue;
        x.load++;
        const{placed}=fullPack(w,trailer,mode);
        const c=getCounts(placed);
        if((c[x.id]||0)>=x.load)changed=true;
        else x.load--;
      }
    }
    return w;
  }

  // Para otras estrategias: búsqueda binaria por tipo (máximo que cabe)
  for(const s of sorted){
    const i=w.findIndex(x=>x.id===s.id);
    if(i<0)continue;
    let lo=0,hi=s.inv;
    while(lo<hi){
      const mid=Math.ceil((lo+hi)/2);
      w[i].load=mid;
      const{placed}=fullPack(w,trailer,mode);
      const c=getCounts(placed);
      if((c[s.id]||0)>=mid)lo=mid;
      else hi=mid-1;
    }
    w[i].load=lo;
  }
  return w;
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
  const [showReorgConfirm,setShowReorgConfirm]=useState(false);
  const [swapOptions,setSwapOptions]=useState(null);
  const [holdAction,setHoldAction]=useState(null);
  const [simMode,setSimMode]=useState(false);
  const [simStep,setSimStep]=useState(0);
  const [simSequence,setSimSequence]=useState([]);
  const [simPlaying,setSimPlaying]=useState(false);
  const simPlayRef=useRef(null);

  useEffect(()=>{
    document.body.style.background="#0B1121";
    document.body.style.margin="0";
    document.body.style.padding="0";
    document.documentElement.style.background="#0B1121";
  },[]);

  const stRef=useRef({th:Math.PI/4,ph:Math.PI/3,r:1400,dr:false,lx:0,ly:0});
  const onZoomIn=()=>{stRef.current.r=Math.max(400,Math.min(3500,stRef.current.r-200));};
  const onZoomOut=()=>{stRef.current.r=Math.max(400,Math.min(3500,stRef.current.r+200));};

  const holdRef=useRef(null);
  const startHold=(type,id)=>{
    setHoldAction({type,id});
    holdRef.current=setInterval(()=>{
      setHoldAction(prev=>prev?{...prev}:null);
    },150);
  };
  const stopHold=()=>{
    clearInterval(holdRef.current);
    holdRef.current=null;
    setHoldAction(null);
  };

  useEffect(()=>{
    if(!holdAction)return;
    const{type,id}=holdAction;
    if(type==='add')addOne(id);
    else if(type==='remove')removeOne(id);
    else if(type==='invUp')setInv(id,(items.find(x=>x.id===id)?.inv||0)+1);
    else if(type==='invDown')setInv(id,(items.find(x=>x.id===id)?.inv||0)-1);
  },[holdAction]);

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

  const handleSwapConfirm=useCallback(()=>{
    if(!pendingAdd)return;
    const{id,itemName}=pendingAdd;
    const itemToAdd=items.find(x=>x.id===id);
    setPendingAdd(null);
    if(!itemToAdd)return;
    const opts=calculateSwapOptions(itemToAdd,items,placed,TR,packMode);
    setSwapOptions({itemName,itemId:id,options:opts});
  },[pendingAdd,items,placed,packMode]);

  // REMOVE: just remove the last placed item of this type, no repack
  const removeOne=useCallback((id)=>{
    const it=items.find(x=>x.id===id);
    if(!it||it.load<=0)return;
    const lastIndex=[...placed].reverse().findIndex(p=>p.id===id);
    if(lastIndex===-1)return;
    const realIndex=placed.length-1-lastIndex;
    const newPlaced=placed.filter((_,i)=>i!==realIndex);
    setItems(items.map(x=>x.id===id?{...x,load:x.load-1}:x));
    setPlaced(newPlaced);
  },[items,placed]);

  // FULL REPACK (strategies, reset)
  const doRepack=useCallback((newItems)=>{
    const{placed:p}=fullPack(newItems,TR,packMode);
    setItems(newItems);setPlaced(p);
  },[packMode]);

  const setInv=useCallback((id,v)=>{
    const newInv=Math.max(0,v);
    setItems(items.map(it=>{
      if(it.id!==id)return it;
      return{...it,inv:newInv,load:Math.min(it.load,newInv)};
    }));
    const it=items.find(x=>x.id===id);
    if(it&&it.load>newInv){
      const excess=it.load-newInv;
      let removed=0;
      const newPlaced=[...placed];
      for(let i=newPlaced.length-1;i>=0&&removed<excess;i--){
        if(newPlaced[i].id===id){newPlaced.splice(i,1);removed++;}
      }
      setPlaced(newPlaced);
    }
  },[items,placed]);

  const startSim=()=>{
    const seq=computeLoadingOrder(placed);
    setSimSequence(seq);
    setSimStep(0);
    setSimMode(true);
    setSimPlaying(false);
  };

  const stopSim=()=>{
    clearInterval(simPlayRef.current);
    simPlayRef.current=null;
    setSimMode(false);
    setSimPlaying(false);
  };

  const simAutoPlay=()=>{
    if(simPlaying){clearInterval(simPlayRef.current);simPlayRef.current=null;setSimPlaying(false);return;}
    setSimPlaying(true);
    simPlayRef.current=setInterval(()=>{
      setSimStep(s=>{
        if(s>=simSequence.length){clearInterval(simPlayRef.current);simPlayRef.current=null;setSimPlaying(false);return s;}
        return s+1;
      });
    },800);
  };

  useEffect(()=>{if(!simMode&&simPlayRef.current){clearInterval(simPlayRef.current);simPlayRef.current=null;}},[simMode]);

  const runStrat=(k)=>{setComp(true);setTimeout(()=>{const r=applyStrat(k,items,TR,packMode);doRepack(r);setSS(false);setComp(false);},50);};
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
              <button onClick={handleSwapConfirm} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#06B6D4",borderColor:"#06B6D444"}}>Sí, reorganizar</button>
              <button onClick={()=>setPendingAdd(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>No, dejarlo así</button>
            </div>
          </div>
        </div>
      )}

      {/* SWAP OPTIONS */}
      {swapOptions&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#1E293B",borderRadius:12,padding:16,maxWidth:360,width:"100%",border:"1px solid #06B6D444"}}>
            {swapOptions.options.length===0?(
              <>
                <div style={{fontSize:14,fontWeight:700,color:"#EF4444",marginBottom:10}}>❌ Sin opciones</div>
                <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>No se encontró ningún intercambio posible para <b style={{color:"#06B6D4"}}>{swapOptions.itemName}</b>.</p>
                <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Entendido</button>
              </>
            ):(
              <>
                <div style={{fontSize:14,fontWeight:700,color:"#06B6D4",marginBottom:4}}>🔄 Elige qué quitar</div>
                <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 12px"}}>Para agregar 1 <b style={{color:"#06B6D4"}}>{swapOptions.itemName}</b>, elige una opción:</p>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12,maxHeight:260,overflowY:"auto"}}>
                  {swapOptions.options.map((opt,i)=>(
                    <button key={i} onClick={()=>{setItems(opt.newItems);setPlaced(opt.newPlaced);setSwapOptions(null);}} style={{...B,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",textAlign:"left",border:"1px solid #334155",borderRadius:8,cursor:"pointer",width:"100%"}}>
                      <div style={{width:12,height:12,borderRadius:2,background:opt.removeColor,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#F8FAFC"}}>Quitar {opt.removeCount} {opt.removeName}</div>
                        <div style={{fontSize:10,color:"#64748B",marginTop:2,fontFamily:"JetBrains Mono"}}>
                          Libera {fmtV(opt.removeTotalVol)} de espacio
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:"#34D399",borderColor:"#34D39944"}}>Cancelar</button>
              </>
            )}
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

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setShowReorgConfirm(true);}} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:"#06B6D4",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:"#06B6D444",opacity:(computing||placed.length===0)?0.5:1}}>
              🔄 Reorganizar
            </button>
            <button onClick={startSim} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:"#A78BFA",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:"#A78BFA44",opacity:(computing||placed.length===0)?0.5:1}}>
              ▶ Simular
            </button>
          </div>

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
                  <button onMouseDown={e=>{e.stopPropagation();startHold('invDown',a.id);}} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={e=>{e.stopPropagation();startHold('invDown',a.id);}} onTouchEnd={stopHold} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <span style={{fontFamily:"JetBrains Mono",fontSize:12,color:"#F59E0B",minWidth:24,textAlign:"center"}}>{a.inv}</span>
                  <button onMouseDown={e=>{e.stopPropagation();startHold('invUp',a.id);}} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={e=>{e.stopPropagation();startHold('invUp',a.id);}} onTouchEnd={stopHold} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                </div>):(<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onMouseDown={e=>{e.stopPropagation();startHold('remove',a.id);}} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={e=>{e.stopPropagation();startHold('remove',a.id);}} onTouchEnd={stopHold} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <span style={{fontFamily:"JetBrains Mono",fontSize:12,color:"#06B6D4",minWidth:24,textAlign:"center"}}>{a.load}</span>
                  <button onMouseDown={e=>{e.stopPropagation();startHold('add',a.id);}} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={e=>{e.stopPropagation();startHold('add',a.id);}} onTouchEnd={stopHold} style={{...B,width:22,height:22,borderRadius:4,color:"#94A3B8",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
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
            {tLoad===0?<div style={{textAlign:"center",color:"#334155",fontSize:11,padding:"40px 0"}}>Usa + o una estrategia</div>:<Viewer3D placed={simMode?simSequence.map(s=>s.item):placed} selId={selId} stRef={stRef} onZoomIn={onZoomIn} onZoomOut={onZoomOut} simMode={simMode} simStep={simStep}/>}
            {simMode?(
              <div style={{marginTop:8,background:"#0F172A",borderRadius:8,padding:10,border:"1px solid #A78BFA44",flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#A78BFA"}}>Simulador de carga</span>
                  <button onClick={stopSim} style={{...B,padding:"2px 8px",fontSize:10,color:"#EF4444",borderColor:"#EF444444"}}>✕ Salir</button>
                </div>
                <div style={{background:"#1E293B",borderRadius:4,height:6,marginBottom:8,overflow:"hidden"}}>
                  <div style={{width:`${simSequence.length>0?(simStep/simSequence.length)*100:0}%`,height:"100%",background:"linear-gradient(90deg,#A78BFA,#06B6D4)",borderRadius:4,transition:"width 0.3s"}}/>
                </div>
                {simStep>0&&simStep<=simSequence.length&&(
                  <div style={{fontSize:11,color:"#CBD5E1",marginBottom:8,background:"#1E293B",borderRadius:6,padding:"6px 8px",lineHeight:1.4}}>
                    <span style={{color:"#A78BFA",fontWeight:600}}>Paso {simStep}/{simSequence.length}:</span> {simSequence[simStep-1]?.instruction}
                  </div>
                )}
                {simStep===0&&<div style={{fontSize:11,color:"#475569",marginBottom:8}}>Presiona ▶ para avanzar paso a paso</div>}
                {simStep===simSequence.length&&simSequence.length>0&&<div style={{fontSize:11,color:"#34D399",marginBottom:8}}>✓ Carga completa ({simSequence.length} muebles)</div>}
                <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                  <button onClick={()=>setSimStep(0)} style={{...B,padding:"5px 10px",fontSize:13,color:"#94A3B8"}} title="Primer paso">⏮</button>
                  <button onClick={()=>setSimStep(s=>Math.max(0,s-1))} style={{...B,padding:"5px 10px",fontSize:13,color:"#94A3B8"}} title="Anterior">◀</button>
                  <button onClick={simAutoPlay} style={{...B,padding:"5px 12px",fontSize:12,color:simPlaying?"#F59E0B":"#A78BFA",borderColor:simPlaying?"#F59E0B44":"#A78BFA44"}}>{simPlaying?"⏸ Pausar":"▶ Auto"}</button>
                  <button onClick={()=>setSimStep(s=>Math.min(s+1,simSequence.length))} style={{...B,padding:"5px 10px",fontSize:13,color:"#94A3B8"}} title="Siguiente">▶</button>
                  <button onClick={()=>setSimStep(simSequence.length)} style={{...B,padding:"5px 10px",fontSize:13,color:"#94A3B8"}} title="Último paso">⏭</button>
                </div>
              </div>
            ):(
              <p style={{margin:"6px 0 0",fontSize:9,color:"#475569",textAlign:"center",flexShrink:0}}>Arrastra para rotar · Scroll para zoom · Muebles se quedan en su lugar al agregar</p>
            )}
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
