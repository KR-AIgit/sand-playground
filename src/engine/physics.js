import { TYPES, ELEMENTS } from './elements';

export class PhysicsEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.nextGrid = new Uint8Array(width * height);
    // 복제 블록이 복제할 타겟을 저장하는 배열
    this.cloneTarget = new Uint8Array(width * height);
    this.sunTimer = 0;
    this.moonTimer = 0;
    this.lightningCooldown = 0;
    this.lightningCheckTimer = 600; // 10 seconds at 60fps
    this.lightningPhase = 0; // 0: none, 1: darkening, 2: brightening
    this.lightningPhaseTimer = 0;
    this.lightningTargetX = -1;
    this.lightningTargetY = -1;
    this.windTimer = 0;
    this.sunCooldown = 0;
    this.moonCooldown = 0;
    this.windCooldown = 0;
    this.toastMessage = null;
    this.rainbowTimer = 0;
    this.isRaining = false;
    this.clear();
  }

  clear() {
    this.grid.fill(TYPES.EMPTY);
    this.nextGrid.fill(TYPES.EMPTY);
    this.cloneTarget.fill(TYPES.EMPTY);
    this.sunTimer = 0;
    this.moonTimer = 0;
    this.windTimer = 0;
    this.sunCooldown = 0;
    this.moonCooldown = 0;
    this.windCooldown = 0;
    this.toastMessage = null;
    this.rainbowTimer = 0;
    this.isRaining = false;
    this.lightningCooldown = 0;
    this.lightningCheckTimer = 600;
    this.lightningPhase = 0;
    this.lightningPhaseTimer = 0;
  }

  getIndex(x, y) {
    return y * this.width + x;
  }

  set(x, y, id) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[this.getIndex(x, y)] = id;
    }
  }

  get(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.grid[this.getIndex(x, y)];
    }
    return TYPES.WALL; // Out of bounds acts like a wall
  }

  canMoveTo(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = this.getIndex(x, y);
    const curr = this.grid[idx];
    const next = this.nextGrid[idx];
    // Can only move to spaces that are CURRENTLY empty/gas AND will REMAIN empty/gas in the next frame
    const isCurrClear = curr === TYPES.EMPTY || (ELEMENTS[curr] && ELEMENTS[curr].type === 'gas');
    const isNextClear = next === TYPES.EMPTY || (ELEMENTS[next] && ELEMENTS[next].type === 'gas');
    return isCurrClear && isNextClear;
  }

  canSwapLiquid(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = this.getIndex(x, y);
    const curr = this.grid[idx];
    const next = this.nextGrid[idx];
    // Powders can swap with liquids
    const isCurrClear = curr === TYPES.EMPTY || (ELEMENTS[curr] && (ELEMENTS[curr].type === 'gas' || ELEMENTS[curr].type === 'liquid'));
    const isNextClear = next === TYPES.EMPTY || (ELEMENTS[next] && (ELEMENTS[next].type === 'gas' || ELEMENTS[next].type === 'liquid'));
    return isCurrClear && isNextClear;
  }

  swap(x1, y1, x2, y2) {
    const id1 = this.get(x1, y1);
    const id2 = this.get(x2, y2);
    this.nextGrid[this.getIndex(x1, y1)] = id2;
    this.nextGrid[this.getIndex(x2, y2)] = id1;
  }

  move(x, y, nx, ny, id) {
    this.nextGrid[this.getIndex(nx, ny)] = id;
    if (this.nextGrid[this.getIndex(x, y)] === id) { // Only clear if we haven't been replaced in nextGrid yet
      this.nextGrid[this.getIndex(x, y)] = TYPES.EMPTY;
    }
  }

  triggerLightning(startX, startY) {
    const branches = Math.floor(Math.random() * 3) + 1; // 1 to 3 branches
    for (let b = 0; b < branches; b++) {
      let x = startX;
      let y = startY;
      while (y < this.height) {
        if (y > startY) {
          this.nextGrid[this.getIndex(x, y)] = TYPES.LIGHTNING;
        }
        y++;
        x += Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        if (x < 0) x = 0;
        if (x >= this.width) x = this.width - 1;
        
        const id = this.get(x, y);
        if (id !== TYPES.EMPTY && id !== TYPES.CLOUD && id !== TYPES.SMOKE && id !== TYPES.GAS && id !== TYPES.FIRE) {
          this.nextGrid[this.getIndex(x, y)] = TYPES.LIGHTNING;
          break;
        }
      }
    }
  }

  update() {
    // Cooldowns
    if (this.sunCooldown > 0) this.sunCooldown--;
    if (this.moonCooldown > 0) this.moonCooldown--;
    if (this.windCooldown > 0) this.windCooldown--;
    if (this.windTimer > 0) this.windTimer--;
    if (this.rainbowTimer > 0) this.rainbowTimer--;
    
    // Copy current grid to nextGrid as baseline
    this.nextGrid.set(this.grid);

    this.isEclipse = false;
    if (this.sunTimer > 0 && this.moonTimer > 0) {
      const sunX = Math.floor(((1200 - this.sunTimer) / 1200) * this.width);
      const moonX = Math.floor((this.moonTimer / 1200) * this.width);
      if (Math.abs(sunX - moonX) < 15) {
        this.isEclipse = true;
      }
    }
    
    const timeSpeed = this.isEclipse ? 0.5 : 1;
    this.isRaining = false;

    // Global Climate Effects
    if (this.sunTimer > 0) {
      this.sunTimer -= timeSpeed;
      for (let i = 0; i < 6; i++) {
        const rx = Math.floor(Math.random() * this.width);
        const ry = Math.floor(Math.random() * this.height);
        const rId = this.get(rx, ry);
        if (rId === TYPES.ICE) this.nextGrid[this.getIndex(rx, ry)] = TYPES.WATER;
        else if (rId === TYPES.WATER) this.nextGrid[this.getIndex(rx, ry)] = TYPES.STEAM;
        else if ((rId === TYPES.PLANT || rId === TYPES.TREE || rId === TYPES.SEED) && Math.random() < 0.5) {
           this.nextGrid[this.getIndex(rx, ry)] = TYPES.SAND;
        }
      }
    }
    if (this.moonTimer > 0) {
      this.moonTimer -= timeSpeed;
      // To keep the conversion rate consistent with half speed, we might only run the loop half the time
      // But 6 checks per frame is already small, we can keep it or use Math.random
      if (Math.random() < timeSpeed) {
        for (let i = 0; i < 6; i++) {
          const rx = Math.floor(Math.random() * this.width);
          const ry = Math.floor(Math.random() * this.height);
          const rId = this.get(rx, ry);
          if (rId === TYPES.WATER) {
             this.nextGrid[this.getIndex(rx, ry)] = TYPES.SNOW;
          } else if (rId === TYPES.SAND) {
             if (ry > 0 && this.get(rx, ry - 1) === TYPES.EMPTY) {
                this.nextGrid[this.getIndex(rx, ry - 1)] = TYPES.ICE;
             }
          }
        }
      }
    }

    // Lightning System
    if (this.lightningCooldown > 0) this.lightningCooldown--;

    if (this.lightningPhase === 1) {
      this.lightningPhaseTimer--;
      if (this.lightningPhaseTimer <= 0) {
        this.triggerLightning(this.lightningTargetX, this.lightningTargetY);
        this.lightningPhase = 2;
        this.lightningPhaseTimer = 300;
        this.lightningCooldown = 3600; // 60 seconds (1 minute at 60fps)
      }
    } else if (this.lightningPhase === 2) {
      this.lightningPhaseTimer--;
      if (this.lightningPhaseTimer <= 0) {
        this.lightningPhase = 0;
      }
    } else if (this.lightningCooldown === 0) {
      this.lightningCheckTimer--;
      if (this.lightningCheckTimer <= 0) {
        this.lightningCheckTimer = 600;
        let mixFound = false;
        let mixX = -1, mixY = -1;
        for (let idx = 0; idx < this.width * this.height; idx++) {
          if (this.grid[idx] === TYPES.CLOUD) {
            const rx = idx % this.width;
            const ry = Math.floor(idx / this.width);
            let localFound = false;
            for(let dx=-1; dx<=1; dx++) {
              for(let dy=-1; dy<=1; dy++) {
                if (this.get(rx+dx, ry+dy) === TYPES.SMOKE) {
                  mixFound = true;
                  mixX = rx;
                  mixY = ry;
                  localFound = true;
                  break;
                }
              }
              if (localFound) break;
            }
          }
          if(mixFound) break;
        }

        if (mixFound && Math.random() < 0.3) {
          this.lightningPhase = 1;
          this.lightningPhaseTimer = 300;
          this.lightningTargetX = mixX;
          this.lightningTargetY = mixY;
        }
      }
    }

    // Iterating bottom to top, randomly left/right
    for (let y = this.height - 1; y >= 0; y--) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const startX = dir === 1 ? 0 : this.width - 1;
      const endX = dir === 1 ? this.width : -1;

      for (let x = startX; x !== endX; x += dir) {
        const idx = this.getIndex(x, y);
        const id = this.grid[idx];
        if (id === TYPES.EMPTY || id === TYPES.WALL) continue;

        // If it already moved in nextGrid, skip it
        if (this.nextGrid[idx] !== id && this.nextGrid[idx] !== TYPES.EMPTY) {
           // It might have been swapped, but let's simplify: 
           // In cellular automata, usually we only process from current grid.
           // However, to prevent double processing, we'd need a separate "processed" array.
           // We will use a simplified approach without it for performance, but things might move twice.
        }

        const el = ELEMENTS[id];
        
        // --- BEHAVIORS ---

        // Energy (Lightning)
        if (el.type === 'energy') {
          if (id === TYPES.LIGHTNING) {
            this.nextGrid[idx] = TYPES.EMPTY;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                  const nid = this.get(nx, ny);
                  if (nid === TYPES.WATER) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.ELECTRIC_WATER;
                  } else if (nid === TYPES.SAND) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.EMPTY;
                  } else if (nid === TYPES.PLANT || nid === TYPES.TREE || nid === TYPES.SEED || nid === TYPES.WOOD) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.FIRE;
                  }
                }
              }
            }
          }
        }

        // Powder (Sand, Seed)
        else if (el.type === 'powder') {
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1);
          } else {
            const canGoLeft = this.canSwapLiquid(x - 1, y + 1);
            const canGoRight = this.canSwapLiquid(x + 1, y + 1);
            
            if (canGoLeft && canGoRight) {
              if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
              else this.swap(x, y, x + 1, y + 1);
            } else if (canGoLeft) {
              this.swap(x, y, x - 1, y + 1);
            } else if (canGoRight) {
              this.swap(x, y, x + 1, y + 1);
            }
          }
        }

        // Snow (drifting slowly downwards)
        else if (id === TYPES.SNOW) {
          // Melting logic
          if (this.moonTimer === 0) {
             const meltChance = this.sunTimer > 0 ? 0.0004 : 0.0002;
             if (Math.random() < meltChance) {
                this.nextGrid[idx] = TYPES.WATER;
                continue;
             }
          }

          if (Math.random() < 0.3) {
            if (this.canSwapLiquid(x, y + 1)) {
              this.swap(x, y, x, y + 1);
            } else {
              const canGoLeft = this.canSwapLiquid(x - 1, y + 1);
              const canGoRight = this.canSwapLiquid(x + 1, y + 1);
              if (canGoLeft && canGoRight) {
                if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
                else this.swap(x, y, x + 1, y + 1);
              } else if (canGoLeft) {
                this.swap(x, y, x - 1, y + 1);
              } else if (canGoRight) {
                this.swap(x, y, x + 1, y + 1);
              }
            }
          }
          if (Math.random() < 0.1) {
            const dx = Math.random() < 0.5 ? -1 : 1;
            if (this.canMoveTo(x + dx, y)) {
              this.swap(x, y, x + dx, y);
            }
          }
        }

        // Falling Solid (drops straight down only)
        else if (el.type === 'falling_solid') {
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1);
          }
        }

        // Liquid (Water, Lava, Acid)
        else if (el.type === 'liquid') {
          if (id === TYPES.WATER && this.moonTimer > 0) {
             if (this.canMoveTo(x, y + 1) || this.canMoveTo(x - 1, y + 1) || this.canMoveTo(x + 1, y + 1)) {
                this.nextGrid[idx] = TYPES.SNOW;
                continue;
             }
          }

          if (id === TYPES.ELECTRIC_WATER && Math.random() < 0.05) {
             this.nextGrid[idx] = TYPES.WATER;
          }
          if (this.canMoveTo(x, y + 1)) {
            this.swap(x, y, x, y + 1);
          } else {
            const canGoLeft = this.canMoveTo(x - 1, y + 1);
            const canGoRight = this.canMoveTo(x + 1, y + 1);
            
            if (canGoLeft && canGoRight) {
              if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
              else this.swap(x, y, x + 1, y + 1);
            } else if (canGoLeft) {
              this.swap(x, y, x - 1, y + 1);
            } else if (canGoRight) {
              this.swap(x, y, x + 1, y + 1);
            } else {
              // spread horizontally further (water pooling effect)
              const maxSpread = 5;
              let canL = true;
              let canR = true;
              let targetX = x;

              let lx = x;
              for (let i = 1; i <= maxSpread; i++) {
                if (canL && this.canMoveTo(x - i, y)) {
                  lx = x - i;
                  if (this.canMoveTo(lx, y + 1)) break; // Found a drop
                } else canL = false;
              }

              let rx = x;
              for (let i = 1; i <= maxSpread; i++) {
                if (canR && this.canMoveTo(x + i, y)) {
                  rx = x + i;
                  if (this.canMoveTo(rx, y + 1)) break; // Found a drop
                } else canR = false;
              }

              const distL = x - lx;
              const distR = rx - x;
              if (distL > 0 && distR > 0) targetX = (Math.random() < 0.5) ? lx : rx;
              else if (distL > 0) targetX = lx;
              else if (distR > 0) targetX = rx;
              
              if (targetX !== x) this.swap(x, y, targetX, y);
            }
          }

          // Lava interactions
          if (id === TYPES.LAVA) {
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.WATER) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.STONE;
                  if (Math.random() < 0.5) this.nextGrid[idx] = TYPES.STONE;
                  if (y > 0 && this.get(x, y - 1) === TYPES.EMPTY) {
                     this.nextGrid[this.getIndex(x, y - 1)] = TYPES.STEAM;
                  }
                  if (this.toastMessage === null && !this.lavaToastShown) {
                     this.toastMessage = "앗 뜨거워! 펄펄 끓는 용암이 차가운 물을 만나면 굳어서 단단한 돌이 된답니다!";
                     this.lavaToastShown = true;
                  }
                } else if (neighbor === TYPES.ICE) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.WATER;
                } else if (ELEMENTS[neighbor] && ELEMENTS[neighbor].flammable) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.FIRE;
                }
              }
            }
          }

          // Acid interactions
          if (id === TYPES.ACID) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.WALL && neighbor !== TYPES.ACID) {
                  if (Math.random() < 0.1) {
                    this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.EMPTY;
                    if (Math.random() < 0.5) this.nextGrid[idx] = TYPES.EMPTY; // Acid gets consumed
                  }
                }
              }
            }
          }
        }

        // Gas (Fire, Smoke, Gas)
        else if (el.type === 'gas') {
          // Gas moves randomly up
          let moved = false;
          if (Math.random() < 0.6) {
             const upId = this.get(x, y - 1);
             if (this.canMoveTo(x, y - 1) || (this.canSwapLiquid(x, y - 1) && upId !== TYPES.LAVA && ELEMENTS[upId] && ELEMENTS[upId].type === 'liquid')) {
                this.swap(x, y, x, y - 1);
                moved = true;
             }
          }
          if (!moved) {
             const dx = (Math.random() < 0.5 ? -1 : 1);
             if (this.canMoveTo(x + dx, y)) {
               this.swap(x, y, x + dx, y);
             } else if (this.canMoveTo(x - dx, y)) {
               this.swap(x, y, x - dx, y);
             }
          }

          if (id === TYPES.FIRE) {
             // Burn things
             let burned = false;
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                const nEl = ELEMENTS[neighbor];
                if (nEl && nEl.flammable && Math.random() < nEl.flammable) {
                  if (neighbor === TYPES.GAS) {
                     this.explode(x + dx, y + dy, 3, TYPES.FIRE); // Gas explodes in a chain reaction!
                  } else {
                     this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.FIRE;
                  }
                  burned = true;
                }
                if (neighbor === TYPES.ICE && Math.random() < 0.2) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.WATER;
                }
                if (neighbor === TYPES.FIREWORK) {
                   // Ignite firework!
                   this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.FIREWORK_ACTIVE;
                }
              }
            }
            if (Math.random() < 0.1) {
              this.nextGrid[idx] = TYPES.SMOKE; // Fire dies to smoke
            }
          }
          
          if (id === TYPES.SMOKE) {
             if (Math.random() < 0.003) {
                this.nextGrid[idx] = TYPES.EMPTY; // dissipate much slower
             }
          }
          if (id === TYPES.STEAM) {
             if (y < 15) {
                if (Math.random() < 0.05) {
                   this.nextGrid[idx] = TYPES.CLOUD;
                   if (this.toastMessage === null && !this.waterCycleToastShown) {
                      this.toastMessage = "햇빛을 받은 물이 뜨거워져서 수증기로 변해 하늘로 올라가 구름이 되었어요!";
                      this.waterCycleToastShown = true;
                   }
                }
             } else if (Math.random() < 0.01) {
                this.nextGrid[idx] = TYPES.EMPTY;
             }
          }
          if (id === TYPES.CLOUD) {
             // 확률적으로 주변 밀도를 검사하여 비를 내리게 함
             if (Math.random() < 0.01) {
               let cloudCount = 0;
               const checkRadius = 5;
               for (let cy = y - checkRadius; cy <= y + checkRadius; cy++) {
                 for (let cx = x - checkRadius; cx <= x + checkRadius; cx++) {
                   if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
                     if (this.grid[this.getIndex(cx, cy)] === TYPES.CLOUD) cloudCount++;
                   }
                 }
               }
               // 해(반지름 7.5) 크기 이상으로 밀도가 높아지면 (약 80픽셀 이상)
               if (cloudCount > 80) {
                 this.nextGrid[idx] = TYPES.WATER; // 구름이 물(비)로 변환
                 if (this.canMoveTo(x, y + 1)) {
                    this.nextGrid[this.getIndex(x, y + 1)] = TYPES.WATER; // 물방울을 추가 생성하여 비를 무겁게 만듦
                 }
               }
             }
          }
        }

        // Spark
        else if (el.type === 'spark') {
           // Disappear after a short time (e.g. ~1-2 seconds)
           if (Math.random() < 0.015) {
              this.nextGrid[idx] = TYPES.EMPTY;
           }
        }

        // Bug (Ant)
        else if (el.type === 'bug') {
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1); // Fall
          } else {
            // Digging behavior: if touching sand, chance to dig
            let digged = false;
            if (Math.random() < 0.1) {
              const digDirs = [{dx:0,dy:1}, {dx:-1,dy:1}, {dx:1,dy:1}, {dx:-1,dy:0}, {dx:1,dy:0}, {dx:0,dy:-1}];
              const dir = digDirs[Math.floor(Math.random() * digDirs.length)];
              const targetIdx = this.getIndex(x + dir.dx, y + dir.dy);
              if (this.grid[targetIdx] === TYPES.SAND && this.nextGrid[targetIdx] === TYPES.SAND) {
                 this.nextGrid[targetIdx] = TYPES.EMPTY;
                 this.swap(x, y, x + dir.dx, y + dir.dy);
                 digged = true;
              }
            }
            if (!digged) {
               // Normal walking
               const dx = Math.random() < 0.5 ? -1 : 1;
               if (this.canMoveTo(x + dx, y) && !this.canMoveTo(x + dx, y + 1)) {
                 this.swap(x, y, x + dx, y);
               } else if (this.canMoveTo(x + dx, y - 1)) {
                 this.swap(x, y, x + dx, y - 1); // Climb
               }
            }
          }
        }

        // Biological Growth (Seed, Plant)
        if (id === TYPES.SEED || id === TYPES.PLANT) {
          let touchedWater = false;
          let waterX = -1, waterY = -1;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (this.get(x + dx, y + dy) === TYPES.WATER) {
                touchedWater = true;
                waterX = x + dx;
                waterY = y + dy;
              }
            }
          }

          if (touchedWater) {
            // 물 흡수 속도 1/2로 감소 (기존 0.2 -> 0.1)
            if (Math.random() < 0.1) {
              this.nextGrid[this.getIndex(waterX, waterY)] = TYPES.EMPTY;
            }
            
            // 씨앗이 새싹으로 변하는 속도 대폭 감소 (천천히 올라옴)
            if (id === TYPES.SEED) {
              if (Math.random() < 0.05) {
                this.nextGrid[idx] = TYPES.PLANT;
              }
            }
            
            // 새싹 성장 속도 1/2로 감소 (기존 0.2 -> 0.1)
            if (id === TYPES.PLANT && Math.random() < 0.1) {
              const growDirs = [
                {dx: 0, dy: -1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}
              ];
              const dir = growDirs[Math.floor(Math.random() * growDirs.length)];
              const target = this.get(x + dir.dx, y + dir.dy);
              if (target === TYPES.EMPTY) {
                 // 자라날 때 10% 확률로 알록달록한 꽃 피우기
                 if (Math.random() < 0.1) {
                   const flowers = [TYPES.FLOWER_1, TYPES.FLOWER_2, TYPES.FLOWER_3];
                   this.nextGrid[this.getIndex(x + dir.dx, y + dir.dy)] = flowers[Math.floor(Math.random() * flowers.length)];
                 } else {
                   this.nextGrid[this.getIndex(x + dir.dx, y + dir.dy)] = TYPES.PLANT;
                 }
              }
            }
          }
        }

        if (id === TYPES.PLANT || id === TYPES.TREE) {
           if (this.windTimer > 0 && Math.random() < 0.02) {
              if (this.canSwapLiquid(x, y+1) || Math.random() < 0.1) {
                 this.nextGrid[idx] = TYPES.LEAF_AUTUMN;
                 if (this.toastMessage === null && !this.autumnToastShown) {
                    this.toastMessage = "가을이 오면 나뭇잎이 예쁘게 물들고, 겨울을 준비하기 위해 땅으로 떨어져요!";
                    this.autumnToastShown = true;
                 }
              }
           }
        }

        // Tree Growth
        if (id === TYPES.TREE) {
          let touchedWater = false;
          let waterX = -1, waterY = -1;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (this.get(x + dx, y + dy) === TYPES.WATER) {
                touchedWater = true;
                waterX = x + dx;
                waterY = y + dy;
              }
            }
          }

          if (touchedWater) {
            // 물 흡수 속도 감소 (기존 0.3 -> 0.15)
            if (Math.random() < 0.15) {
              this.nextGrid[this.getIndex(waterX, waterY)] = TYPES.EMPTY;
            }
            // 성장 확률 감소 (기존 0.4 -> 0.2)
            if (Math.random() < 0.2) {
              // 위로 자라며 기둥을 남김 (20% 확률)
              if (Math.random() < 0.2 && this.get(x, y - 1) === TYPES.EMPTY) {
                this.nextGrid[idx] = TYPES.WOOD;
                this.nextGrid[this.getIndex(x, y - 1)] = TYPES.TREE;
              } else {
                // 옆으로 잎사귀 뻗기
                const growDirs = [
                  {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 0}, {dx: 1, dy: 0},
                  {dx: -1, dy: -2}, {dx: 1, dy: -2}
                ];
                for(let i=0; i<2; i++) {
                  const dir = growDirs[Math.floor(Math.random() * growDirs.length)];
                  const target = this.get(x + dir.dx, y + dir.dy);
                  if (target === TYPES.EMPTY) {
                    this.nextGrid[this.getIndex(x + dir.dx, y + dir.dy)] = TYPES.TREE;
                  }
                }
              }
            }
          } else {
             // 물에 닿지 않은 잎사귀들은 시간이 지나면 서서히 벚꽃으로 변함
             if (Math.random() < 0.002) {
                this.nextGrid[idx] = TYPES.FLOWER_PINK;
             }
          }
        }

        // Clone
        if (id === TYPES.CLONE) {
          const currentTarget = this.cloneTarget[idx];
          if (currentTarget === TYPES.EMPTY) {
            // Find a target to clone
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.CLONE && neighbor !== TYPES.WALL) {
                  this.cloneTarget[idx] = neighbor;
                  break;
                }
              }
            }
          } else {
            // Clone the target around it
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.EMPTY) {
                   if (Math.random() < 0.2) {
                     this.nextGrid[this.getIndex(x + dx, y + dy)] = currentTarget;
                   }
                }
              }
             }
          }
        }

        // FIREWORK_ACTIVE: Ascends rapidly
        if (id === TYPES.FIREWORK_ACTIVE) {
          // Move up by 1 or 2 pixels
          const dy = Math.random() < 0.5 ? -1 : -2;
          if (this.canMoveTo(x, y + dy)) {
            this.swap(x, y, x, y + dy);
            // Leave smoke or fire trail
            if (Math.random() < 0.6) {
              this.nextGrid[this.getIndex(x, y)] = Math.random() < 0.5 ? TYPES.FIRE : TYPES.SMOKE;
            }
          } else {
            // Hit something, explode early
            this.explodeFirework(x, y);
          }
          // Explode at top 1/3 of the screen
          if (y < this.height / 3 && Math.random() < 0.1) {
             this.explodeFirework(x, y);
          }
        }

        // Sparks: fall slowly and disappear
        if (id === TYPES.SPARK_YELLOW || id === TYPES.SPARK_PINK || id === TYPES.SPARK_BLUE || id === TYPES.SPARK_GREEN) {
           if (Math.random() < 0.05) {
              this.nextGrid[idx] = TYPES.EMPTY; // Disappear
           } else {
              // Fall like snow
              if (Math.random() < 0.5) {
                if (this.canSwapLiquid(x, y + 1)) {
                  this.swap(x, y, x, y + 1);
                } else {
                  const dx = Math.random() < 0.5 ? -1 : 1;
                  if (this.canSwapLiquid(x + dx, y + 1)) {
                    this.swap(x, y, x + dx, y + 1);
                  }
                }
              }
           }
        }
        if (id === TYPES.CLONE) {
          const currentTarget = this.cloneTarget[idx];
          if (currentTarget === TYPES.EMPTY) {
            // Find a target to clone
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.CLONE && neighbor !== TYPES.WALL) {
                  this.cloneTarget[idx] = neighbor;
                  break;
                }
              }
            }
          } else {
            // Clone the target around it
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.EMPTY) {
                   if (Math.random() < 0.2) {
                     this.nextGrid[this.getIndex(x + dx, y + dy)] = currentTarget;
                   }
                }
              }
             }
          }
        }
      }
    }

    // Apply nextGrid back to grid
    this.grid.set(this.nextGrid);

    // Rainbow logic
    if (this.sunTimer > 0 && this.isRaining) {
      this.rainbowTimer = 300;
      if (this.toastMessage === null && !this.rainbowToastShown) {
         this.toastMessage = "비가 올 때 햇빛이 비치면, 물방울이 빛을 꺾어 예쁜 무지개를 만들어요!";
         this.rainbowToastShown = true;
      }
    }
  }

  explode(cx, cy, radius, type) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx*dx + dy*dy <= radius*radius) {
            const current = this.get(x, y);
            if (current !== TYPES.WALL) {
               if (Math.random() < 0.8) {
                 this.nextGrid[this.getIndex(x, y)] = type;
               } else {
                 this.nextGrid[this.getIndex(x, y)] = TYPES.EMPTY;
               }
            }
          }
        }
      }
    }
  }

  explodeFirework(cx, cy) {
    // 1. Base Explosion (Red/Orange Fire)
    this.nextGrid[this.getIndex(cx, cy)] = TYPES.EMPTY; // Remove the active firework
    this.explode(cx, cy, 3, TYPES.FIRE);
    
    // 2. Spread 5-8 branches of fire
    const branches = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < branches; i++) {
       const angle = (Math.PI * 2 / branches) * i;
       const dist = 5 + Math.random() * 10;
       const bx = Math.floor(cx + Math.cos(angle) * dist);
       const by = Math.floor(cy + Math.sin(angle) * dist);
       if (bx >= 0 && bx < this.width && by >= 0 && by < this.height) {
          this.explode(bx, by, 2, TYPES.FIRE);
       }
    }

    // 3. Pattern (Flower, Heart, Spaceship, Rabbit)
    const patterns = [
      // 0: Yellow Flower
      { type: TYPES.SPARK_YELLOW, points: [[0,0], [0,-2], [0,-3], [-1,-1], [-2,0], [-3,0], [-1,1], [0,2], [0,3], [1,1], [2,0], [3,0]] },
      // 1: Pink Heart
      { type: TYPES.SPARK_PINK, points: [[0,3], [-1,2], [-2,1], [-3,0], [-3,-1], [-2,-2], [-1,-2], [0,-1], [1,-2], [2,-2], [3,-1], [3,0], [2,1], [1,2]] },
      // 2: Blue Spaceship
      { type: TYPES.SPARK_BLUE, points: [[0,-3], [-1,-1], [1,-1], [-2,1], [2,1], [-3,2], [3,2], [-1,3], [1,3], [0,0]] },
      // 3: Green Rabbit
      { type: TYPES.SPARK_GREEN, points: [[-1,-3], [-1,-2], [1,-3], [1,-2], [0,-1], [-2,0], [2,0], [-2,1], [2,1], [-1,2], [0,2], [1,2]] }
    ];

    const selected = patterns[Math.floor(Math.random() * patterns.length)];
    const scale = 2; // Scale up the pattern
    
    for (const [px, py] of selected.points) {
       const targetX = cx + (px * scale);
       const targetY = cy + (py * scale);
       if (targetX >= 0 && targetX < this.width && targetY >= 0 && targetY < this.height) {
          // Fill a small 2x2 or 3x3 box for each point so it's visible
          for(let dy = -1; dy <= 1; dy++) {
             for(let dx = -1; dx <= 1; dx++) {
                if (Math.random() < 0.8) {
                   const finalX = targetX + dx;
                   const finalY = targetY + dy;
                   if (finalX >= 0 && finalX < this.width && finalY >= 0 && finalY < this.height && this.get(finalX, finalY) !== TYPES.WALL) {
                      this.nextGrid[this.getIndex(finalX, finalY)] = selected.type;
                   }
                }
             }
          }
       }
    }
  }

  render(ctx, imageData) {
    const data = imageData.data;
    for (let i = 0; i < this.grid.length; i++) {
      const id = this.grid[i];
      const color = ELEMENTS[id].color;
      const idx = i * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = id === TYPES.EMPTY ? 0 : 255;
    }
    ctx.putImageData(imageData, 0, 0);

    if (this.rainbowTimer > 0) {
      const cx = this.width / 2;
      const cy = this.height / 2 + 50;
      const maxRadius = this.width / 2 - 20;
      const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
      
      ctx.save();
      ctx.globalAlpha = (this.rainbowTimer > 60 ? 1 : this.rainbowTimer / 60) * 0.5;
      for (let i = 0; i < colors.length; i++) {
         ctx.beginPath();
         ctx.arc(cx, cy, maxRadius - i * 5, Math.PI, 0);
         ctx.lineWidth = 5;
         ctx.strokeStyle = colors[i];
         ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Sun and Moon as UI overlays directly on the canvas
    const drawCelestial = (timer, color, isSun) => {
      const p = isSun ? (1200 - timer) / 1200 : timer / 1200; // 0.0 to 1.0
      const startX = 0;
      const endX = this.width;
      const highestY = this.height / 6;
      const startY = this.height / 2;
      
      const cx = startX + p * (endX - startX);
      const cy = highestY + 4 * (startY - highestY) * (p - 0.5) * (p - 0.5);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
      ctx.fill();
    };

    if (this.sunTimer > 0) {
      drawCelestial(this.sunTimer, '#ffdc32', true);
    }
    if (this.moonTimer > 0) {
      drawCelestial(this.moonTimer, '#c8c8ff', false);
    }
  }
}
