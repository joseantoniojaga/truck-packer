import { COLORS } from "../constants.js";

// TR llega como prop `trailer`; lo aliaseamos a TR para mantener idéntico el
// código de la implementación interna (rebautizo viene en paso posterior).
function OV({placed,vk,selId,onSel,trailer:TR}){
  const gc=(p)=>{const L=TR.largo,W=TR.ancho,H=TR.alto;switch(vk){case"top":return{x:p.x/L*100,y:p.y/W*100,w:p.l/L*100,h:p.w/W*100};case"bottom":return{x:p.x/L*100,y:(W-p.y-p.w)/W*100,w:p.l/L*100,h:p.w/W*100};case"front":return{x:p.y/W*100,y:(H-p.z-p.h)/H*100,w:p.w/W*100,h:p.h/H*100};case"back":return{x:(W-p.y-p.w)/W*100,y:(H-p.z-p.h)/H*100,w:p.w/W*100,h:p.h/H*100};case"right":return{x:p.x/L*100,y:(H-p.z-p.h)/H*100,w:p.l/L*100,h:p.h/H*100};case"left":return{x:(L-p.x-p.l)/L*100,y:(H-p.z-p.h)/H*100,w:p.l/L*100,h:p.h/H*100};default:return{x:0,y:0,w:0,h:0};}};
  const a={top:25,bottom:25,front:80,back:80,right:20,left:20};
  const lb={top:"Superior",bottom:"Inferior",front:"Frontal",back:"Trasera",right:"Derecha",left:"Izquierda"};
  let list=placed;
  if(vk==="front")list=placed.filter(p=>p.x<TR.largo*0.06);if(vk==="back")list=placed.filter(p=>p.x+p.l>TR.largo*0.94);
  if(vk==="right"){const s=new Map();for(const p of placed){const k=`${Math.round(p.x/5)}-${Math.round(p.z/5)}`;if(!s.has(k)||p.y>s.get(k).y)s.set(k,p);}list=Array.from(s.values());}
  if(vk==="left"){const s=new Map();for(const p of placed){const k=`${Math.round(p.x/5)}-${Math.round(p.z/5)}`;if(!s.has(k)||p.y<s.get(k).y)s.set(k,p);}list=Array.from(s.values());}
  return(<div style={{flex:1,minWidth:"48%"}}><div style={{fontSize:9,color:"#64748B",marginBottom:2,fontWeight:600,textAlign:"center"}}>{lb[vk]}</div>
    <div style={{position:"relative",width:"100%",paddingBottom:`${a[vk]}%`,background:"#080E1A",borderRadius:4,border:`1px solid ${COLORS.card}`,overflow:"hidden"}}>
      {list.map((p,i)=>{const c=gc(p);if(c.w<0.3||c.h<0.3)return null;const is=selId===p.id;
        return(<div key={i} onClick={e=>{e.stopPropagation();onSel(p.id);}} style={{position:"absolute",left:`${c.x}%`,top:`${c.y}%`,width:`${c.w}%`,height:`${c.h}%`,background:is?p.color:p.color+"88",border:`1px solid ${p.color}`,borderRadius:1,cursor:"pointer",opacity:is?1:0.75,zIndex:is?10:1,boxShadow:is?`0 0 0 2px ${p.color}`:"none"}} title={p.name}/>);})}
    </div></div>);
}

export default OV;
