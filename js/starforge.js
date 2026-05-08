(function () {
  'use strict';

  const RAID_CREDIT_PENALTY = 0.7;

  class StarforgeGame {
    constructor() {
      this.state = {
        credits: 120,
        energy: 40,
        alloys: 10,
        science: 0,
        sectors: 1,
        threat: 5,
        drones: 1,
        escorts: 0,
        freighters: 0,
        buildings: { miner: 0, reactor: 0, lab: 0, shipyard: 0 },
        research: { automation: false, warp: false, ai: false, quantum: false }
      };

      this.buildingDefs = {
        miner: { name: 'Asteroid Miner', cost: 50, desc: 'Produces alloys passively.' },
        reactor: { name: 'Fusion Reactor', cost: 80, desc: 'Generates energy.' },
        lab: { name: 'Research Nexus', cost: 120, desc: 'Generates science.' },
        shipyard: { name: 'Orbital Shipyard', cost: 180, desc: 'Builds fleet support.' }
      };

      this.researchDefs = {
        automation: { name: 'Automation Protocols', cost: 80, effect: 'Mining efficiency +50%' },
        warp: { name: 'Warp Compression', cost: 150, effect: 'Sector expansion cost reduced' },
        ai: { name: 'Tactical AI', cost: 250, effect: 'Threat growth slowed' },
        quantum: { name: 'Quantum Fabrication', cost: 400, effect: 'All production doubled' }
      };

      this.tickTimer = null;
      this.stars = [];
      this.init();
    }

    init() {
      this.renderBuildings();
      this.renderResearch();
      this.drawGalaxy();
      this.log('Frontier command initialized.');
      this.updateUI();
      this.refreshActionButtons();
      this.tickTimer = setInterval(() => this.tick(), 1000);
    }

    fmt(value, digits = 1) {
      return Number.isInteger(value) ? String(value) : Number(value).toFixed(digits);
    }

    updateUI() {
      const map = {
        'sf-credits': Math.floor(this.state.credits),
        'sf-energy': Math.floor(this.state.energy),
        'sf-alloys': Math.floor(this.state.alloys),
        'sf-science': Math.floor(this.state.science),
        'sf-sectors': this.state.sectors,
        'sf-drones': this.fmt(this.state.drones, 2),
        'sf-escorts': this.fmt(this.state.escorts, 2),
        'sf-freighters': this.fmt(this.state.freighters, 2),
        'sf-threat': this.fmt(this.state.threat, 1)
      };

      Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      });
    }

    log(message) {
      const log = document.getElementById('sf-log');
      if (!log) return;
      const row = document.createElement('div');
      row.textContent = `[${new Date().toLocaleTimeString('en-US')}] ${message}`;
      log.prepend(row);
      while (log.children.length > 50) log.removeChild(log.lastChild);
    }

    mine() {
      const gain = Math.floor(Math.random() * 12) + 8;
      this.state.credits += gain;
      this.state.alloys += 1;
      this.log(`Mining team extracted ${gain} credits worth of ore.`);
      this.updateUI();
      this.refreshActionButtons();
    }

    scan() {
      if (Math.random() > 0.65) {
        this.state.science += 25;
        this.log('Deep scan located an ancient relay. Science gained.');
      } else {
        this.state.threat += 3;
        this.log('Pirate activity detected in nearby sectors.');
      }
      this.updateUI();
      this.refreshActionButtons();
    }

    expand() {
      const cost = this.state.research.warp ? 180 : 250;
      if (this.state.credits < cost) return;
      this.state.credits -= cost;
      this.state.sectors += 1;
      this.state.threat += 5;
      this.log(`Sector ${this.state.sectors} colonized.`);
      this.drawGalaxy();
      this.updateUI();
      this.refreshActionButtons();
    }

    buildingCost(key) {
      const b = this.buildingDefs[key];
      return Math.floor(b.cost * (1 + this.state.buildings[key] * 0.35));
    }

    buyBuilding(key) {
      const cost = this.buildingCost(key);
      if (this.state.credits < cost) return;
      this.state.credits -= cost;
      this.state.buildings[key] += 1;
      this.log(`${this.buildingDefs[key].name} constructed.`);
      this.renderBuildings();
      this.updateUI();
      this.refreshActionButtons();
    }

    unlockResearch(key) {
      const r = this.researchDefs[key];
      if (this.state.research[key] || this.state.science < r.cost) return;
      this.state.science -= r.cost;
      this.state.research[key] = true;
      this.log(`Research completed: ${r.name}`);
      this.renderResearch();
      this.updateUI();
      this.refreshActionButtons();
    }

    renderBuildings() {
      const root = document.getElementById('sf-buildings');
      if (!root) return;
      root.innerHTML = '';

      Object.entries(this.buildingDefs).forEach(([key, b]) => {
        const card = document.createElement('div');
        card.className = 'formula-box';
        card.style.marginBottom = '8px';
        const cost = this.buildingCost(key);
        card.innerHTML = `
          <strong>${b.name}</strong><br>
          <span style="font-size:0.75rem">${b.desc}</span><br>
          Owned: ${this.state.buildings[key]}<br>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.type = 'button';
        btn.dataset.sfBuilding = key;
        btn.textContent = `Build (${cost} credits)`;
        btn.disabled = this.state.credits < cost;
        btn.addEventListener('click', () => this.buyBuilding(key));
        card.appendChild(btn);
        root.appendChild(card);
      });
    }

    renderResearch() {
      const root = document.getElementById('sf-research');
      if (!root) return;
      root.innerHTML = '';

      Object.entries(this.researchDefs).forEach(([key, r]) => {
        const card = document.createElement('div');
        card.className = 'formula-box';
        card.style.marginBottom = '8px';
        card.innerHTML = `
          <strong>${r.name}</strong><br>
          <span style="font-size:0.75rem">${r.effect}</span><br>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.type = 'button';
        btn.dataset.sfResearch = key;
        btn.textContent = this.state.research[key] ? 'Unlocked' : `Research (${r.cost} science)`;
        btn.disabled = this.state.research[key] || this.state.science < r.cost;
        btn.addEventListener('click', () => this.unlockResearch(key));
        card.appendChild(btn);
        root.appendChild(card);
      });
    }

    refreshActionButtons() {
      document.querySelectorAll('[data-sf-building]').forEach(btn => {
        const key = btn.dataset.sfBuilding;
        const cost = this.buildingCost(key);
        btn.textContent = `Build (${cost} credits)`;
        btn.disabled = this.state.credits < cost;
      });
      document.querySelectorAll('[data-sf-research]').forEach(btn => {
        const key = btn.dataset.sfResearch;
        const r = this.researchDefs[key];
        const unlocked = this.state.research[key];
        btn.textContent = unlocked ? 'Unlocked' : `Research (${r.cost} science)`;
        btn.disabled = unlocked || this.state.science < r.cost;
      });
    }

    tick() {
      let alloyRate = this.state.buildings.miner * 2;
      let energyRate = this.state.buildings.reactor * 3;
      let scienceRate = this.state.buildings.lab * 2;

      if (this.state.research.automation) alloyRate *= 1.5;
      if (this.state.research.quantum) {
        alloyRate *= 2;
        energyRate *= 2;
        scienceRate *= 2;
      }

      this.state.alloys += alloyRate;
      this.state.energy += energyRate;
      this.state.science += scienceRate;

      if (this.state.buildings.shipyard > 0) {
        this.state.drones += 0.05 * this.state.buildings.shipyard;
        this.state.escorts += 0.03 * this.state.buildings.shipyard;
        this.state.freighters += 0.02 * this.state.buildings.shipyard;
      }

      this.state.credits += Math.floor(this.state.freighters * 2);
      this.state.threat += this.state.research.ai ? 0.05 : 0.15;

      if (this.state.threat > 100) {
        this.log('Raiders overwhelmed frontier defenses. Threat reset.');
        this.state.threat = 20;
        this.state.credits *= RAID_CREDIT_PENALTY;
      }

      this.updateUI();
      this.refreshActionButtons();
    }

    drawGalaxy() {
      const canvas = document.getElementById('sf-starfield');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!this.stars.length) {
        for (let i = 0; i < 140; i++) {
          this.stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
          });
        }
      }

      for (const star of this.stars) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(star.x, star.y, 2, 2);
      }

      const sectors = this.state.sectors;
      const radius = 7;
      let prev = null;
      for (let s = 0; s < sectors; s++) {
        const x = 40 + (s % 12) * ((canvas.width - 80) / 11);
        const y = 40 + Math.floor(s / 12) * 38 + ((s % 2) ? 10 : 0);
        if (prev) {
          ctx.strokeStyle = 'rgba(80,200,255,0.35)';
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#7ae2ff';
        ctx.fill();
        prev = { x, y };
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('sec-starforge')) return;
    window.starforgeGame = new StarforgeGame();
  });
})();
