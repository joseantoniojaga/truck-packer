export class Furniture {
  constructor({ id, name, ancho, alto, fondo, color, inv }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.ancho = ancho;
    this.alto = alto;
    this.fondo = fondo;
    this.inv = inv;
  }
  get volume() { return this.ancho * this.alto * this.fondo; }
  get dimensions() { return [this.ancho, this.alto, this.fondo]; }
}

function createFurniture(props) {
  return new Furniture(props);
}

export const FURNITURE = [
  createFurniture({ id:1, name:"Tocador Boston",    color:"#E07A5F", ancho:122.5, alto:89.5, fondo:42,    inv:16 }),
  createFurniture({ id:2, name:"Portaluna Habana",  color:"#7B9ACC", ancho:81,    alto:172,  fondo:7.5,   inv:28 }),
  createFurniture({ id:3, name:"Cabecera Hampton",  color:"#81B29A", ancho:143,   alto:9,    fondo:151,   inv:38 }),
  createFurniture({ id:4, name:"Buró Hampton",      color:"#F2CC8F", ancho:65,    alto:65,   fondo:40,    inv:32 }),
  createFurniture({ id:5, name:"Base Ind. Cielo",   color:"#6A994E", ancho:99,    alto:30.5, fondo:191,   inv:12 }),
  createFurniture({ id:6, name:"Base Mat. Cielo",   color:"#A7C957", ancho:136.5, alto:30.5, fondo:191,   inv:10 }),
  createFurniture({ id:7, name:"Base Ind. Sierra",  color:"#BC4749", ancho:99.5,  alto:36,   fondo:199.5, inv:25 }),
  createFurniture({ id:8, name:"Base Mat. Sierra",  color:"#9B5DE5", ancho:137,   alto:36,   fondo:199.5, inv:32 }),
  createFurniture({ id:9, name:"Base Queen Sierra", color:"#0F4C5C", ancho:150,   alto:36,   fondo:199.5, inv:34 }),
];
