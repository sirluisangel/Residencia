// IndexedDB: usuarios + sesión
let db;
const DB_NAME = "AgendaDB";
const DB_VERSION = 2;

const req = indexedDB.open(DB_NAME, DB_VERSION);
req.onupgradeneeded = (e)=>{
  const _db = e.target.result;
  if(!_db.objectStoreNames.contains("usuarios")){
    _db.createObjectStore("usuarios",{keyPath:"user"});
  }
  if(!_db.objectStoreNames.contains("pagos")){
    // pagos se gestiona en main, aquí sólo aseguramos su existencia por si abren primero login
    _db.createObjectStore("pagos",{keyPath:"folio"});
  }
};
req.onsuccess = (e)=> db = e.target.result;
req.onerror = ()=> Swal.fire("Error","No se pudo abrir IndexedDB","error");

// Tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#${btn.dataset.tab}Form`).classList.add("active");
  });
});

// Registro
document.getElementById("registerForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const user = document.getElementById("regUser").value.trim();
  const pass = document.getElementById("regPass").value.trim();
  if(!user || !pass) return;

  const tx = db.transaction("usuarios","readwrite");
  const store = tx.objectStore("usuarios");
  const getReq = store.get(user);

  getReq.onsuccess = ()=>{
    if(getReq.result){
      Swal.fire("Atención","Ese usuario ya existe","warning");
    }else{
      store.add({user, pass});
      Swal.fire({
        icon:"success",
        title:"Usuario creado",
        text:"Puedes iniciar sesión ahora",
        timer:1600,
        showConfirmButton:false
      }).then(()=>{
        // Cambiar a pestaña login
        document.querySelector('[data-tab="login"]').click();
      });
    }
  };
  getReq.onerror = ()=> Swal.fire("Error","No se pudo registrar","error");
});

// Login
document.getElementById("loginForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  const tx = db.transaction("usuarios","readonly");
  const store = tx.objectStore("usuarios");
  const reqUser = store.get(user);

  reqUser.onsuccess = ()=>{
    if(reqUser.result && reqUser.result.pass===pass){
      localStorage.setItem("sessionUser", user);
      Swal.fire({
        icon:"success",
        title:"¡Bienvenido!",
        text:"Accediendo al sistema",
        timer:1200,
        showConfirmButton:false
      }).then(()=> location.href="main.html");
    }else{
      Swal.fire("Error","Usuario o contraseña incorrectos","error");
    }
  };
  reqUser.onerror = ()=> Swal.fire("Error","No se pudo validar","error");
});
