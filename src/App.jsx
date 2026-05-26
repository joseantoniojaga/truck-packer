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
import EmptyViewerState from './components/EmptyViewerState.jsx';
import TrailerEditorModal from './components/TrailerEditorModal.jsx';
import OV from './components/OrthoView.jsx';
import { useTheme } from './hooks/useTheme.js';
import { alpha } from './styles/util.js';
import Topbar from './components/Topbar.jsx';
import FurnitureCard from './components/FurnitureCard.jsx';
import CapacityCard from './components/CapacityCard.jsx';
import ActionBar from './components/ActionBar.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import {
  Box, RotateCcw, Play, Sparkles, X, Plus, Edit2,
  AlertTriangle, Check,
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
  updateInventoryTrailer,
  DEFAULT_INVENTORY_NAME,
  DEFAULT_TRAILER,
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

const MIN = 5;

// Velocidades del auto-play del simulador. `ms` es el delay del setInterval
// (intervalo entre pasos). 1× = 800 ms es el ritmo original.
const SIM_SPEED_OPTIONS = [
  { value: 0.5, label: "0.5×", ms: 1600 },
  { value: 1,   label: "1×",   ms: 800 },
  { value: 2,   label: "2×",   ms: 400 },
  { value: 4,   label: "4×",   ms: 200 },
  { value: 8,   label: "8×",   ms: 100 },
];


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
  const [computing,setComp]=useState(false);
  const [runningStrategyId,setRunningStrategyId]=useState(null);
  // Última estrategia aplicada — marca la opción en el dropdown del ActionBar.
  // Se limpia (null) ante cualquier mutación manual de la carga (add/remove/
  // setLoad/allZero/reorganize) porque deja de ser la "vista vigente".
  const [lastAppliedStrategyId,setLastAppliedStrategyId]=useState(null);
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
  const [simSpeed,setSimSpeed]=useState(1);
  const [speedDropdownOpen,setSpeedDropdownOpen]=useState(false);
  const simPlayRef=useRef(null);

  const { theme, toggleTheme } = useTheme();
  const activeInventoryName = inventories.find(i => i.id === activeInventoryId)?.name || 'Inventario base';

  // Dimensiones del tráiler — derivadas del inventario activo. Cuando el
  // usuario edita las dims o cambia de inventario, `inventories` cambia y
  // el useMemo reemplaza este objeto, lo cual a su vez invalida `TV` y
  // dispara re-render de los componentes que dependen.
  const trailer = useMemo(()=>{
    const inv = inventories.find(i=>i.id===activeInventoryId);
    return inv?.trailer || DEFAULT_TRAILER;
  },[inventories,activeInventoryId]);
  const TR = trailer;
  const TV = useMemo(()=>trailer.largo*trailer.ancho*trailer.alto,[trailer]);

  // Estado del modal de edición de tráiler.
  const [trailerModalOpen,setTrailerModalOpen]=useState(false);
  const [pendingTrailer,setPendingTrailer]=useState(null);
  const [confirmEmptyOpen,setConfirmEmptyOpen]=useState(false);

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
    setLastAppliedStrategyId(null);
  },[items,placed,packMode,TR]);

  const handleSwapConfirm=useCallback(()=>{
    if(!pendingAdd)return;
    const{id,itemName}=pendingAdd;
    const itemToAdd=items.find(x=>x.id===id);
    setPendingAdd(null);
    if(!itemToAdd)return;
    const opts=calculateSwapOptions(itemToAdd,items,placed,TR,packMode);
    setSwapOptions({itemName,itemId:id,options:opts});
  },[pendingAdd,items,placed,packMode,TR]);

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
    setLastAppliedStrategyId(null);
  },[items,placed]);

  // FULL REPACK (strategies, reset)
  const doRepack=useCallback((newItems)=>{
    const{placed:p}=fullPack(newItems,TR,packMode);
    setItems(newItems);setPlaced(p);
  },[packMode,TR]);

  // SET LOAD directly (input editing): clamp a [0, inv] y repack completo
  // porque cambiar load no es incremental.
  const setLoad=useCallback((id,v)=>{
    const it=items.find(x=>x.id===id);
    if(!it)return;
    const newLoad=Math.max(0,Math.min(it.inv,v|0));
    if(newLoad===it.load)return;
    doRepack(items.map(x=>x.id===id?{...x,load:newLoad}:x));
    setLastAppliedStrategyId(null);
  },[items,doRepack]);

  // Persiste los items del inventario activo en localStorage (sin el campo load).
  const persistActiveItems=useCallback((newItems)=>{
    if(!activeInventoryId)return;
    updateInventory(activeInventoryId,{items:newItems.map(({load,...rest})=>rest)});
    setInventories(loadInventories());
  },[activeInventoryId]);

  // Colores custom del inventario activo. Derivado del array `inventories`
  // (que sí está en el state de React) — así re-renderea al cambiar inventario.
  const activeCustomColors = useMemo(()=>{
    const inv = inventories.find(i=>i.id===activeInventoryId);
    return Array.isArray(inv?.customColors) ? inv.customColors : [];
  },[inventories,activeInventoryId]);

  // Agrega un color custom al inventario activo y lo persiste. Lee la lista
  // actual desde storage (no del closure) para que múltiples picks rápidos
  // dedupeen correctamente sin esperar el re-render de React.
  const handleAddCustomColor=useCallback((color)=>{
    if(!activeInventoryId)return;
    const lc=(color||'').toLowerCase();
    const fresh=loadInventories();
    const inv=fresh.find(x=>x.id===activeInventoryId);
    const current=Array.isArray(inv?.customColors)?inv.customColors:[];
    if(current.some(c=>c.toLowerCase()===lc))return;
    updateInventory(activeInventoryId,{customColors:[...current,color]});
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

  // Estado para el ConfirmModal de borrado de mueble.
  const [furnitureToDelete,setFurnitureToDelete]=useState(null);

  // Borrar un mueble custom: abre el ConfirmModal. El delete real ocurre tras
  // confirmar (ver confirmFurnitureDelete).
  const handleFurnitureDelete=useCallback((furniture)=>{
    setFurnitureToDelete(furniture);
  },[]);

  const confirmFurnitureDelete=useCallback(()=>{
    const furniture=furnitureToDelete;
    if(!furniture)return;
    const newItems=items.filter(it=>it.id!==furniture.id);
    const newPlaced=placed.filter(p=>p.id!==furniture.id);
    setItems(newItems);
    setPlaced(newPlaced);
    persistActiveItems(newItems);
    setShowFurnitureEditor(false);
    setEditingFurniture(null);
    setFurnitureToDelete(null);
  },[furnitureToDelete,items,placed,persistActiveItems]);

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
    setLastAppliedStrategyId(null);
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
    const delay=SIM_SPEED_OPTIONS.find(o=>o.value===simSpeed)?.ms ?? 800;
    simPlayRef.current=setInterval(()=>{
      setSimStep(s=>{
        if(s>=simSequence.length){clearInterval(simPlayRef.current);simPlayRef.current=null;setSimPlaying(false);return s;}
        return s+1;
      });
    },delay);
  };

  useEffect(()=>{if(!simMode&&simPlayRef.current){clearInterval(simPlayRef.current);simPlayRef.current=null;}},[simMode]);

  // Reinicia el intervalo cuando cambia simSpeed mid-play (sin esto, el
  // dropdown solo afectaría a partir del próximo Play/Pause).
  useEffect(()=>{
    if(!simPlaying || !simPlayRef.current) return;
    clearInterval(simPlayRef.current);
    const delay=SIM_SPEED_OPTIONS.find(o=>o.value===simSpeed)?.ms ?? 800;
    simPlayRef.current=setInterval(()=>{
      setSimStep(s=>{
        if(s>=simSequence.length){clearInterval(simPlayRef.current);simPlayRef.current=null;setSimPlaying(false);return s;}
        return s+1;
      });
    },delay);
  },[simSpeed]);

  const runStrat=(k)=>{setRunningStrategyId(k);setComp(true);setTimeout(()=>{const r=quickStrat(k,items,TR,packMode);doRepack(r);setComp(false);setRunningStrategyId(null);setLastAppliedStrategyId(k);},50);};
  const handleStrat=(k)=>{if(placed.length>0){setPendingStrat(k);}else{runStrat(k);}};

  // Aplica el nuevo tráiler: persiste a storage, sincroniza React state, y
  // si reduce y hay carga colocada, primero pide confirmación (en handleSaveTrailer).
  const applyTrailer=useCallback((newTrailer,emptyLoad)=>{
    if(emptyLoad){
      setPlaced([]);
      setItems(prev=>prev.map(it=>({...it,load:0})));
      setLastAppliedStrategyId(null);
    }
    if(activeInventoryId){
      updateInventoryTrailer(activeInventoryId,newTrailer);
      setInventories(loadInventories());
    }
    setTrailerModalOpen(false);
    setConfirmEmptyOpen(false);
    setPendingTrailer(null);
  },[activeInventoryId]);

  const handleSaveTrailer=useCallback((newTrailer)=>{
    const reduces =
      newTrailer.largo < trailer.largo ||
      newTrailer.ancho < trailer.ancho ||
      newTrailer.alto  < trailer.alto;
    if(reduces && placed.length>0){
      setPendingTrailer(newTrailer);
      setConfirmEmptyOpen(true);
    } else {
      applyTrailer(newTrailer,false);
    }
  },[trailer,placed.length,applyTrailer]);

  const B={borderRadius:"var(--radius-md)",border:`1px solid var(--border)`,background:"var(--bg-subtle)",cursor:"pointer",fontWeight:600};

  return(
    <div className="tp-root" style={{background:"var(--bg-base)",color:"var(--text-primary)",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`
        .tp-root{height:100vh;padding:8px 16px 16px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;}
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
          <p style={{fontSize:"var(--text-sm)",color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 10px"}}>No hay hueco disponible para <b style={{color:"var(--primary)"}}>{conflict.itemName}</b>. Reorganizar desplazaría:</p>
          {conflict.displaced.map(d=>(
            <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",marginBottom:4,fontSize:"var(--text-sm)"}}>
              <span>{d.name}</span><span style={{color:"var(--error)"}}>{d.oldC}→{d.newC} (−{d.lost})</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>{setItems(conflict.newItems);setPlaced(conflict.newP);setConflict(null);}} style={{...B,flex:1,padding:"8px",fontSize:"var(--text-xs)",color:"var(--warning)",borderColor:alpha('--warning', 27)}}>Reorganizar</button>
            <button onClick={()=>setConflict(null)} style={{...B,flex:1,padding:"8px",fontSize:"var(--text-xs)",color:"var(--success)",borderColor:alpha('--success', 27)}}>Cancelar</button>
          </div>
        </>)}
      </Modal>

      {/* MODE SWITCH CONFIRM */}
      <ConfirmModal
        open={!!modeSwitchTarget}
        title="Cambiar modo de empaquetado"
        message="Cambiar de modo eliminará todos los muebles colocados. ¿Continuar?"
        confirmLabel="Sí, cambiar"
        cancelLabel="Cancelar"
        variant="default"
        onConfirm={()=>{
          setItems(items.map(it=>({...it,load:0})));
          setPlaced([]);
          setPackMode(modeSwitchTarget);
          setModeSwitchTarget(null);
        }}
        onCancel={()=>setModeSwitchTarget(null)}
      />

      {/* STRATEGY CONFIRM */}
      <ConfirmModal
        open={!!pendingStrat}
        title="Aplicar estrategia"
        message="Esto reorganizará todos los muebles colocados. ¿Continuar?"
        confirmLabel="Sí, reorganizar"
        cancelLabel="Cancelar"
        variant="default"
        onConfirm={()=>{ const k=pendingStrat; setPendingStrat(null); runStrat(k); }}
        onCancel={()=>setPendingStrat(null)}
      />

      {/* REORGANIZE ADD CONFIRM */}
      <ConfirmModal
        open={!!pendingAdd}
        title="Reorganizar carga"
        message={pendingAdd ? `No hay espacio disponible para ${pendingAdd.itemName}. ¿Reorganizar todos los muebles para intentar que quepa?` : ""}
        confirmLabel="Sí, reorganizar"
        cancelLabel="No, dejarlo así"
        variant="default"
        onConfirm={handleSwapConfirm}
        onCancel={()=>setPendingAdd(null)}
      />

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
            <p style={{fontSize:"var(--text-sm)",color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 14px"}}>No se encontró ningún intercambio posible para <b style={{color:"var(--primary)"}}>{swapOptions.itemName}</b>.</p>
            <button
              type="button"
              onClick={()=>setSwapOptions(null)}
              className="action-btn action-btn--secondary"
              style={{ width:"100%", padding:"8px 14px", fontSize:"var(--text-sm)" }}
            >
              Entendido
            </button>
          </>
        ):(
          <>
            <p style={{fontSize:"var(--text-sm)",color:"var(--text-secondary)",lineHeight:1.5,margin:"0 0 12px"}}>Para agregar 1 <b style={{color:"var(--primary)"}}>{swapOptions.itemName}</b>, elige una opción:</p>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12,maxHeight:260,overflowY:"auto"}}>
              {swapOptions.options.map((opt,i)=>(
                <button
                  key={i}
                  type="button"
                  onClick={()=>{setItems(opt.newItems);setPlaced(opt.newPlaced);setSwapOptions(null);setLastAppliedStrategyId(null);}}
                  style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"10px 12px", textAlign:"left",
                    border:"1px solid var(--border)",
                    borderRadius:"var(--radius-md)",
                    cursor:"pointer", width:"100%",
                    background:"var(--surface)",
                    transition:"background 0.15s",
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background = "var(--bg-subtle)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background = "var(--surface)"; }}
                >
                  <div style={{width:12,height:12,borderRadius:2,background:opt.removeColor,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"var(--text-sm)",fontWeight:600,color:"var(--text-primary)"}}>Quitar {opt.removeCount} {opt.removeName}</div>
                    <div style={{fontSize:"var(--text-xs)",color:"var(--text-tertiary)",marginTop:2}}>
                      Libera {fmtV(opt.removeTotalVol)} de espacio
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={()=>setSwapOptions(null)}
              className="action-btn action-btn--secondary"
              style={{ width:"100%", padding:"8px 14px", fontSize:"var(--text-sm)" }}
            >
              Cancelar
            </button>
          </>
        ))}
      </Modal>

      {/* REORG CONFIRM */}
      <ConfirmModal
        open={showReorgConfirm}
        title="Reorganizar carga"
        message="Esto reacomodará todos los muebles para optimizar el espacio. ¿Continuar?"
        confirmLabel="Sí, reorganizar"
        cancelLabel="Cancelar"
        variant="default"
        onConfirm={()=>{ setShowReorgConfirm(false); doRepack(items); setLastAppliedStrategyId(null); }}
        onCancel={()=>setShowReorgConfirm(false)}
      />

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
        hidden={!!furnitureToDelete}
        customColors={activeCustomColors}
        onAddCustomColor={handleAddCustomColor}
      />

      {/* CONFIRM: borrar mueble custom */}
      <ConfirmModal
        open={!!furnitureToDelete}
        variant="danger"
        title="Borrar mueble"
        message={furnitureToDelete
          ? (placed.filter(p=>p.id===furnitureToDelete.id).length>0
              ? `¿Borrar el mueble "${furnitureToDelete.name}"? También se quitarán los ${placed.filter(p=>p.id===furnitureToDelete.id).length} ya colocados.`
              : `¿Borrar el mueble "${furnitureToDelete.name}"?`)
          : ''}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        onConfirm={confirmFurnitureDelete}
        onCancel={()=>setFurnitureToDelete(null)}
      />

      {/* TRAILER EDITOR */}
      <TrailerEditorModal
        open={trailerModalOpen}
        trailer={trailer}
        hasPlacedItems={placed.length>0}
        onSave={handleSaveTrailer}
        onCancel={()=>setTrailerModalOpen(false)}
      />

      {/* CONFIRM: vaciar carga al reducir el tráiler. nested=true porque
          se abre sobre el modal del tráiler (que sigue visible detrás). */}
      <ConfirmModal
        open={confirmEmptyOpen}
        variant="danger"
        title="Vaciar carga"
        message="Las nuevas dimensiones son más pequeñas. Esto vaciará la carga actual. ¿Continuar?"
        confirmLabel="Vaciar y aplicar"
        cancelLabel="Cancelar"
        onConfirm={()=>pendingTrailer && applyTrailer(pendingTrailer,true)}
        onCancel={()=>{setConfirmEmptyOpen(false);setPendingTrailer(null);}}
        nested={true}
      />

      {/* ── TOPBAR Cargo Trust ── */}
      <Topbar
        inventoryName={activeInventoryName}
        trailerPlate={trailer.placas}
        capacityText={fmtV(TV)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenInventories={()=>setShowInventoryManager(true)}
        onEditTrailer={()=>setTrailerModalOpen(true)}
      />

      {/* ── DOS COLUMNAS ── */}
      <div className="tp-cols">

        {/* ── IZQUIERDA: controles (35%) ── */}
        <div className="tp-left">

          <div style={{display:"flex",gap:4,marginBottom:8}}>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("free");else setPackMode("free");}} style={{...B,flex:1,padding:"7px 0",fontSize:"var(--text-xs)",color:packMode==="free"?"var(--bg-base)":"var(--text-secondary)",background:packMode==="free"?"var(--primary)":"var(--bg-subtle)",borderColor:packMode==="free"?"var(--primary)":"var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Box size={14}/>Libre</button>
            <button onClick={()=>{if(placed.length>0)setModeSwitchTarget("backToFront");else setPackMode("backToFront");}} style={{...B,flex:1,padding:"7px 0",fontSize:"var(--text-xs)",color:packMode==="backToFront"?"var(--bg-base)":"var(--text-secondary)",background:packMode==="backToFront"?"var(--primary)":"var(--bg-subtle)",borderColor:packMode==="backToFront"?"var(--primary)":"var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><ArrowLeftRight size={14}/>Fondo→Frente</button>
          </div>

          <div style={{background:"var(--surface)",borderRadius:"var(--radius-md)",padding:10,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:"var(--text-lg)",fontWeight:700,color:"var(--text-primary)"}}>Muebles</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {!editMode && (
                  <button
                    onClick={()=>{setItems(items.map(it=>({...it,load:0})));setPlaced([]);setLastAppliedStrategyId(null);}}
                    style={{...B,padding:"8px 14px",fontSize:"var(--text-sm)",borderRadius:"var(--radius-md)",color:"var(--error)",display:"inline-flex",alignItems:"center",gap:6}}
                  >
                    Todos a 0
                  </button>
                )}
                <button
                  onClick={()=>setEM(!editMode)}
                  style={{...B,padding:"8px 14px",fontSize:"var(--text-sm)",borderRadius:"var(--radius-md)",color:editMode?"var(--warning)":"var(--text-secondary)",display:"inline-flex",alignItems:"center",gap:6}}
                >
                  {editMode
                    ? <><Check size={14}/>Guardar inventario</>
                    : <><Edit2 size={14}/>Inventario</>}
                </button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:6,padding:"4px 8px",background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",fontSize:"var(--text-xs)",color:"var(--text-tertiary)"}}>
              {editMode?<span>Editando <b style={{color:"var(--warning)"}}>inventario</b></span>
              :<><span style={{color:"var(--success)"}}>colocadas</span><span>/</span><span style={{color:"var(--text-primary)"}}>tenemos</span><span>— + agrega sin mover los demás</span></>}
            </div>
            {items.length===0&&(
              <div style={{textAlign:"center",padding:"30px 10px",color:"var(--text-secondary)",fontSize:"var(--text-sm)",lineHeight:1.5}}>
                <p style={{margin:"0 0 12px"}}>Este inventario está vacío.<br/>Agrega tu primer mueble.</p>
                <button
                  type="button"
                  className="add-furniture-btn"
                  onClick={()=>{setEditingFurniture(null);setShowFurnitureEditor(true);}}
                  style={{display:"inline-flex",width:"auto",padding:"10px 18px"}}
                >
                  <Plus size={14}/>Agregar mueble
                </button>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10,margin:"0 -4px",padding:"0 4px"}}>
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
                { key: "top",   label: "Arriba" },
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
              totalInventory={items.reduce((s,i)=>s+(i.inv||0),0)}
              placedVolume={volL}
              totalVolume={TV}
              formatVolume={fmtV}
            />

            {/* Action bar flotante abajo-centro */}
            <ActionBar
              canReorganize={placed.length>0}
              canSimulate={placed.length>0}
              isCalculating={computing}
              activeStrategyId={runningStrategyId}
              lastAppliedStrategyId={lastAppliedStrategyId}
              strategies={PACKING_STRATEGIES}
              onReorganize={()=>setShowReorgConfirm(true)}
              onApplyStrategy={handleStrat}
              onSimulate={startSim}
            />

            {/* Contenido del visor */}
            <div className="viewer-content" style={{padding:viewMode==="all"&&placed.length>0?"140px 16px 16px":0,overflowY:viewMode==="all"&&placed.length>0?"auto":"hidden"}}>
              {placed.length===0 ? (
                <EmptyViewerState totalInventory={tInv}/>
              ) : viewMode==="all" ? (
                // Durante simulación, las 6 orthoviews deben mostrar el estado
                // PARCIAL (items 0..simStep), no la carga final. OrthoView no
                // entiende de simMode/simStep, así que pasamos la rebanada ya
                // calculada como `placed`.
                <div style={{display:"flex",flexWrap:"wrap",gap:8,width:"100%",alignSelf:"flex-start"}}>
                  {(() => {
                    const allPlaced = simMode
                      ? simSequence.map(s=>s.item).slice(0, simStep)
                      : placed;
                    return ["top","bottom","right","left","front","back"].map(vk=>(
                      <OV key={vk} placed={allPlaced} vk={vk} selId={selId} onSel={setSelId} trailer={TR}/>
                    ));
                  })()}
                </div>
              ) : (
                <div style={{width:"100%",height:"100%"}}>
                  <Viewer3D
                    placed={simMode?simSequence.map(s=>s.item):placed}
                    selId={selId} stRef={stRef}
                    onZoomIn={onZoomIn} onZoomOut={onZoomOut}
                    simMode={simMode} simStep={simStep}
                    trailer={TR}
                    cameraMode={viewMode==="3d" ? "free" : viewMode==="front" ? "front" : viewMode==="right" ? "side" : "top"}
                  />
                </div>
              )}
            </div>
          </div>

          {simMode ? (
            <div style={{
              position:"relative",
              marginTop:8,
              background:"var(--surface)",
              borderRadius:"var(--radius-lg)",
              padding:"16px 20px",
              border:"1px solid var(--border)",
              boxShadow:"var(--shadow-sm)",
              flexShrink:0,
            }}>
              {/* Título grande */}
              <div style={{
                fontSize:"var(--text-lg)", fontWeight:700,
                color:"var(--text-primary)",
                marginBottom:12,
                paddingRight:40, // deja espacio para el X superior derecho
              }}>
                Simulador de carga
              </div>
              {/* X circular en la esquina (mismo patrón que Modal.showClose) */}
              <button
                type="button"
                onClick={stopSim}
                aria-label="Salir del simulador"
                title="Salir del simulador"
                style={{
                  position:"absolute", top:12, right:12,
                  width:32, height:32, padding:0,
                  borderRadius:"var(--radius-sm)", border:"none",
                  background:"transparent", cursor:"pointer",
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  color:"var(--text-secondary)",
                  transition:"background-color 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <X size={18}/>
              </button>

              {/* Barra de progreso */}
              <div style={{background:"var(--bg-subtle)",borderRadius:"var(--radius-sm)",height:6,marginBottom:10,overflow:"hidden"}}>
                <div style={{width:`${simSequence.length>0?(simStep/simSequence.length)*100:0}%`,height:"100%",background:`linear-gradient(90deg,var(--secondary),var(--primary))`,borderRadius:"var(--radius-sm)",transition:"width 0.3s"}}/>
              </div>

              {/* Instrucción del paso actual + indicador de completado.
                  Container con altura mínima fija para que el panel no salte
                  al pasar de "en progreso" a "completo". Cuando ya terminó,
                  el mensaje "Carga completa" aparece A LA DERECHA del paso,
                  no en una línea nueva debajo. */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 10,
                padding: "8px 10px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-sm)",
                minHeight: 40,
                lineHeight: 1.4,
              }}>
                <span style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}>
                  {simStep > 0 && simStep <= simSequence.length && (
                    <>
                      <span style={{color:"var(--secondary)",fontWeight:600}}>Paso {simStep}/{simSequence.length}:</span>{" "}
                      {simSequence[simStep-1]?.instruction}
                    </>
                  )}
                </span>
                {simStep === simSequence.length && simSequence.length > 0 && (
                  <span style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--success)",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    <Check size={16}/>
                    Carga completa ({simSequence.length} muebles)
                  </span>
                )}
              </div>

              {/* Controles estilo ActionBar — centrados horizontalmente */}
              <div style={{display:"flex",justifyContent:"center"}}>
              <div style={{
                display:"inline-flex",
                gap:4,
                padding:6,
                background:"var(--bg-subtle)",
                border:"1px solid var(--border)",
                borderRadius:"var(--radius-lg)",
              }}>
                <button
                  type="button" className="action-btn action-btn--secondary"
                  onClick={()=>setSimStep(0)}
                  title="Primer paso" aria-label="Primer paso"
                  style={{padding:"10px 14px"}}
                >
                  <SkipBack size={16} strokeWidth={2}/>
                </button>
                <button
                  type="button" className="action-btn action-btn--secondary"
                  onClick={()=>setSimStep(s=>Math.max(0,s-1))}
                  title="Anterior" aria-label="Anterior"
                  style={{padding:"10px 14px"}}
                >
                  <Rewind size={16} strokeWidth={2}/>
                </button>
                <button
                  type="button"
                  className={`action-btn ${simPlaying?"action-btn--secondary":"action-btn--primary"}`}
                  onClick={simAutoPlay}
                  title={simPlaying?"Pausar":"Auto-reproducir"}
                  aria-label={simPlaying?"Pausar":"Auto-reproducir"}
                  style={{padding:"10px 14px"}}
                >
                  {simPlaying
                    ? <><Pause size={16} strokeWidth={2}/>Pausar</>
                    : <><Play size={16} strokeWidth={2}/>Auto</>}
                </button>
                <button
                  type="button" className="action-btn action-btn--secondary"
                  onClick={()=>setSimStep(s=>Math.min(s+1,simSequence.length))}
                  title="Siguiente" aria-label="Siguiente"
                  style={{padding:"10px 14px"}}
                >
                  <Play size={16} strokeWidth={2}/>
                </button>
                <button
                  type="button" className="action-btn action-btn--secondary"
                  onClick={()=>setSimStep(simSequence.length)}
                  title="Último paso" aria-label="Último paso"
                  style={{padding:"10px 14px"}}
                >
                  <SkipForward size={16} strokeWidth={2}/>
                </button>

                {/* Dropdown de velocidad. Abre HACIA ARRIBA porque el
                    simulador vive en el fondo del visor (no hay espacio
                    abajo). Backdrop invisible para cerrar al click afuera. */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={()=>setSpeedDropdownOpen(o=>!o)}
                    className={`action-btn ${speedDropdownOpen?"action-btn--open":"action-btn--secondary"}`}
                    style={{ minWidth:60, padding:"10px 14px", fontSize:"var(--text-sm)", fontVariantNumeric:"tabular-nums" }}
                    aria-label="Velocidad de simulación"
                    title="Velocidad"
                    aria-haspopup="menu"
                    aria-expanded={speedDropdownOpen}
                  >
                    {SIM_SPEED_OPTIONS.find(o=>o.value===simSpeed)?.label}
                  </button>
                  {speedDropdownOpen && (
                    <>
                      <div
                        onClick={()=>setSpeedDropdownOpen(false)}
                        style={{ position:"fixed", inset:0, zIndex:49 }}
                      />
                      <div
                        role="menu"
                        style={{
                          position:"absolute",
                          bottom:"calc(100% + 8px)",
                          left:"50%",
                          transform:"translateX(-50%)",
                          background:"var(--surface)",
                          border:"1px solid var(--border)",
                          borderRadius:"var(--radius-lg)",
                          boxShadow:"var(--shadow-md)",
                          padding:6,
                          minWidth:100,
                          display:"flex",
                          flexDirection:"column",
                          gap:2,
                          zIndex:50,
                        }}
                      >
                        {SIM_SPEED_OPTIONS.map(opt=>{
                          const isActive = opt.value === simSpeed;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="menuitem"
                              onClick={()=>{ setSimSpeed(opt.value); setSpeedDropdownOpen(false); }}
                              style={{
                                padding:"8px 12px",
                                background: isActive ? "var(--bg-subtle)" : "transparent",
                                color: isActive ? "var(--primary)" : "var(--text-primary)",
                                fontWeight: isActive ? 600 : 500,
                                border:"none",
                                borderRadius:"var(--radius-md)",
                                cursor:"pointer",
                                fontSize:"var(--text-sm)",
                                textAlign:"center",
                                fontVariantNumeric:"tabular-nums",
                                transition:"background 0.15s",
                              }}
                              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="var(--bg-subtle)"; }}
                              onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              </div>
            </div>
          ) : (
            <p style={{margin:"8px 0 0",fontSize:"var(--text-xs)",color:"var(--text-tertiary)",textAlign:"center",flexShrink:0}}>Arrastra para rotar · Scroll para zoom · Muebles se quedan en su lugar al agregar</p>
          )}

        </div>{/* end right */}

      </div>
    </div>
  );
}
