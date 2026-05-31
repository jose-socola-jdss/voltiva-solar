import { gsap } from "gsap";

// Document Load Event
document.addEventListener("DOMContentLoaded", () => {
  // Mobile Navigation
  const menuToggle = document.getElementById("menu-button");
  const navMenu = document.getElementById("nav-menu");
  const header = document.querySelector(".site-header");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("is-open");
      header.classList.toggle("menu-open", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("is-open");
        header.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Footer Year
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  // GSAP Entrance Animations
  gsap.from(".hero-title, .badge, .hero-lead, .hero-actions", {
    y: 30,
    opacity: 0,
    duration: 1.2,
    stagger: 0.15,
    ease: "power4.out",
  });

  gsap.from(".hero-solar-chart", {
    scale: 0.85,
    opacity: 0,
    duration: 1.4,
    ease: "power3.out",
    delay: 0.3
  });

  // Slow orbit rotation for the background sun tracker
  gsap.to(".rotating-sun", {
    rotation: 360,
    transformOrigin: "100px 100px",
    duration: 30,
    repeat: -1,
    ease: "none"
  });

  // Animated live solar yield counter
  const liveYield = document.getElementById("live-solar-yield");
  if (liveYield) {
    const yieldValue = { val: 0.0 };
    gsap.to(yieldValue, {
      val: 4.8,
      duration: 2.2,
      delay: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        liveYield.textContent = `${yieldValue.val.toFixed(1)} kW`;
      }
    });
  }
});

// Custom Web Component for Voltiva Solar Flow Calculator
class VoltivaCalculator extends HTMLElement {
  constructor() {
    super();
    this.bill = 380;
    this.sunHours = 5.0;
    this.systemType = "ongrid";
    this.tweens = {};
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.initFlowAnimations();
    this.calculate();
  }

  render() {
    this.innerHTML = `
      <div class="calc-inputs">
        <div class="calc-row">
          <label for="calc-bill">
            Consumo Eléctrico Mensual
            <span class="calc-val" id="val-bill">S/ 380</span>
          </label>
          <input type="range" id="calc-bill" min="100" max="1800" step="20" value="${this.bill}" />
        </div>

        <div class="calc-row">
          <label for="calc-sun">
            Horas de Sol Pico Diario
            <span class="calc-val" id="val-sun">5.0 hrs</span>
          </label>
          <input type="range" id="calc-sun" min="3.0" max="8.0" step="0.5" value="${this.sunHours}" />
        </div>

        <div class="calc-select-row">
          <label>Configuración de Interconexión</label>
          <div class="select-buttons">
            <button type="button" class="select-btn active" data-type="ongrid">On-Grid (Net Billing)</button>
            <button type="button" class="select-btn" data-type="hybrid">Híbrido (Respaldo)</button>
          </div>
        </div>

        <div class="calc-results">
          <div class="calc-box">
            <span>Módulos</span>
            <strong id="res-panels">0</strong>
          </div>
          <div class="calc-box highlight">
            <span>Ahorro Mensual</span>
            <strong id="res-savings">S/ 0</strong>
          </div>
          <div class="calc-box">
            <span>Retorno ROI</span>
            <strong id="res-payback">0.0 años</strong>
          </div>
        </div>
      </div>

      <div class="calc-visual-flow">
        <!-- SVG diagram showing Panel, Inverter, Grid, Home, Battery -->
        <svg class="flow-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
          <!-- Flow Paths (Dashed particles travel along these) -->
          <path id="path-panels-inverter" class="flow-path" d="M100 35 V75" />
          <path id="path-inverter-home" class="flow-path" d="M100 85 H40" />
          <path id="path-inverter-grid" class="flow-path" d="M100 85 H160" />
          <path id="path-inverter-battery" class="flow-path" d="M100 95 V135" />

          <!-- Flow Particles Overlay -->
          <path id="part-panels-inverter" class="flow-particles" d="M100 35 V75" />
          <path id="part-inverter-home" class="flow-particles" d="M100 85 H40" />
          <path id="part-inverter-grid" class="flow-particles" d="M100 85 H160" />
          <path id="part-inverter-battery" class="flow-particles" d="M100 95 V135" />

          <!-- Nodes (Paneles, Inversor, Casa, Red, Batería) -->
          <!-- 1. PANELES (Top Centered) -->
          <g id="node-panels">
            <rect class="flow-node-bg" x="75" y="10" width="50" height="25" />
            <text class="flow-node-text" x="100" y="22">PANELES</text>
            <text id="flow-val-generation" class="flow-node-metric" x="100" y="32">0.0 kW</text>
          </g>

          <!-- 2. INVERSOR (Center) -->
          <g id="node-inverter">
            <rect class="flow-node-bg" x="80" y="70" width="40" height="25" fill="#f8fafc" />
            <text class="flow-node-text" x="100" y="82" style="font-size:7px;">INVERSOR</text>
            <text class="flow-node-text" x="100" y="91" style="font-size:6px;fill:#64748b;">98.5% Eff</text>
          </g>

          <!-- 3. HOGAR (Left) -->
          <g id="node-home">
            <rect class="flow-node-bg" x="10" y="70" width="40" height="25" />
            <text class="flow-node-text" x="30" y="82">HOGAR</text>
            <text id="flow-val-consumption" class="flow-node-metric" x="30" y="92">1.2 kW</text>
          </g>

          <!-- 4. RED ELÉCTRICA (Right) -->
          <g id="node-grid">
            <rect class="flow-node-bg" x="150" y="70" width="40" height="25" />
            <text class="flow-node-text" x="170" y="82">RED</text>
            <text id="flow-val-grid" class="flow-node-metric" x="170" y="92">0.0 kW</text>
          </g>

          <!-- 5. BATERÍA (Bottom, faded out if ongrid) -->
          <g id="node-battery" style="transition: opacity 0.4s ease;">
            <rect class="flow-node-bg" x="75" y="130" width="50" height="25" />
            <text class="flow-node-text" x="100" y="142">BATERÍA</text>
            <text id="flow-val-battery" class="flow-node-metric" x="100" y="151">100%</text>
          </g>
        </svg>
      </div>
    `;
  }

  setupListeners() {
    const billInput = this.querySelector("#calc-bill");
    const sunInput = this.querySelector("#calc-sun");
    const buttons = this.querySelectorAll(".select-btn");

    billInput.addEventListener("input", (e) => {
      this.bill = parseInt(e.target.value, 10);
      this.querySelector("#val-bill").textContent = `S/ ${this.bill.toLocaleString("es-PE")}`;
      this.calculate();
    });

    sunInput.addEventListener("input", (e) => {
      this.sunHours = parseFloat(e.target.value);
      this.querySelector("#val-sun").textContent = `${this.sunHours.toFixed(1)} hrs`;
      this.calculate();
    });

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.systemType = btn.dataset.type;
        this.calculate();
      });
    });
  }

  initFlowAnimations() {
    // We animate the stroke-dashoffset to make particles travel down paths
    const particles = [
      "part-panels-inverter",
      "part-inverter-home",
      "part-inverter-grid",
      "part-inverter-battery"
    ];

    particles.forEach((id) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        // Continuous infinite loop of dashoffset
        this.tweens[id] = gsap.to(el, {
          strokeDashoffset: -32,
          duration: 1.5,
          repeat: -1,
          ease: "none"
        });
      }
    });
  }

  calculate() {
    // Estimations
    const systemSizeKW = (this.bill / 120) * (5.5 / this.sunHours);
    const calculatedSize = Math.max(1.2, Math.round(systemSizeKW * 10) / 10);
    const basePanels = Math.max(3, Math.round(calculatedSize / 0.45));
    
    let savingsFactor = 0.85; // On-grid saves ~85%
    let paybackPeriod = 3.4;

    const batteryNode = this.querySelector("#node-battery");
    const batteryPath = this.querySelector("#path-inverter-battery");
    const batteryPart = this.querySelector("#part-inverter-battery");

    if (this.systemType === "hybrid") {
      savingsFactor = 0.95; // Hybrid saves ~95%
      paybackPeriod = 5.2; // Longer ROI because of battery cost
      
      // Highlight Battery Node
      if (batteryNode) batteryNode.style.opacity = "1";
      if (batteryPath) batteryPath.style.opacity = "1";
      if (batteryPart) {
        batteryPart.style.opacity = "1";
        if (this.tweens["part-inverter-battery"]) this.tweens["part-inverter-battery"].play();
      }
    } else {
      // Fade out Battery Node
      if (batteryNode) batteryNode.style.opacity = "0.15";
      if (batteryPath) batteryPath.style.opacity = "0.15";
      if (batteryPart) {
        batteryPart.style.opacity = "0";
        if (this.tweens["part-inverter-battery"]) this.tweens["part-inverter-battery"].pause();
      }
    }

    const calculatedSavings = this.bill * savingsFactor;

    // Display updates in widgets
    const resPanels = this.querySelector("#res-panels");
    const resSavings = this.querySelector("#res-savings");
    const resPayback = this.querySelector("#res-payback");

    gsap.killTweensOf([resPanels, resSavings, resPayback]);

    const currentSavingsNum = parseFloat(resSavings.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const currentPaybackNum = parseFloat(resPayback.textContent) || 0;
    const currentPanelsNum = parseInt(resPanels.textContent, 10) || 0;

    const valObj = { panels: currentPanelsNum, savings: currentSavingsNum, payback: currentPaybackNum };

    gsap.to(valObj, {
      panels: basePanels,
      savings: calculatedSavings,
      payback: paybackPeriod,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => {
        resPanels.textContent = Math.round(valObj.panels).toString();
        resSavings.textContent = `S/ ${Math.round(valObj.savings).toLocaleString("es-PE")}`;
        resPayback.textContent = `${valObj.payback.toFixed(1)} años`;
      },
    });

    // Update node metric numbers
    const genVal = this.querySelector("#flow-val-generation");
    const conVal = this.querySelector("#flow-val-consumption");
    const gridVal = this.querySelector("#flow-val-grid");
    const batVal = this.querySelector("#flow-val-battery");

    const genKW = Math.round(calculatedSize * 10) / 10;
    const conKW = Math.min(genKW * 0.7, 3.2);
    const gridKW = Math.max(0, genKW - conKW);

    if (genVal) genVal.textContent = `${genKW.toFixed(1)} kW`;
    if (conVal) conVal.textContent = `${conKW.toFixed(1)} kW`;
    if (gridVal) gridVal.textContent = `${gridKW.toFixed(1)} kW`;
    if (batVal) batVal.textContent = this.systemType === "hybrid" ? "94% Li" : "---";

    // Speed up particle flows relative to generation amount
    const flowScale = Math.min(2.5, Math.max(0.4, genKW / 2));
    
    if (this.tweens["part-panels-inverter"]) this.tweens["part-panels-inverter"].timeScale(flowScale);
    if (this.tweens["part-inverter-home"]) this.tweens["part-inverter-home"].timeScale(flowScale * 0.8);
    if (this.tweens["part-inverter-grid"]) this.tweens["part-inverter-grid"].timeScale(flowScale * 1.2);
    if (this.tweens["part-inverter-battery"]) this.tweens["part-inverter-battery"].timeScale(flowScale * 0.5);
  }
}

customElements.define("voltiva-calculator", VoltivaCalculator);
