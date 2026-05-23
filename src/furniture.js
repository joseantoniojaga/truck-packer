export class Furniture {
  constructor({ id, name, width, height, depth, color, inventory }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.inventory = inventory;
    // Own properties so spread ({...instance}) copies them correctly
    this.ancho = width;
    this.alto = height;
    this.fondo = depth;
    this.inv = inventory;
  }
  get volume() { return this.width * this.height * this.depth; }
  get dimensions() { return [this.width, this.height, this.depth]; }
}

function createFurniture(props) {
  return new Furniture(props);
}

export const FURNITURE = [
  createFurniture({ id:1, name:"Tocador Boston",    color:"#E07A5F", width:122.5, height:89.5, depth:42,    inventory:16 }),
  createFurniture({ id:2, name:"Portaluna Habana",  color:"#7B9ACC", width:81,    height:172,  depth:7.5,   inventory:28 }),
  createFurniture({ id:3, name:"Cabecera Hampton",  color:"#81B29A", width:143,   height:9,    depth:151,   inventory:38 }),
  createFurniture({ id:4, name:"Buró Hampton",      color:"#F2CC8F", width:65,    height:65,   depth:40,    inventory:32 }),
  createFurniture({ id:5, name:"Base Ind. Cielo",   color:"#6A994E", width:99,    height:30.5, depth:191,   inventory:12 }),
  createFurniture({ id:6, name:"Base Mat. Cielo",   color:"#A7C957", width:136.5, height:30.5, depth:191,   inventory:10 }),
  createFurniture({ id:7, name:"Base Ind. Sierra",  color:"#BC4749", width:99.5,  height:36,   depth:199.5, inventory:25 }),
  createFurniture({ id:8, name:"Base Mat. Sierra",  color:"#9B5DE5", width:137,   height:36,   depth:199.5, inventory:32 }),
  createFurniture({ id:9, name:"Base Queen Sierra", color:"#0F4C5C", width:150,   height:36,   depth:199.5, inventory:34 }),
];
