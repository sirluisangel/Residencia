// ----- IndexedDB -----
let db;
const DB_NAME = "AgendaDB";
const DB_VERSION = 2; // usuarios + pagos

const openReq = indexedDB.open(DB_NAME, DB_VERSION);
openReq.onupgradeneeded = (e)=>{
  const _db = e.target.result;
  if(!_db.objectStoreNames.contains("usuarios")){
    _db.createObjectStore("usuarios",{keyPath:"user"});
  }
  if(!_db.objectStoreNames.contains("pagos")){
    _db.createObjectStore("pagos",{keyPath:"folio"});
  }
};
openReq.onsuccess = (e)=>{
  db = e.target.result;
  initApp();
};
openReq.onerror = ()=> Swal.fire("Error","No se pudo abrir IndexedDB","error");

// ----- Constantes -----
const TRAMITES = {
  LUS:   { nombre: "L.U.S",   costo: 250.00 },
  CIZ:   { nombre: "C.I.Z",   costo: 320.00 },
  CANO:  { nombre: "C.A.N.O", costo: 410.00 },
  CUS:   { nombre: "C.U.S",   costo: 280.00 },
  VBCUS: { nombre: "V.B.C.U.S", costo: 300.00 }
};

// ----- Helpers UI -----
const $ = (sel)=> document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
const currency = (n)=> "$" + (Number(n||0)).toFixed(2);

// ----- Inicialización -----
function initApp(){
  // Sesión
  const user = localStorage.getItem("sessionUser");
  if(!user){
    Swal.fire("Sesión requerida","Inicia sesión para continuar","info").then(()=>location.href="login.html");
    return;
  }
  $("#userBadge").textContent = `Usuario: ${user}`;

  // Navegación
  $$(".navitem").forEach(a=>{
    a.addEventListener("click",(ev)=>{
      if(a.hasAttribute("href")) return; // "Cerrar sesión"
      ev.preventDefault();
      $$(".navitem").forEach(x=>x.classList.remove("active"));
      a.classList.add("active");
      const section = a.dataset.section;
      $$(".section").forEach(s=>s.classList.remove("visible"));
      if(section==="pagos"||!section){$("#section-pagos").classList.add("visible");}
      if(section==="buscar"){$("#section-buscar").classList.add("visible");}
      if(section==="reportes"){$("#section-reportes").classList.add("visible"); cargarTablaReportes();}
      if(section==="config"){$("#section-config").classList.add("visible");}
    });
  });

  // Tema
  $("#toggleTheme").addEventListener("click", ()=>{
    document.body.classList.toggle("light");
  });

  // Trámites: activar/desactivar importes + autollenado costo + recalcular
  $$(".chk").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const code = chk.dataset.code;
      const inp = document.querySelector(`.importe[data-for="${code}"]`);
      if(chk.checked){
        inp.disabled = false;
        // si está vacío, colocamos el costo por defecto
        if(!inp.value) inp.value = TRAMITES[code].costo.toFixed(2);
      }else{
        inp.disabled = true;
        inp.value = "";
      }
      recalcular();
    });
  });
  $$(".importe").forEach(inp=>{
    ["input","change"].forEach(evt=> inp.addEventListener(evt, ()=>recalcular()));
  });

  // Botones CRUD
  $("#btnGuardar").addEventListener("click", guardar);
  $("#btnActualizar").addEventListener("click", actualizar);
  $("#btnEliminar").addEventListener("click", eliminar);
  $("#btnLimpiar").addEventListener("click", limpiar);
  $("#btnBuscar").addEventListener("click", buscarFolioDeFormulario);

  // Buscar sección
  $("#btnBuscarFolio").addEventListener("click", buscarFolioSeccion);

  // Reportes
  $("#btnFiltrarRep").addEventListener("click", cargarTablaReportes);

  // Fecha hoy por default
  const hoy = new Date().toISOString().slice(0,10);
  $("#fechaIng").value = hoy;

  // Arranque: vaciar tablas
  actualizarResumenTabla([]);
}

// ----- Cálculo y resumen -----
function obtenerSeleccion(){
  const seleccion = [];
  $$(".chk").forEach(chk=>{
    if(chk.checked){
      const code = chk.dataset.code;
      const imp = document.querySelector(`.importe[data-for="${code}"]`).value;
      const importeNum = Number(imp||0);
      seleccion.push({
        code,
        nombre: TRAMITES[code].nombre,
        importe: isNaN(importeNum)?0:importeNum
      });
    }
  });
  return seleccion;
}

function recalcular(){
  const seleccion = obtenerSeleccion();
  const total = seleccion.reduce((s,it)=> s+Number(it.importe||0), 0);
  $("#importeTotal").value = currency(total);
  actualizarResumenTabla(seleccion, total);
}

function actualizarResumenTabla(items, total=null){
  const tbody = $("#tablaResumen tbody");
  tbody.innerHTML = "";
  (items||[]).forEach(it=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${it.nombre}</td><td>${currency(it.importe)}</td>`;
    tbody.appendChild(tr);
  });
  $("#resTotal").textContent = currency(total ?? items.reduce((s,i)=>s+Number(i.importe||0),0));
}

// ----- CRUD IndexedDB pagos (keyPath: folio) -----
function leerFormulario(){
  const folioExp = $("#folioExp").value.trim();
  const fechaIng = $("#fechaIng").value;
  const folio = $("#folio").value.trim();
  const nombre = $("#nombre").value.trim();
  const noRecibo = $("#noRecibo").value.trim();
  const obs = $("#obs").value.trim();
  const items = obtenerSeleccion();
  const total = items.reduce((s,i)=> s+Number(i.importe||0),0);
  const now = new Date();
  const payload = {
    folio,
    folioExp,
    fechaIng,
    nombre,
    noRecibo,
    obs,
    items,
    total,
    fecha: now.toLocaleDateString(),
    hora: now.toLocaleTimeString(),
    usuario: localStorage.getItem("sessionUser")||""
  };
  return payload;
}

function validarMinimo(){
  if(!$("#folio").value.trim()){ Swal.fire("Falta folio","El campo Folio es obligatorio","warning"); return false; }
  if(!$("#folioExp").value.trim()){ Swal.fire("Falta expediente","El Folio de Expediente es obligatorio","warning"); return false; }
  if(!$("#nombre").value.trim()){ Swal.fire("Falta nombre","El nombre es obligatorio","warning"); return false; }
  if(!$("#fechaIng").value){ Swal.fire("Falta fecha","La fecha de ingreso es obligatoria","warning"); return false; }
  return true;
}

function guardar(){
  if(!validarMinimo()) return;
  const data = leerFormulario();
  const tx = db.transaction("pagos","readwrite");
  const store = tx.objectStore("pagos");
  const get = store.get(data.folio);
  get.onsuccess = ()=>{
    if(get.result){
      Swal.fire({
        icon:"question",
        title:"Folio ya existe",
        text:"¿Deseas sobreescribirlo?",
        showCancelButton:true,
        confirmButtonText:"Sí, reemplazar"
      }).then(res=>{
        if(res.isConfirmed){
          store.put(data);
          Swal.fire("Actualizado","El folio fue reemplazado","success");
        }
      });
    }else{
      store.add(data);
      Swal.fire("Guardado","Registro almacenado","success");
    }
  };
  get.onerror = ()=> Swal.fire("Error","No se pudo guardar","error");
}

function actualizar(){
  if(!validarMinimo()) return;
  const data = leerFormulario();
  const tx = db.transaction("pagos","readwrite");
  const store = tx.objectStore("pagos");
  const get = store.get(data.folio);
  get.onsuccess = ()=>{
    if(get.result){
      store.put(data);
      Swal.fire("Actualizado","Cambios guardados","success");
    }else{
      Swal.fire("No encontrado","Ese folio no existe para actualizar","warning");
    }
  };
  get.onerror = ()=> Swal.fire("Error","No se pudo actualizar","error");
}

function eliminar(){
  const folio = $("#folio").value.trim();
  if(!folio){ Swal.fire("Falta folio","Ingresa un folio para eliminar","warning"); return; }
  Swal.fire({
    icon:"warning",
    title:"Eliminar registro",
    text:"Esta acción no se puede deshacer",
    showCancelButton:true,
    confirmButtonText:"Eliminar"
  }).then(r=>{
    if(r.isConfirmed){
      const tx = db.transaction("pagos","readwrite");
      tx.objectStore("pagos").delete(folio);
      tx.oncomplete = ()=>{
        Swal.fire("Eliminado","Registro borrado","success");
        limpiar();
      };
    }
  });
}

function limpiar(){
  $("#formPagos").reset();
  // desactivar importes
  $$(".importe").forEach(i=>{ i.value=""; i.disabled=true; });
  $$(".chk").forEach(c=> c.checked=false);
  actualizarResumenTabla([]);
  $("#importeTotal").value = currency(0);
}

// ----- Buscar por folio (desglosar) -----
function buscarFolio(folio, onFound){
  const tx = db.transaction("pagos","readonly");
  const req = tx.objectStore("pagos").get(folio);
  req.onsuccess = ()=>{
    const data = req.result;
    if(!data){
      Swal.fire("Sin resultados","No existe un registro con ese folio","info");
      return;
    }
    onFound && onFound(data);
  };
  req.onerror = ()=> Swal.fire("Error","No se pudo buscar","error");
}

function rellenarFormulario(data){
  $("#folioExp").value = data.folioExp||"";
  $("#fechaIng").value = data.fechaIng||"";
  $("#folio").value = data.folio||"";
  $("#nombre").value = data.nombre||"";
  $("#noRecibo").value = data.noRecibo||"";
  $("#obs").value = data.obs||"";

  // limpiar selección actual
  $$(".chk").forEach(c=>{ c.checked=false; });
  $$(".importe").forEach(i=>{ i.value=""; i.disabled=true; });

  (data.items||[]).forEach(it=>{
    const chk = document.querySelector(`.chk[data-code="${it.code}"]`);
    const inp = document.querySelector(`.importe[data-for="${it.code}"]`);
    if(chk && inp){
      chk.checked = true;
      inp.disabled = false;
      inp.value = Number(it.importe||0).toFixed(2);
    }
  });
  recalcular();
}

function buscarFolioDeFormulario(){
  const folio = $("#folio").value.trim();
  if(!folio){ Swal.fire("Falta folio","Escribe el folio a buscar","warning"); return; }
  buscarFolio(folio, (data)=>{
    rellenarFormulario(data);
    Swal.fire("Cargado","Se llenó la agenda con ese folio","success");
  });
}

// Sección buscar (sólo muestra desglose)
function buscarFolioSeccion(){
  const folio = $("#buscarFolio").value.trim();
  if(!folio){ Swal.fire("Falta folio","Ingresa el folio a buscar","warning"); return; }
  buscarFolio(folio, (data)=>{
    const cont = $("#resultadoBusqueda");
    const filas = (data.items||[]).map(it=>`
      <tr><td>${TRAMITES[it.code]?.nombre || it.code}</td><td class="right">${currency(it.importe)}</td></tr>
    `).join("");
    cont.innerHTML = `
      <h3>Expediente: ${data.folioExp || "-"}</h3>
      <p><strong>Folio:</strong> ${data.folio} — <strong>Nombre:</strong> ${data.nombre || "-"} — <strong>Fecha:</strong> ${data.fecha} ${data.hora}</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Trámite</th><th>Importe</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr><td class="right bold">Total</td><td class="bold">${currency(data.total)}</td></tr></tfoot>
        </table>
      </div>
      <p class="muted">Usuario: ${data.usuario || "-"}</p>
    `;
  });
}

// ----- Reportes (tabla general ordenada por fecha/hora + filtros) -----
function cargarTablaReportes(){
  const desde = $("#repDesde").value ? new Date($("#repDesde").value) : null;
  const hasta = $("#repHasta").value ? new Date($("#repHasta").value) : null;
  const tbody = $("#tablaReportes tbody");
  tbody.innerHTML = "";

  const tx = db.transaction("pagos","readonly");
  const req = tx.objectStore("pagos").getAll();
  req.onsuccess = ()=>{
    let rows = req.result || [];
    // Orden por fecha+hora (guardadas como texto local) → construimos Date robusto con fechaIng y hora guardada
    rows.sort((a,b)=>{
      // usar fechaIng (ISO yyyy-mm-dd) si existe, sino fecha local
      const da = new Date((a.fechaIng||"1970-01-01")+"T"+(a.hora||"00:00"));
      const dbb = new Date((b.fechaIng||"1970-01-01")+"T"+(b.hora||"00:00"));
      return dbb - da; // descendente
    });

    if(desde && hasta){
      rows = rows.filter(r=>{
        const d = new Date((r.fechaIng||"1970-01-01")+"T12:00");
        return d >= desde && d <= hasta;
      });
    }

    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.folio}</td>
        <td>${r.nombre || "-"}</td>
        <td>${r.fechaIng || r.fecha || "-"}</td>
        <td>${r.hora || "-"}</td>
        <td>${currency(r.total||0)}</td>
        <td>${r.usuario || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  };
}
