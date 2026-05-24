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
import { useTheme } from './hooks/useTheme.js';
import { alpha } from './styles/util.js';
import Topbar from './components/Topbar.jsx';
import FurnitureCard from './components/FurnitureCard.jsx';
import CapacityCard from './components/CapacityCard.jsx';
import {
  Truck, Box, Package, RotateCcw, Play, Sparkles, X, FolderOpen, Plus, Edit2,
  ChevronDown, ChevronUp, AlertTriangle, Check, Lightbulb, Loader2,
  ArrowLeftRight, SkipBack, Rewind, Pause, SkipForward, Layers,
} from 'lucide-react';

// Helper para títulos de modales con icono inline.
const iconTitle = (Icon, text) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
    <Icon size={16} />{text}
  </span>
);
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
  // Tab del visor: '3d' | 'front' | 'right' | 'top' | 'all' (6 vistas)
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

  const { theme, toggleTheme } = useTheme();
  const activeInventoryName = inventories.find(i => i.id === activeInventoryId)?.name || 'Inventario base';

  useEffect(()=>{
    document.body.style.background="var(--bg-base)";
    document.body.style.margin="0";
    document.body.style.padding="0";
    document.documentElement.style.background="var(--bg-base)";
  },[]);

  const stRef=useRef({theta:Math.PI/4,phi:Math.PI/3,radius:1400,dragging:false,lastX:0,lastY:0});
  const onZoomIn=()=>{stRef.current.radius=Math.max(400,Math.min(3500,stRef.current.radius-200));};
  const onZoomOut=()=>{stRef.current.radius=Math.max(400,Math.min(3500,stRef.current.radius+200));};

  // Hold-to-repeat ahora vive dentro de cada <FurnitureCard /> con sus propios
  // hooks. App.jsx solo provee los callbacks (addOne / removeOne / setInv).

  const pkC=useMemo(()=>getCounts(placed),[placed]);
  const volL=placed.reduce((s,p)=>s+p.l*p.w*p.h,0);
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

  const B={borderRadius:"var(--radius-sm)",border:`1px solid var(--border)`,background:"var(--bg-subtle)",cursor:"pointer",fontWeight:600};

  return(
    <div className="tp-root" style={{background:"var(--bg-base)",color:"var(--text-primary)",position:"relative"}}>
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
      <Modal open={!!conflict} onClose={()=>setConflict(null)} title={iconTitle(AlertTriangle, "Conflicto de espacio")} titleColor={"var(--warning)"} accentColor={alpha('--warning', 27)}>
        {conflict&&(<>
          <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 10px"}}>No hay hueco disponible para <b style={{color:"var(--primary)"}}>{conflict.itemName}</b>. Reorganizar desplazaría:</p>
          {conflict.displaced.map(d=>(
            <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",marginBottom:4,fontSize:12}}>
              <span>{d.name}</span><span style={{color:"var(--error)"}}>{d.oldC}→{d.newC} (−{d.lost})</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>{setItems(conflict.newItems);setPlaced(conflict.newP);setConflict(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--warning)",borderColor:alpha('--warning', 27)}}>Reorganizar</button>
            <button onClick={()=>setConflict(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
          </div>
        </>)}
      </Modal>

      {/* MODE SWITCH CONFIRM */}
      <Modal open={!!modeSwitchTarget} onClose={()=>setModeSwitchTarget(null)} title={iconTitle(AlertTriangle, "Cambiar modo de acomodo")} titleColor={"var(--warning)"} accentColor={alpha('--warning', 27)}>
        <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>Cambiar de modo eliminará todos los muebles colocados. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);setPackMode(modeSwitchTarget);setModeSwitchTarget(null);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--warning)",borderColor:alpha('--warning', 27)}}>Sí, cambiar</button>
          <button onClick={()=>setModeSwitchTarget(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
        </div>
      </Modal>

      {/* STRATEGY CONFIRM */}
      <Modal open={!!pendingStrat} onClose={()=>setPendingStrat(null)} title={iconTitle(Sparkles, "Aplicar estrategia")} titleColor={"var(--warning)"} accentColor={alpha('--warning', 27)}>
        <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>Esto reorganizará todos los muebles colocados. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{const k=pendingStrat;setPendingStrat(null);runStrat(k);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--primary)",borderColor:alpha('--primary', 27)}}>Sí, reorganizar</button>
          <button onClick={()=>setPendingStrat(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
        </div>
      </Modal>

      {/* REORGANIZE ADD CONFIRM */}
      <Modal open={!!pendingAdd} onClose={()=>setPendingAdd(null)} title={iconTitle(RotateCcw, "Reorganizar carga")} titleColor={"var(--warning)"} accentColor={alpha('--warning', 27)}>
        {pendingAdd&&(<>
          <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>No hay espacio disponible para <b style={{color:"var(--primary)"}}>{pendingAdd.itemName}</b>. ¿Reorganizar todos los muebles para intentar que quepa?</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleSwapConfirm} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--primary)",borderColor:alpha('--primary', 27)}}>Sí, reorganizar</button>
            <button onClick={()=>setPendingAdd(null)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>No, dejarlo así</button>
          </div>
        </>)}
      </Modal>

      {/* SWAP OPTIONS */}
      <Modal
        open={!!swapOptions}
        onClose={()=>setSwapOptions(null)}
        title={swapOptions?(swapOptions.options.length===0?iconTitle(X,"Sin opciones"):iconTitle(RotateCcw,"Elige qué quitar")):""}
        titleColor={swapOptions&&swapOptions.options.length===0?"var(--error)":"var(--primary)"}
        accentColor={alpha('--primary', 27)}
        maxWidth={360}
      >
        {swapOptions&&(swapOptions.options.length===0?(
          <>
            <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>No se encontró ningún intercambio posible para <b style={{color:"var(--primary)"}}>{swapOptions.itemName}</b>.</p>
            <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Entendido</button>
          </>
        ):(
          <>
            <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 12px"}}>Para agregar 1 <b style={{color:"var(--primary)"}}>{swapOptions.itemName}</b>, elige una opción:</p>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12,maxHeight:260,overflowY:"auto"}}>
              {swapOptions.options.map((opt,i)=>(
                <button key={i} onClick={()=>{setItems(opt.newItems);setPlaced(opt.newPlaced);setSwapOptions(null);}} style={{...B,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",textAlign:"left",border:`1px solid var(--border)`,borderRadius:"var(--radius-md)",cursor:"pointer",width:"100%"}}>
                  <div style={{width:12,height:12,borderRadius:2,background:opt.removeColor,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--text-primary)"}}>Quitar {opt.removeCount} {opt.removeName}</div>
                    <div style={{fontSize:10,color:"var(--text-tertiary)",marginTop:2}}>
                      Libera {fmtV(opt.removeTotalVol)} de espacio
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={()=>setSwapOptions(null)} style={{...B,width:"100%",padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
          </>
        ))}
      </Modal>

      {/* REORG CONFIRM */}
      <Modal open={showReorgConfirm} onClose={()=>setShowReorgConfirm(false)} title={iconTitle(RotateCcw, "Reorganizar carga")} titleColor={"var(--primary)"} accentColor={alpha('--primary', 27)}>
        <p style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>Esto reacomodará todos los muebles para optimizar el espacio. ¿Continuar?</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowReorgConfirm(false);doRepack(items);}} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--primary)",borderColor:alpha('--primary', 27)}}>Sí, reorganizar</button>
          <button onClick={()=>setShowReorgConfirm(false)} style={{...B,flex:1,padding:"8px",fontSize:11,color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
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

      {/* ── TOPBAR Cargo Trust ── */}
      <Topbar
        inventoryName={activeInventoryName}
        trailerPlate={TR.placas}
        capacityText={fmtV(TV)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* ── DOS COLUMNAS ── */}
      <div className="tp-cols">

        {/* ── IZQUIERDA: controles (35%) ── */}
        <div className="tp-left">

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("free");else setPackMode("free");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="free"?"var(--bg-base)":"var(--text-secondary)",background:packMode==="free"?"var(--primary)":"var(--bg-subtle)",borderColor:packMode==="free"?"var(--primary)":"var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Box size={14}/>Libre</button>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("backToFront");else setPackMode("backToFront");}} style={{...B,flex:1,padding:"7px 0",fontSize:11,color:packMode==="backToFront"?"var(--bg-base)":"var(--text-secondary)",background:packMode==="backToFront"?"var(--primary)":"var(--bg-subtle)",borderColor:packMode==="backToFront"?"var(--primary)":"var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><ArrowLeftRight size={14}/>Fondo→Frente</button>
          </div>

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setShowReorgConfirm(true);}} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:"var(--primary)",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:alpha('--primary', 27),opacity:(computing||placed.length===0)?0.5:1}}>
              <RotateCcw size={14}/>Reorganizar
            </button>
            <button onClick={startSim} disabled={computing||placed.length===0} style={{...B,flex:1,padding:"8px",fontSize:12,color:"var(--secondary)",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:alpha('--secondary', 27),opacity:(computing||placed.length===0)?0.5:1}}>
              <Play size={14}/>Simular
            </button>
          </div>

          <button onClick={()=>setSS(!showStrats)} disabled={computing} style={{...B,width:"100%",padding:"8px",marginBottom:8,fontSize:12,color:"var(--warning)",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderColor:showStrats?alpha('--warning', 27):"var(--border)",opacity:computing?0.5:1}}>
            {computing
              ?<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Loader2 size={14} className="animate-spin"/>Calculando...</span>
              :<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Sparkles size={14}/>Estrategias</span>} {!computing&&(showStrats?<ChevronUp size={14}/>:<ChevronDown size={14}/>)}
          </button>
          {showStrats&&(
            <div style={{background:"var(--surface)",borderRadius:"var(--radius-md)",padding:10,marginBottom:10,border:`1px solid ${alpha('--warning', 13)}`}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {PACKING_STRATEGIES.map(s=>(<button key={s.key} onClick={()=>handleStrat(s.key)} disabled={computing} style={{...B,padding:"8px 12px",display:"flex",alignItems:"flex-start",gap:10,textAlign:"left",opacity:computing?0.5:1}}>
                  <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span><div><div style={{fontSize:11,color:"var(--text-primary)",fontWeight:600}}>{s.label}</div><div style={{fontSize:9,color:"var(--text-tertiary)",fontWeight:400,marginTop:1}}>{s.desc}</div></div>
                </button>))}
              </div>
            </div>
          )}


          <div style={{background:"var(--surface)",borderRadius:"var(--radius-md)",padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary)"}}>Muebles</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setShowInventoryManager(true)} style={{...B,padding:"3px 7px",fontSize:10,color:"var(--primary)",display:"inline-flex",alignItems:"center",gap:4}}><FolderOpen size={12}/>Inventarios</button>
                <button onClick={()=>setEM(!editMode)} style={{...B,padding:"3px 7px",fontSize:10,color:editMode?"var(--warning)":"var(--text-secondary)",display:"inline-flex",alignItems:"center",gap:4}}>{editMode?<><Check size={12}/>Listo</>:<><Edit2 size={12}/>Inventario</>}</button>
                <button onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);}} style={{...B,padding:"3px 7px",fontSize:10,color:"var(--error)"}}>Todos a 0</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:6,padding:"4px 8px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",fontSize:9,color:"var(--text-tertiary)"}}>
              {editMode?<span>Editando <b style={{color:"var(--warning)"}}>inventario</b></span>
              :<><span style={{color:"var(--success)"}}>colocadas</span><span>/</span><span style={{color:"var(--text-primary)"}}>tenemos</span><span>— + agrega sin mover los demás</span></>}
            </div>
            {items.length===0&&(
              <div style={{textAlign:"center",padding:"30px 10px",color:"var(--text-secondary)",fontSize:12,lineHeight:1.5}}>
                <p style={{margin:"0 0 12px"}}>Este inventario está vacío.<br/>Agrega tu primer mueble.</p>
                <button onClick={()=>{setEditingFurniture(null);setShowFurnitureEditor(true);}}
                        style={{...B,padding:"10px 18px",fontSize:12,color:"var(--primary)",borderColor:alpha('--primary', 27),display:"inline-flex",alignItems:"center",gap:6}}>
                  <Plus size={14}/>Agregar mueble
                </button>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {items.map(a=>{
                const pk=pkC[a.id]||0;
                return (
                  <FurnitureCard
                    key={a.id}
                    furniture={a}
                    placed={pk}
                    editMode={editMode}
                    selected={selId===a.id}
                    onSelect={()=>setSelId(a.id)}
                    onIncrement={editMode
                      ?()=>setInv(a.id,(a.inv||0)+1)
                      :()=>addOne(a.id)}
                    onDecrement={editMode
                      ?()=>setInv(a.id,(a.inv||0)-1)
                      :()=>removeOne(a.id)}
                    onSetCount={editMode
                      ?(n)=>setInv(a.id,n)
                      :(n)=>setLoad(a.id,n)}
                    onEdit={()=>{setEditingFurniture(a);setShowFurnitureEditor(true);}}
                  />
                );
              })}
              {items.length>0&&(
                <button
                  type="button"
                  className="add-furniture-btn"
                  onClick={()=>{setEditingFurniture(null);setShowFurnitureEditor(true);}}
                >
                  <Plus size={14}/>Agregar mueble
                </button>
              )}
            </div>
          </div>

          <div style={{marginTop:10,background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",padding:10,fontSize:10,color:"var(--text-secondary)",lineHeight:1.5}}>
            <Lightbulb size={14} style={{verticalAlign:"-2px",color:"var(--text-secondary)"}}/> <b>+ es incremental:</b> busca el mejor hueco sin mover nada. <b>−</b> quita el último y reorganiza. Las estrategias reorganizan todo para optimizar.
          </div>

        </div>{/* end left */}

        {/* ── DERECHA: visual (65%) ── */}
        <div className="tp-right">

          <div className="viewer-container">
            {/* Tabs flotantes arriba-izquierda */}
            <div className="viewer-tabs">
              {[
                { key: "3d",    label: "3D" },
                { key: "front", label: "Frente" },
                { key: "right", label: "Lado" },
                { key: "top",   label: "Top" },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`viewer-tab${viewMode===t.key ? " viewer-tab--active" : ""}`}
                  onClick={()=>setVM(t.key)}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className={`viewer-tab${viewMode==="all" ? " viewer-tab--active" : ""}`}
                onClick={()=>setVM("all")}
                title="Ver las 6 vistas"
              >
                <Layers size={14}/>Todas
              </button>
            </div>

            {/* CapacityCard flotante arriba-derecha */}
            <CapacityCard
              placedCount={placed.length}
              totalRequested={tLoad}
              placedVolume={volL}
              totalVolume={TV}
              formatVolume={fmtV}
            />

            {/* Contenido del visor */}
            <div className="viewer-content" style={{padding:viewMode==="all"?16:0,overflowY:viewMode==="all"?"auto":"hidden"}}>
              {tLoad===0 ? (
                <div style={{textAlign:"center",color:"var(--text-tertiary)",fontSize:13,padding:"40px"}}>
                  Usa + o una estrategia
                </div>
              ) : viewMode==="3d" ? (
                <div style={{width:"100%",height:"100%"}}>
                  <Viewer3D placed={simMode?simSequence.map(s=>s.item):placed} selId={selId} stRef={stRef} onZoomIn={onZoomIn} onZoomOut={onZoomOut} simMode={simMode} simStep={simStep} trailer={TR}/>
                </div>
              ) : viewMode==="all" ? (
                <div style={{display:"flex",flexWrap:"wrap",gap:8,width:"100%",alignSelf:"flex-start"}}>
                  {["top","bottom","right","left","front","back"].map(vk=>(
                    <OV key={vk} placed={placed} vk={vk} selId={selId} onSel={setSelId} trailer={TR}/>
                  ))}
                </div>
              ) : (
                <div style={{width:"100%",padding:24,paddingTop:80}}>
                  <OV placed={placed} vk={viewMode} selId={selId} onSel={setSelId} trailer={TR}/>
                </div>
              )}
            </div>
          </div>

          {simMode ? (
            <div style={{marginTop:8,background:"var(--bg-subtle)",borderRadius:"var(--radius-md)",padding:10,border:`1px solid ${alpha('--secondary', 27)}`,flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:600,color:"var(--secondary)"}}>Simulador de carga</span>
                <button onClick={stopSim} style={{...B,padding:"2px 8px",fontSize:10,color:"var(--error)",borderColor:alpha('--error', 27),display:"inline-flex",alignItems:"center",gap:4}}><X size={12}/>Salir</button>
              </div>
              <div style={{background:"var(--surface)",borderRadius:"var(--radius-sm)",height:6,marginBottom:8,overflow:"hidden"}}>
                <div style={{width:`${simSequence.length>0?(simStep/simSequence.length)*100:0}%`,height:"100%",background:`linear-gradient(90deg,var(--secondary),var(--primary))`,borderRadius:"var(--radius-sm)",transition:"width 0.3s"}}/>
              </div>
              {simStep>0&&simStep<=simSequence.length&&(
                <div style={{fontSize:11,color:"var(--text-secondary)",marginBottom:8,background:"var(--surface)",borderRadius:"var(--radius-sm)",padding:"6px 8px",lineHeight:1.4}}>
                  <span style={{color:"var(--secondary)",fontWeight:600}}>Paso {simStep}/{simSequence.length}:</span> {simSequence[simStep-1]?.instruction}
                </div>
              )}
              {simStep===0&&<div style={{fontSize:11,color:"var(--text-tertiary)",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>Presiona <Play size={12} style={{display:"inline-block"}}/> para avanzar paso a paso</div>}
              {simStep===simSequence.length&&simSequence.length>0&&<div style={{fontSize:11,color:"var(--success)",marginBottom:8,display:"flex",alignItems:"center",gap:4}}><Check size={14}/>Carga completa ({simSequence.length} muebles)</div>}
              <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                <button onClick={()=>setSimStep(0)} style={{...B,padding:"5px 10px",fontSize:13,color:"var(--text-secondary)",display:"inline-flex",alignItems:"center"}} title="Primer paso" aria-label="Primer paso"><SkipBack size={14}/></button>
                <button onClick={()=>setSimStep(s=>Math.max(0,s-1))} style={{...B,padding:"5px 10px",fontSize:13,color:"var(--text-secondary)",display:"inline-flex",alignItems:"center"}} title="Anterior" aria-label="Anterior"><Rewind size={14}/></button>
                <button onClick={simAutoPlay} style={{...B,padding:"5px 12px",fontSize:12,color:simPlaying?"var(--warning)":"var(--secondary)",borderColor:simPlaying?alpha('--warning', 27):alpha('--secondary', 27),display:"inline-flex",alignItems:"center",gap:6}}>{simPlaying?<><Pause size={14}/>Pausar</>:<><Play size={14}/>Auto</>}</button>
                <button onClick={()=>setSimStep(s=>Math.min(s+1,simSequence.length))} style={{...B,padding:"5px 10px",fontSize:13,color:"var(--text-secondary)",display:"inline-flex",alignItems:"center"}} title="Siguiente" aria-label="Siguiente"><Play size={14}/></button>
                <button onClick={()=>setSimStep(simSequence.length)} style={{...B,padding:"5px 10px",fontSize:13,color:"var(--text-secondary)",display:"inline-flex",alignItems:"center"}} title="Último paso" aria-label="Último paso"><SkipForward size={14}/></button>
              </div>
            </div>
          ) : (
            <p style={{margin:"8px 0 0",fontSize:11,color:"var(--text-tertiary)",textAlign:"center",flexShrink:0}}>Arrastra para rotar · Scroll para zoom · Muebles se quedan en su lugar al agregar</p>
          )}

        </div>{/* end right */}

      </div>
    </div>
  );
}
