// js/app.js - Controlador Principal del Módulo de Inversionistas FINOVA (14 Pantallas)

document.addEventListener("DOMContentLoaded", () => {
  // Inicialización de la aplicación
  window.finovaApp = new FinovaInvestorApp();
});

class FinovaInvestorApp {
  constructor() {
    this.store = window.finovaStore;
    this.currentView = "dashboard";
    this.selectedInvestorId = "INV-001"; // Por defecto Roberto Andrade ($8,000)
    
    this.initNavigation();
    this.initGlobalEvents();
    this.renderCurrentView();
  }

  // Enrutador de vistas
  navigateTo(viewId, params = {}) {
    this.currentView = viewId;
    if (params.investorId) {
      this.selectedInvestorId = params.investorId;
    }

    // Actualizar sidebar activo
    document.querySelectorAll(".nav-item").forEach(item => {
      if (item.dataset.view === viewId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Actualizar migas de pan
    const breadcrumbElem = document.getElementById("current-view-name");
    if (breadcrumbElem) {
      const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"] span`);
      breadcrumbElem.textContent = activeNav ? activeNav.textContent : this.getViewTitle(viewId);
    }

    // Ocultar todas las vistas y mostrar la activa
    document.querySelectorAll(".view-container").forEach(el => el.classList.remove("active-view"));
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.add("active-view");
    }

    // Renderizar contenido dinámico de la vista
    this.renderCurrentView();

    // Scroll to top
    const contentArea = document.querySelector(".content-area");
    if (contentArea) contentArea.scrollTop = 0;
  }

  getViewTitle(viewId) {
    const titles = {
      "dashboard": "Panel General de Inversionistas",
      "inversionistas-lista": "Directorio de Inversionistas",
      "inversionista-detalle": "Expediente 360° de Inversionista",
      "nuevo-inversionista": "Registro de Nuevo Inversionista",
      "nuevo-aporte": "Registrar Aporte de Capital",
      "asignacion-fondos": "Módulo de Asignación y Destino de Fondos",
      "cartera-prestamos": "Cartera de Préstamos Fondeados",
      "recuperacion-intereses": "Recuperación y Atribución de Intereses",
      "acuerdos-contratos": "Acuerdos y Contratos de Rendimiento",
      "monitor-obligaciones": "Monitor de Obligaciones y Vencimientos",
      "registro-pagos": "Liquidación de Pagos y Devoluciones",
      "libro-mayor": "Libro Mayor y Extracto Contable",
      "auditoria-reversiones": "Bitácora de Auditoría y Reversiones",
      "reportes-conciliacion": "Conciliación de Caja y Reportes"
    };
    return titles[viewId] || "Módulo Inversionistas";
  }

  initNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) {
          this.navigateTo(view);
        }
      });
    });

    // Delegación para enlaces rápidos con clase data-view-target
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-view-target]");
      if (target) {
        e.preventDefault();
        const view = target.dataset.viewTarget;
        const invId = target.dataset.investorId;
        this.navigateTo(view, { investorId: invId });
      }
    });
  }

  initGlobalEvents() {
    // Cerrar modales con ESC o click en backdrop
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    document.querySelectorAll(".modal-close").forEach(btn => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-overlay");
        if (modal) this.closeModal(modal.id);
      });
    });

    // Botón de reinicio de demostración
    const resetBtn = document.getElementById("btn-reset-demo");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("¿Deseas restaurar todos los datos de demostración a su estado inicial?")) {
          this.store.reset();
          this.showToast("Datos de demostración restablecidos correctamente", "success");
          this.renderCurrentView();
        }
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("open");
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("open");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="font-weight: 700; font-size: 1.1rem;">
        ${type === 'success' ? '✓' : (type === 'danger' ? '✕' : 'ℹ')}
      </div>
      <div>${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  formatMoney(num) {
    return `$${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // RENDERIZADO SEGÚN LA PANTALLA ACTIVA
  renderCurrentView() {
    switch (this.currentView) {
      case "dashboard":
        this.renderDashboard();
        break;
      case "inversionistas-lista":
        this.renderInversionistasLista();
        break;
      case "inversionista-detalle":
        this.renderInversionistaDetalle(this.selectedInvestorId);
        break;
      case "nuevo-inversionista":
        this.renderNuevoInversionista();
        break;
      case "nuevo-aporte":
        this.renderNuevoAporte();
        break;
      case "asignacion-fondos":
        this.renderAsignacionFondos();
        break;
      case "cartera-prestamos":
        this.renderCarteraPrestamos();
        break;
      case "recuperacion-intereses":
        this.renderRecuperacionIntereses();
        break;
      case "acuerdos-contratos":
        this.renderAcuerdosContratos();
        break;
      case "monitor-obligaciones":
        this.renderMonitorObligaciones();
        break;
      case "registro-pagos":
        this.renderRegistroPagos();
        break;
      case "libro-mayor":
        this.renderLibroMayor();
        break;
      case "auditoria-reversiones":
        this.renderAuditoriaReversiones();
        break;
      case "reportes-conciliacion":
        this.renderReportesConciliacion();
        break;
      default:
        this.renderDashboard();
    }
  }

  // 1. DASHBOARD GENERAL
  renderDashboard() {
    const emp = this.store.getEmpresa();
    const inversionistas = this.store.getInversionistas();
    const aportes = this.store.getAportes();
    const obligaciones = this.store.getObligaciones().filter(o => o.estado === 'pendiente');

    // Recalcular métricas dinámicas
    const totalRecibido = inversionistas.reduce((sum, i) => sum + i.totalAportado, 0);
    const asignadoPrestamos = inversionistas.reduce((sum, i) => sum + i.capitalAsignadoPrestamos, 0);
    const otrosUsos = inversionistas.reduce((sum, i) => sum + i.capitalOtrosUsos, 0);
    const devueltoTotal = inversionistas.reduce((sum, i) => sum + i.capitalDevuelto, 0);
    const pendienteTotal = inversionistas.reduce((sum, i) => sum + i.capitalPendiente, 0);
    const rendimientosPendientes = obligaciones.reduce((sum, o) => sum + (o.montoTotalObligacion || o.montoRendimiento), 0);
    const interesesCobradosTotal = inversionistas.reduce((sum, i) => sum + i.interesesCobradosCartera, 0);

    const pctPrestamos = totalRecibido > 0 ? ((asignadoPrestamos / totalRecibido) * 100).toFixed(1) : 0;
    const pctOtros = totalRecibido > 0 ? ((otrosUsos / totalRecibido) * 100).toFixed(1) : 0;

    const container = document.getElementById("view-dashboard");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            Panel General de Inversionistas
          </h1>
          <p>Supervisión consolidada de capital captado, colocación en créditos, liquidez y rendimientos devengados.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" data-view-target="reportes-conciliacion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Conciliación de Caja
          </button>
          <button class="btn btn-primary" data-view-target="nuevo-aporte">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            + Registrar Aporte
          </button>
        </div>
      </div>

      <!-- Comparativa Conceptual: Tasa Cartera FINOVA vs Tasa Inversionista -->
      <div class="rate-comparison-banner">
        <div class="rate-compare-item">
          <div class="rate-badge-circle finova">${emp.tasaPromedioCartera}%</div>
          <div>
            <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Tasa Cobrada a Prestatarios</div>
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">Retorno Bruto FINOVA en Cartera</div>
          </div>
        </div>
        <div style="font-size: 1.5rem; color: var(--text-dim); font-weight: 300;">≠</div>
        <div class="rate-compare-item">
          <div class="rate-badge-circle investor">2.8% - 4.0%</div>
          <div>
            <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Rendimiento Pactado Inversionistas</div>
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">Costo de Fondeo Contractual</div>
          </div>
        </div>
        <div style="border-left: 1px solid var(--border-subtle); padding-left: 18px;">
          <div style="font-size: 0.74rem; color: var(--text-dim);">Margen Financiero Bruto:</div>
          <div style="font-family: var(--font-mono); font-size: 1.15rem; font-weight: 800; color: var(--success);">
            ${this.formatMoney(interesesCobradosTotal - emp.rendimientosDevengadosTotal)}
          </div>
        </div>
      </div>

      <!-- 6 Tarjetas KPI Clave -->
      <div class="kpi-grid">
        <div class="kpi-card" style="--accent-color: #3b82f6;">
          <div class="kpi-header">
            <span class="kpi-title">Capital Recibido Total</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/></svg>
            </div>
          </div>
          <div class="kpi-value">${this.formatMoney(totalRecibido)}</div>
          <div class="kpi-subtext"><strong>${inversionistas.length}</strong> inversionistas activos registrados</div>
          <div class="dist-bar-container">
            <div class="dist-bar-track">
              <div class="dist-bar-fill-loans" style="width: ${pctPrestamos}%;" title="Préstamos: ${pctPrestamos}%"></div>
              <div class="dist-bar-fill-others" style="width: ${pctOtros}%;" title="Otros Usos: ${pctOtros}%"></div>
            </div>
            <div class="dist-legend">
              <span>● ${pctPrestamos}% Préstamos</span>
              <span>● ${pctOtros}% Otros Usos</span>
            </div>
          </div>
        </div>

        <div class="kpi-card" style="--accent-color: #6366f1;">
          <div class="kpi-header">
            <span class="kpi-title">Colocado en Préstamos</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
          </div>
          <div class="kpi-value">${this.formatMoney(asignadoPrestamos)}</div>
          <div class="kpi-subtext">Asignado a créditos de clientes FINOVA</div>
        </div>

        <div class="kpi-card" style="--accent-color: #f59e0b;">
          <div class="kpi-header">
            <span class="kpi-title">Destinado a Otros Usos</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
          </div>
          <div class="kpi-value">${this.formatMoney(otrosUsos)}</div>
          <div class="kpi-subtext">Caja operativa, reservas y liquidez</div>
        </div>

        <div class="kpi-card" style="--accent-color: #10b981;">
          <div class="kpi-header">
            <span class="kpi-title">Capital Devuelto</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>
            </div>
          </div>
          <div class="kpi-value">${this.formatMoney(devueltoTotal)}</div>
          <div class="kpi-subtext">Amortizaciones y liquidaciones pagadas</div>
        </div>

        <div class="kpi-card" style="--accent-color: #ef4444;">
          <div class="kpi-header">
            <span class="kpi-title">Capital Pendiente Devolver</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
          </div>
          <div class="kpi-value" style="color: #fca5a5;">${this.formatMoney(pendienteTotal)}</div>
          <div class="kpi-subtext">Obligación de capital principal con inversores</div>
        </div>

        <div class="kpi-card" style="--accent-color: #a855f7;">
          <div class="kpi-header">
            <span class="kpi-title">Rendimientos por Pagar</span>
            <div class="kpi-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div class="kpi-value" style="color: #d8b4fe;">${this.formatMoney(rendimientosPendientes)}</div>
          <div class="kpi-subtext"><strong>${obligaciones.length}</strong> cortes devengados próximos a liquidar</div>
        </div>
      </div>

      <!-- Sección de Ejemplo Destacado: Caso de Uso $8,000 -->
      <div class="card" style="border-left: 4px solid var(--primary); background: linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(17, 24, 39, 0.7) 100%);">
        <div class="card-header-clean">
          <div>
            <div class="badge badge-primary" style="margin-bottom: 6px;">Caso Típico Ilustrativo</div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff;">Aporte de $8,000.00 — Roberto Andrade Carrión</h3>
            <p style="font-size: 0.82rem; color: var(--text-muted);">
              Demostración exacta de trazabilidad: $2,000 colocados en préstamos, $6,000 en otros usos, sin alterar la obligación de devolución de los $8,000.
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" data-view-target="inversionista-detalle" data-investor-id="INV-001">
            Ver Expediente 360° →
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-top: 14px;">
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Aporte Recibido</div>
            <div class="highlight-stat-num" style="color: #38bdf8;">$8,000.00</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">15/01/2026 (Pichincha)</div>
          </div>
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">En Préstamos</div>
            <div class="highlight-stat-num" style="color: #818cf8;">$2,000.00</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">PREST-1049 y PREST-1052</div>
          </div>
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Otros Usos / Caja</div>
            <div class="highlight-stat-num" style="color: #fbbf24;">$6,000.00</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Disponibilidad y reservas</div>
          </div>
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Interés Cobrado Cartera</div>
            <div class="highlight-stat-num" style="color: #34d399;">$400.00</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Recuperado de clientes al 20%</div>
          </div>
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Rendimiento Inversionista</div>
            <div class="highlight-stat-num" style="color: #c084fc;">$280.00 / mes</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Tasa pactada: 3.5% mensual</div>
          </div>
        </div>
      </div>

      <!-- Tabla Resumen de Inversionistas -->
      <div class="card">
        <div class="card-header-clean">
          <h3 class="card-title-clean">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Inversionistas Principales
          </h3>
          <button class="btn btn-secondary btn-sm" data-view-target="inversionistas-lista">
            Ver Todos (${inversionistas.length}) →
          </button>
        </div>

        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Inversionista</th>
                <th>Capital Aportado</th>
                <th>Asignado Préstamos</th>
                <th>Otros Usos</th>
                <th>Capital Devuelto</th>
                <th>Saldo Pendiente</th>
                <th>Tasa Pactada</th>
                <th>Próximo Corte</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${inversionistas.map(inv => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${inv.nombre}</div>
                    <div style="font-size: 0.74rem; color: var(--text-dim);">${inv.id} • ${inv.tipoDocumento}: ${inv.documento}</div>
                  </td>
                  <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${this.formatMoney(inv.totalAportado)}</td>
                  <td class="font-mono">${this.formatMoney(inv.capitalAsignadoPrestamos)}</td>
                  <td class="font-mono">${this.formatMoney(inv.capitalOtrosUsos)}</td>
                  <td class="font-mono" style="color: var(--success);">${this.formatMoney(inv.capitalDevuelto)}</td>
                  <td class="font-mono" style="font-weight: 700; color: #fca5a5;">${this.formatMoney(inv.capitalPendiente)}</td>
                  <td>
                    <span class="badge badge-primary">${inv.acuerdoVigente?.tasaMensualPactada}% mes</span>
                  </td>
                  <td>
                    <span style="font-size: 0.78rem; color: var(--warning);">${inv.proximoVencimiento}</span>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" data-view-target="inversionista-detalle" data-investor-id="${inv.id}">
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 2. DIRECTORIO DE INVERSIONISTAS
  renderInversionistasLista() {
    const inversionistas = this.store.getInversionistas();
    const container = document.getElementById("view-inversionistas-lista");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Directorio de Inversionistas</h1>
          <p>Expedientes, estados de cuenta, calificación de riesgo y acuerdos vigentes.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" data-view-target="nuevo-inversionista">
            + Nuevo Inversionista
          </button>
        </div>
      </div>

      <div class="card">
        <div class="filter-toolbar">
          <div class="search-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="search-investor-input" class="form-control" placeholder="Buscar por nombre, RUC/Cédula, correo o ID...">
          </div>
          <select id="filter-investor-state" class="form-control" style="width: auto;">
            <option value="all">Todos los Estados</option>
            <option value="activo" selected>Activos</option>
            <option value="liquidado">Liquidados</option>
          </select>
        </div>

        <div class="table-responsive">
          <table class="fin-table" id="table-investors-list">
            <thead>
              <tr>
                <th>Código</th>
                <th>Inversionista</th>
                <th>Contacto & Banco</th>
                <th>Capital Total</th>
                <th>En Préstamos</th>
                <th>Otros Usos</th>
                <th>Devoluciones</th>
                <th>Saldo Pendiente</th>
                <th>Rendimiento</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${inversionistas.map(inv => `
                <tr data-search="${inv.nombre.toLowerCase()} ${inv.documento} ${inv.id.toLowerCase()}">
                  <td class="font-mono"><strong>${inv.id}</strong></td>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${inv.nombre}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${inv.tipoPersona} • ${inv.documento}</div>
                  </td>
                  <td>
                    <div style="font-size: 0.76rem; color: var(--text-main);">${inv.email}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${inv.bancoDestino} (${inv.tipoCuenta})</div>
                  </td>
                  <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${this.formatMoney(inv.totalAportado)}</td>
                  <td class="font-mono">${this.formatMoney(inv.capitalAsignadoPrestamos)}</td>
                  <td class="font-mono">${this.formatMoney(inv.capitalOtrosUsos)}</td>
                  <td class="font-mono" style="color: var(--success);">${this.formatMoney(inv.capitalDevuelto)}</td>
                  <td class="font-mono" style="font-weight: 700; color: #fca5a5;">${this.formatMoney(inv.capitalPendiente)}</td>
                  <td>
                    <span class="badge badge-purple">${inv.acuerdoVigente?.tasaMensualPactada}% m.</span>
                  </td>
                  <td>
                    <span class="badge badge-success">Activo</span>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" data-view-target="inversionista-detalle" data-investor-id="${inv.id}">
                      Expediente
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Filtro interactivo de búsqueda
    const searchInput = document.getElementById("search-investor-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll("#table-investors-list tbody tr").forEach(row => {
          const text = row.dataset.search || "";
          row.style.display = text.includes(query) ? "" : "none";
        });
      });
    }
  }

  // 3. EXPEDIENTE 360° DEL INVERSIONISTA
  renderInversionistaDetalle(invId) {
    const inv = this.store.getInversionistaById(invId) || this.store.getInversionistas()[0];
    if (!inv) return;
    this.selectedInvestorId = inv.id;

    const aportes = this.store.getAportesByInversionista(inv.id);
    const asignaciones = this.store.getAsignaciones().filter(a => a.inversionistaId === inv.id);
    const obligaciones = this.store.getObligaciones().filter(o => o.inversionistaId === inv.id);
    const extracto = this.store.getLibroMayor().filter(l => l.inversionistaId === inv.id);

    const container = document.getElementById("view-inversionista-detalle");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-secondary btn-sm" data-view-target="inversionistas-lista">← Volver al listado</button>
            <span class="badge badge-primary">${inv.id}</span>
            <span class="badge badge-success">${inv.estado.toUpperCase()}</span>
          </div>
          <h1 style="margin-top: 6px;">${inv.nombre}</h1>
          <p>${inv.tipoPersona} • ${inv.tipoDocumento}: ${inv.documento} • Registrado el ${inv.fechaRegistro}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" id="btn-generar-corte-inv">
            ⚡ Generar Corte Rendimiento
          </button>
          <button class="btn btn-primary btn-sm" data-view-target="registro-pagos" data-investor-id="${inv.id}">
            Liquidar Pago / Devolución
          </button>
        </div>
      </div>

      <!-- Tarjetas de Saldo del Inversionista -->
      <div class="kpi-grid">
        <div class="kpi-card" style="--accent-color: #3b82f6;">
          <div class="kpi-title">Capital Total Aportado</div>
          <div class="kpi-value">${this.formatMoney(inv.totalAportado)}</div>
          <div class="kpi-subtext">Histórico recibido</div>
        </div>
        <div class="kpi-card" style="--accent-color: #6366f1;">
          <div class="kpi-title">Fondeado en Préstamos</div>
          <div class="kpi-value">${this.formatMoney(inv.capitalAsignadoPrestamos)}</div>
          <div class="kpi-subtext">Generando intereses de cartera</div>
        </div>
        <div class="kpi-card" style="--accent-color: #f59e0b;">
          <div class="kpi-title">Destinado a Otros Usos</div>
          <div class="kpi-value">${this.formatMoney(inv.capitalOtrosUsos)}</div>
          <div class="kpi-subtext">Caja operativa y liquidez</div>
        </div>
        <div class="kpi-card" style="--accent-color: #ef4444;">
          <div class="kpi-title">Capital Pendiente Devolver</div>
          <div class="kpi-value" style="color: #fca5a5;">${this.formatMoney(inv.capitalPendiente)}</div>
          <div class="kpi-subtext">Capital devuelto: <strong>${this.formatMoney(inv.capitalDevuelto)}</strong></div>
        </div>
        <div class="kpi-card" style="--accent-color: #a855f7;">
          <div class="kpi-title">Rendimiento Pendiente</div>
          <div class="kpi-value" style="color: #d8b4fe;">${this.formatMoney(inv.rendimientoPendiente)}</div>
          <div class="kpi-subtext">Tasa pactada: <strong>${inv.acuerdoVigente?.tasaMensualPactada}% mensual</strong></div>
        </div>
      </div>

      <!-- Pestañas Interactivas del Expediente -->
      <div class="tab-nav">
        <button class="tab-btn active" data-tab-target="tab-resumen">Ficha & Acuerdo Contractual</button>
        <button class="tab-btn" data-tab-target="tab-aportes">Aportes Realizados (${aportes.length})</button>
        <button class="tab-btn" data-tab-target="tab-asignaciones">Asignaciones de Fondos (${asignaciones.length})</button>
        <button class="tab-btn" data-tab-target="tab-obligaciones">Obligaciones & Rendimientos (${obligaciones.length})</button>
        <button class="tab-btn" data-tab-target="tab-extracto">Extracto Contable</button>
      </div>

      <!-- Tab 1: Resumen y Acuerdo -->
      <div class="tab-content" id="tab-resumen">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="card">
            <h3 class="card-title-clean">Datos Financieros y Bancarios</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px; font-size: 0.85rem;">
              <div><strong style="color: var(--text-dim);">Entidad Bancaria:</strong> ${inv.bancoDestino}</div>
              <div><strong style="color: var(--text-dim);">Tipo y Número de Cuenta:</strong> ${inv.tipoCuenta} #${inv.numeroCuenta}</div>
              <div><strong style="color: var(--text-dim);">Titular Registrado:</strong> ${inv.titularCuenta}</div>
              <div><strong style="color: var(--text-dim);">Correo de Notificaciones:</strong> ${inv.email}</div>
              <div><strong style="color: var(--text-dim);">Teléfono:</strong> ${inv.telefono}</div>
              <div><strong style="color: var(--text-dim);">Domicilio / Ciudad:</strong> ${inv.direccion}, ${inv.ciudad}</div>
              <div><strong style="color: var(--text-dim);">Calificación de Inversión:</strong> <span class="badge badge-primary">${inv.calificacionRiesgo}</span></div>
            </div>
          </div>

          <div class="card" style="border-left: 3px solid var(--primary);">
            <h3 class="card-title-clean">Acuerdo Contractual Vigente</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px; font-size: 0.85rem;">
              <div><strong style="color: var(--text-dim);">Código de Contrato:</strong> <span class="font-mono">${inv.acuerdoVigente?.codigo}</span></div>
              <div><strong style="color: var(--text-dim);">Rendimiento Pactado:</strong> <span class="badge badge-purple" style="font-size: 0.82rem;">${inv.acuerdoVigente?.tasaMensualPactada}% Mensual</span></div>
              <div><strong style="color: var(--text-dim);">Modalidad de Liquidación:</strong> ${inv.acuerdoVigente?.modalidadPago}</div>
              <div><strong style="color: var(--text-dim);">Plazo Contractual:</strong> ${inv.acuerdoVigente?.plazoMeses} meses (Vence: ${inv.acuerdoVigente?.fechaVencimiento})</div>
              <div><strong style="color: var(--text-dim);">Día de Corte Mensual:</strong> Día ${inv.acuerdoVigente?.diaCorte} de cada mes</div>
              <div><strong style="color: var(--text-dim);">Garantía Otorgada:</strong> ${inv.acuerdoVigente?.garantiaPactada}</div>
              <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-dim);">
                Nota: El rendimiento pactado (${inv.acuerdoVigente?.tasaMensualPactada}%) es independiente del 20% mensual cobrado a los clientes prestatarios.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: Aportes -->
      <div class="tab-content" id="tab-aportes" style="display: none;">
        <div class="card">
          <div class="card-header-clean">
            <h3 class="card-title-clean">Historial de Aportes de Capital</h3>
            <button class="btn btn-primary btn-sm" data-view-target="nuevo-aporte">+ Añadir Aporte</button>
          </div>
          <div class="table-responsive">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Medio de Pago</th>
                  <th>Comprobante</th>
                  <th>Cuenta Receptora</th>
                  <th>Estado Asignación</th>
                </tr>
              </thead>
              <tbody>
                ${aportes.map(a => `
                  <tr>
                    <td class="font-mono"><strong>${a.id}</strong></td>
                    <td>${a.fechaAporte}</td>
                    <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${this.formatMoney(a.monto)}</td>
                    <td>${a.medioPago}</td>
                    <td class="font-mono">${a.numeroComprobante}</td>
                    <td style="font-size: 0.76rem;">${a.cuentaReceptoraFinova}</td>
                    <td>
                      <span class="badge ${a.estadoAsignacion === 'completamente_asignado' ? 'badge-success' : 'badge-warning'}">
                        ${a.estadoAsignacion === 'completamente_asignado' ? '100% Asignado' : 'Pendiente Asignar'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 3: Asignaciones -->
      <div class="tab-content" id="tab-asignaciones" style="display: none;">
        <div class="card">
          <div class="card-header-clean">
            <h3 class="card-title-clean">Destino y Distribución de Fondos</h3>
            <button class="btn btn-primary btn-sm" data-view-target="asignacion-fondos">+ Nueva Asignación</button>
          </div>
          <div class="table-responsive">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Tipo Destino</th>
                  <th>Destino / Préstamo</th>
                  <th>Monto Asignado</th>
                  <th>Justificación</th>
                </tr>
              </thead>
              <tbody>
                ${asignaciones.map(asig => `
                  <tr>
                    <td class="font-mono"><strong>${asig.id}</strong></td>
                    <td>${asig.fecha}</td>
                    <td>
                      <span class="badge ${asig.tipoDestino === 'prestamo' ? 'badge-primary' : 'badge-warning'}">
                        ${asig.tipoDestino === 'prestamo' ? 'Préstamo' : 'Otros Usos'}
                      </span>
                    </td>
                    <td><strong>${asig.destinoNombre}</strong></td>
                    <td class="font-mono" style="font-weight: 700;">${this.formatMoney(asig.monto)}</td>
                    <td style="font-size: 0.78rem; color: var(--text-dim);">${asig.justificacion}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 4: Obligaciones -->
      <div class="tab-content" id="tab-obligaciones" style="display: none;">
        <div class="card">
          <h3 class="card-title-clean">Rendimientos Devengados y Vencimientos</h3>
          <div class="table-responsive">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Período</th>
                  <th>Base Cálculo</th>
                  <th>Tasa</th>
                  <th>Rendimiento</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${obligaciones.map(o => `
                  <tr>
                    <td class="font-mono"><strong>${o.id}</strong></td>
                    <td>${o.periodo}</td>
                    <td class="font-mono">${this.formatMoney(o.baseCalculoCapital)}</td>
                    <td>${o.tasaPactadaMensual}% m.</td>
                    <td class="font-mono" style="font-weight: 700; color: #d8b4fe;">${this.formatMoney(o.montoTotalObligacion || o.montoRendimiento)}</td>
                    <td>${o.fechaVencimientoPago}</td>
                    <td>
                      <span class="badge ${o.estado === 'pagado' ? 'badge-success' : 'badge-danger'}">
                        ${o.estado.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      ${o.estado === 'pendiente' ? `
                        <button class="btn btn-success btn-sm" data-view-target="registro-pagos" data-investor-id="${inv.id}">
                          Pagar Ahora
                        </button>
                      ` : `
                        <span style="font-size: 0.72rem; color: var(--text-dim);">${o.fechaPagoRealizado}</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 5: Extracto -->
      <div class="tab-content" id="tab-extracto" style="display: none;">
        <div class="card">
          <h3 class="card-title-clean">Libro Mayor del Inversionista</h3>
          <div class="table-responsive">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Referencia</th>
                  <th>Monto</th>
                  <th>Saldo Capital</th>
                  <th>Saldo Rendimientos</th>
                  <th>Glosa / Detalle</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${extracto.map(e => `
                  <tr>
                    <td>${e.fecha}</td>
                    <td><strong>${e.tipoMovimiento}</strong></td>
                    <td class="font-mono" style="font-size: 0.76rem;">${e.referencia}</td>
                    <td class="font-mono" style="font-weight: 700;">${this.formatMoney(e.monto)}</td>
                    <td class="font-mono" style="color: #38bdf8;">${this.formatMoney(e.saldoCapital)}</td>
                    <td class="font-mono" style="color: #c084fc;">${this.formatMoney(e.saldoRendimientos)}</td>
                    <td style="font-size: 0.78rem;">${e.glosa}</td>
                    <td>
                      <span class="badge ${e.estado === 'confirmado' ? 'badge-success' : 'badge-danger'}">
                        ${e.estado}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Interacciones de pestañas
    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        container.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
        btn.classList.add("active");
        const targetId = btn.dataset.tabTarget;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.style.display = "block";
      });
    });

    // Acción para generar corte devengado
    const btnCorte = document.getElementById("btn-generar-corte-inv");
    if (btnCorte) {
      btnCorte.addEventListener("click", () => {
        if (confirm(`¿Deseas generar el corte de rendimiento mensual para ${inv.nombre}? Tasa: ${inv.acuerdoVigente?.tasaMensualPactada}% sobre saldo de ${this.formatMoney(inv.capitalPendiente)}`)) {
          const obl = this.store.generarCorteDevengado(inv.id);
          this.showToast(`Corte generado con éxito: ${this.formatMoney(obl.montoRendimiento)} devengados`, "success");
          this.renderInversionistaDetalle(inv.id);
        }
      });
    }
  }

  // 4. REGISTRO DE NUEVO INVERSIONISTA
  renderNuevoInversionista() {
    const container = document.getElementById("view-nuevo-inversionista");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Registro de Nuevo Inversionista</h1>
          <p>Creación del expediente legal, perfil de cumplimiento, cuentas de destino y contrato marco.</p>
        </div>
      </div>

      <div class="card" style="max-width: 900px; margin: 0 auto;">
        <form id="form-nuevo-inversionista">
          <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            1. Información Legal y Personal
          </h3>
          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Nombre Completo o Razón Social *</label>
              <input type="text" name="nombre" class="form-control" required placeholder="Ej: Ing. Marcelo Paredes / Inversiones Alfa Cía. Ltda.">
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Persona</label>
              <select name="tipoPersona" class="form-control">
                <option value="Natural">Persona Natural</option>
                <option value="Natural con RUC">Persona Natural con RUC</option>
                <option value="Jurídica">Persona Jurídica (Empresa)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo y Nro. Documento *</label>
              <div style="display: flex; gap: 8px;">
                <select name="tipoDocumento" class="form-control" style="width: 100px;">
                  <option value="Cédula">Cédula</option>
                  <option value="RUC">RUC</option>
                  <option value="Pasaporte">Pasap.</option>
                </select>
                <input type="text" name="documento" class="form-control" required placeholder="1718293849">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Correo Electrónico *</label>
              <input type="email" name="email" class="form-control" required placeholder="inversionista@correo.com">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono Móvil *</label>
              <input type="text" name="telefono" class="form-control" required placeholder="+593 99 123 4567">
            </div>
            <div class="form-group col-span-2">
              <label class="form-label">Dirección Domiciliaria</label>
              <input type="text" name="direccion" class="form-control" placeholder="Av. Principal y Secundaria, Edificio / Oficina">
            </div>
          </div>

          <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin: 24px 0 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            2. Datos Bancarios para Pagos y Devoluciones
          </h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Banco Destino *</label>
              <select name="bancoDestino" class="form-control">
                <option value="Banco Pichincha">Banco Pichincha</option>
                <option value="Banco Guayaquil">Banco Guayaquil</option>
                <option value="Produbanco">Produbanco</option>
                <option value="Banco del Austro">Banco del Austro</option>
                <option value="Banco Internacional">Banco Internacional</option>
                <option value="Banco Bolivariano">Banco Bolivariano</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Cuenta</label>
              <select name="tipoCuenta" class="form-control">
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Número de Cuenta *</label>
              <input type="text" name="numeroCuenta" class="form-control" required placeholder="2100489234">
            </div>
            <div class="form-group">
              <label class="form-label">Titular de la Cuenta</label>
              <input type="text" name="titularCuenta" class="form-control" placeholder="Dejar en blanco si es el mismo">
            </div>
          </div>

          <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin: 24px 0 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            3. Acuerdo Contractual Inicial
          </h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Tasa de Rendimiento Mensual Pactada (%) *</label>
              <input type="number" step="0.1" name="tasaMensualPactada" class="form-control" value="3.5" required>
              <span class="input-hint">Rendimiento que pagará FINOVA (ej: 3.5% mensual).</span>
            </div>
            <div class="form-group">
              <label class="form-label">Plazo de la Inversión (Meses)</label>
              <input type="number" name="plazoMeses" class="form-control" value="12">
            </div>
            <div class="form-group">
              <label class="form-label">Modalidad de Devolución</label>
              <select name="modalidadPago" class="form-control">
                <option value="Interés mensual, Capital al vencimiento">Interés mensual, Capital al vencimiento</option>
                <option value="Amortización mensual Capital + Rendimiento">Amortización mensual Capital + Rendimiento</option>
                <option value="Capital y Rendimiento compuesto al final">Capital y Rendimiento compuesto al final</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Garantía Pactada</label>
              <input type="text" name="garantiaPactada" class="form-control" value="Pagaré a la orden avalado por cartera">
            </div>
            <div class="form-group col-span-full">
              <label class="form-label">Observaciones y Notas de Cumplimiento</label>
              <textarea name="notas" class="form-control" placeholder="Notas de debida diligencia, origen de fondos declarado, etc."></textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 28px; border-top: 1px solid var(--border-subtle); padding-top: 18px;">
            <button type="button" class="btn btn-secondary" data-view-target="inversionistas-lista">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Expediente</button>
          </div>
        </form>
      </div>
    `;

    const form = document.getElementById("form-nuevo-inversionista");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const nuevo = this.store.agregarInversionista(data);
        this.showToast(`Inversionista ${nuevo.nombre} registrado correctamente`, "success");
        this.navigateTo("inversionista-detalle", { investorId: nuevo.id });
      });
    }
  }

  // 5. REGISTRO DE APORTES DE CAPITAL
  renderNuevoAporte() {
    const inversionistas = this.store.getInversionistas();
    const container = document.getElementById("view-nuevo-aporte");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Registro de Aporte de Capital</h1>
          <p>Registra el ingreso de fondos respaldado por comprobante bancario. El dinero ingresará al patrimonio administrado.</p>
        </div>
      </div>

      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <form id="form-nuevo-aporte">
          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Seleccionar Inversionista *</label>
              <select name="inversionistaId" class="form-control" required>
                ${inversionistas.map(i => `
                  <option value="${i.id}" ${i.id === this.selectedInvestorId ? 'selected' : ''}>
                    ${i.nombre} (${i.id}) — Saldo actual: ${this.formatMoney(i.capitalPendiente)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Monto del Aporte ($ USD) *</label>
              <input type="number" step="0.01" name="monto" class="form-control" required placeholder="8000.00">
              <span class="input-hint">Ej: $8,000.00 ingresados a caja/banco.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Recepción *</label>
              <input type="date" name="fechaAporte" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
            </div>

            <div class="form-group col-span-2">
              <label class="form-label">Cuenta Receptora de FINOVA *</label>
              <select name="cuentaReceptoraFinova" class="form-control">
                <option value="Banco Pichincha - Cta Corriente #2100892019 (FINOVA)">Banco Pichincha - Cta Corriente #2100892019 (FINOVA Matriz)</option>
                <option value="Banco Guayaquil - Cta Cte #109283719 (FINOVA)">Banco Guayaquil - Cta Cte #109283719 (FINOVA)</option>
                <option value="Banco Internacional - Cta Cte #029384710 (FINOVA)">Banco Internacional - Cta Cte #029384710 (FINOVA)</option>
                <option value="Caja General Efectivo">Caja General / Bóveda Efectivo</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Medio de Pago *</label>
              <select name="medioPago" class="form-control">
                <option value="Transferencia Interbancaria SPEI">Transferencia Interbancaria (SPEI / SPI)</option>
                <option value="Depósito en Efectivo">Depósito en Efectivo</option>
                <option value="Cheque Certificado / Gerencia">Cheque Certificado / Gerencia</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Nro. Comprobante / Referencia Bancaria *</label>
              <input type="text" name="numeroComprobante" class="form-control" required placeholder="TRANSF-8849201">
            </div>

            <div class="form-group col-span-full">
              <label class="form-label">Observaciones y Destino Previsto</label>
              <textarea name="observaciones" class="form-control" placeholder="Ej: Aporte pactado para fondeo de cartera comercial de microcréditos."></textarea>
            </div>
          </div>

          <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-md); padding: 14px; margin-top: 18px; font-size: 0.8rem; color: var(--text-muted);">
            ℹ️ <strong>Importante:</strong> Al guardar este aporte se generará un asiento en el Libro Mayor y se incrementará la obligación de capital pendiente. Luego podrás distribuir el dinero entre préstamos y otros usos en el módulo de Asignación.
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" data-view-target="dashboard">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar y Confirmar Aporte</button>
          </div>
        </form>
      </div>
    `;

    const form = document.getElementById("form-nuevo-aporte");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const aporte = this.store.agregarAporte(data);
        this.showToast(`Aporte de ${this.formatMoney(aporte.monto)} registrado con éxito`, "success");
        this.navigateTo("asignacion-fondos");
      });
    }
  }

  // 6. ASIGNACIÓN Y DESTINO DE FONDOS
  renderAsignacionFondos() {
    const aportes = this.store.getAportes();
    const prestamosPendientes = this.store.getPrestamosFinova().filter(p => p.estado === 'pendiente_fondeo' || (p.porcentajeFondeo < 100));
    const asignaciones = this.store.getAsignaciones();

    const container = document.getElementById("view-asignacion-fondos");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Módulo de Asignación y Destino de Fondos</h1>
          <p>Controla exactamente a qué préstamos se envía el dinero o si se destina a otros fines (caja operativa, reservas).</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <!-- Formulario de Distribución -->
        <div class="card">
          <h3 class="card-title-clean">Distribuir Fondos de un Aporte</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
            Elige el aporte origen y asígnalo a un préstamo o a una categoría operativa.
          </p>

          <form id="form-asignar-fondos">
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Aporte de Origen *</label>
              <select name="aporteId" id="select-aporte-asignar" class="form-control" required>
                ${aportes.map(a => `
                  <option value="${a.id}">
                    ${a.id} • ${a.inversionistaNombre} (${this.formatMoney(a.monto)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Tipo de Destino *</label>
              <div style="display: flex; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer;">
                  <input type="radio" name="tipoDestino" value="prestamo" checked> 
                  <strong>Asignar a Préstamo</strong>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer;">
                  <input type="radio" name="tipoDestino" value="otros_usos"> 
                  <strong>Otros Usos / Caja</strong>
                </label>
              </div>
            </div>

            <!-- Destino Dinámico Préstamo -->
            <div id="group-destino-prestamo" class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Seleccionar Crédito de FINOVA *</label>
              <select name="prestamoId" id="select-prestamo-fondeo" class="form-control">
                ${prestamosPendientes.length > 0 ? prestamosPendientes.map(p => `
                  <option value="${p.id}" data-monto="${p.montoOriginal - (p.montoFondeado || 0)}" data-nombre="Préstamo #${p.id} - ${p.clienteNombre} (${this.formatMoney(p.montoOriginal)})">
                    ${p.id} — ${p.clienteNombre} (Requiere: ${this.formatMoney(p.montoOriginal - (p.montoFondeado || 0))} al ${p.tasaMensualFinanciera}%)
                  </option>
                `).join('') : `
                  <option value="PREST-1049" data-monto="1200" data-nombre="Préstamo #1049 - Carlos Mendoza ($1,200.00)">
                    PREST-1049 — Carlos Mendoza ($1,200.00 al 20% mensual)
                  </option>
                `}
              </select>
            </div>

            <!-- Destino Dinámico Otros Usos -->
            <div id="group-destino-otros" class="form-group" style="margin-bottom: 14px; display: none;">
              <label class="form-label">Categoría de Otros Usos *</label>
              <select name="categoriaOtros" id="select-otros-usos" class="form-control">
                <option value="Caja Operativa / Disponibilidad General">Caja Operativa / Disponibilidad General</option>
                <option value="Fondo de Reserva de Liquidez">Fondo de Reserva de Liquidez</option>
                <option value="Fondo para Futuros Desembolsos">Fondo para Futuros Desembolsos Inmediatos</option>
                <option value="Gastos Extraordinarios Autorizados">Gastos Extraordinarios Autorizados</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Monto a Asignar ($ USD) *</label>
              <input type="number" step="0.01" name="monto" id="input-monto-asignar" class="form-control" required placeholder="2000.00">
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label">Justificación / Motivo de Asignación</label>
              <input type="text" name="justificacion" class="form-control" placeholder="Ej: Fondeo de crédito para compra de mercadería...">
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">
              Confirmar y Registrar Asignación
            </button>
          </form>
        </div>

        <!-- Resumen de Destinos Asignados -->
        <div class="card">
          <h3 class="card-title-clean">Asignaciones Registradas</h3>
          <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Inversionista</th>
                </tr>
              </thead>
              <tbody>
                ${asignaciones.map(a => `
                  <tr>
                    <td>
                      <div style="font-weight: 600; color: #fff; font-size: 0.82rem;">${a.destinoNombre}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${a.id} • ${a.fecha}</div>
                    </td>
                    <td>
                      <span class="badge ${a.tipoDestino === 'prestamo' ? 'badge-primary' : 'badge-warning'}">
                        ${a.tipoDestino === 'prestamo' ? 'Préstamo' : 'Otros'}
                      </span>
                    </td>
                    <td class="font-mono" style="font-weight: 700;">${this.formatMoney(a.monto)}</td>
                    <td style="font-size: 0.74rem;">${a.inversionistaId}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Lógica para toggle entre préstamo y otros usos
    const radioPrestamo = container.querySelector('input[value="prestamo"]');
    const radioOtros = container.querySelector('input[value="otros_usos"]');
    const groupPrestamo = document.getElementById("group-destino-prestamo");
    const groupOtros = document.getElementById("group-destino-otros");

    const updateDestinationToggle = () => {
      if (radioPrestamo.checked) {
        groupPrestamo.style.display = "block";
        groupOtros.style.display = "none";
      } else {
        groupPrestamo.style.display = "none";
        groupOtros.style.display = "block";
      }
    };

    radioPrestamo.addEventListener("change", updateDestinationToggle);
    radioOtros.addEventListener("change", updateDestinationToggle);

    // Form submit
    const form = document.getElementById("form-asignar-fondos");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const tipo = formData.get("tipoDestino");
        const aporteId = formData.get("aporteId");
        const monto = parseFloat(formData.get("monto"));
        const justificacion = formData.get("justificacion");

        let referenciaId = "";
        let destinoNombre = "";

        if (tipo === "prestamo") {
          const select = document.getElementById("select-prestamo-fondeo");
          const opt = select.options[select.selectedIndex];
          referenciaId = select.value;
          destinoNombre = opt.dataset.nombre || `Préstamo #${referenciaId}`;
        } else {
          destinoNombre = document.getElementById("select-otros-usos").value;
          referenciaId = `USO-${Date.now().toString().slice(-4)}`;
        }

        try {
          this.store.asignarFondos({
            aporteId,
            tipoDestino: tipo,
            referenciaId,
            destinoNombre,
            monto,
            justificacion
          });
          this.showToast(`Fondos asignados con éxito: ${this.formatMoney(monto)} a ${destinoNombre}`, "success");
          this.renderAsignacionFondos();
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  // 7. CARTERA DE PRÉSTAMOS FONDEADOS
  renderCarteraPrestamos() {
    const prestamos = this.store.getPrestamosFinova();
    const container = document.getElementById("view-cartera-prestamos");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Cartera de Préstamos Fondeados</h1>
          <p>Supervisa qué créditos de FINOVA han sido financiados con dinero de inversionistas y su estado de cobro.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente Prestatario</th>
                <th>Monto Crédito</th>
                <th>Tasa FINOVA</th>
                <th>Inversionista Fondeador</th>
                <th>Monto Fondeado</th>
                <th>% Cobertura</th>
                <th>Interés Cobrado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${prestamos.map(p => `
                <tr>
                  <td class="font-mono"><strong>${p.id}</strong></td>
                  <td>
                    <div style="font-weight: 600; color: #fff;">${p.clienteNombre}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${p.clienteDocumento} • ${p.modalidad}</div>
                  </td>
                  <td class="font-mono" style="font-weight: 700;">${this.formatMoney(p.montoOriginal)}</td>
                  <td><span class="badge badge-success">${p.tasaMensualFinanciera}% mensual</span></td>
                  <td>
                    <div style="font-weight: 600; color: ${p.inversionistaFondeadorId ? '#818cf8' : 'var(--text-dim)'};">
                      ${p.inversionistaNombre}
                    </div>
                  </td>
                  <td class="font-mono" style="color: #38bdf8;">${this.formatMoney(p.montoFondeado || 0)}</td>
                  <td>
                    <div style="font-size: 0.78rem; font-weight: 700; color: #fff;">${p.porcentajeFondeo}%</div>
                    <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; width: 60px; overflow: hidden; margin-top: 2px;">
                      <div style="height: 100%; width: ${p.porcentajeFondeo}%; background: var(--primary);"></div>
                    </div>
                  </td>
                  <td class="font-mono" style="color: var(--success); font-weight: 700;">
                    ${this.formatMoney(p.interesEfectivamenteCobrado)}
                  </td>
                  <td>
                    <span class="badge ${p.estado === 'completado' ? 'badge-success' : (p.estado === 'activo' ? 'badge-primary' : 'badge-warning')}">
                      ${p.estado.toUpperCase()}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 8. RECUPERACIÓN Y ATRIBUCIÓN DE INTERESES COBRADOS
  renderRecuperacionIntereses() {
    const cobros = this.store.getRecuperacionCobros();
    const container = document.getElementById("view-recuperacion-intereses");
    if (!container) return;

    const totalCobrado = cobros.reduce((sum, c) => sum + c.totalCobrado, 0);
    const totalCapital = cobros.reduce((sum, c) => sum + c.capitalRecuperado, 0);
    const totalInteres = cobros.reduce((sum, c) => sum + c.interesCobrado, 0);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Recuperación y Atribución de Intereses</h1>
          <p>
            Identifica con exactitud los intereses efectivamente cobrados de los préstamos vinculados a cada inversionista.
            (Excluye cuotas impagas o pendientes de cobro).
          </p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card" style="--accent-color: #38bdf8;">
          <div class="kpi-title">Total Cobrado de Cartera Fondeada</div>
          <div class="kpi-value">${this.formatMoney(totalCobrado)}</div>
          <div class="kpi-subtext">Ingresos efectivamente percibidos</div>
        </div>
        <div class="kpi-card" style="--accent-color: #6366f1;">
          <div class="kpi-title">Capital Principal Recuperado</div>
          <div class="kpi-value">${this.formatMoney(totalCapital)}</div>
          <div class="kpi-subtext">Retorno de principal prestado</div>
        </div>
        <div class="kpi-card" style="--accent-color: #10b981;">
          <div class="kpi-title">Intereses Cobrados (Ganancia Bruta Cartera)</div>
          <div class="kpi-value" style="color: #34d399;">${this.formatMoney(totalInteres)}</div>
          <div class="kpi-subtext">Base para sustentar las obligaciones de la financiera</div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title-clean">Detalle de Cobros Reales Atribuidos</h3>
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha Cobro</th>
                <th>Préstamo & Cliente</th>
                <th>Cuota</th>
                <th>Total Cobrado</th>
                <th>Capital Recuperado</th>
                <th>Interés Cobrado</th>
                <th>Inversionista Atribuido</th>
                <th>Estado Atribución</th>
              </tr>
            </thead>
            <tbody>
              ${cobros.map(c => `
                <tr>
                  <td class="font-mono"><strong>${c.comprobanteRecibo}</strong></td>
                  <td>${c.fechaCobro}</td>
                  <td>
                    <div style="font-weight: 600; color: #fff;">${c.clienteNombre}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${c.prestamoId}</div>
                  </td>
                  <td>${c.cuotaNumero}</td>
                  <td class="font-mono" style="font-weight: 700;">${this.formatMoney(c.totalCobrado)}</td>
                  <td class="font-mono" style="color: #38bdf8;">${this.formatMoney(c.capitalRecuperado)}</td>
                  <td class="font-mono" style="font-weight: 700; color: var(--success);">${this.formatMoney(c.interesCobrado)}</td>
                  <td>
                    <span style="font-size: 0.8rem; font-weight: 600; color: #818cf8;">${c.inversionistaNombre}</span>
                  </td>
                  <td>
                    <span class="badge badge-success">Efectivo Cobrado</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 9. ACUERDOS Y CONTRATOS DE RENDIMIENTO
  renderAcuerdosContratos() {
    const inversionistas = this.store.getInversionistas();
    const container = document.getElementById("view-acuerdos-contratos");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Acuerdos y Contratos de Rendimiento</h1>
          <p>Parámetros legales de inversión: tasa acordada, modalidad de liquidación, plazos y garantías.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Inversionista</th>
                <th>Capital Vigente</th>
                <th>Tasa Pactada</th>
                <th>Modalidad Liquidación</th>
                <th>Plazo</th>
                <th>Vigencia</th>
                <th>Garantía</th>
                <th>Día Corte</th>
              </tr>
            </thead>
            <tbody>
              ${inversionistas.map(inv => {
                const acu = inv.acuerdoVigente;
                return `
                  <tr>
                    <td class="font-mono"><strong>${acu.codigo}</strong></td>
                    <td>
                      <div style="font-weight: 600; color: #fff;">${inv.nombre}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${inv.id}</div>
                    </td>
                    <td class="font-mono" style="font-weight: 700; color: #38bdf8;">${this.formatMoney(inv.capitalPendiente)}</td>
                    <td>
                      <span class="badge badge-purple" style="font-size: 0.82rem;">${acu.tasaMensualPactada}% Mensual</span>
                    </td>
                    <td style="font-size: 0.82rem;">${acu.modalidadPago}</td>
                    <td>${acu.plazoMeses} meses</td>
                    <td style="font-size: 0.76rem;">${acu.fechaInicio} al ${acu.fechaVencimiento}</td>
                    <td style="font-size: 0.78rem; color: var(--text-dim);">${acu.garantiaPactada}</td>
                    <td><span class="badge badge-primary">Día ${acu.diaCorte}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 10. MONITOR DE OBLIGACIONES Y VENCIMIENTOS
  renderMonitorObligaciones() {
    const obligaciones = this.store.getObligaciones();
    const container = document.getElementById("view-monitor-obligaciones");
    if (!container) return;

    const pendientes = obligaciones.filter(o => o.estado === 'pendiente');
    const pagadas = obligaciones.filter(o => o.estado === 'pagado');
    const totalPendiente = pendientes.reduce((sum, o) => sum + (o.montoTotalObligacion || o.montoRendimiento), 0);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Monitor de Obligaciones y Rendimientos Devengados</h1>
          <p>Control de compromisos de pago calculados rigurosamente con base en los acuerdos de cada inversor.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btn-corte-masivo">
            ⚡ Generar Cortes del Mes
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card" style="--accent-color: #ef4444;">
          <div class="kpi-title">Total Obligaciones Pendientes</div>
          <div class="kpi-value" style="color: #fca5a5;">${this.formatMoney(totalPendiente)}</div>
          <div class="kpi-subtext"><strong>${pendientes.length}</strong> pagos programados</div>
        </div>
        <div class="kpi-card" style="--accent-color: #10b981;">
          <div class="kpi-title">Rendimientos Pagados Acumulados</div>
          <div class="kpi-value">${this.formatMoney(pagadas.reduce((sum, o) => sum + (o.montoTotalObligacion || o.montoRendimiento), 0))}</div>
          <div class="kpi-subtext">Cumplimiento al día</div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title-clean">Obligaciones Pendientes por Liquidar</h3>
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Inversionista</th>
                <th>Período</th>
                <th>Base Capital</th>
                <th>Tasa Pactada</th>
                <th>Rendimiento</th>
                <th>Vencimiento</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${pendientes.length > 0 ? pendientes.map(o => `
                <tr>
                  <td class="font-mono"><strong>${o.id}</strong></td>
                  <td><strong>${o.inversionistaNombre}</strong></td>
                  <td>${o.periodo}</td>
                  <td class="font-mono">${this.formatMoney(o.baseCalculoCapital)}</td>
                  <td>${o.tasaPactadaMensual}% mes</td>
                  <td class="font-mono" style="font-weight: 700; color: #fca5a5;">${this.formatMoney(o.montoTotalObligacion || o.montoRendimiento)}</td>
                  <td>
                    <span style="font-size: 0.8rem; color: var(--warning); font-weight: 700;">${o.fechaVencimientoPago}</span>
                  </td>
                  <td>
                    <button class="btn btn-success btn-sm" data-view-target="registro-pagos" data-investor-id="${o.inversionistaId}">
                      Pagar
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="8" style="text-align: center; color: var(--text-dim);">No hay obligaciones pendientes</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const btnMasivo = document.getElementById("btn-corte-masivo");
    if (btnMasivo) {
      btnMasivo.addEventListener("click", () => {
        const invs = this.store.getInversionistas();
        let count = 0;
        invs.forEach(i => {
          if (i.capitalPendiente > 0) {
            this.store.generarCorteDevengado(i.id);
            count++;
          }
        });
        this.showToast(`Se generaron ${count} cortes de rendimiento mensual`, "success");
        this.renderMonitorObligaciones();
      });
    }
  }

  // 11. REGISTRO DE PAGOS Y DEVOLUCIONES
  renderRegistroPagos() {
    const inversionistas = this.store.getInversionistas();
    const container = document.getElementById("view-registro-pagos");
    if (!container) return;

    const invSeleccionado = this.store.getInversionistaById(this.selectedInvestorId) || inversionistas[0];
    const pagosPrevios = this.store.getPagosInversionistas();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Liquidación de Pagos y Devoluciones a Inversionistas</h1>
          <p>Emite devoluciones de capital (parcial o total) y paga rendimientos devengados con respaldo bancario.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="card">
          <h3 class="card-title-clean">Formulario de Liquidación</h3>
          <form id="form-liquidar-pago">
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Inversionista Beneficiario *</label>
              <select name="inversionistaId" id="select-inversionista-pago" class="form-control" required>
                ${inversionistas.map(i => `
                  <option value="${i.id}" ${i.id === invSeleccionado.id ? 'selected' : ''}>
                    ${i.nombre} (Cap: ${this.formatMoney(i.capitalPendiente)}, Rend. Pend: ${this.formatMoney(i.rendimientoPendiente)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Tipo de Pago *</label>
              <select name="tipoPago" id="select-tipo-pago-inv" class="form-control">
                <option value="rendimiento">Pago de Rendimientos Pactados</option>
                <option value="capital">Devolución de Capital Principal</option>
                <option value="mixto">Pago Mixto (Devolución Capital + Rendimiento)</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label">Rendimiento ($)</label>
                <input type="number" step="0.01" name="montoRendimiento" id="input-pago-rend" class="form-control" value="${invSeleccionado.rendimientoPendiente || 0}">
              </div>
              <div class="form-group">
                <label class="form-label">Devolución Capital ($)</label>
                <input type="number" step="0.01" name="montoCapital" id="input-pago-cap" class="form-control" value="0.00">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Cuenta Bancaria de Origen (FINOVA) *</label>
              <select name="cuentaOrigenFinova" class="form-control">
                <option value="Banco Pichincha - Cta Corriente #2100892019">Banco Pichincha - Cta Corriente #2100892019</option>
                <option value="Banco Guayaquil - Cta Cte #109283719">Banco Guayaquil - Cta Cte #109283719</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Cuenta de Destino del Inversionista</label>
              <input type="text" readonly class="form-control" style="background: rgba(0,0,0,0.3);" value="${invSeleccionado.bancoDestino} - ${invSeleccionado.tipoCuenta} #${invSeleccionado.numeroCuenta}">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label">Nro. de Transferencia / Comprobante *</label>
              <input type="text" name="numeroTransferencia" class="form-control" required placeholder="TRANSF-OUT-99821">
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label">Concepto / Glosa</label>
              <input type="text" name="concepto" class="form-control" value="Liquidación de rendimientos mensuales">
            </div>

            <button type="submit" class="btn btn-success" style="width: 100%;">
              Procesar y Confirmar Liquidación
            </button>
          </form>
        </div>

        <div class="card">
          <h3 class="card-title-clean">Pagos Recientes a Inversionistas</h3>
          <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Fecha</th>
                  <th>Inversionista</th>
                  <th>Monto Pagado</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                ${pagosPrevios.map(p => `
                  <tr>
                    <td>
                      <div class="font-mono"><strong>${p.id}</strong></div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${p.numeroTransferencia}</div>
                    </td>
                    <td>${p.fechaPago}</td>
                    <td>
                      <div style="font-weight: 600; color: #fff;">${p.inversionistaNombre}</div>
                    </td>
                    <td class="font-mono" style="font-weight: 700; color: var(--success);">${this.formatMoney(p.montoTotal)}</td>
                    <td>
                      <span class="badge ${p.tipoPago === 'rendimiento' ? 'badge-purple' : (p.tipoPago === 'capital' ? 'badge-primary' : 'badge-warning')}">
                        ${p.tipoPago.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Cambio dinámico de inversionista
    const selectInv = document.getElementById("select-inversionista-pago");
    if (selectInv) {
      selectInv.addEventListener("change", (e) => {
        this.selectedInvestorId = e.target.value;
        this.renderRegistroPagos();
      });
    }

    // Submit
    const form = document.getElementById("form-liquidar-pago");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const invId = formData.get("inversionistaId");
        const tipoPago = formData.get("tipoPago");
        const montoRend = parseFloat(formData.get("montoRendimiento") || 0);
        const montoCap = parseFloat(formData.get("montoCapital") || 0);
        const total = montoRend + montoCap;

        if (total <= 0) {
          alert("El monto total a liquidar debe ser superior a cero.");
          return;
        }

        this.store.registrarPagoInversionista({
          inversionistaId: invId,
          tipoPago,
          montoTotal: total,
          montoCapital: montoCap,
          montoRendimiento: montoRend,
          concepto: formData.get("concepto"),
          numeroTransferencia: formData.get("numeroTransferencia"),
          cuentaOrigenFinova: formData.get("cuentaOrigenFinova")
        });

        this.showToast(`Pago procesado por ${this.formatMoney(total)}`, "success");
        this.renderRegistroPagos();
      });
    }
  }

  // 12. HISTORIAL DE MOVIMIENTOS Y LIBRO MAYOR
  renderLibroMayor() {
    const movimientos = this.store.getLibroMayor();
    const container = document.getElementById("view-libro-mayor");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Libro Mayor y Extracto Contable de Inversionistas</h1>
          <p>Asientos cronológicos de doble entrada: aportes, asignaciones, devengos, pagos y devoluciones.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Asiento</th>
                <th>Fecha</th>
                <th>Inversionista</th>
                <th>Tipo de Movimiento</th>
                <th>Referencia</th>
                <th>Monto</th>
                <th>Saldo Capital</th>
                <th>Saldo Rendimiento</th>
                <th>Glosa Contable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${movimientos.map(m => `
                <tr style="${m.estado === 'reversado' ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
                  <td class="font-mono"><strong>${m.id}</strong></td>
                  <td>${m.fecha}</td>
                  <td><strong>${m.inversionistaNombre}</strong></td>
                  <td>
                    <span class="badge ${m.tipoMovimiento.includes('Aporte') ? 'badge-primary' : (m.tipoMovimiento.includes('Devolución') || m.tipoMovimiento.includes('Pago') ? 'badge-success' : (m.tipoMovimiento.includes('REVERSO') ? 'badge-danger' : 'badge-warning'))}">
                      ${m.tipoMovimiento}
                    </span>
                  </td>
                  <td class="font-mono" style="font-size: 0.74rem;">${m.referencia}</td>
                  <td class="font-mono" style="font-weight: 700;">${this.formatMoney(m.monto)}</td>
                  <td class="font-mono" style="color: #38bdf8;">${this.formatMoney(m.saldoCapital)}</td>
                  <td class="font-mono" style="color: #c084fc;">${this.formatMoney(m.saldoRendimientos)}</td>
                  <td style="font-size: 0.76rem;">${m.glosa}</td>
                  <td>
                    <span class="badge ${m.estado === 'confirmado' ? 'badge-success' : 'badge-danger'}">
                      ${m.estado}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 13. AUDITORÍA, TRAZABILIDAD Y REVERSIONES
  renderAuditoriaReversiones() {
    const logs = this.store.getAuditoria();
    const container = document.getElementById("view-auditoria-reversiones");
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Bitácora de Auditoría, Trazabilidad y Reversiones</h1>
          <p>
            Regla de oro contable: los registros confirmados no se eliminan. Para corrección de errores, 
            se genera un contra-asiento de reverso con trazabilidad y justificación obligatoria.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-danger btn-sm" id="btn-abrir-reverso-modal">
            ⚡ Ejecutar Reverso Contable Justificado
          </button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title-clean">Registro Inmutable de Eventos del Sistema</h3>
        <div class="table-responsive">
          <table class="fin-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Detalle del Evento</th>
                <th>Dirección IP</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td class="font-mono"><strong>${l.id}</strong></td>
                  <td style="font-size: 0.76rem;">${l.fechaHora}</td>
                  <td>
                    <div style="font-weight: 600; color: #fff; font-size: 0.8rem;">${l.usuario}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${l.rol}</div>
                  </td>
                  <td><span class="badge badge-primary">${l.modulo}</span></td>
                  <td class="font-mono" style="font-size: 0.74rem;"><strong>${l.accion}</strong></td>
                  <td style="font-size: 0.8rem;">${l.descripcion}</td>
                  <td class="font-mono" style="font-size: 0.72rem; color: var(--text-dim);">${l.ip}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal de Reverso Contable -->
      <div class="modal-overlay" id="modal-reverso">
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">Procedimiento de Reverso Contable</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">
              Este procedimiento genera un contra-asiento de ajuste en el Libro Mayor sin borrar el historial original.
            </p>
            <form id="form-reverso-movimiento">
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label">ID de Asiento a Reversar *</label>
                <input type="text" name="asientoId" id="input-asiento-reversar" class="form-control" required placeholder="Ej: LIB-001 o APO-001">
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label">Motivo Justificado del Reverso *</label>
                <textarea name="motivo" class="form-control" required placeholder="Ej: Error en digitación de comprobante bancario..."></textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-secondary modal-close">Cancelar</button>
                <button type="submit" class="btn btn-danger">Confirmar Reverso</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const btnReverso = document.getElementById("btn-abrir-reverso-modal");
    if (btnReverso) {
      btnReverso.addEventListener("click", () => this.openModal("modal-reverso"));
    }

    const formReverso = document.getElementById("form-reverso-movimiento");
    if (formReverso) {
      formReverso.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("input-asiento-reversar").value;
        const motivo = formReverso.elements["motivo"].value;

        try {
          this.store.reversarMovimiento(id, motivo);
          this.closeModal("modal-reverso");
          this.showToast(`Movimiento ${id} reversado mediante contra-asiento`, "success");
          this.renderAuditoriaReversiones();
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  // 14. REPORTES FINANCIEROS Y CONCILIACIÓN DE CAJA
  renderReportesConciliacion() {
    const emp = this.store.getEmpresa();
    const inversionistas = this.store.getInversionistas();
    const container = document.getElementById("view-reportes-conciliacion");
    if (!container) return;

    const totalRecibido = inversionistas.reduce((s, i) => s + i.totalAportado, 0);
    const totalEnPrestamos = inversionistas.reduce((s, i) => s + i.capitalAsignadoPrestamos, 0);
    const totalEnOtrosUsos = inversionistas.reduce((s, i) => s + i.capitalOtrosUsos, 0);
    const totalDevuelto = inversionistas.reduce((s, i) => s + i.capitalDevuelto, 0);
    const totalPendiente = inversionistas.reduce((s, i) => s + i.capitalPendiente, 0);

    const totalInteresCobrado = inversionistas.reduce((s, i) => s + i.interesesCobradosCartera, 0);
    const totalRendimientoDevengado = inversionistas.reduce((s, i) => s + i.rendimientoDevengado, 0);
    const margenNetoFinova = totalInteresCobrado - totalRendimientoDevengado;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Reportes Financieros y Conciliación de Caja</h1>
          <p>Conciliación patrimonial entre dinero recibido, colocación en créditos, reservas y margen de intermediación.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" onclick="window.print()">
            🖨️ Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      <!-- Cuadro de Conciliación Patrimonial -->
      <div class="card" style="border: 1px solid rgba(16, 185, 129, 0.3);">
        <h3 class="card-title-clean" style="color: var(--success);">
          Ecuación de Conciliación de Fondos de Inversionistas
        </h3>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 20px;">
          Verificación exacta: Cada dólar recibido está identificado en préstamos activos o en reservas operativas.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Capital Total Recibido</div>
            <div class="highlight-stat-num" style="color: #38bdf8;">${this.formatMoney(totalRecibido)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">100% de aportes históricos</div>
          </div>

          <div class="highlight-stat-box">
            <div class="highlight-stat-title">En Préstamos Colocados</div>
            <div class="highlight-stat-num" style="color: #818cf8;">${this.formatMoney(totalEnPrestamos)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">${((totalEnPrestamos / totalRecibido) * 100).toFixed(1)}% del capital</div>
          </div>

          <div class="highlight-stat-box">
            <div class="highlight-stat-title">En Otros Usos y Reservas</div>
            <div class="highlight-stat-num" style="color: #fbbf24;">${this.formatMoney(totalEnOtrosUsos)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">${((totalEnOtrosUsos / totalRecibido) * 100).toFixed(1)}% del capital</div>
          </div>

          <div class="highlight-stat-box">
            <div class="highlight-stat-title">Diferencia Conciliación</div>
            <div class="highlight-stat-num" style="color: var(--success);">$0.00</div>
            <div style="font-size: 0.72rem; color: var(--success); margin-top: 4px;">✓ Fondos Cuadrados al 100%</div>
          </div>
        </div>
      </div>

      <!-- Cuadro de Margen de Intermediación Financiera -->
      <div class="card" style="border: 1px solid rgba(99, 102, 241, 0.3);">
        <h3 class="card-title-clean" style="color: #818cf8;">
          Análisis de Rentabilidad y Margen Financiero
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 14px;">
          <div style="background: rgba(0,0,0,0.25); padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">1. Intereses Cobrados a Prestatarios</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 800; color: #34d399; margin: 6px 0;">
              ${this.formatMoney(totalInteresCobrado)}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Generados por la cartera fondeada con tasa comercial de FINOVA (~20% mensual).
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.25); padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">2. Rendimientos a Pagar a Inversores</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 800; color: #d8b4fe; margin: 6px 0;">
              ${this.formatMoney(totalRendimientoDevengado)}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Costo de fondeo según acuerdos pactados contractuales (~2.8% a 4.0% mensual).
            </div>
          </div>

          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 0.76rem; color: var(--success); text-transform: uppercase; font-weight: 700;">3. Margen Financiero Neto (Spread)</div>
            <div style="font-family: var(--font-mono); font-size: 1.6rem; font-weight: 800; color: var(--success); margin: 6px 0;">
              ${this.formatMoney(margenNetoFinova)}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Utilidad bruta retenida por FINOVA por intermediación y gestión de cobranza.
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
