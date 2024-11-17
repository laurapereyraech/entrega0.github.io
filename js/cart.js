const FIXER_API_URL = "https://data.fixer.io/api/latest";
const FIXER_API_KEY = "78b5e230cc134cc75d0d7eabf3105e8c";

let productos = JSON.parse(localStorage.getItem("cartItems")) || [];
let dolarAPeso = 40; // Valor aproximado por si Fixer falla

// Inicializar la vista y configurar eventos
async function initCarrito() {
  await mostrarProductos();
  recalcularTotal();
  setupEventListeners();
}

// Mostrar productos en el carrito y actualizar vista
async function mostrarProductos() {
  const contenedorProductos = document.getElementById("productosSeleccionados");
  const tablaProductos = document.getElementById("tabla");
  contenedorProductos.innerHTML = "";
  tablaProductos.innerHTML = "";

  if (!productos.length) {
    actualizarVistaVacia();
    return;
  }

  let totalUSD = 0;
  let totalUYU = 0;
  let totalItems = 0;

  productos.forEach((product, index) => {
    const subtotal = product.unitCost * product.count;
    totalItems += product.count;

    if (product.currency === "USD") totalUSD += subtotal;
    if (product.currency === "UYU") totalUYU += subtotal;

    agregarFilaTabla(product, index, subtotal);
    agregarCardProducto(product, index);
  });

  const tasaCambio = await obtenerTasaCambio();
  const totalEnPesos = totalUYU + totalUSD * tasaCambio;

  actualizarTotales(totalEnPesos, totalItems, tasaCambio);
}

// Obtener tasa de cambio del dólar
async function obtenerTasaCambio() {
  try {
    const response = await fetch(`${FIXER_API_URL}?access_key=${FIXER_API_KEY}&symbols=USD,UYU`);
    if (response.ok) {
      const data = await response.json();
      return (data.rates.UYU / data.rates.USD) || dolarAPeso;
    }
  } catch (error) {
    console.error("Error obteniendo tasa de cambio:", error);
  }
  mostrarAdvertenciaFixer();
  return dolarAPeso;
}

function mostrarAdvertenciaFixer() {
  Swal.fire("Advertencia", "No se pudo obtener la tasa de cambio actual. Se usará un valor aproximado.", "warning");
}

function actualizarVistaVacia() {
  document.getElementById("productosSeleccionados").textContent = "No existen elementos seleccionados";
  document.getElementById("cantidadProductos").textContent = 0;
  document.getElementById("cart-count-badge").textContent = 0;
  document.getElementById("total").textContent = "$0.00";
}

function agregarFilaTabla(product, index, subtotal) {
  const fila = document.createElement("tr");
  fila.innerHTML = `
    <td>${product.name} x<span id="count-${index}">${product.count}</span></td>
    <td class="text-end">${product.currency} $<span id="subtotal-${index}">${subtotal.toFixed(2)}</span></td>
  `;
  document.getElementById("tabla").appendChild(fila);
}

function agregarCardProducto(product, index) {
  const card = document.createElement("li");
  card.innerHTML = `
    <article class="d-flex my-2 flex-row align-items-center">
      <img src="${product.image}" alt="${product.name}" />
      <div class="d-flex flex-column justify-content-between mx-2">
        <h3 class="fs-4 mb-0">${product.name}</h3>
        <p class="mb-0"><span>${product.currency} $</span>${product.unitCost}</p>
      </div>
      <label for="cantidad">x</label>
      <input name="cantidad" type="number" value="${product.count}" min="1" data-index="${index}" />
      <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${index})">Eliminar</button>
    </article>
  `;
  document.getElementById("productosSeleccionados").appendChild(card);
  card.querySelector(`input[name="cantidad"]`).addEventListener("input", (event) => actualizarCantidad(event, index));
}

function actualizarTotales(totalEnPesos, totalItems, tasaCambio) {
  document.getElementById("cantidadProductos").textContent = productos.length;
  document.getElementById("cart-count-badge").textContent = totalItems;
  document.getElementById("total").textContent = `UYU ${totalEnPesos.toFixed(2)}`;
  document.getElementById("moneda").textContent = `Tasa de cambio: 1 USD = ${tasaCambio.toFixed(2)} UYU`;
}

// Actualizar cantidad de producto
function actualizarCantidad(event, index) {
  const newQuantity = parseInt(event.target.value);
  productos[index].count = isNaN(newQuantity) ? 0 : newQuantity;
  recalcularTotal();
  actualizarVistaLocalStorage();
}

// Recalcular total del carrito
function recalcularTotal() {
  let subtotal = productos.reduce((acc, product) => acc + product.unitCost * product.count, 0);
  const tipoEnvio = document.querySelector("#opciones-compra select:nth-of-type(2)").value || "estandar";
  const porcentajeEnvio = { express: 0.07, premium: 0.15, estandar: 0.05 }[tipoEnvio];
  const costoEnvio = subtotal * (porcentajeEnvio || 0);

  document.getElementById("subtotalProductos").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("costoEnvio").textContent = `$${costoEnvio.toFixed(2)}`;
  document.getElementById("totalCompra").textContent = `$${(subtotal + costoEnvio).toFixed(2)}`;
  document.getElementById("cart-count-badge").textContent = productos.reduce((acc, p) => acc + p.count, 0);
}

function actualizarVistaLocalStorage() {
  localStorage.setItem("cartItems", JSON.stringify(productos));
}

// Eliminar producto
function eliminarProducto(index) {
  productos.splice(index, 1);
  actualizarVistaLocalStorage();
  mostrarProductos();
  recalcularTotal();
}

// Configurar eventos
function setupEventListeners() {
  document.querySelector("#opciones-compra select:nth-of-type(2)").addEventListener("change", recalcularTotal);
  document.getElementById("opciones-compra").addEventListener("submit", (event) => {
    event.preventDefault();
    if (validarDatosCompra()) {
      Swal.fire("Éxito", "Compra realizada con éxito.", "success").then(() => {
        productos = [];
        localStorage.removeItem("cartItems");
        mostrarProductos();
        document.getElementById("opciones-compra").reset();
      });
    }
  });
}

// Validar datos de compra
function validarDatosCompra() {
  if (!productos.length) return mostrarError("Por favor, agregue al menos un producto al carrito.", "cart-count-badge");
  const camposDireccion = ["departamento", "localidad", "calle", "numero", "apartamento"];
  if (!camposDireccion.every((id) => document.getElementById(id).value)) {
    return mostrarError("Complete todos los campos de dirección.", "opciones-envio");
  }
  if (!["forma_pago", "tipo_envio"].every((id) => document.getElementById(id).value)) {
    return mostrarError("Seleccione forma de pago y tipo de envío.", "opciones-compra");
  }
  return true;
}

function mostrarError(mensaje, scrollId) {
  Swal.fire("Error", mensaje, "error").then(() => setTimeout(() => scrollearHasta(scrollId), 200));
  return false;
}

function scrollearHasta(id) {
  const element = document.getElementById(id);
  if (element) element.scrollIntoView({ behavior: "smooth" });
}

// Inicializar vista
initCarrito();
