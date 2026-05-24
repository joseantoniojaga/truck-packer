import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { findBestPos, fullPack, fmtV, getCounts, quickStrat } from './packing.js';
import { PACKING_STRATEGIES } from './packingStrategies.js';
import { calculateSwapOptions } from './swapCalculator';
import { FURNITURE } from './furniture.js';
import { computeLoadingOrder } from './loadingSequence.js';
import Modal from './components/Modal.jsx';
import InventoryManagerModal from './components/InventoryManagerModal.jsx';
import FurnitureEditorModal from './components/FurnitureEditorModal.jsx';
import Viewer3D from './components/Viewer3D.jsx';
import OV from './components/OrthoView.jsx';
import { useHoldRepeat } from './hooks/useHoldRepeat.js';
import { COLORS } from './constants.js';
import {
  loadInventories,
  getActiveInventoryId,
  setActiveInventoryId as persistActiveInventoryId,
  createInventory,
  updateInventory,
  DEFAULT_INVENTORY_NAME,
} from './inventoryStorage.js';

// Bootstrap de inventarios: corre una sola vez en el primer render (se llama
// desde los useState lazy initializers). Si no hay inventarios guardados,
// crea el "Inventario base" con FURNITURE. Si hay pero no activo, marca el
// primero como activo. Devuelve { inventories, activeId, items }.
function bootstrapInventories() {
  let invs = loadInventories();
  let activeId = getActiveInventoryId();
  if (invs.length === 0) {
    const baseItems = FURNITURE.map(f => ({
      id: f.id, name: f.name, color: f.color,
      ancho: f.ancho, alto: f.alto, fondo: f.fondo, inv: f.inv,
    }));
    const base = createInventory(DEFAULT_INVENTORY_NAME, baseItems);
    invs = [base];
    persistActiveInventoryId(base.id);
    activeId = base.id;
  } else if (!activeId || !invs.find(i => i.id === activeId)) {
    activeId = invs[0].id;
    persistActiveInventoryId(activeId);
  }
  const active = invs.find(i => i.id === activeId);
  const items = active ? active.items.map(it => ({ ...it, load: 0 })) : [];
  return { inventories: invs, activeId, items };
}

const TR = { largo:1615.4, ancho:247, alto:280, placas:"49-UT-7V" };
const TV = TR.largo*TR.ancho*TR.alto;
const MIN = 5;


// --- Three.js 3D Viewer ---
export default function App(){
  // El primer useState corre el bootstrap (crea "Inventario base" si no había
  // nada en localStorage). Los siguientes solo leen el localStorage ya seedado.
  const [items,setItems]=useState(()=>bootstrapInventories().items);
  const [inventories,setInventories]=useState(()=>loadInventories());
  const [activeInventoryId,setActiveInventoryIdState]=useState(()=>getActiveInventoryId());
  const [showInventoryManager,setShowInventoryManager]=useState(false);
  const [showFurnitureEditor,setShowFurnitureEditor]=useState(false);
  const [editingFurniture,setEditingFurniture]=useState(null);
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
  const [simMode,setSimMode]=useState(false);
  const [simStep,setSimStep]=useState(0);
  const [simSequence,setSimSequence]=useState([]);
  const [simPlaying,setSimPlaying]=useState(false);
  const simPlayRef=useRef(null);

  useEffect(()=>{
    document.body.style.background=COLORS.bg;
    document.body.style.margin="0";
    document.body.style.padding="0";
    document.documentElement.style.background=COLORS.bg;
  },[]);

  const stRef=useRef({theta:Math.PI/4,phi:Math.PI/3,radius:1400,dragging:false,lastX:0,lastY:0});
  const onZoomIn=()=>{stRef.current.radius=Math.max(400,Math.min(3500,stRef.current.radius-200));};
  const onZoomOut=()=>{stRef.current.radius=Math.max(400,Math.min(3500,stRef.current.radius+200));};

  // Hold-to-repeat: cada uno dispara la acción al press y la repite cada 150ms.
  const addHold=useHoldRepeat(id=>addOne(id));
  const removeHold=useHoldRepeat(id=>removeOne(id));
  const invUpHold=useHoldRepeat(id=>setInv(id,(items.find(x=>x.id===id)?.inv||0)+1));
  const invDownHold=useHoldRepeat(id=>setInv(id,(items.find(x=>x.id===id)?.inv||0)-1));

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

  // SET LOAD directly (input editing): clamp a [0, inv] y repack completo
  // porque cambiar load no es incremental.
  const setLoad=useCallback((id,v)=>{
    const it=items.find(x=>x.id===id);
    if(!it)return;
    const newLoad=Math.max(0,Math.min(it.inv,v|0));
    if(newLoad===it.load)return;
    doRepack(items.map(x=>x.id===id?{...x,load:newLoad}:x));
  },[items,doRepack]);

  // Persiste los items del inventario activo en localStorage (sin el campo load).
  const persistActiveItems=useCallback((newItems)=>{
    if(!activeInventoryId)return;
    updateInventory(activeInventoryId,{items:newItems.map(({load,...rest})=>rest)});
    setInventories(loadInventories());
  },[activeInventoryId]);

  // Guardar (nuevo o editado) un mueble custom.
  const handleFurnitureSave=useCallback((furniture)=>{
    const existing=items.find(x=>x.id===furniture.id);
    let newItems;
    if(existing){
      // Edición: preservar load, pero clamp si bajó el inv
      newItems=items.map(it=>it.id===furniture.id
        ?{...furniture,load:Math.min(it.load||0,furniture.inv)}
        :it);
    }else{
      // Nuevo: load = 0
      newItems=[...items,{...furniture,load:0}];
    }
    setItems(newItems);
    persistActiveItems(newItems);
  },[items,persistActiveItems]);

  // Borrar un mueble custom (con confirm). También quita lo ya colocado y persiste.
  const handleFurnitureDelete=useCallback((furniture)=>{
    const placedCount=placed.filter(p=>p.id===furniture.id).length;
    const msg=placedCount>0
      ? `¿Borrar el mueble "${furniture.name}"? También se quitarán los ${placedCount} ya colocados.`
      : `¿Borrar el mueble "${furniture.name}"?`;
    if(!window.confirm(msg))return;
    const newItems=items.filter(it=>it.id!==furniture.id);
    const newPlaced=placed.filter(p=>p.id!==furniture.id);
    setItems(newItems);
    setPlaced(newPlaced);
    persistActiveItems(newItems);
    setShowFurnitureEditor(false);
    setEditingFurniture(null);
  },[items,placed,persistActiveItems]);

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

  const runStrat=(k)=>{setComp(true);setTimeout(()=>{const r=quickStrat(k,items,TR,packMode);doRepack(r);setSS(false);setComp(false);},50);};
  const handleStrat=(k)=>{if(placed.length>0){setPendingStrat(k);}else{runStrat(k);}};

  const sel=selId?items.find(a=>a.id===selId):null;
  const selVol=sel?sel.ancho*sel.alto*sel.fondo:0;
  const B={borderRadius:5,border:`1px solid ${COLORS.border}`,background:"#0F172A",cursor:"pointer",fontFamily:"DM Sans",fontWeight:600};

  return(
    <div className="tp-root" style={{fontFamily:"'DM Sans',sans-serif",background:COLORS.bg,color:"#E8E6DF",position:"relative"}}>
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
        .tp-qty::-webkit-outer-spin-button,
        .tp-qty::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
        .tp-qty{-moz-appearance:textfield;}
      `}</style>

      {/* CONFLICT */}
      <Modal open={!!conflict} onClose={()=>setConflict(null)} title="⚠ Conflicto de espacio" titleColor={COLORS.amber} accentColor={COLORS.amber+"44"}>
        {conflict&&(<>
          <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 10px"}}>No hay hueco disponible para <b style={{color:COLORS.cyan}}>{conflict.itemName}</b>. Reorganizar desplazaría:</p>
          {conflict.displaced.map(d=>(
            <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#0F172A",borderRadius:6,marginBottom:4,fontSize:12}}>
              <span>{d.name}</span><span style={{color:COLORS.red,fontFamily:"JetBrains Mono"}}>{d.oldC}→{d.newC} (−{d.lost})</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>{setItems(conflict.newItems);setPlaced(conflict.newP);setConflict(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.amber,borderColor:COLORS.amber+"44"}}>Reorganizar</button>
            <button onClick={()=>setConflict(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Cancelar</button>
          </div>
        </>)}
      </Modal>

      {/* MODE SWITCH CONFIRM */}
      <Modal open={!!modeSwitchTarget} onClose={()=>setModeSwitchTarget(null)} title="⚠ Cambiar modo de acomodo" titleColor={COLORS.amber} accentColor={COLORS.amber+"44"}>
        <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Cambiar de modo eliminará todos los muebles colocados. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);setPackMode(modeSwitchTarget);setModeSwitchTarget(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.amber,borderColor:COLORS.amber+"44"}}>Sí, cambiar</button>
          <button onClick={()=>setModeSwitchTarget(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Cancelar</button>
        </div>
      </Modal>

      {/* STRATEGY CONFIRM */}
      <Modal open={!!pendingStrat} onClose={()=>setPendingStrat(null)} title="🧠 Aplicar estrategia" titleColor={COLORS.amber} accentColor={COLORS.amber+"44"}>
        <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Esto reorganizará todos los muebles colocados. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{const k=pendingStrat;setPendingStrat(null);runStrat(k);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.cyan,borderColor:COLORS.cyan+"44"}}>Sí, reorganizar</button>
          <button onClick={()=>setPendingStrat(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Cancelar</button>
        </div>
      </Modal>

      {/* REORGANIZE ADD CONFIRM */}
      <Modal open={!!pendingAdd} onClose={()=>setPendingAdd(null)} title="🔄 Reorganizar carga" titleColor={COLORS.amber} accentColor={COLORS.amber+"44"}>
        {pendingAdd&&(<>
          <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>No hay espacio disponible para <b style={{color:COLORS.cyan}}>{pendingAdd.itemName}</b>. ¿Reorganizar todos los muebles para intentar que quepa?</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleSwapConfirm} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.cyan,borderColor:COLORS.cyan+"44"}}>Sí, reorganizar</button>
            <button onClick={()=>setPendingAdd(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>No, dejarlo así</button>
          </div>
        </>)}
      </Modal>

      {/* SWAP OPTIONS */}
      <Modal
        open={!!swapOptions}
        onClose={()=>setSwapOptions(null)}
        title={swapOptions?(swapOptions.options.length===0?"❌ Sin opciones":"🔄 Elige qué quitar"):""}
        titleColor={swapOptions&&swapOptions.options.length===0?COLORS.red:COLORS.cyan}
        accentColor={COLORS.cyan+"44"}
        maxWidth={360}
      >
        {swapOptions&&(swapOptions.options.length===0?(
          <>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>No se encontró ningún intercambio posible para <b style={{color:COLORS.cyan}}>{swapOptions.itemName}</b>.</p>
            <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Entendido</button>
          </>
        ):(
          <>
            <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 12px"}}>Para agregar 1 <b style={{color:COLORS.cyan}}>{swapOptions.itemName}</b>, elige una opción:</p>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12,maxHeight:260,overflowY:"auto"}}>
              {swapOptions.options.map((opt,i)=>(
                <button key={i} onClick={()=>{setItems(opt.newItems);setPlaced(opt.newPlaced);setSwapOptions(null);}} style={{...B,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",textAlign:"left",border:`1px solid ${COLORS.border}`,borderRadius:8,cursor:"pointer",width:"100%"}}>
                  <div style={{width:12,height:12,borderRadius:2,background:opt.removeColor,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:COLORS.text}}>Quitar {opt.removeCount} {opt.removeName}</div>
                    <div style={{fontSize:10,color:"#64748B",marginTop:2,fontFamily:"JetBrains Mono"}}>
                      Libera {fmtV(opt.removeTotalVol)} de espacio
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Cancelar</button>
          </>
        ))}
      </Modal>

      {/* REORG CONFIRM */}
      <Modal open={showReorgConfirm} onClose={()=>setShowReorgConfirm(false)} title="🔄 Reorganizar carga" titleColor={COLORS.cyan} accentColor={COLORS.cyan+"44"}>
        <p style={{fontSize:12,color:"#CBD5E1",lineHeight:1.5,margin:"0 0 14px"}}>Esto reacomodará todos los muebles para optimizar el espacio. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowReorgConfirm(false);doRepack(items);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.cyan,borderColor:COLORS.cyan+"44"}}>Sí, reorganizar</button>
          <button onClick={()=>setShowReorgConfirm(false)} style={{...B,flex:1,padding:"8px",fontSize:11,color:COLORS.green,borderColor:COLORS.green+"44"}}>Cancelar</button>
        </div>
      </Modal>

      {/* INVENTORY MANAGER */}
      <InventoryManagerModal
        open={showInventoryManager}
        onClose={()=>setShowInventoryManager(false)}
        inventories={inventories}
        setInventories={setInventories}
        activeInventoryId={activeInventoryId}
        setActiveInventoryIdState={setActiveInventoryIdState}
        items={items}
        setItems={setItems}
        setPlaced={setPlaced}
      />

      {/* FURNITURE EDITOR */}
      <FurnitureEditorModal
        open={showFurnitureEditor}
        onClose={()=>{setShowFurnitureEditor(false);setEditingFurniture(null);}}
        onSave={handleFurnitureSave}
        onDelete={handleFurnitureDelete}
        initialFurniture={editingFurniture}
        existingFurniture={items}
        trailerVolume={TV}
      />

      {/* ── HEADER (ancho completo) ── */}
      <div className="tp-header">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <span style={{fontSize:20}}>🚛</span>
          <h1 style={{margin:0,fontSize:17,fontWeight:700,color:COLORS.text}}>Calculadora de Carga</h1>
        </div>
        <p style={{margin:0,fontSize:10,color:"#64748B"}}>Tráiler 16.15m × 2.47m × 2.80m · {TR.placas} · {fmtV(TV)}</p>
      </div>

      {/* ── DOS COLUMNAS ── */}
      <div className="tp-cols">

        {/* ── IZQUIERDA: controles (35%) ── */}
        <div className="tp-left">

          <div style={{background:COLORS.card,borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5}}>
              <span style={{color:COLORS.muted}}>📦 {placed.length} colocadas / {tLoad} pedidas</span>
              <span style={{fontFamily:"JetBrains Mono",fontWeight:600,color:util>85?COLORS.red:util>60?COLORS.amber:COLORS.green}}>{util.toFixed(1)}%</span>
            </div>
            <div style={{background:"#0F172A",borderRadius:5,height:18,overflow:"hidden"}}>
              <div style={{width:`${Math.min(util,100)}%`,height:"100%",background:util>85?`linear-gradient(90deg,${COLORS.amber},${COLORS.red})`:`linear-gradient(90deg,${COLORS.cyan},${COLORS.green})`,borderRadius:5,transition:"width 0.4s"}}/>
            </div>
            <div style={{fontSize:10,color:"#64748B",marginTop:4,textAlign:"right"}}>{fmtV(volL)} / {fmtV(TV)}</div>
          </div>

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("free");else setPackMode("free");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="free"?COLORS.bg:COLORS.muted,background:packMode==="free"?COLORS.cyan:"#0F172A",borderColor:packMode==="free"?COLORS.cyan:COLORS.border}}>📦 Libre</button>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("backToFront");else setPackMode("backToFront");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="backToFront"?COLORS.bg:COLORS.muted,background:packMode==="backToFront"?COLORS.cyan:"#0F172A",borderColor:packMode==="backToFront"?COLORS.cyan:COLORS.border}}>🧱 Fondo→Frente</button>
          </div>

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setShowReorgConfirm(true);}} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:COLORS.cyan,display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:COLORS.cyan+"44",opacity:(computing||placed.length===0)?0.5:1}}>
              🔄 Reorganizar
            </button>
            <button onClick={startSim} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:COLORS.purple,display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:COLORS.purple+"44",opacity:(computing||placed.length===0)?0.5:1}}>
              ▶ Simular
            </button>
          </div>

          <button onClick={()=>setSS(!showStrats)} disabled={computing} style={{...B,width:"100%",padding:"8px",marginBottom:8,fontSize:12,color:COLORS.amber,display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:showStrats?COLORS.amber+"44":COLORS.border,opacity:computing?0.5:1}}>
            {computing?"⏳ Calculando...":"🧠 Estrategias"} {!computing&&(showStrats?"▲":"▼")}
          </button>
          {showStrats&&(
            <div style={{background:COLORS.card,borderRadius:8,padding:10,marginBottom:10,border:`1px solid ${COLORS.amber}22`}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {PACKING_STRATEGIES.map(s=>(<button key={s.key} onClick={()=>handleStrat(s.key)} disabled={computing} style={{...B,padding:"8px 12px",display:"flex",alignItems:"flex-start",gap:10,textAlign:"left",opacity:computing?0.5:1}}>
                  <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span><div><div style={{fontSize:11,color:COLORS.text,fontWeight:600}}>{s.label}</div><div style={{fontSize:9,color:"#64748B",fontWeight:400,marginTop:1}}>{s.desc}</div></div>
                </button>))}
              </div>
            </div>
          )}

          {sel&&(<div style={{background:`${sel.color}12`,border:`1px solid ${sel.color}33`,borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:sel.color}}>{sel.name}</span>
              <button onClick={()=>setSelId(null)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:6,fontSize:10,color:COLORS.muted}}>
              <span>Medidas: <b style={{color:"#E8E6DF"}}>{sel.ancho}×{sel.alto}×{sel.fondo}cm</b></span>
              <span>Vol: <b style={{color:"#E8E6DF"}}>{fmtV(selVol)}</b></span>
              <span>Inventario: <b style={{color:"#E8E6DF"}}>{sel.inv}</b></span>
              <span>A cargar: <b style={{color:COLORS.cyan}}>{sel.load}</b></span>
              <span>Colocadas: <b style={{color:(pkC[sel.id]||0)>=sel.load?COLORS.green:COLORS.amber}}>{pkC[sel.id]||0}</b></span>
            </div>
          </div>)}

          <div style={{background:COLORS.card,borderRadius:8,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:600,color:COLORS.text}}>Muebles</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setShowInventoryManager(true)} style={{...B,padding:"3px 7px",fontSize:10,color:COLORS.cyan}}>🗂️ Inventarios</button>
                <button onClick={()=>setEM(!editMode)} style={{...B,padding:"3px 7px",fontSize:10,color:editMode?COLORS.amber:COLORS.muted}}>{editMode?"✓ Listo":"✏️ Inventario"}</button>
                <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);}} style={{...B,padding:"3px 7px",fontSize:10,color:COLORS.red}}>Todos a 0</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:6,padding:"4px 8px",background:"#0F172A",borderRadius:5,fontSize:9,color:"#64748B"}}>
              {editMode?<span>Editando <b style={{color:COLORS.amber}}>inventario</b></span>
              :<><span style={{fontFamily:"JetBrains Mono",color:COLORS.green}}>colocadas</span><span>/</span><span style={{fontFamily:"JetBrains Mono",color:"#E8E6DF"}}>tenemos</span><span>— + agrega sin mover los demás</span></>}
            </div>
            {items.length===0&&(
              <div style={{textAlign:"center",padding:"30px 10px",color:COLORS.muted,fontSize:12,lineHeight:1.5}}>
                <p style={{margin:"0 0 12px"}}>Este inventario está vacío.<br/>Agrega tu primer mueble.</p>
                <button onClick={()=>{setEditingFurniture(null);setShowFurnitureEditor(true);}}
                        style={{...B,padding:"10px 18px",fontSize:12,color:COLORS.cyan,borderColor:COLORS.cyan+"44"}}>
                  ➕ Agregar mueble
                </button>
              </div>
            )}
            {items.map(a=>{const pk=pkC[a.id]||0;
              return(<div key={a.id} onClick={()=>setSelId(a.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:3,background:selId===a.id?"#0F172A":"#13192A",borderRadius:6,cursor:"pointer",border:selId===a.id?`1px solid ${a.color}44`:"1px solid transparent"}}>
                <div style={{width:4,height:24,borderRadius:3,background:a.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,color:COLORS.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</div>
                  <div style={{fontSize:9,color:"#475569"}}>{a.ancho}×{a.alto}×{a.fondo}cm</div></div>
                {!editMode&&<span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:600,color:a.load===0?"#64748B":pk>=a.load?COLORS.green:COLORS.amber,minWidth:38,textAlign:"right"}}>{pk}/{a.inv}</span>}
                {editMode?(<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onMouseDown={e=>{e.stopPropagation();invDownHold.start(a.id);}} onMouseUp={invDownHold.stop} onMouseLeave={invDownHold.stop} onTouchStart={e=>{e.stopPropagation();invDownHold.start(a.id);}} onTouchEnd={invDownHold.stop} style={{...B,width:22,height:22,borderRadius:4,color:COLORS.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <input
                    type="number" className="tp-qty" value={a.inv} min={0} max={999}
                    onChange={e=>{const v=e.target.value;setInv(a.id, v===""?0:Math.max(0,Math.min(999,parseInt(v,10)||0)));}}
                    onClick={e=>e.stopPropagation()}
                    onFocus={e=>e.target.select()}
                    style={{fontFamily:"JetBrains Mono",fontSize:12,color:COLORS.amber,minWidth:24,width:36,textAlign:"center",border:"none",background:"transparent",outline:"none",padding:0}}
                  />
                  <button onMouseDown={e=>{e.stopPropagation();invUpHold.start(a.id);}} onMouseUp={invUpHold.stop} onMouseLeave={invUpHold.stop} onTouchStart={e=>{e.stopPropagation();invUpHold.start(a.id);}} onTouchEnd={invUpHold.stop} style={{...B,width:22,height:22,borderRadius:4,color:COLORS.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                </div>):(<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onMouseDown={e=>{e.stopPropagation();removeHold.start(a.id);}} onMouseUp={removeHold.stop} onMouseLeave={removeHold.stop} onTouchStart={e=>{e.stopPropagation();removeHold.start(a.id);}} onTouchEnd={removeHold.stop} style={{...B,width:22,height:22,borderRadius:4,color:COLORS.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>
                  <input
                    type="number" className="tp-qty" value={a.load} min={0} max={a.inv}
                    onChange={e=>{const v=e.target.value;setLoad(a.id, v===""?0:(parseInt(v,10)||0));}}
                    onClick={e=>e.stopPropagation()}
                    onFocus={e=>e.target.select()}
                    style={{fontFamily:"JetBrains Mono",fontSize:12,color:COLORS.cyan,minWidth:24,width:36,textAlign:"center",border:"none",background:"transparent",outline:"none",padding:0}}
                  />
                  <button onMouseDown={e=>{e.stopPropagation();addHold.start(a.id);}} onMouseUp={addHold.stop} onMouseLeave={addHold.stop} onTouchStart={e=>{e.stopPropagation();addHold.start(a.id);}} onTouchEnd={addHold.stop} style={{...B,width:22,height:22,borderRadius:4,color:COLORS.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>+</button>
                </div>)}
                <button
                  onClick={e=>{e.stopPropagation();setEditingFurniture(a);setShowFurnitureEditor(true);}}
                  onMouseEnter={e=>{e.currentTarget.style.opacity=1;}}
                  onMouseLeave={e=>{e.currentTarget.style.opacity=0.5;}}
                  title="Editar mueble"
                  style={{background:"transparent",border:"none",cursor:"pointer",fontSize:11,padding:0,opacity:0.5,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                >✏️</button>
              </div>);
            })}
            {items.length>0&&(
              <button onClick={()=>{setEditingFurniture(null);setShowFurnitureEditor(true);}}
                      style={{marginTop:6,width:"100%",padding:"6px",fontSize:11,color:COLORS.cyan,background:"transparent",border:`1px dashed ${COLORS.cyan}44`,borderRadius:6,cursor:"pointer",fontFamily:"DM Sans",fontWeight:600}}>
                ➕ Agregar mueble
              </button>
            )}
          </div>

          <div style={{marginTop:10,background:"#162032",borderRadius:8,padding:10,fontSize:10,color:COLORS.muted,lineHeight:1.5}}>
            <span style={{fontWeight:600,color:"#CBD5E1"}}>💡</span> <b>+ es incremental:</b> busca el mejor hueco sin mover nada. <b>−</b> quita el último y reorganiza. Las estrategias reorganizan todo para optimizar.
          </div>

        </div>{/* end left */}

        {/* ── DERECHA: visual (65%) ── */}
        <div className="tp-right">

          <div style={{display:"flex",gap:3,marginBottom:8,flexShrink:0}}>
            <button onClick={()=>setVM("3d")} style={{...B,flex:1,padding:"6px 0",borderRadius:6,fontSize:11,background:viewMode==="3d"?COLORS.cyan:COLORS.card,color:viewMode==="3d"?COLORS.bg:"#64748B"}}>🧊 3D</button>
            <button onClick={()=>setVM("grid")} style={{...B,flex:1,padding:"6px 0",borderRadius:6,fontSize:11,background:viewMode==="grid"?COLORS.cyan:COLORS.card,color:viewMode==="grid"?COLORS.bg:"#64748B"}}>⊞ 6 Vistas</button>
          </div>

          {viewMode==="3d"&&(<div style={{background:COLORS.card,borderRadius:8,padding:10,flex:1,minHeight:0,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {tLoad===0?<div style={{textAlign:"center",color:COLORS.border,fontSize:11,padding:"40px 0"}}>Usa + o una estrategia</div>:<Viewer3D placed={simMode?simSequence.map(s=>s.item):placed} selId={selId} stRef={stRef} onZoomIn={onZoomIn} onZoomOut={onZoomOut} simMode={simMode} simStep={simStep} trailer={TR}/>}
            {simMode?(
              <div style={{marginTop:8,background:"#0F172A",borderRadius:8,padding:10,border:`1px solid ${COLORS.purple}44`,flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:COLORS.purple}}>Simulador de carga</span>
                  <button onClick={stopSim} style={{...B,padding:"2px 8px",fontSize:10,color:COLORS.red,borderColor:COLORS.red+"44"}}>✕ Salir</button>
                </div>
                <div style={{background:COLORS.card,borderRadius:4,height:6,marginBottom:8,overflow:"hidden"}}>
                  <div style={{width:`${simSequence.length>0?(simStep/simSequence.length)*100:0}%`,height:"100%",background:`linear-gradient(90deg,${COLORS.purple},${COLORS.cyan})`,borderRadius:4,transition:"width 0.3s"}}/>
                </div>
                {simStep>0&&simStep<=simSequence.length&&(
                  <div style={{fontSize:11,color:"#CBD5E1",marginBottom:8,background:COLORS.card,borderRadius:6,padding:"6px 8px",lineHeight:1.4}}>
                    <span style={{color:COLORS.purple,fontWeight:600}}>Paso {simStep}/{simSequence.length}:</span> {simSequence[simStep-1]?.instruction}
                  </div>
                )}
                {simStep===0&&<div style={{fontSize:11,color:"#475569",marginBottom:8}}>Presiona ▶ para avanzar paso a paso</div>}
                {simStep===simSequence.length&&simSequence.length>0&&<div style={{fontSize:11,color:COLORS.green,marginBottom:8}}>✓ Carga completa ({simSequence.length} muebles)</div>}
                <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                  <button onClick={()=>setSimStep(0)} style={{...B,padding:"5px 10px",fontSize:13,color:COLORS.muted}} title="Primer paso">⏮</button>
                  <button onClick={()=>setSimStep(s=>Math.max(0,s-1))} style={{...B,padding:"5px 10px",fontSize:13,color:COLORS.muted}} title="Anterior">◀</button>
                  <button onClick={simAutoPlay} style={{...B,padding:"5px 12px",fontSize:12,color:simPlaying?COLORS.amber:COLORS.purple,borderColor:simPlaying?COLORS.amber+"44":COLORS.purple+"44"}}>{simPlaying?"⏸ Pausar":"▶ Auto"}</button>
                  <button onClick={()=>setSimStep(s=>Math.min(s+1,simSequence.length))} style={{...B,padding:"5px 10px",fontSize:13,color:COLORS.muted}} title="Siguiente">▶</button>
                  <button onClick={()=>setSimStep(simSequence.length)} style={{...B,padding:"5px 10px",fontSize:13,color:COLORS.muted}} title="Último paso">⏭</button>
                </div>
              </div>
            ):(
              <p style={{margin:"6px 0 0",fontSize:9,color:"#475569",textAlign:"center",flexShrink:0}}>Arrastra para rotar · Scroll para zoom · Muebles se quedan en su lugar al agregar</p>
            )}
          </div>)}
          {viewMode==="grid"&&(<div style={{background:COLORS.card,borderRadius:8,padding:10,flex:1,minHeight:0,overflowY:"auto"}}>
            {tLoad===0?<div style={{textAlign:"center",color:COLORS.border,fontSize:11,padding:"40px 0"}}>Usa + o una estrategia</div>:(
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{["top","bottom","right","left","front","back"].map(vk=>(<OV key={vk} placed={placed} vk={vk} selId={selId} onSel={setSelId} trailer={TR}/>))}</div>)}
          </div>)}

        </div>{/* end right */}

      </div>
    </div>
  );
}
